import { NextResponse } from "next/server";
import { getCustomerView, getStaffContext } from "@/lib/staff";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staffContext = await getStaffContext();
  if ("error" in staffContext) {
    return staffContext.error;
  }

  const { id } = await context.params;
  const customer = await getCustomerView(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json({ customer });
}
