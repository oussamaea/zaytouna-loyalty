# Apple Wallet Stage 3 Notes

Apple Wallet is disabled by default:

```text
NEXT_PUBLIC_APPLE_WALLET_ENABLED=false
```

Do not generate Apple Wallet passes until signed Apple certificates are
available. Required Apple Wallet assets usually include:

- Apple Developer Team ID.
- Pass Type Identifier.
- Pass signing certificate.
- Certificate password or secure key handling.
- WWDR intermediate certificate if required by the pass-generation library.

Placeholder variables:

```text
APPLE_PASS_TYPE_IDENTIFIER=
APPLE_TEAM_IDENTIFIER=
APPLE_PASS_CERTIFICATE_BASE64=
APPLE_PASS_CERTIFICATE_PASSWORD=
```

The Stage 1 app includes only a disabled adapter and disabled customer button.
