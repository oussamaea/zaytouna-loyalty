# Google Wallet Stage 2 Notes

Google Wallet is disabled by default:

```text
NEXT_PUBLIC_GOOGLE_WALLET_ENABLED=false
```

Stage 2 work should add:

- Server-only service account credential parsing.
- Loyalty class creation or verification using `GOOGLE_WALLET_ISSUER_ID` and
  `GOOGLE_WALLET_CLASS_ID`.
- Customer loyalty object creation using the member code, stamp progress, and
  reward state.
- Signed Add to Google Wallet links.
- Pass updates after `add_stamp`, `redeem_fifth_reward`, and
  `redeem_tenth_reward`.
- Error handling that keeps the loyalty app usable if Wallet sync fails.

Required variables:

```text
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_CLASS_ID=
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WALLET_PRIVATE_KEY=
```
