import { afterEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest supports virtual mocks for packages absent in tests.
vi.mock("server-only", () => ({}), { virtual: true });

describe("QR token helpers", () => {
  afterEach(() => {
    delete process.env.LOYALTY_QR_SIGNING_SECRET;
    vi.resetModules();
  });

  it("renders the raw opaque token in the QR payload", async () => {
    process.env.LOYALTY_QR_SIGNING_SECRET = "test-secret";
    const { createQrPayload } = await import("@/lib/qr");

    expect(createQrPayload("raw-token-value")).toBe("raw-token-value");
  });

  it("hash generation and validation use matching lowercase hex HMAC-SHA256 output", async () => {
    process.env.LOYALTY_QR_SIGNING_SECRET = "test-secret";
    const { hashQrToken, parseQrPayload } = await import("@/lib/qr");

    const hash = hashQrToken(parseQrPayload("raw-token-value"));

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashQrToken("raw-token-value"));
  });

  it("can still parse previous JSON QR payloads for backward compatibility", async () => {
    process.env.LOYALTY_QR_SIGNING_SECRET = "test-secret";
    const { parseQrPayload } = await import("@/lib/qr");

    expect(
      parseQrPayload(
        JSON.stringify({ v: 1, iss: "zaytouna-loyalty", t: "legacy-token" }),
      ),
    ).toBe("legacy-token");
  });
});
