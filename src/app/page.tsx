import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ButtonLink } from "@/components/button-link";
import { StampGrid } from "@/components/stamp-grid";

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#f8f2e8_0%,#ece2d3_48%,#fdf8ef_100%)]">
      <BrandHeader />
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#59623d]">
            Mediterranean rewards
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[0.98] text-[#24301f] sm:text-7xl">
            Zaytouna Bistro Loyalty
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#3c4729]">
            Earn one stamp per qualifying purchase, unlock 10% off on stamp
            five, and 50% off on stamp ten. Staff approval keeps every reward
            fair and ready for your next visit.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/join">
              Join now <ArrowRight aria-hidden className="ml-2 size-5" />
            </ButtonLink>
            <ButtonLink
              href="/login"
              className="bg-white text-[#24301f] hover:bg-[#fffaf2]"
            >
              Open my card
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#59623d]">
            Your card
          </p>
          <h2 className="mt-2 font-display text-4xl">10 stamps, two rewards</h2>
          <div className="mt-5 rounded-sm bg-[#ece2d3] p-4">
            <StampGrid stamps={4} />
          </div>
          <ul className="mt-5 space-y-3 text-sm font-semibold">
            <li className="flex gap-3">
              <CheckCircle2
                aria-hidden
                className="mt-0.5 size-5 text-[#4c5a2d]"
              />
              One approved purchase earns one stamp.
            </li>
            <li className="flex gap-3">
              <BadgePercent
                aria-hidden
                className="mt-0.5 size-5 text-[#a44530]"
              />
              Stamp five unlocks 10% off; stamp ten unlocks 50% off.
            </li>
            <li className="flex gap-3">
              <Smartphone
                aria-hidden
                className="mt-0.5 size-5 text-[#4c5a2d]"
              />
              Save the app to your phone for quick staff scanning.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
