import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { StaffLoginOptions } from "@/components/staff-login-options";
import { getCurrentProfile } from "@/lib/auth";
import { hasSupabasePublicEnv } from "@/lib/env";

export default async function StaffLoginPage() {
  if (hasSupabasePublicEnv()) {
    const profile = await getCurrentProfile();
    if (profile?.role === "staff" || profile?.role === "admin") {
      redirect("/staff/dashboard");
    }

    if (profile?.role === "customer") {
      redirect("/card");
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader staff />
      <section className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#59623d]">
            Staff only
          </p>
          <h1 className="mt-3 font-display text-5xl">Protected staff login</h1>
          <p className="mt-4 leading-7 text-[#3c4729]">
            Staff accounts are created by an admin in Supabase. Public staff
            registration is disabled. Use the temporary password option for
            scanner testing, or request an email code.
          </p>
        </div>
        <div className="rounded-sm border border-[#cfc2ad] bg-[#fffaf2] p-5">
          <StaffLoginOptions />
        </div>
      </section>
    </main>
  );
}
