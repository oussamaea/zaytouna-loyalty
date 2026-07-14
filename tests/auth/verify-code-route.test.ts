import { afterEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";

const { mockCreateSupabaseCallbackClient, mockVerifyOtp, mockMaybeSingle } =
  vi.hoisted(() => ({
    mockCreateSupabaseCallbackClient: vi.fn(),
    mockVerifyOtp: vi.fn(),
    mockMaybeSingle: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  hasSupabasePublicEnv: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseCallbackClient: mockCreateSupabaseCallbackClient,
}));

async function postVerify(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/auth/verify-code/route");

  return POST(
    new NextRequest("https://loyalty.example.com/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockSupabase(
  result: unknown,
  options: {
    role?: "customer" | "staff" | "admin" | null;
    cookies?: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }>;
  } = {},
) {
  mockVerifyOtp.mockImplementation(async () => result);
  mockMaybeSingle.mockResolvedValue({
    data: options.role ? { role: options.role } : null,
    error: null,
  });
  mockCreateSupabaseCallbackClient.mockImplementation((_request, onSetAll) => {
    if (options.cookies) {
      onSetAll(options.cookies);
    }

    return {
      auth: { verifyOtp: mockVerifyOtp },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      })),
    };
  });
}

describe("email OTP verification route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("valid customer code returns /card and preserves auth cookies", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockSupabase(
      {
        data: { user: { id: "customer-1" }, session: { user: { id: "customer-1" } } },
        error: null,
      },
      {
        cookies: [
          {
            name: "sb-customer-auth-token",
            value: "redacted-cookie-value",
            options: { path: "/", httpOnly: true, sameSite: "lax" },
          },
        ],
      },
    );

    const response = await postVerify({
      email: "customer@example.com",
      token: "123456",
      next: "/card",
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      redirectTo: "/card",
    });
    expect(response.headers.get("set-cookie")).toContain(
      "sb-customer-auth-token",
    );
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "customer@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("valid staff code returns /staff/dashboard for staff profiles", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockSupabase(
      {
        data: { user: { id: "staff-1" }, session: { user: { id: "staff-1" } } },
        error: null,
      },
      { role: "staff" },
    );

    const response = await postVerify({
      email: "staff@example.com",
      token: "123456",
      next: "/staff/dashboard",
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      redirectTo: "/staff/dashboard",
    });
    expect(response.status).toBe(200);
  });

  it("valid staff code returns /staff/dashboard for admin profiles", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockSupabase(
      {
        data: { user: { id: "admin-1" }, session: { user: { id: "admin-1" } } },
        error: null,
      },
      { role: "admin" },
    );

    const response = await postVerify({
      email: "admin@example.com",
      token: "123456",
      next: "/staff/dashboard",
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      redirectTo: "/staff/dashboard",
    });
  });

  it("customer cannot verify into the staff dashboard", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockSupabase(
      {
        data: {
          user: { id: "customer-1" },
          session: { user: { id: "customer-1" } },
        },
        error: null,
      },
      {
        role: "customer",
        cookies: [
          {
            name: "sb-customer-auth-token",
            value: "redacted-cookie-value",
            options: { path: "/", httpOnly: true },
          },
        ],
      },
    );

    const response = await postVerify({
      email: "customer@example.com",
      token: "123456",
      next: "/staff/dashboard",
    });

    await expect(response.json()).resolves.toEqual({
      error: "This email is not authorized for staff access.",
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expired codes return a readable message", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      data: { user: null, session: null },
      error: { message: "Email OTP has expired", status: 403 },
    });

    const response = await postVerify({
      email: "customer@example.com",
      token: "123456",
      next: "/card",
    });

    await expect(response.json()).resolves.toEqual({
      error: "Email OTP has expired",
    });
    expect(response.status).toBe(403);
  });

  it("invalid codes return a readable message", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      data: { user: null, session: null },
      error: { message: "Token has expired or is invalid", status: 403 },
    });

    const response = await postVerify({
      email: "customer@example.com",
      token: "000000",
      next: "/card",
    });

    await expect(response.json()).resolves.toEqual({
      error: "Token has expired or is invalid",
    });
    expect(response.status).toBe(403);
  });
});
