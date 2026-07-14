import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { hashQrToken, parseQrPayload } from "@/lib/qr";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStaffContext } from "@/lib/staff";

const schema = z.object({
  customerId: z.string().uuid().optional(),
  memberCode: z.string().trim().optional(),
  qrPayload: z.string().optional(),
  requestId: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = checkRateLimit(`staff-change:${ip}`, 15);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many loyalty changes." },
      { status: 429 },
    );
  }

  const context = await getStaffContext();
  if ("error" in context) {
    return context.error;
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid stamp request." },
      { status: 400 },
    );
  }

  const qrTokenHash = parsed.data.qrPayload
    ? hashQrToken(parseQrPayload(parsed.data.qrPayload))
    : null;

  const { data, error } = await context.supabase.rpc("add_stamp", {
    p_customer_id: parsed.data.customerId ?? null,
    p_member_code: parsed.data.memberCode?.toUpperCase() ?? null,
    p_qr_token_hash: qrTokenHash,
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return jsonError(error, 400, "add stamp");
  }

  return NextResponse.json({ account: data });
}
