import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/api-error";

describe("getErrorMessage", () => {
  it("returns Error messages", async () => {
    await expect(getErrorMessage(new Error("Supabase failed"))).resolves.toBe(
      "Supabase failed",
    );
  });

  it("returns message properties from unknown objects", async () => {
    await expect(
      getErrorMessage({ message: "Email rate limit exceeded" }),
    ).resolves.toBe("Email rate limit exceeded");
  });

  it("does not return an empty plain object as braces", async () => {
    await expect(getErrorMessage({ message: "{}" })).resolves.toBe(
      "An unexpected signup error occurred.",
    );
  });

  it("extracts non-enumerable Error messages", async () => {
    const error = new Error("Non-enumerable message survives");
    expect(Object.keys(error)).toEqual([]);

    await expect(getErrorMessage(error)).resolves.toBe(
      "Non-enumerable message survives",
    );
  });

  it("extracts error_description", async () => {
    await expect(
      getErrorMessage({ error_description: "Magic link redirects are invalid" }),
    ).resolves.toBe("Magic link redirects are invalid");
  });

  it("extracts details and hint", async () => {
    await expect(getErrorMessage({ details: "Detailed failure" })).resolves.toBe(
      "Detailed failure",
    );
    await expect(getErrorMessage({ hint: "Check the auth redirect URL" })).resolves.toBe(
      "Check the auth redirect URL",
    );
  });

  it("reads Response JSON error bodies", async () => {
    const response = Response.json(
      { error_description: "Provider rejected the request" },
      { status: 400 },
    );

    await expect(getErrorMessage(response)).resolves.toBe(
      "Provider rejected the request",
    );
  });

  it("reads Response text bodies", async () => {
    const response = new Response("Plain response failure", { status: 500 });

    await expect(getErrorMessage(response)).resolves.toBe(
      "Plain response failure",
    );
  });

  it("returns a fallback for unknown errors", async () => {
    await expect(getErrorMessage({})).resolves.toBe(
      "An unexpected signup error occurred.",
    );
  });

  it("returns a fallback for unknown empty objects", async () => {
    await expect(getErrorMessage({})).resolves.toBe(
      "An unexpected signup error occurred.",
    );
  });

  it("extracts error fields after message is unusable", async () => {
    await expect(
      getErrorMessage({ message: "{}", error: "Readable fallback field" }),
    ).resolves.toBe("Readable fallback field");
  });

  it("keeps the older Supabase object message behavior", async () => {
    await expect(
      getErrorMessage({ message: "Email rate limit exceeded" }),
    ).resolves.toBe(
      "Email rate limit exceeded",
    );
  });
});
