import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRedirect, mockGetCurrentProfile } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  mockGetCurrentProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/env", () => ({
  hasSupabasePublicEnv: () => true,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentProfile: mockGetCurrentProfile,
}));

async function renderStaffLogin() {
  const { default: StaffLoginPage } = await import("@/app/staff/login/page");
  const element = await StaffLoginPage();

  return renderToStaticMarkup(element);
}

describe("/staff/login", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders only the staff login form for anonymous users", async () => {
    mockGetCurrentProfile.mockResolvedValue(null);

    const html = await renderStaffLogin();

    expect(html).toContain("Protected staff login");
    expect(html).toContain("Sign in with password");
    expect(html).toContain("Send email code");
    expect(html).not.toContain("Staff Loyalty Dashboard");
  });

  it("redirects staff users to the dashboard", async () => {
    mockGetCurrentProfile.mockResolvedValue({ role: "staff" });

    await expect(renderStaffLogin()).rejects.toThrow(
      "NEXT_REDIRECT:/staff/dashboard",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/staff/dashboard");
  });

  it("redirects customer users to their card", async () => {
    mockGetCurrentProfile.mockResolvedValue({ role: "customer" });

    await expect(renderStaffLogin()).rejects.toThrow("NEXT_REDIRECT:/card");
    expect(mockRedirect).toHaveBeenCalledWith("/card");
  });
});
