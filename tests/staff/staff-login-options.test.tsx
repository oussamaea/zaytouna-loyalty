/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffLoginOptions } from "@/components/staff-login-options";

const {
  mockCreateSupabaseBrowserClient,
  mockReplace,
  mockSignInWithPassword,
  mockSignOut,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockCreateSupabaseBrowserClient: vi.fn(),
  mockReplace: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: mockCreateSupabaseBrowserClient,
}));

function mockSupabase(role: "staff" | "admin" | "customer" | null) {
  mockCreateSupabaseBrowserClient.mockReturnValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  });
  mockSignInWithPassword.mockResolvedValue({
    data: { user: { id: `${role ?? "unknown"}-1` } },
    error: null,
  });
  mockMaybeSingle.mockResolvedValue({
    data: role ? { role } : null,
    error: null,
  });
  mockSignOut.mockResolvedValue({ error: null });
}

async function submitPasswordLogin() {
  fireEvent.change(screen.getByLabelText(/staff email/i), {
    target: { value: "staff@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "correct horse battery staple" },
  });
  fireEvent.submit(screen.getByLabelText(/staff email/i).closest("form")!);
}

describe("StaffLoginOptions password flow", () => {
  beforeEach(() => {
    mockSupabase("staff");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("offers password login and email-code login choices", () => {
    render(<StaffLoginOptions />);

    expect(
      screen.getAllByRole("button", { name: "Sign in with password" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("tab", { name: "Send email code" }),
    ).toBeInTheDocument();
  });

  it("redirects staff users to the dashboard after password login", async () => {
    mockSupabase("staff");
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "staff@example.com",
        password: "correct horse battery staple",
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith("/staff/dashboard");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("redirects admin users to the dashboard after password login", async () => {
    mockSupabase("admin");
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/staff/dashboard"),
    );
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signs out and rejects customer accounts", async () => {
    mockSupabase("customer");
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is not authorized for staff access.",
    );
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows readable invalid credential errors", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid login credentials",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
