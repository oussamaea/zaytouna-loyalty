# Security Model

## Staff Authentication Flow

1. Staff sign in with Supabase passwordless email.
2. Supabase emails a six-digit OTP code using `{{ .Token }}`.
3. The browser submits the code to `/api/auth/verify-code`.
4. The verification route calls `supabase.auth.verifyOtp()` with the email,
   typed code, and `type: "email"`, then attaches every Supabase `Set-Cookie`
   value to the JSON response.
5. Staff verification immediately checks that the profile role is `staff` or
   `admin` before returning `/staff/dashboard`.
6. The browser sends the Supabase session cookie to staff pages and API routes.
7. API routes call `supabase.auth.getUser()` with the user-scoped server client.
8. Routes verify the profile role is `staff` or `admin` before continuing.
9. Loyalty mutation routes call RPCs with the same user-scoped client.
10. PostgreSQL reads `auth.uid()` inside the RPC and validates that user again.
11. `loyalty_transactions.staff_id` is written from `auth.uid()`.

Clients never send the acting staff UUID, and RPC signatures do not accept
`p_staff_id`.

Email authentication does not use clickable magic links, auth `token_hash`, or
`exchangeCodeForSession()`. This prevents email-client prefetching from
consuming a login token before the user enters it.

## Service Role Usage

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It is allowed only in server modules,
after the route has authenticated staff access, for controlled lookup/read
helpers where RLS would otherwise make operational staff views awkward.

Do not use the service-role client for loyalty mutation RPCs. Doing so would
remove the caller identity from `auth.uid()`.

## Function Grants And RLS

The migration revokes `EXECUTE` from `PUBLIC` and `anon` for protected functions.
Staff mutation RPCs are granted only to `authenticated`; customers may technically
attempt the call, but PostgreSQL rejects them through `assert_staff_actor()`.

Direct table updates are not granted to customers for profiles, loyalty accounts,
transactions, QR tokens, or wallet passes. Customer profile edits go through
`update_profile()`, which accepts only `first_name`, `last_name`, and `birthday`.

## QR Tokens

QR values contain only an opaque random token wrapped in a small JSON payload.
The database stores only the HMAC hash. `add_stamp()` locks the QR token row with
`FOR UPDATE`, marks it used inside the same transaction, and rejects expired,
revoked, or already used tokens.

## End-To-End Checklist

- Customer signup creates a customer profile and loyalty account.
- Malformed birthday metadata does not block account creation.
- Customer cannot call `add_stamp`, `redeem_fifth_reward`, or
  `redeem_tenth_reward` successfully.
- Anonymous callers cannot execute protected mutation RPCs.
- Staff and admin users can add stamps.
- Staff and admin users can redeem unlocked rewards.
- Reusing a QR token succeeds at most once.
- Reusing a request ID for the same operation is idempotent.
- Reusing a request ID for a different customer or operation fails.
- Customers cannot update `role`, `loyalty_member_code`, email, stamp balance, or
  reward state.
