import { BrandHeader } from "@/components/brand-header";
import { StaffDashboard } from "@/components/staff-dashboard";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/env";
import { requireStaffProfile } from "@/lib/auth";

export default async function StaffDashboardPage() {
  if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
    return (
      <main className="min-h-screen bg-[#f8f2e8]">
        <BrandHeader staff />
        <section className="mx-auto max-w-2xl px-5 py-12">
          <h1 className="font-display text-5xl">Supabase setup needed</h1>
          <p className="mt-4 leading-7">
            Add Supabase public and service-role environment variables before
            staff tools can access protected loyalty operations.
          </p>
        </section>
      </main>
    );
  }

  await requireStaffProfile();

  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader staff />
      <section className="mx-auto max-w-6xl px-5 py-8">
        <StaffDashboard />
      </section>
    </main>
  );
}
