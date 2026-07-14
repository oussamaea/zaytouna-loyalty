import { Home, WalletCards } from "lucide-react";
import { env } from "@/lib/env";
import type { CustomerLoyaltyView } from "@/lib/types";
import { QrPanel } from "@/components/qr-panel";
import { StampGrid } from "@/components/stamp-grid";

export function LoyaltyCard({ customer }: { customer: CustomerLoyaltyView }) {
  const { profile, account } = customer;
  const fifthAvailable = account.fifth_reward_status === "available";
  const tenthAvailable = account.tenth_reward_status === "available";

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-5 pb-10">
      <section className="relative overflow-hidden rounded-sm bg-[#24301f] p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-28 w-28 border-l border-b border-[#b1c553]/40" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dce8a7]">
          Zaytouna Bistro
        </p>
        <h1 className="mt-4 font-display text-4xl">Hi {profile.first_name}</h1>
        <p className="mt-2 font-semibold">
          Member {profile.loyalty_member_code}
        </p>
        <div className="mt-5 rounded-sm bg-[#ece2d3] p-4 text-[#24301f]">
          <p className="font-black">{account.current_stamps} of 10 stamps</p>
          <StampGrid stamps={account.current_stamps} />
        </div>
      </section>

      <section className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
        <h2 className="font-display text-2xl">Rewards</h2>
        <div className="mt-3 grid gap-3">
          <RewardLine
            label="10% discount"
            status={account.fifth_reward_status}
            active={fifthAvailable}
          />
          <RewardLine
            label="50% discount"
            status={account.tenth_reward_status}
            active={tenthAvailable}
          />
        </div>
      </section>

      <QrPanel />

      <section className="rounded-sm border border-[#cfc2ad] bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Home aria-hidden className="size-5" />
          Add to Home Screen
        </h2>
        <p className="mt-2 text-sm leading-6">
          On iPhone, tap Share and choose Add to Home Screen. On Android, open
          browser settings and choose Install app.
        </p>
      </section>

      {env.googleWalletEnabled ? (
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#24301f] px-5 font-bold text-white">
          <WalletCards aria-hidden className="size-5" />
          Add to Google Wallet
        </button>
      ) : null}

      <button
        disabled
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-[#9ca57b] px-5 font-bold text-[#59623d] disabled:opacity-70"
      >
        <WalletCards aria-hidden className="size-5" />
        Apple Wallet unavailable
      </button>
    </div>
  );
}

function RewardLine({
  label,
  status,
  active,
}: {
  label: string;
  status: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-[#e1d6c6] bg-white px-3 py-3">
      <span className="font-bold">{label}</span>
      <span
        className={`rounded-sm px-3 py-1 text-xs font-black uppercase ${
          active ? "bg-[#b1c553] text-[#24301f]" : "bg-[#ece2d3] text-[#59623d]"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
