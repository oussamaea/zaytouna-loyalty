"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCcw } from "lucide-react";

export function QrPanel() {
  const [payload, setPayload] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState("Preparing secure QR code...");

  async function refresh() {
    setStatus("Refreshing secure QR code...");
    const response = await fetch("/api/qr-token", { method: "POST" });
    const data = (await response.json()) as {
      payload?: string;
      expiresAt?: string;
      error?: string;
    };

    if (!response.ok || !data.payload || !data.expiresAt) {
      setPayload("");
      setStatus(data.error ?? "QR code unavailable.");
      return;
    }

    setPayload(data.payload);
    setExpiresAt(data.expiresAt);
    setStatus("QR code ready.");
  }

  useEffect(() => {
    const kickoff = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 110_000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="space-y-3" aria-labelledby="qr-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="qr-title" className="font-display text-2xl">
          Staff scan
        </h2>
        <button
          type="button"
          onClick={refresh}
          className="grid size-11 place-items-center rounded-sm border border-[#4c5a2d] bg-white"
          aria-label="Refresh QR code"
        >
          <RefreshCcw aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid min-h-64 place-items-center rounded-sm border-2 border-dashed border-[#9ca57b] bg-white p-5">
        {payload ? (
          <QRCodeSVG value={payload} size={220} level="M" />
        ) : (
          <p className="text-center text-sm font-semibold">{status}</p>
        )}
      </div>
      <p aria-live="polite" className="text-sm font-semibold text-[#4c5a2d]">
        {status}{" "}
        {expiresAt && `Expires ${new Date(expiresAt).toLocaleTimeString()}.`}
      </p>
    </section>
  );
}
