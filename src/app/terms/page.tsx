import { BrandHeader } from "@/components/brand-header";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader />
      <article className="mx-auto max-w-3xl px-5 py-10 leading-7">
        <h1 className="font-display text-5xl">Loyalty terms draft</h1>
        <p className="mt-5">
          One stamp is awarded per qualifying purchase after staff verification.
          Customers cannot add their own stamps or redeem their own rewards.
        </p>
        <p className="mt-4">
          The fifth stamp unlocks a 10% discount and the tenth stamp unlocks a
          50% discount. Each reward must be explicitly redeemed by staff and
          rewards cannot be exchanged for cash.
        </p>
        <p className="mt-4">
          Fraud, misuse, duplicate accounts, or abuse of the program may result
          in account suspension. Exact products eligible for discounts must be
          configurable by Zaytouna Bistro ownership.
        </p>
      </article>
    </main>
  );
}
