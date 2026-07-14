/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffLoginOptions } from "@/components/staff-login-options";

const {
  mockCreateSupabaseBrowserClient,
  mockReplace,
  mockSignInWithPassword,
  mockGetUser,
  mockSignOut,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockCreateSupabaseBrowserClient: vi.fn(),
  mockReplace: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockGetUser: vi.fn(),
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
      getUser: mockGetUser,
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
  mockGetUser.mockResolvedValue({
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
    expect(mockGetUser).toHaveBeenCalled();
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

  it("shows readable email-not-confirmed errors", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email not confirmed",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows readable network failure errors", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("Network unavailable"));
    render(<StaffLoginOptions />);

    await submitPasswordLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network failure. Please check your connection and try again.",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("prevents duplicate password submissions while signing in", async () => {
    let resolveSignIn: (value: unknown) => void = () => undefined;
    mockSignInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<StaffLoginOptions />);

    fireEvent.change(screen.getByLabelText(/staff email/i), {
      target: { value: "staff@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "correct horse battery staple" },
    });
    const form = screen.getByLabelText(/staff email/i).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Signing in..." }),
      ).toBeDisabled(),
    );

    resolveSignIn({ data: { user: { id: "staff-1" } }, error: null });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/staff/dashboard"),
    );
  });

  it("does not reference the service-role key in the browser component", () => {
    const componentSource = readFileSync(
      join(process.cwd(), "src/components/staff-login-options.tsx"),
      "utf8",
    );

    expect(componentSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(componentSource).not.toContain("serviceRole");
    expect(componentSource).not.toContain("supabaseServiceRoleKey");
  });
});
