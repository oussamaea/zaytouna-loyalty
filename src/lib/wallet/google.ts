import "server-only";

import { env } from "@/lib/env";

export async function getGoogleWalletLink() {
  if (!env.googleWalletEnabled) {
    return null;
  }

  throw new Error(
    "Google Wallet is enabled but Stage 2 credential integration is not implemented yet.",
  );
}

export async function syncGoogleWalletPass() {
  if (!env.googleWalletEnabled) {
    return { skipped: true };
  }

  throw new Error(
    "Google Wallet sync requires Stage 2 issuer credentials and pass object setup.",
  );
}
