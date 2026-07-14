import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandHeader } from "@/components/brand-header";

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader />
      <section className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#59623d]">
            Join
          </p>
          <h1 className="mt-3 font-display text-5xl">
            Start your loyalty card
          </h1>
          <p className="mt-4 leading-7 text-[#3c4729]">
            We collect only what is needed to run the loyalty program. Your
            8-digit verification code will arrive by email.
          </p>
          <p className="mt-4 text-sm">
            Already joined?{" "}
            <Link href="/login" className="font-bold underline">
              Log in
            </Link>
          </p>
        </div>
        <div className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
          <AuthForm mode="join" />
        </div>
      </section>
    </main>
  );
}
