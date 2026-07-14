import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthErrorStatus, jsonError } from "@/lib/api-error";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email(),
  allowSignup: z.boolean().default(false),
});

export async function POST(request: Request) {
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
        { error: "Invalid login request." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: parsed.data.allowSignup,
      },
    });

    if (error) {
      return jsonError(
        error,
        await getAuthErrorStatus(error),
        "passwordless login",
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, 500, "passwordless login");
  }
}
