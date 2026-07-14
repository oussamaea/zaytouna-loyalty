import "server-only";

import crypto from "node:crypto";
import { env } from "@/lib/env";

const TOKEN_BYTES = 32;

export function createOpaqueQrToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashQrToken(token: string) {
  if (!env.qrSigningSecret) {
    throw new Error("LOYALTY_QR_SIGNING_SECRET is not configured.");
  }

  return crypto
    .createHmac("sha256", env.qrSigningSecret)
    .update(token)
    .digest("hex");
}

export function createQrPayload(token: string) {
  return token;
}

export function parseQrPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      v?: number;
      t?: string;
      iss?: string;
    };
    if (parsed.v === 1 && parsed.iss === "zaytouna-loyalty" && parsed.t) {
      return parsed.t;
    }
  } catch {
    return value.trim();
  }

  return value.trim();
}
