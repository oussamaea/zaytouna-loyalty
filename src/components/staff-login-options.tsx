"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginMethod = "password" | "code";

function readableAuthError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to sign in. Please try again.";
}

export function StaffLoginOptions() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>("password");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signingInRef = useRef(false);

  async function submitPassword(formData: FormData) {
    if (signingInRef.current) {
      return;
    }

    signingInRef.current = true;
    setIsSigningIn(true);
    setError("");
    setStatus("Signing in...");

    try {
      const supabase = createSupabaseBrowserClient();
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setStatus("");
        setError(readableAuthError(signInError));
        signingInRef.current = false;
        setIsSigningIn(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      const userId = user?.id ?? data.user?.id;
      if (!userId) {
        await supabase.auth.signOut();
        setStatus("");
        setError(
          userError
            ? readableAuthError(userError)
            : "Unable to confirm this staff session. Please try again.",
        );
        signingInRef.current = false;
        setIsSigningIn(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle<{ role: string }>();

      if (profileError) {
        await supabase.auth.signOut();
        setStatus("");
        setError(readableAuthError(profileError));
        signingInRef.current = false;
        setIsSigningIn(false);
        return;
      }

      if (profile?.role !== "staff" && profile?.role !== "admin") {
        await supabase.auth.signOut();
        setStatus("");
        setError("This account is not authorized for staff access.");
        signingInRef.current = false;
        setIsSigningIn(false);
        return;
      }

      setStatus("Opening staff dashboard...");
      router.replace("/staff/dashboard");
    } catch {
      setStatus("");
      setError("Network failure. Please check your connection and try again.");
      signingInRef.current = false;
      setIsSigningIn(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-2 gap-2 rounded-sm bg-[#ece2d3] p-1"
        role="tablist"
        aria-label="Staff sign-in method"
      >
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          onClick={() => {
            setMethod("password");
            setError("");
            setStatus("");
          }}
          disabled={isSigningIn}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-black focus-visible:outline-2 ${
            method === "password"
              ? "bg-[#24301f] text-white"
              : "text-[#24301f] hover:bg-[#fffaf2]"
          }`}
        >
          <LockKeyhole aria-hidden className="size-4" />
          Sign in with password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "code"}
          onClick={() => {
            setMethod("code");
            setError("");
            setStatus("");
          }}
          disabled={isSigningIn}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-black focus-visible:outline-2 ${
            method === "code"
              ? "bg-[#24301f] text-white"
              : "text-[#24301f] hover:bg-[#fffaf2]"
          }`}
        >
          <Mail aria-hidden className="size-4" />
          Send email code
        </button>
      </div>

      {method === "password" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitPassword(new FormData(event.currentTarget));
          }}
          className="space-y-4"
          aria-describedby="staff-password-status"
        >
          <label className="block text-sm font-bold">
            Staff email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-sm border border-[#9ca57b] bg-white px-3 py-3"
            />
          </label>
          <label className="block text-sm font-bold">
            Password
            <span className="mt-1 flex items-center rounded-sm border border-[#9ca57b] bg-white">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="w-full bg-transparent px-3 py-3"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex min-h-12 items-center justify-center px-3 text-[#24301f] hover:bg-[#ece2d3] focus-visible:outline-2"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={isSigningIn}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-[#24301f] px-5 py-3 font-bold text-white hover:bg-[#4c5a2d] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2"
          >
            {isSigningIn ? "Signing in..." : "Sign in with password"}
          </button>
          <p
            id="staff-password-status"
            aria-live="polite"
            className="min-h-6 text-sm font-semibold"
          >
            {status}
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-sm border border-[#a44530] bg-white p-3 text-sm font-semibold text-[#a44530]"
            >
              {error}
            </p>
          )}
        </form>
      ) : (
        <AuthForm mode="staff" />
      )}
    </div>
  );
}
