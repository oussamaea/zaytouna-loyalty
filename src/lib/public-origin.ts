export function getConfiguredPublicOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || null;
}

export function getPublicOrigin(request: Request) {
  const configuredOrigin = getConfiguredPublicOrigin();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const requestOrigin = new URL(request.url).origin;

  return {
    configuredOrigin,
    forwardedHost,
    forwardedProto,
    requestOrigin,
    publicOrigin:
      configuredOrigin ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestOrigin),
  };
}

export function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/card";
  }

  return value;
}
