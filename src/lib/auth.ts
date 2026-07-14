import { redirect } from "next/navigation";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return data;
}

export async function requireCustomerProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireStaffProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/staff/login");
  }

  if (!["staff", "admin"].includes(profile.role)) {
    redirect("/card");
  }

  return profile;
}
