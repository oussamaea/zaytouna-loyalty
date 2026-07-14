import { NextResponse } from "next/server";
import { hashQrToken, parseQrPayload } from "@/lib/qr";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCustomerView, getStaffContext } from "@/lib/staff";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = checkRateLimit(`staff-lookup:${ip}`, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many lookup attempts." },
      { status: 429 },
    );
  }

  const context = await getStaffContext();
  if ("error" in context) {
    return context.error;
  }

  const url = new URL(request.url);
  const memberCode = url.searchParams.get("memberCode")?.trim().toUpperCase();
  const qrPayload = url.searchParams.get("qrPayload");

  let customerId: string | null = null;

  if (memberCode) {
    const { data } = await context.admin
      .from("profiles")
      .select("id")
      .eq("loyalty_member_code", memberCode)
      .eq("role", "customer")
      .maybeSingle<{ id: string }>();
    customerId = data?.id ?? null;
  } else if (qrPayload) {
    const token = parseQrPayload(qrPayload);
    const tokenHash = hashQrToken(token);
    const { data } = await context.admin
      .from("qr_tokens")
      .select("customer_id, expires_at, used_at, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle<{
        customer_id: string;
        expires_at: string;
        used_at: string | null;
        revoked_at: string | null;
      }>();

    if (
      data &&
      !data.used_at &&
      new Date(data.expires_at).getTime() > Date.now()
    ) {
      customerId = data.customer_id;
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const customer = await getCustomerView(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json({ customer });
}
