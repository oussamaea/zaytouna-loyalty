import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: string;
};

const DEFAULT_ERROR_MESSAGE = "An unexpected signup error occurred.";

export type SafeLoggedError = {
  type: string;
  name: string | null;
  message: string | null;
  code: string | null;
  status: number | null;
};

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

export function getSafeLoggedError(error: unknown): SafeLoggedError {
  if (error instanceof Error) {
    return {
      type: "error",
      name: cleanMessage(error.name),
      message: cleanMessage(error.message),
      code: null,
      status: null,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      type: error.constructor?.name ?? "object",
      name: cleanMessage(record.name),
      message: cleanMessage(record.message),
      code: cleanMessage(record.code),
      status: typeof record.status === "number" ? record.status : null,
    };
  }

  return {
    type: typeof error,
    name: null,
    message: cleanMessage(error),
    code: null,
    status: null,
  };
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
  console.error(`[${context}]`, getSafeLoggedError(error));
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
