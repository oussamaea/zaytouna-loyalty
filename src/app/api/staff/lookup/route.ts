import { NextResponse } from "next/server";
import { logServerError } from "@/lib/api-error";
import { hashQrToken, parseQrPayload } from "@/lib/qr";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStaffContext } from "@/lib/staff";
import type { StaffLookupCustomer } from "@/lib/types";

const MEMBER_CODE_PATTERN = /^ZB-[0-9A-F]{6}$/;
const GENERIC_LOOKUP_ERROR = "Unexpected lookup failure";

type LookupProfile = {
  id: string;
  first_name: string;
  loyalty_member_code: string;
};

type LookupAccount = {
  customer_id: string;
  current_stamps: number;
  cycle_number: number;
  fifth_reward_status: StaffLookupCustomer["fifthRewardStatus"];
  tenth_reward_status: StaffLookupCustomer["tenthRewardStatus"];
};

function toLookupCustomer(
  profile: LookupProfile,
  account: LookupAccount,
): StaffLookupCustomer {
  return {
    id: profile.id,
    firstName: profile.first_name,
    memberCode: profile.loyalty_member_code,
    currentStamps: account.current_stamps,
    cycleNumber: account.cycle_number,
    fifthRewardStatus: account.fifth_reward_status,
    tenthRewardStatus: account.tenth_reward_status,
  };
}

function unexpectedLookupFailure() {
  return NextResponse.json({ error: GENERIC_LOOKUP_ERROR }, { status: 500 });
}

function assertMappableLookupRows(
  profile: LookupProfile,
  account: LookupAccount,
) {
  if (
    !profile.id ||
    !profile.first_name ||
    !profile.loyalty_member_code ||
    typeof account.current_stamps !== "number" ||
    typeof account.cycle_number !== "number" ||
    !account.fifth_reward_status ||
    !account.tenth_reward_status
  ) {
    throw new Error("Lookup response row is missing required fields.");
  }
}

export async function GET(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = checkRateLimit(`staff-lookup:${ip}`, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many lookup attempts." },
      { status: 429 },
    );
  }

  const context = await getStaffContext();
  if ("error" in context && context.error) {
    return context.error;
  }

  const url = new URL(request.url);
  const normalizedMemberCode =
    url.searchParams.get("memberCode")?.trim().toUpperCase() ?? null;
  const qrPayload = url.searchParams.get("qrPayload");

  let profile: LookupProfile | null = null;
  let source: "member-code" | "qr" = "member-code";

  try {
    if (normalizedMemberCode) {
      if (!MEMBER_CODE_PATTERN.test(normalizedMemberCode)) {
        return NextResponse.json(
          { error: "Invalid member code." },
          { status: 400 },
        );
      }

      const { data, error } = await context.admin
        .from("profiles")
        .select("id, first_name, loyalty_member_code")
        .eq("loyalty_member_code", normalizedMemberCode)
        .eq("role", "customer")
        .maybeSingle<LookupProfile>();

      if (error) {
        logServerError("staff lookup profile query", error);
        return unexpectedLookupFailure();
      }

      profile = data ?? null;
    } else if (qrPayload) {
      source = "qr";
      const token = parseQrPayload(qrPayload);
      const tokenHash = hashQrToken(token);
      const { data, error } = await context.admin
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

      if (error) {
        logServerError("staff qr lookup query", error);
        return unexpectedLookupFailure();
      }

      if (
        data?.expires_at &&
        new Date(data.expires_at).getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: "QR code expired. Ask the customer to refresh their card." },
          { status: 404 },
        );
      }

      if (data && !data.used_at && !data.revoked_at) {
        const { data: qrProfile, error: profileError } = await context.admin
          .from("profiles")
          .select("id, first_name, loyalty_member_code")
          .eq("id", data.customer_id)
          .eq("role", "customer")
          .maybeSingle<LookupProfile>();

        if (profileError) {
          logServerError("staff qr profile query", profileError);
          return unexpectedLookupFailure();
        }

        profile = qrProfile ?? null;
      }
    } else {
      return NextResponse.json(
        { error: "Invalid member code." },
        { status: 400 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 },
      );
    }

    const { data: account, error: accountError } = await context.admin
      .from("loyalty_accounts")
      .select(
        "customer_id, current_stamps, cycle_number, fifth_reward_status, tenth_reward_status",
      )
      .eq("customer_id", profile.id)
      .maybeSingle<LookupAccount>();

    if (accountError) {
      logServerError("staff lookup account query", accountError);
      return unexpectedLookupFailure();
    }

    if (!account) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 },
      );
    }

    try {
      assertMappableLookupRows(profile, account);
    } catch (error) {
      logServerError("staff lookup response mapping", error);
      return unexpectedLookupFailure();
    }

    return NextResponse.json({
      customer: toLookupCustomer(profile, account),
    });
  } catch (error) {
    logServerError(`staff lookup ${source}`, error);
    return unexpectedLookupFailure();
  }
}
