import { BrandHeader } from "@/components/brand-header";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader />
      <article className="mx-auto max-w-3xl px-5 py-10 leading-7">
        <h1 className="font-display text-5xl">Privacy policy draft</h1>
        <p className="mt-5">
          Zaytouna Bistro collects only the customer information necessary to
          run the loyalty program, including name, email, optional birthday,
          loyalty account status, QR-token records, and transaction history.
        </p>
        <p className="mt-4">
          Loyalty data is used to verify purchases, award stamps, redeem
          discounts, prevent fraud, and support customer service. Private
          loyalty data should not be cached for long periods on customer
          devices.
        </p>
        <p className="mt-4">
          Staff verification is required for every stamp and reward redemption.
          Contact Zaytouna Bistro to request account support or corrections.
        </p>
      </article>
    </main>
  );
}
