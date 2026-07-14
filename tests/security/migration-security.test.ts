import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/0001_initial_loyalty.sql"),
  "utf8",
);
const addStampRoute = readFileSync(
  join(root, "src/app/api/staff/loyalty/add-stamp/route.ts"),
  "utf8",
);
const redeemFifthRoute = readFileSync(
  join(root, "src/app/api/staff/loyalty/redeem-fifth/route.ts"),
  "utf8",
);
const redeemTenthRoute = readFileSync(
  join(root, "src/app/api/staff/loyalty/redeem-tenth/route.ts"),
  "utf8",
);
const lookupRoute = readFileSync(
  join(root, "src/app/api/staff/lookup/route.ts"),
  "utf8",
);

function extractMigrationBlock(start: string, end: string) {
  return migration.slice(migration.indexOf(start), migration.indexOf(end));
}

describe("database authorization hardening", () => {
  it("does not accept caller supplied staff IDs for loyalty mutations", () => {
    expect(migration).not.toContain("p_staff_id");
    expect(addStampRoute).not.toContain("p_staff_id");
    expect(redeemFifthRoute).not.toContain("p_staff_id");
    expect(redeemTenthRoute).not.toContain("p_staff_id");
  });

  it("records the acting staff member from auth.uid()", () => {
    expect(migration).toContain("v_actor_id := auth.uid()");
    expect(migration).toContain("staff_id");
    expect(migration).toContain("v_actor_id,\n    'stamp_added'");
    expect(migration).toContain("v_actor_id,\n    'fifth_reward_redeemed'");
    expect(migration).toContain("v_actor_id,\n    'tenth_reward_redeemed'");
  });

  it("rejects anonymous and customer callers in protected RPC functions", () => {
    expect(migration).toContain("raise exception 'Authentication required.'");
    expect(migration).toContain(
      "raise exception 'Staff authorization required.'",
    );
    expect(migration).toContain("v_actor_id := public.assert_staff_actor()");
    expect(migration).toContain(
      "revoke execute on function public.add_stamp(uuid, text, text, text, text) from public, anon",
    );
  });

  it("keeps mutation routes on the user-scoped Supabase client", () => {
    expect(addStampRoute).toContain('context.supabase.rpc("add_stamp"');
    expect(redeemFifthRoute).toContain(
      'context.supabase.rpc("redeem_fifth_reward"',
    );
    expect(redeemTenthRoute).toContain(
      'context.supabase.rpc("redeem_tenth_reward"',
    );
    expect(addStampRoute).not.toContain("context.admin.rpc");
    expect(redeemFifthRoute).not.toContain("context.admin.rpc");
    expect(redeemTenthRoute).not.toContain("context.admin.rpc");
  });
});

describe("profile and loyalty data protections", () => {
  it("does not grant direct profile or loyalty updates to customers", () => {
    expect(migration).toContain("revoke all on table public.profiles");
    expect(migration).not.toMatch(/grant\s+update\s+on\s+public\.profiles/i);
    expect(migration).not.toMatch(
      /grant\s+update\s+on\s+public\.loyalty_accounts/i,
    );
    expect(migration).toContain(
      "create or replace function public.update_profile",
    );
  });

  it("prevents customers from changing role, member code, or loyalty state directly", () => {
    const updateProfileBody = migration.slice(
      migration.indexOf("create or replace function public.update_profile"),
      migration.indexOf(
        "create or replace function public.resolve_loyalty_customer",
      ),
    );
    const updateSetClause = updateProfileBody.slice(
      updateProfileBody.indexOf("set"),
      updateProfileBody.indexOf("where id = auth.uid()"),
    );
    expect(updateSetClause).not.toMatch(/role\s*=/i);
    expect(updateSetClause).not.toMatch(/loyalty_member_code\s*=/i);
    expect(updateSetClause).not.toMatch(/current_stamps\s*=/i);
    expect(migration).toContain("where id = auth.uid() and role = 'customer'");
  });

  it("adds integrity constraints for reward state and request IDs", () => {
    expect(migration).toContain("fifth_reward_requires_five_stamps");
    expect(migration).toContain("tenth_reward_requires_ten_stamps");
    expect(migration).toContain("tenth_available_at_exactly_ten");
    expect(migration).toContain("char_length(request_id) between 36 and 80");
  });

  it("keeps generated users as customers and ignores role/member-code metadata", () => {
    expect(migration).toContain("'customer',");
    expect(migration).not.toContain("raw_user_meta_data->>'role'");
    expect(migration).not.toContain(
      "raw_user_meta_data->>'loyalty_member_code'",
    );
    expect(migration).toContain("public.safe_optional_birthday");
  });
});

