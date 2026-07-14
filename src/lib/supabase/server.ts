import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { env, getSupabasePublicConfigError } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseServerClient(
  onSetAll?: (cookiesToSet: CookieToSet[]) => void,
) {
  const configError = getSupabasePublicConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
          onSetAll?.(cookiesToSet);
        } catch {
          // Server Components cannot write cookies. Route handlers and actions can.
        }
      },
    },
  });
}

export function createSupabaseCallbackClient(
  request: NextRequest,
  onSetAll: (cookiesToSet: CookieToSet[]) => void,
) {
  const configError = getSupabasePublicConfigError();
  if (configError) {
    throw new Error(configError);
  }

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        onSetAll(cookiesToSet);
      },
    },
  });
}
