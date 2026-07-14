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
  env: {
    googleWalletEnabled: false,
    appleWalletEnabled: false,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

function createQueryBuilder(table: string) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => {
      if (table === "loyalty_transactions") {
        return { data: [], error: null };
      }

      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === "profiles") {
        return {
          data: {
            id: "customer-1",
            first_name: "Layla",
            loyalty_member_code: "ZB-ABC123",
          },
          error: null,
        };
      }

      if (table === "loyalty_accounts") {
        return {
          data: {
            customer_id: "customer-1",
            current_stamps: 4,
            cycle_number: 1,
            fifth_reward_status: "locked",
            tenth_reward_status: "locked",
            version: 1,
            updated_at: "2026-07-12T12:00:00.000Z",
          },
          error: null,
        };
      }

      return { data: null, error: null };
    }),
  };

  return builder;
}

function mockSupabase(user: { id: string } | null) {
  mockCreateSupabaseServerClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: null,
      })),
    },
    from: vi.fn((table: string) => createQueryBuilder(table)),
  });
}

async function renderCardPage() {
  const { default: CardPage } = await import("@/app/card/page");
  const element = await CardPage();

  return renderToStaticMarkup(element);
}

describe("/card page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("never renders the Join form", async () => {
    mockSupabase({ id: "customer-1" });

    const html = await renderCardPage();

    expect(html).not.toContain("Start your loyalty card");
    expect(html).not.toContain("I accept the Zaytouna loyalty terms");
    expect(html).not.toContain("Join with email");
  });

  it("redirects unauthenticated users to login", async () => {
    mockSupabase(null);

    await expect(renderCardPage()).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/card",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/login?next=/card");
  });

  it("renders member code and stamp progress for authenticated users", async () => {
    mockSupabase({ id: "customer-1" });

    const html = await renderCardPage();

    expect(html).toContain("Member ZB-ABC123");
    expect(html).toContain("4 of 10 stamps");
    expect(html).toContain("10%");
    expect(html).toContain("50%");
    expect(html).toContain("Add to Home Screen");
  });
});
