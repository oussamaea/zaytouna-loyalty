"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, LoaderCircle, Search, UserRound } from "lucide-react";
import type { CustomerLoyaltyView } from "@/lib/types";

export function StaffDashboard() {
  const [memberCode, setMemberCode] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [customer, setCustomer] = useState<CustomerLoyaltyView | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<unknown> } | null>(null);

  async function lookup(source: "code" | "qr") {
    setError("");
    setStatus("Looking up customer...");
    const params = new URLSearchParams();
    if (source === "code") {
      params.set("memberCode", memberCode);
    } else {
      params.set("qrPayload", qrPayload);
    }

    const response = await fetch(`/api/staff/lookup?${params.toString()}`);
    const data = (await response.json()) as {
      customer?: CustomerLoyaltyView;
      error?: string;
    };

    if (!response.ok || !data.customer) {
      setStatus("");
      setError(data.error ?? "Customer not found.");
      return;
    }

    setCustomer(data.customer);
    setStatus(`Loaded ${data.customer.profile.first_name}.`);
  }

  async function startScanner() {
    setError("");
    setStatus("Starting camera...");
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          setQrPayload(decodedText);
          setStatus("QR code scanned.");
          await scanner.stop();
          setScanning(false);
          const params = new URLSearchParams({ qrPayload: decodedText });
          const response = await fetch(`/api/staff/lookup?${params.toString()}`);
          const data = (await response.json()) as {
            customer?: CustomerLoyaltyView;
            error?: string;
          };
          if (data.customer) {
            setCustomer(data.customer);
            setStatus(`Loaded ${data.customer.profile.first_name}.`);
          } else {
            setError(data.error ?? "QR code was not valid.");
          }
        },
        () => undefined,
      );
    } catch {
      setScanning(false);
      setError(
        "Camera permission was denied or this browser does not support camera scanning. Use manual lookup instead.",
      );
      setStatus("");
    }
  }

  async function stopScanner() {
    await scannerRef.current?.stop();
    setScanning(false);
    setStatus("Camera stopped.");
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
        <h1 className="font-display text-4xl">Staff Loyalty Dashboard</h1>
        <p className="mt-2 text-sm leading-6">
          Scan a customer QR code or use the member code fallback. All changes
          are confirmed here and executed on the server.
        </p>

        <div className="mt-5 space-y-3">
          <div
            id="qr-reader"
            className="min-h-64 overflow-hidden rounded-sm bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={scanning ? stopScanner : startScanner}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-[#24301f] px-4 font-bold text-white"
            >
              <Camera aria-hidden className="size-5" />
              {scanning ? "Stop camera" : "Start camera"}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-bold">
            Member code
            <input
              value={memberCode}
              onChange={(event) => setMemberCode(event.target.value)}
              className="mt-1 w-full rounded-sm border border-[#9ca57b] bg-white px-3 py-3 uppercase"
              placeholder="ZB-ABC123"
            />
          </label>
          <button
            type="button"
            onClick={() => lookup("code")}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-[#24301f] bg-white px-4 font-bold"
          >
            <Search aria-hidden className="size-5" />
            Look up member
          </button>
        </div>

        <p aria-live="polite" className="mt-4 min-h-6 text-sm font-bold">
          {status}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-sm border border-[#a44530] bg-white p-3 text-sm font-bold text-[#a44530]"
          >
            {error}
          </p>
        )}
      </section>

      <section className="rounded-sm border border-[#cfc2ad] bg-white p-5">
        {customer ? (
          <CustomerLookupResult customer={customer} />
        ) : (
          <div className="grid min-h-96 place-items-center text-center">
            <div>
              <LoaderCircle
                aria-hidden
                className="mx-auto size-9 text-[#4c5a2d]"
              />
              <h2 className="mt-4 font-display text-3xl">No customer loaded</h2>
              <p className="mt-2 text-sm text-[#59623d]">
                Scan a QR code or search by member code.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerLookupResult({ customer }: { customer: CustomerLoyaltyView }) {
  const { profile, account } = customer;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-3xl">
          <UserRound aria-hidden className="size-6" />
          Customer result
        </h2>
      </div>
      <div className="rounded-sm border border-[#e1d6c6] bg-[#fffaf2] p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#59623d]">
          {profile.loyalty_member_code}
        </p>
        <h3 className="mt-1 font-display text-4xl">{profile.first_name}</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-black">Current stamps</dt>
            <dd>{account.current_stamps} of 10</dd>
          </div>
          <div>
            <dt className="font-black">10% reward</dt>
            <dd>{account.fifth_reward_status}</dd>
          </div>
          <div>
            <dt className="font-black">50% reward</dt>
            <dd>{account.tenth_reward_status}</dd>
          </div>
        </dl>
      </div>
      <Link
        href={`/staff/customer/${profile.id}`}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-[#24301f] px-5 py-3 text-center font-bold text-white hover:bg-[#4c5a2d] focus-visible:outline-2"
      >
        Open customer loyalty details
      </Link>
    </div>
  );
}
