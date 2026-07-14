import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { addMinutes } from "@/lib/time";
import { env, hasSupabasePublicEnv } from "@/lib/env";
import { createOpaqueQrToken, createQrPayload, hashQrToken } from "@/lib/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabasePublicEnv() || !env.qrSigningSecret) {
    return NextResponse.json(
      { error: "Supabase or QR environment variables are not configured." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const token = createOpaqueQrToken();
  const expiresAt = addMinutes(new Date(), 2);

  const { error } = await supabase.from("qr_tokens").insert({
    customer_id: user.id,
    token_hash: hashQrToken(token),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return jsonError(error, 400, "qr token creation");
  }

  return NextResponse.json({
    payload: createQrPayload(token),
    expiresAt: expiresAt.toISOString(),
  });
}
