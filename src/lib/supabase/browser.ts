"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createSupabaseBrowserClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase public environment variables are not configured.",
    );
  }

  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
