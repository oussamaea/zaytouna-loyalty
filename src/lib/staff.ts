import { NextResponse } from "next/server";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerLoyaltyView, Profile } from "@/lib/types";

function getSafeSupabaseError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : null,
    code: typeof record.code === "string" ? record.code : null,
    details: typeof record.details === "string" ? record.details : null,
    hint: typeof record.hint === "string" ? record.hint : null,
    status: typeof record.status === "number" ? record.status : null,
  };
}

export async function getStaffContext() {
  if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
    return {
      error: NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 503 },
      ),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("Staff auth user resolved", {
    staffUserId: user?.id ?? null,
    hasUser: Boolean(user),
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  console.log("Staff profile role resolved", {
    staffUserId: user.id,
    role: profile?.role ?? null,
    profileFound: Boolean(profile),
    error: getSafeSupabaseError(profileError),
  });

  if (!profile || !["staff", "admin"].includes(profile.role)) {
    return {
      error: NextResponse.json(
        { error: "Staff authorization required." },
        { status: 403 },
      ),
    };
  }

  return {
    staff: profile,
    supabase,
    admin: createSupabaseAdminClient(),
  };
}

export async function getCustomerView(customerId: string) {
  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, first_name, loyalty_member_code")
    .eq("id", customerId)
    .eq("role", "customer")
    .maybeSingle<CustomerLoyaltyView["profile"]>();

  if (profileError || !profile) {
    return null;
  }

  const { data: account } = await admin
    .from("loyalty_accounts")
    .select("*")
    .eq("customer_id", customerId)
    .single<CustomerLoyaltyView["account"]>();

  const { data: transactions } = await admin
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (!account) {
    return null;
  }

  return {
    profile,
    account,
    transactions: transactions ?? [],
  };
}
