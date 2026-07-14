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

function getDiagnosticField(error: unknown, key: string) {
  if (typeof error === "object" && error !== null && key in error) {
    return (error as Record<string, unknown>)[key];
  }

  return null;
}

function logSignupDiagnostic(error: unknown) {
  console.error("Signup diagnostic", {
    type: typeof error,
    constructor:
      error && typeof error === "object" ? error.constructor?.name : null,
    keys: error && typeof error === "object" ? Object.keys(error) : [],
    name: getDiagnosticField(error, "name"),
    message: getDiagnosticField(error, "message"),
    code: getDiagnosticField(error, "code"),
    status: getDiagnosticField(error, "status"),
  });
}

export async function POST(request: Request) {
  try {
    const configError = getSupabasePublicConfigError();
    if (configError) {
      return NextResponse.json(
        { error: configError },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the signup form." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOtp({
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

    console.error("Supabase signup result", {
      hasData: Boolean(data),
      hasError: Boolean(error),
      errorName: error?.name,
      errorMessage: error?.message,
      errorStatus: error?.status,
      errorCode: getDiagnosticField(error, "code"),
    });

    if (error) {
      logSignupDiagnostic(error);
      return NextResponse.json(
        { error: await getErrorMessage(error) },
        { status: await getAuthErrorStatus(error) },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logSignupDiagnostic(error);
    return NextResponse.json(
      { error: await getErrorMessage(error) },
      { status: 500 },
    );
  }
}
