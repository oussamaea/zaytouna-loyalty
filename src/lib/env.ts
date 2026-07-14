export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  qrSigningSecret: process.env.LOYALTY_QR_SIGNING_SECRET ?? "",
  stampCooldownSeconds: Number(
    process.env.LOYALTY_STAMP_COOLDOWN_SECONDS ?? "300",
  ),
  googleWalletEnabled: process.env.NEXT_PUBLIC_GOOGLE_WALLET_ENABLED === "true",
  appleWalletEnabled: process.env.NEXT_PUBLIC_APPLE_WALLET_ENABLED === "true",
};

export function hasSupabasePublicEnv() {
  return getSupabasePublicConfigError() === null;
}

export function hasSupabaseAdminEnv() {
  return Boolean(
    env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey,
  );
}

export function getSupabasePublicConfigError() {
  if (!env.supabaseUrl.trim()) {
    return "Supabase URL is not configured.";
  }

  try {
    const url = new URL(env.supabaseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "Supabase URL must be a valid HTTP or HTTPS URL.";
    }
  } catch {
    return "Supabase URL must be a valid URL.";
  }

  if (!env.supabaseAnonKey.trim()) {
    return "Supabase anon key is not configured.";
  }

  return null;
}
