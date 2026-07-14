import { notFound } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { StaffCustomerDetails } from "@/components/staff-customer-details";
import { getCustomerView } from "@/lib/staff";
import { requireStaffProfile } from "@/lib/auth";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/env";

export default async function StaffCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
    notFound();
  }

  await requireStaffProfile();
  const { id } = await params;
  const customer = await getCustomerView(id);
  if (!customer) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader staff />
      <section className="mx-auto max-w-6xl px-5 py-8">
        <StaffCustomerDetails initialCustomer={customer} />
      </section>
    </main>
  );
}
