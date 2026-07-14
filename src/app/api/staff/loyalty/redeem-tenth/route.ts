import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { getStaffContext } from "@/lib/staff";

const schema = z.object({
  customerId: z.string().uuid(),
  requestId: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const context = await getStaffContext();
  if ("error" in context) {
    return context.error;
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid redemption request." },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase.rpc("redeem_tenth_reward", {
    p_customer_id: parsed.data.customerId,
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return jsonError(error, 400, "redeem tenth reward");
  }

  return NextResponse.json({ account: data });
}
