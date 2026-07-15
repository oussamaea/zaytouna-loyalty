import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthErrorStatus, getErrorMessage } from "@/lib/api-error";
import { getSupabasePublicConfigError } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.email(),
  birthday: z.string().optional(),
  acceptedTerms: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const configError = getSupabasePublicConfigError();
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the signup form." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName ?? null,
          birthday: parsed.data.birthday || null,
          accepted_loyalty_terms: true,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: await getErrorMessage(error) },
        { status: await getAuthErrorStatus(error) },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: await getErrorMessage(error) },
      { status: 500 },
    );
  }
}
