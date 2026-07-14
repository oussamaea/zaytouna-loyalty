import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandHeader } from "@/components/brand-header";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader />
      <section className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#59623d]">
            Customer login
          </p>
          <h1 className="mt-3 font-display text-5xl">Open your loyalty card</h1>
          <p className="mt-4 leading-7 text-[#3c4729]">
            Enter your email and we will send an 8-digit sign-in code.
            Customers cannot add stamps or redeem rewards from this card.
          </p>
          <p className="mt-4 text-sm">
            Need a card?{" "}
            <Link href="/join" className="font-bold underline">
              Join first
            </Link>
          </p>
        </div>
        <div className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
          <AuthForm mode="login" />
        </div>
      </section>
    </main>
  );
}
