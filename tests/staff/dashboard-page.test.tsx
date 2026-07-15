import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRedirect, mockCreateSupabaseServerClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  mockCreateSupabaseServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/env", () => ({
  hasSupabasePublicEnv: () => true,
  hasSupabaseAdminEnv: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

function mockProfile(role: "customer" | "staff" | "admin" | null) {
  mockCreateSupabaseServerClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: role ? { id: `${role}-1` } : null },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: role
          ? {
              id: `${role}-1`,
              first_name: role,
              last_name: null,
              email: `${role}@example.com`,
              birthday: null,
              role,
              loyalty_member_code: "ZB-ABC123",
              created_at: "2026-07-12T12:00:00.000Z",
              updated_at: "2026-07-12T12:00:00.000Z",
            }
          : null,
      })),
    })),
  });
}

async function renderStaffDashboard() {
  const { default: StaffDashboardPage } =
    await import("@/app/staff/dashboard/page");
  const element = await StaffDashboardPage();

  return renderToStaticMarkup(element);
}

describe("/staff/dashboard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects anonymous users to staff login", async () => {
    mockProfile(null);

    await expect(renderStaffDashboard()).rejects.toThrow(
      "NEXT_REDIRECT:/staff/login",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/staff/login");
  });

  it("redirects customer users to their card", async () => {
    mockProfile("customer");

    await expect(renderStaffDashboard()).rejects.toThrow("NEXT_REDIRECT:/card");
    expect(mockRedirect).toHaveBeenCalledWith("/card");
  });

  it("renders the scanner dashboard for staff", async () => {
    mockProfile("staff");

    const html = await renderStaffDashboard();

    expect(html).toContain("Staff Loyalty Dashboard");
    expect(html).toContain("Start camera");
    expect(html).not.toContain("Protected staff login");
    expect(html).not.toContain("Send code");
  });
});
