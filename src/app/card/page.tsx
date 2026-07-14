import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { LoyaltyCard } from "@/components/loyalty-card";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerLoyaltyView } from "@/lib/types";

export default async function CardPage() {
  if (!hasSupabasePublicEnv()) {
    return (
      <main className="min-h-screen bg-[#f8f2e8]">
        <BrandHeader />
        <section className="mx-auto max-w-2xl px-5 py-12">
          <h1 className="font-display text-5xl">Supabase setup needed</h1>
          <p className="mt-4 leading-7">
            Add Supabase environment variables to load live customer cards. The
            app is intentionally closed to private loyalty data until
            configured.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("Card auth", {
    hasUser: Boolean(user),
    userId: user?.id ?? null,
  });

  if (error || !user) {
    redirect("/login?next=/card");
  }

  const customer = await loadCustomerLoyalty(user.id);
  if (!customer) {
    return (
      <main className="min-h-screen bg-[#f8f2e8]">
        <BrandHeader />
        <section className="mx-auto max-w-2xl px-5 py-12">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#59623d]">
            Card not ready
          </p>
          <h1 className="mt-3 font-display text-5xl">
            We could not load your loyalty card yet
          </h1>
          <p className="mt-4 leading-7">
            Your sign-in worked, but your loyalty profile or account is not
            available yet. Please ask staff to confirm your account setup.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f2e8]">
      <BrandHeader />
      <LoyaltyCard customer={customer} />
    </main>
  );
}

async function loadCustomerLoyalty(customerId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, loyalty_member_code")
    .eq("id", customerId)
    .eq("role", "customer")
    .maybeSingle<CustomerLoyaltyView["profile"]>();

  if (profileError || !profile) {
    return null;
  }

  const { data: account, error: accountError } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle<CustomerLoyaltyView["account"]>();

  if (accountError || !account) {
    return null;
  }

  const { data: transactions } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(12);

  return {
    profile,
    account,
    transactions: transactions ?? [],
  } satisfies CustomerLoyaltyView;
}
