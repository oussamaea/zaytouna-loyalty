import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetStaffContext, mockHashQrToken, mockParseQrPayload } = vi.hoisted(
  () => ({
    mockGetStaffContext: vi.fn(),
    mockHashQrToken: vi.fn((token: string) => `hash-${token}`),
    mockParseQrPayload: vi.fn((payload: string) => payload.trim()),
  }),
);

vi.mock("@/lib/staff", () => ({
  getStaffContext: mockGetStaffContext,
}));

vi.mock("@/lib/qr", () => ({
  hashQrToken: mockHashQrToken,
  parseQrPayload: mockParseQrPayload,
}));

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Layla",
  loyalty_member_code: "ZB-EDCF6B",
};

const account = {
  customer_id: profile.id,
  current_stamps: 4,
  cycle_number: 2,
  fifth_reward_status: "locked",
  tenth_reward_status: "locked",
};

function createQuery(result: { data: unknown; error?: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: result.data,
      error: result.error ?? null,
    })),
  };
}

function createAdmin(options: {
  profileData?: unknown;
  accountData?: unknown;
  qrData?: unknown;
  updateSpy?: ReturnType<typeof vi.fn>;
}) {
  const profileQuery = createQuery({
    data: "profileData" in options ? options.profileData : profile,
  });
  const accountQuery = createQuery({
    data: "accountData" in options ? options.accountData : account,
  });
  const qrQuery = createQuery({ data: options.qrData });
  const updateSpy = options.updateSpy ?? vi.fn();

  return {
    updateSpy,
    profileQuery,
    accountQuery,
    qrQuery,
    admin: {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return profileQuery;
        }

        if (table === "loyalty_accounts") {
          return accountQuery;
        }

        if (table === "qr_tokens") {
          return {
            ...qrQuery,
            update: updateSpy,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}

async function callLookup(query: string) {
  const { GET } = await import("@/app/api/staff/lookup/route");

  return GET(new Request(`https://loyalty.example.com/api/staff/lookup${query}`));
}

describe("staff lookup route", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("finds exact member code ZB-EDCF6B", async () => {
    const { admin, profileQuery } = createAdmin({});
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?memberCode=ZB-EDCF6B");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      customer: {
        id: profile.id,
        firstName: "Layla",
        memberCode: "ZB-EDCF6B",
        currentStamps: 4,
        cycleNumber: 2,
        fifthRewardStatus: "locked",
        tenthRewardStatus: "locked",
      },
    });
    expect(profileQuery.eq).toHaveBeenCalledWith(
      "loyalty_member_code",
      "ZB-EDCF6B",
    );
    expect(profileQuery.eq).toHaveBeenCalledWith("role", "customer");
  });

  it("normalizes lowercase member codes", async () => {
    const { admin, profileQuery } = createAdmin({});
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?memberCode=zb-edcf6b");

    expect(response.status).toBe(200);
    expect(profileQuery.eq).toHaveBeenCalledWith(
      "loyalty_member_code",
      "ZB-EDCF6B",
    );
  });

  it("trims surrounding spaces from member codes", async () => {
    const { admin, profileQuery } = createAdmin({});
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?memberCode=%20ZB-EDCF6B%20");

    expect(response.status).toBe(200);
    expect(profileQuery.eq).toHaveBeenCalledWith(
      "loyalty_member_code",
      "ZB-EDCF6B",
    );
  });

  it("returns 400 for invalid member-code format", async () => {
    const { admin } = createAdmin({});
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?memberCode=EDCF6B");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid member code.",
    });
  });

  it("returns 404 for unknown member codes", async () => {
    const { admin } = createAdmin({ profileData: null });
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?memberCode=ZB-EDCF6B");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Customer not found.",
    });
  });

  it("blocks customer-role callers before lookup", async () => {
    mockGetStaffContext.mockResolvedValue({
      error: Response.json(
        { error: "Staff authorization required." },
        { status: 403 },
      ),
    });

    const response = await callLookup("?memberCode=ZB-EDCF6B");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Staff authorization required.",
    });
  });

  it("finds customers by valid QR token without consuming it", async () => {
    const updateSpy = vi.fn();
    const { admin, qrQuery } = createAdmin({
      qrData: {
        customer_id: profile.id,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        used_at: null,
        revoked_at: null,
      },
      updateSpy,
    });
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?qrPayload=raw-token");

    expect(response.status).toBe(200);
    expect(mockParseQrPayload).toHaveBeenCalledWith("raw-token");
    expect(mockHashQrToken).toHaveBeenCalledWith("raw-token");
    expect(qrQuery.eq).toHaveBeenCalledWith("token_hash", "hash-raw-token");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns readable QR expiry errors", async () => {
    const { admin } = createAdmin({
      qrData: {
        customer_id: profile.id,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        used_at: null,
        revoked_at: null,
      },
    });
    mockGetStaffContext.mockResolvedValue({
      staff: { id: "staff-1", role: "staff" },
      admin,
    });

    const response = await callLookup("?qrPayload=expired-token");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "QR code expired. Ask the customer to refresh their card.",
    });
  });
});
