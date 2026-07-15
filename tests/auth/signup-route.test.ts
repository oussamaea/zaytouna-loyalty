import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateSupabaseServerClient, mockSignInWithOtp } = vi.hoisted(
  () => ({
    mockCreateSupabaseServerClient: vi.fn(),
    mockSignInWithOtp: vi.fn(),
  }),
);

vi.mock("@/lib/env", () => ({
  hasSupabasePublicEnv: () => true,
  getSupabasePublicConfigError: () => null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

async function postSignup(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/auth/signup/route");

  return POST(
    new Request("https://loyalty.example.com/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const validBody = {
  firstName: "Layla",
  lastName: "",
  email: "layla@example.com",
  birthday: "",
  acceptedTerms: true,
};

describe("customer signup route", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: { signInWithOtp: mockSignInWithOtp },
    });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns a Supabase signup error message", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });

    const response = await postSignup(validBody);

    await expect(response.json()).resolves.toEqual({
      error: "Email rate limit exceeded",
    });
    expect(response.status).toBe(400);
  });

  it("returns an unexpected Error message safely", async () => {
    mockCreateSupabaseServerClient.mockRejectedValue(
      new Error("Supabase client could not be created"),
    );

    const response = await postSignup(validBody);

    await expect(response.json()).resolves.toEqual({
      error: "Supabase client could not be created",
    });
    expect(response.status).toBe(500);
  });

  it("returns the fallback message for unknown thrown errors", async () => {
    mockCreateSupabaseServerClient.mockRejectedValue({});

    const response = await postSignup(validBody);

    await expect(response.json()).resolves.toEqual({
      error: "An unexpected signup error occurred.",
    });
    expect(response.status).toBe(500);
  });

  it("does not return braces when Supabase error message is an empty object string", async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: null,
      error: { message: "{}", error_description: "Redirect URL is invalid" },
    });

    const response = await postSignup(validBody);

    await expect(response.json()).resolves.toEqual({
      error: "Redirect URL is invalid",
    });
    expect(response.status).toBe(400);
  });

  it("requests a customer signup code without a clickable redirect", async () => {
    await postSignup(validBody);

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          shouldCreateUser: true,
        }),
      }),
    );
    expect(mockSignInWithOtp.mock.calls[0]?.[0]?.options).not.toHaveProperty(
      "emailRedirectTo",
    );
  });
});
