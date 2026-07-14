/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";

function fillJoinForm(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Layla" },
  });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "layla@example.com" },
  });
  fireEvent.click(container.querySelector("input[name='acceptedTerms']")!);
}

describe("AuthForm join mode", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("displays a readable API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Email rate limit exceeded" }, { status: 400 }),
      ),
    );

    const { container } = render(<AuthForm mode="join" />);
    fillJoinForm(container);
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email rate limit exceeded",
    );
  });

  it("does not stringify object-shaped API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "Do not expose me as JSON" } }, { status: 500 }),
      ),
    );

    const { container } = render(<AuthForm mode="join" />);
    fillJoinForm(container);
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
  });

  it("displays the code instruction after successful signup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));

    const { container } = render(<AuthForm mode="join" />);
    fillJoinForm(container);
    fireEvent.submit(container.querySelector("form")!);

    expect(
      await screen.findByText("Check your email for an 8-digit code."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify code" })).toBeInTheDocument();
  });

  it("displays invalid and expired code messages from verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(
          Response.json(
            { error: "Token has expired or is invalid" },
            { status: 403 },
          ),
        ),
    );

    const { container } = render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "layla@example.com" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await screen.findByText("Check your email for an 8-digit code.");
    fireEvent.change(screen.getByLabelText(/eight-digit verification code/i), {
      target: { value: "00000000" },
    });
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Token has expired or is invalid",
    );
  });

  it("normalizes pasted codes with spaces or hyphens before verification", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json({ error: "Test stop after submit" }, { status: 400 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "layla@example.com" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await screen.findByText("Check your email for an 8-digit code.");
    const otpInput = screen.getByLabelText(/eight-digit verification code/i);
    fireEvent.paste(otpInput, {
      clipboardData: { getData: () => "12 34-5678 99" },
    });

    expect(otpInput).toHaveValue("12345678");
    fireEvent.submit(container.querySelector("form")!);

    await screen.findByRole("alert");
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      token: "12345678",
    });
  });

  it("keeps resend-code disabled during the cooldown", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));

    const { container } = render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "layla@example.com" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const cooldownButton = screen.getByRole("button", {
      name: /send another code in 30s/i,
    });
    expect(cooldownButton).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(
      screen.getByRole("button", { name: "Send another code" }),
    ).toBeEnabled();
  });
});
