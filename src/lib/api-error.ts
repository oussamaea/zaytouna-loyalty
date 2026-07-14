import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: string;
};

const DEFAULT_ERROR_MESSAGE = "An unexpected signup error occurred.";

function cleanMessage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") {
    return null;
  }

  return trimmed;
}

function getObjectString(error: object, key: string) {
  if (key in error) {
    return cleanMessage((error as Record<string, unknown>)[key]);
  }

  return null;
}

async function getResponseMessage(response: Response) {
  const clone = response.clone();
  const contentType = clone.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await clone.json()) as unknown;
      if (typeof body === "object" && body !== null) {
        return (
          getObjectString(body, "message") ??
          getObjectString(body, "error_description") ??
          getObjectString(body, "error") ??
          getObjectString(body, "details") ??
          getObjectString(body, "hint")
        );
      }
    }

    return cleanMessage(await clone.text());
  } catch {
    return null;
  }
}

export async function getErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): Promise<string> {
  if (error instanceof Response) {
    return (await getResponseMessage(error)) ?? fallback;
  }

  if (error instanceof Error) {
    return cleanMessage(error.message) ?? fallback;
  }

  if (typeof error === "object" && error !== null) {
    return (
      getObjectString(error, "message") ??
      getObjectString(error, "error_description") ??
      getObjectString(error, "error") ??
      getObjectString(error, "details") ??
      getObjectString(error, "hint") ??
      fallback
    );
  }

  return cleanMessage(error) ?? fallback;
}

export function logServerError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

export async function jsonError(
  error: unknown,
  status = 500,
  context?: string,
  fallback = "An unexpected error occurred.",
) {
  if (context) {
    logServerError(context, error);
  }

  return NextResponse.json<ApiErrorBody>(
    { error: await getErrorMessage(error, fallback) },
    { status },
  );
}

export async function getAuthErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }

  const message = (await getErrorMessage(error)).toLowerCase();

  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already been registered")
  ) {
    return 409;
  }

  return 400;
}
