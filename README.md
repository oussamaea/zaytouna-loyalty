# Zaytouna Loyalty

Standalone digital loyalty-card app for Zaytouna Bistro. This repository is
separate from the public Zaytouna website and is intended to be deployed and
tested independently.

## Stage 1 Scope

- Next.js App Router, TypeScript, Tailwind CSS.
- Supabase Auth, PostgreSQL migrations, RLS policies, and transactional loyalty
  RPC functions.
- Customer join, login, and loyalty card routes.
- Staff login, scanner dashboard, member-code lookup, stamp addition, and reward
  redemption routes.
- Short-lived QR codes without personal information.
- PWA manifest, install behavior, and conservative service worker caching.
- Tests for the core loyalty rules.

## Local Development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill Supabase values.
3. Run Supabase migrations from `supabase/migrations`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

Without Supabase environment variables, public design pages still render, while
protected card and staff data stay closed.

## Useful Commands

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentation

- `docs/supabase-setup.md`
- `docs/security.md`
- `docs/deployment.md`
- `docs/wallet-google.md`
- `docs/wallet-apple.md`

## Authentication Architecture

Customers and staff sign in with Supabase passwordless email OTP. The email
template must show the 8-digit `{{ .Token }}` code and must not include a
clickable magic link. The browser submits the typed code to
`/api/auth/verify-code`, which verifies it with Supabase and attaches Supabase
session cookies to the response before sending customers to `/card` or staff to
`/staff/dashboard`.

Browser requests carry the Supabase session cookie to Next.js route handlers.
Staff mutation routes first verify the session and staff/admin role, then call
PostgreSQL RPCs through the user-scoped Supabase server client, not the
service-role client.

Inside PostgreSQL, `auth.uid()` is the source of truth for the acting staff
identity. Loyalty transaction rows record `staff_id` from `auth.uid()`, and the
client cannot supply or impersonate a staff UUID.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It may be used for controlled
server-side read helpers such as staff lookup after a staff session check, but it
must never be exposed through `NEXT_PUBLIC_` variables and must not be used for
loyalty mutation RPCs.

## Supabase Email Template

Use a code-only email template for passwordless authentication:

```html
<h2>Sign in to Zaytouna Loyalty</h2>
<p>Your 8-digit sign-in code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em;">
  {{ .Token }}
</p>
<p>This code expires shortly. If you did not request it, you can ignore this email.</p>
```

Do not include clickable magic links, `{{ .ConfirmationURL }}`, or
`{{ .TokenHash }}` in the email template.
