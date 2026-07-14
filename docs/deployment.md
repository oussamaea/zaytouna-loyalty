# Vercel Deployment

1. Create a new Vercel project from this standalone repository.
2. Set the framework preset to Next.js.
3. Add all required environment variables from `.env.example`.
4. Keep `SUPABASE_SERVICE_ROLE_KEY`, `LOYALTY_QR_SIGNING_SECRET`, and wallet
   private keys as encrypted server environment variables only.
   `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_`.
5. Set the Supabase Auth site URL to the deployed app URL.
6. Update the Supabase Magic Link email template to show the six-digit
   `{{ .Token }}` code, as shown in `docs/supabase-setup.md`.
7. Run `npm run build` before deploy or let Vercel run it.
8. Do not deploy from the public Zaytouna website repository.

## Production Checks

- Confirm `/join` sends a six-digit email code.
- Confirm the email contains `{{ .Token }}` output and no clickable auth link.
- Confirm `/card` requires login and displays a QR code.
- Confirm `/staff/dashboard` rejects non-staff users.
- Confirm staff can scan or manually look up a member code.
- Confirm reward redemption requires staff confirmation.
- Confirm mutation RPCs are called with the authenticated user-scoped client and
  record the staff ID from `auth.uid()`.
