import { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { z } from "zod";
import {
  getAuthErrorStatus,
  getErrorMessage,
  logServerError,
} from "@/lib/api-error";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getSafeNext } from "@/lib/public-origin";
import { createSupabaseCallbackClient } from "@/lib/supabase/server";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const schema = z.object({
  email: z.email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{8}$/),
  next: z.string().default("/card"),
});

function jsonWithCookies(
  body: Record<string, unknown>,
  status: number,
  cookiesToSet: CookieToSet[],
) {
  const response = NextResponse.json(body, { status });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

async function getVerifiedUserRole(
  supabase: ReturnType<typeof createSupabaseCallbackClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string }>();

  if (error) {
    throw error;
  }

  return data?.role ?? null;
}

export async function POST(request: NextRequest) {
  const cookiesToSet: CookieToSet[] = [];

  try {
    if (!hasSupabasePublicEnv()) {
      return NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter the 8-digit code from your email." },
        { status: 400 },
      );
    }

    const safeNext = getSafeNext(parsed.data.next);
    const supabase = createSupabaseCallbackClient(request, (nextCookies) => {
      cookiesToSet.push(...nextCookies);
    });
    const { data, error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: "email",
    });

    if (error) {
      logServerError("email otp verification", error);
      return jsonWithCookies(
        {
          error: await getErrorMessage(
            error,
            "Invalid or expired verification code.",
          ),
        },
        await getAuthErrorStatus(error),
        cookiesToSet,
      );
    }

    const userId = data.user?.id ?? data.session?.user.id;
    if (!userId) {
      return jsonWithCookies(
        { error: "We could not verify this email session. Please try again." },
        401,
        cookiesToSet,
      );
    }

    if (safeNext.startsWith("/staff")) {
      const role = await getVerifiedUserRole(supabase, userId);
      if (role !== "staff" && role !== "admin") {
        return jsonWithCookies(
          { error: "This email is not authorized for staff access." },
          403,
          [],
        );
      }
    }

    return jsonWithCookies(
      { ok: true, redirectTo: safeNext },
      200,
      cookiesToSet,
    );
  } catch (error) {
    logServerError("email otp verification", error);

    return jsonWithCookies(
      { error: await getErrorMessage(error, "Unable to verify the code.") },
      500,
      cookiesToSet,
    );
  }
}
