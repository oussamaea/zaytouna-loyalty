# Supabase Setup

1. Create a new Supabase project for `zaytouna-loyalty`.
2. In Authentication, enable email OTP/passwordless sign-in.
3. Set the site URL to the deployed app URL. No clickable auth callback URL is
   required for the email OTP flow.
4. Run `supabase/migrations/0001_initial_loyalty.sql` in SQL Editor or through
   the Supabase CLI.
5. Copy the project URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Copy the service-role key into `SUPABASE_SERVICE_ROLE_KEY` on the server only.
7. Generate a strong random `LOYALTY_QR_SIGNING_SECRET`.

## Email Template

This app uses 8-digit email OTP codes. The email must show the code only, not
a clickable magic link. That avoids email-client prefetching consuming a login
token before the customer or staff member opens the message.

In Supabase Dashboard, open **Authentication > Email Templates > Magic Link**
and replace the body with a code-focused template:

```html
<h2>Sign in to Zaytouna Loyalty</h2>
<p>Your 8-digit sign-in code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em;">
  {{ .Token }}
</p>
<p>This code expires shortly. If you did not request it, you can ignore this email.</p>
```

The required Supabase variable is:

```text
{{ .Token }}
```

Do not use `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, `/auth/v1/verify`, or
an app `/auth/callback` link for this email OTP flow. The browser submits the
typed code to `/api/auth/verify-code`, which calls `verifyOtp({ email, token,
type: "email" })` and returns the post-login destination.

## Staff Account Setup

Public staff registration is intentionally unavailable.

Only a trusted owner/operator should perform the first promotion from the
Supabase dashboard SQL editor.

1. Create a normal authenticated user in Supabase Auth.
2. Have the user complete the email login once so a profile row is created.
3. Promote that exact profile by email:

```sql
update public.profiles
set role = 'admin'
where email = 'staff@example.com';
```

Or promote by known UUID:

```sql
update public.profiles
set role = 'staff'
where id = '00000000-0000-0000-0000-000000000000';
```

Use `admin` only for owners or operators who should have elevated access. Never
add a public role-selection field.

## Applying the Migration Later

The migration has not been applied by this repository. When ready:

1. Review `supabase/migrations/0001_initial_loyalty.sql`.
2. Confirm the Supabase project is empty or intended for this standalone app.
3. Apply the migration through the Supabase dashboard SQL editor or Supabase CLI.
4. Create one normal user, sign in once, then promote that specific profile using
   the controlled SQL above.
5. Run end-to-end checks before connecting the loyalty app from the public site.

## Cooldown

The default stamp cooldown is five minutes. The app environment variable is:

```text
LOYALTY_STAMP_COOLDOWN_SECONDS=300
```

The migration defaults database enforcement to 300 seconds. If a different
database-level value is needed, set `app.loyalty_stamp_cooldown_seconds` for the
database/session before calling the RPC functions.

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.
- Loyalty mutations must go through protected API routes or equivalent
  server-only code using a user-scoped Supabase client.
- Mutation RPCs derive the actor from `auth.uid()` and reject non-staff callers
  in PostgreSQL.
- QR tokens store only HMAC hashes in the database.
- Customers can read their own loyalty data but cannot write stamps or rewards.
- Email authentication uses 8-digit OTP codes displayed with `{{ .Token }}`.
  Do not include clickable auth links in the email template.
