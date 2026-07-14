"use client";

import { useState } from "react";
import { BadgePercent, RefreshCcw, Stamp } from "lucide-react";
import type { CustomerLoyaltyView } from "@/lib/types";
import { StampGrid } from "@/components/stamp-grid";

type Action = "add-stamp" | "redeem-fifth" | "redeem-tenth";

export function StaffCustomerDetails({
  initialCustomer,
}: {
  initialCustomer: CustomerLoyaltyView;
}) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function refreshCustomer() {
    const response = await fetch(`/api/staff/customer/${customer.profile.id}`);
    const data = (await response.json()) as {
      customer?: CustomerLoyaltyView;
      error?: string;
    };

    if (!response.ok || !data.customer) {
      setError(data.error ?? "Unable to refresh customer.");
      return;
    }

    setCustomer(data.customer);
  }

  async function mutate(action: Action) {
    const label =
      action === "add-stamp"
        ? "add one stamp"
        : action === "redeem-fifth"
          ? "redeem the 10% reward"
          : "redeem the 50% reward and reset the cycle";

    if (!window.confirm(`Confirm: ${label} for ${customer.profile.first_name}?`)) {
      return;
    }

    setError("");
    setStatus("Saving loyalty change...");

    const response = await fetch(`/api/staff/loyalty/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.profile.id,
        requestId: crypto.randomUUID(),
      }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus("");
      setError(data.error ?? "Unable to save loyalty change.");
      return;
    }

    await refreshCustomer();
    setStatus("Loyalty change saved.");
  }

  const { profile, account, transactions } = customer;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#59623d]">
          {profile.loyalty_member_code}
        </p>
        <h1 className="mt-2 font-display text-5xl">{profile.first_name}</h1>
        <p className="mt-3 font-black">
          {account.current_stamps} of 10 stamps, cycle {account.cycle_number}
        </p>
        <div className="mt-5 rounded-sm bg-[#ece2d3] p-4">
          <StampGrid stamps={account.current_stamps} />
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-sm bg-white p-3">
            <p className="font-black">10% reward</p>
            <p>{account.fifth_reward_status}</p>
          </div>
          <div className="rounded-sm bg-white p-3">
            <p className="font-black">50% reward</p>
            <p>{account.tenth_reward_status}</p>
          </div>
        </div>
      </section>

      <section className="rounded-sm border border-[#cfc2ad] bg-white p-5">
        <h2 className="font-display text-3xl">Staff actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => mutate("add-stamp")}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-[#24301f] px-3 font-bold text-white"
          >
            <Stamp aria-hidden className="size-5" />
            Add one stamp
          </button>
          <button
            type="button"
            onClick={() => mutate("redeem-fifth")}
            disabled={account.fifth_reward_status !== "available"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-[#24301f] px-3 font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BadgePercent aria-hidden className="size-5" />
            Redeem 10%
          </button>
          <button
            type="button"
            onClick={() => mutate("redeem-tenth")}
            disabled={account.tenth_reward_status !== "available"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-[#a44530] px-3 font-bold text-[#a44530] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BadgePercent aria-hidden className="size-5" />
            Redeem 50%
          </button>
        </div>
        <button
          type="button"
          onClick={refreshCustomer}
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-[#9ca57b] px-4 font-bold"
        >
          <RefreshCcw aria-hidden className="size-4" />
          Refresh customer
        </button>

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

        <div className="mt-5">
          <h3 className="font-display text-2xl">Recent transactions</h3>
          <ul className="mt-3 divide-y divide-[#e1d6c6]">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="py-3 text-sm">
                <p className="font-bold">{transaction.transaction_type}</p>
                <p>
                  {transaction.stamp_count_before} to{" "}
                  {transaction.stamp_count_after} stamps
                </p>
                <p className="text-[#59623d]">
                  {new Date(transaction.created_at).toLocaleString()}
                </p>
              </li>
            ))}
            {transactions.length === 0 && (
              <li className="py-3 text-sm text-[#59623d]">
                No loyalty transactions yet.
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
