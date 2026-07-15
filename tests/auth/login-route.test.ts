import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateSupabaseServerClient, mockSignInWithOtp } = vi.hoisted(
  () => ({
    mockCreateSupabaseServerClient: vi.fn(),
    mockSignInWithOtp: vi.fn(),
  }),
);

vi.mock("@/lib/env", () => ({
  hasSupabasePublicEnv: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

async function postLogin(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/auth/login/route");

  return POST(
    new Request("https://loyalty.example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("passwordless login route", () => {
  beforeEach(() => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: { signInWithOtp: mockSignInWithOtp },
    });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("requests a customer email code", async () => {
    const response = await postLogin({
      email: "customer@example.com",
      allowSignup: false,
    });

    expect(response.status).toBe(200);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "customer@example.com",
      options: {
        shouldCreateUser: false,
      },
    });
  });

  it("keeps staff login from creating missing users", async () => {
    const response = await postLogin({
      email: "staff@example.com",
      allowSignup: false,
    });

    expect(response.status).toBe(200);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "staff@example.com",
      options: {
        shouldCreateUser: false,
      },
    });
  });
});
