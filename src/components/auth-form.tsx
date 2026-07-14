"use client";

import { useEffect, useState } from "react";
import { KeyRound, Mail, UserRound } from "lucide-react";

type Mode = "join" | "login" | "staff";
type AuthResponse = {
  ok?: boolean;
  error?: unknown;
  redirectTo?: unknown;
};
type PendingRequest = {
  endpoint: "/api/auth/signup" | "/api/auth/login";
  body: Record<string, unknown>;
  email: string;
  next: "/card" | "/staff/dashboard";
};

const RESEND_COOLDOWN_SECONDS = 30;

function readableClientError(error: unknown) {
  return typeof error === "string" && error.trim()
    ? error
    : "Something went wrong.";
}

function normalizeOtpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function AuthForm({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(
    null,
  );
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function sendCode(request: PendingRequest, isResend = false) {
    setError("");
    setStatus(isResend ? "Sending another code..." : "Sending code...");

    let response: Response;
    let payload: AuthResponse;

    try {
      response = await fetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      payload = (await response.json()) as AuthResponse;
    } catch {
      setStatus("");
      setError("Network error. Please check your connection and try again.");
      return;
    }

    if (!response.ok) {
      setStatus("");
      setError(readableClientError(payload.error));
      return;
    }

    setPendingRequest(request);
    setStep("code");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setStatus(
      isResend
        ? "A new 8-digit code was sent."
        : "Check your email for an 8-digit code.",
    );
  }

  async function submitEmail(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const next = mode === "staff" ? "/staff/dashboard" : "/card";
    const body =
      mode === "join"
        ? {
            firstName: String(formData.get("firstName") ?? ""),
            lastName: String(formData.get("lastName") ?? ""),
            email,
            birthday: String(formData.get("birthday") ?? ""),
            acceptedTerms: formData.get("acceptedTerms") === "on",
          }
        : {
            email,
            allowSignup: false,
          };

    const endpoint = mode === "join" ? "/api/auth/signup" : "/api/auth/login";
    await sendCode({ endpoint, body, email, next });
  }

  async function submitCode() {
    if (!pendingRequest) {
      setError("Please request a code first.");
      return;
    }

    setError("");
    setStatus("Verifying code...");

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingRequest.email,
          token: otpCode,
          next: pendingRequest.next,
        }),
      });
      const payload = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setStatus("");
        setError(readableClientError(payload.error));
        return;
      }

      const redirectTo =
        typeof payload.redirectTo === "string"
          ? payload.redirectTo
          : pendingRequest.next;
      setStatus("Code verified. Opening your loyalty page...");
      window.location.assign(redirectTo);
    } catch {
      setStatus("");
      setError("Network error. Please check your connection and try again.");
    }
  }

  function renderStatus() {
    return (
      <p
        id="auth-status"
        aria-live="polite"
        className="min-h-6 text-sm font-semibold"
      >
        {status}
      </p>
    );
  }

  if (step === "code" && pendingRequest) {
    return (
      <form
        action={submitCode}
        className="space-y-4"
        aria-describedby="auth-status"
      >
        <div className="rounded-sm border border-[#cfc2ad] bg-white p-3 text-sm">
          <p className="font-bold">Code sent to</p>
          <p>{pendingRequest.email}</p>
        </div>
        <label className="block text-sm font-bold">
          Enter the 8-digit code
          <span className="mt-1 flex items-center gap-2 rounded-sm border border-[#9ca57b] bg-white px-3 py-3">
            <KeyRound aria-hidden className="size-4 text-[#4c5a2d]" />
            <input
              name="otpCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              required
              value={otpCode}
              onChange={(event) =>
                setOtpCode(normalizeOtpInput(event.currentTarget.value))
              }
              onPaste={(event) => {
                event.preventDefault();
                setOtpCode(
                  normalizeOtpInput(event.clipboardData.getData("text")),
                );
              }}
              placeholder="12345678"
              className="w-full bg-transparent tracking-[0.35em]"
              autoComplete="one-time-code"
              aria-label="Eight-digit verification code"
            />
          </span>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-[#24301f] px-5 py-3 font-bold text-white hover:bg-[#4c5a2d] focus-visible:outline-2"
        >
          Verify code
        </button>
        <button
          type="button"
          disabled={resendCooldown > 0}
          onClick={() => sendCode(pendingRequest, true)}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-[#59623d] px-5 py-3 font-bold text-[#24301f] hover:bg-[#ece2d3] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2"
        >
          {resendCooldown > 0
            ? `Send another code in ${resendCooldown}s`
            : "Send another code"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setStatus("");
            setError("");
            setOtpCode("");
          }}
          className="text-sm font-bold underline"
        >
          Use a different email
        </button>
        {renderStatus()}
        {error && (
          <p
            role="alert"
            className="rounded-sm border border-[#a44530] bg-white p-3 text-sm font-semibold text-[#a44530]"
          >
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form
      action={submitEmail}
      className="space-y-4"
      aria-describedby="auth-status"
    >
      {mode === "join" && (
        <>
          <label className="block text-sm font-bold">
            First name
            <span className="mt-1 flex items-center gap-2 rounded-sm border border-[#9ca57b] bg-white px-3 py-3">
              <UserRound aria-hidden className="size-4 text-[#4c5a2d]" />
              <input
                name="firstName"
                required
                className="w-full bg-transparent"
                autoComplete="given-name"
              />
            </span>
          </label>
          <label className="block text-sm font-bold">
            Last name optional
            <input
              name="lastName"
              className="mt-1 w-full rounded-sm border border-[#9ca57b] bg-white px-3 py-3"
              autoComplete="family-name"
            />
          </label>
          <label className="block text-sm font-bold">
            Birthday optional
            <input
              name="birthday"
              type="date"
              className="mt-1 w-full rounded-sm border border-[#9ca57b] bg-white px-3 py-3"
            />
          </label>
        </>
      )}
      <label className="block text-sm font-bold">
        Email
        <span className="mt-1 flex items-center gap-2 rounded-sm border border-[#9ca57b] bg-white px-3 py-3">
          <Mail aria-hidden className="size-4 text-[#4c5a2d]" />
          <input
            name="email"
            type="email"
            required
            className="w-full bg-transparent"
            autoComplete="email"
          />
        </span>
      </label>
      {mode === "join" && (
        <label className="flex gap-3 text-sm">
          <input
            name="acceptedTerms"
            type="checkbox"
            required
            className="mt-1"
          />
          <span>
            I accept the Zaytouna loyalty terms and understand staff approval is
            required for stamps and rewards.
          </span>
        </label>
      )}
      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-[#24301f] px-5 py-3 font-bold text-white hover:bg-[#4c5a2d] focus-visible:outline-2"
      >
        Send code
      </button>
      {renderStatus()}
      {error && (
        <p
          role="alert"
          className="rounded-sm border border-[#a44530] bg-white p-3 text-sm font-semibold text-[#a44530]"
        >
          {error}
        </p>
      )}
    </form>
  );
}