describe("qr token and idempotency protections", () => {
  it("allows staff and admin users to select qr tokens through RLS", () => {
    const qrSelectPolicy = extractMigrationBlock(
      'create policy "staff can read qr tokens"',
      'create policy "customers and staff can read wallet passes"',
    );

    expect(migration).toContain("grant select on public.qr_tokens to authenticated");
    expect(qrSelectPolicy).toContain("on public.qr_tokens for select");
    expect(qrSelectPolicy).toContain("to authenticated");
    expect(qrSelectPolicy).toContain(
      "public.current_user_is_staff_or_admin()",
    );
    expect(migration).toContain("role in ('staff', 'admin')");
  });

  it("prevents customers and anonymous users from selecting qr tokens", () => {
    const qrSelectPolicy = extractMigrationBlock(
      'create policy "staff can read qr tokens"',
      'create policy "customers and staff can read wallet passes"',
    );

    expect(migration).toContain(
      "revoke all on table public.qr_tokens from anon, authenticated",
    );
    expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.qr_tokens\s+to\s+anon/i);
    expect(qrSelectPolicy).not.toContain("customer_id = auth.uid()");
    expect(qrSelectPolicy).not.toContain("id = auth.uid()");
  });

  it("stores only hashed qr tokens and claims them with row locking", () => {
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("for update");
    expect(migration).toContain("set used_at = now()");
    expect(migration).toContain("and used_at is null");
    expect(migration).not.toContain("token text");
  });

  it("consumes QR tokens only inside add_stamp and rejects reuse", () => {
    const addStampFunction = extractMigrationBlock(
      "create or replace function public.add_stamp",
      "create or replace function public.redeem_fifth_reward",
    );

    expect(addStampFunction).toContain("where token_hash = p_qr_token_hash");
    expect(addStampFunction).toContain("for update");
    expect(addStampFunction).toContain("set used_at = now()");
    expect(addStampFunction).toContain("where id = v_qr_token_id and used_at is null");
    expect(addStampFunction).toContain(
      "QR token is invalid, expired, or already used.",
    );
  });

  it("does not consume QR tokens during staff lookup", () => {
    expect(lookupRoute).toContain('.from("qr_tokens")');
    expect(lookupRoute).toContain(
      '.select("customer_id, expires_at, used_at, revoked_at")',
    );
    expect(lookupRoute).not.toContain("set used_at");
    expect(lookupRoute).not.toContain(".update(");
  });

  it("successful add_stamp consumes a qr token once", () => {
    const addStampFunction = extractMigrationBlock(
      "create or replace function public.add_stamp",
      "create or replace function public.redeem_fifth_reward",
    );
    const consumeMatches = addStampFunction.match(/set used_at = now\(\)/g) ?? [];

    expect(consumeMatches).toHaveLength(1);
    expect(addStampFunction).toContain("where id = v_qr_token_id and used_at is null");
    expect(addStampFunction).toContain("if not found then");
    expect(addStampFunction).toContain(
      "QR token is invalid, expired, or already used.",
    );
  });

  it("limits qr creation to authenticated customers and short lifetimes", () => {
    expect(migration).toContain(
      "customers can create own short lived qr tokens",
    );
    expect(migration).toContain("customer_id = auth.uid()");
    expect(migration).toContain("expires_at <= now() + interval '3 minutes'");
  });

  it("validates duplicate request IDs by operation, actor, and customer", () => {
    expect(migration).toContain("public.return_idempotent_account");
    expect(migration).toContain(
      "v_transaction.transaction_type <> p_transaction_type",
    );
    expect(migration).toContain("v_transaction.staff_id <> p_actor_id");
    expect(migration).toContain(
      "Request ID was already used for a different customer",
    );
  });
});
