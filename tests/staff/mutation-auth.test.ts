import { describe, expect, it, vi } from "vitest";

const { mockGetStaffContext } = vi.hoisted(() => ({
  mockGetStaffContext: vi.fn(),
}));

vi.mock("@/lib/staff", () => ({
  getStaffContext: mockGetStaffContext,
}));

vi.mock("@/lib/qr", () => ({
  hashQrToken: vi.fn((token: string) => `hash-${token}`),
  parseQrPayload: vi.fn((payload: string) => payload),
}));

describe("staff mutation authorization", () => {
  it("blocks unauthorized add-stamp attempts before mutation RPC", async () => {
    mockGetStaffContext.mockResolvedValue({
      error: Response.json(
        { error: "Staff authorization required." },
        { status: 403 },
      ),
    });
    const { POST } = await import("@/app/api/staff/loyalty/add-stamp/route");

    const response = await POST(
      new Request("https://loyalty.example.com/api/staff/loyalty/add-stamp", {
        method: "POST",
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          requestId: "44444444-4444-4444-8444-444444444444",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response).toBeDefined();
    const actualResponse = response as Response;
    expect(actualResponse.status).toBe(403);
    await expect(actualResponse.json()).resolves.toEqual({
      error: "Staff authorization required.",
    });
  });
});
