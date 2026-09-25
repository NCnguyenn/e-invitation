export function isAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  // Hosting proxies must not allow forwarded headers to expand the production allowlist.
  const configured = process.env.SITE_URL?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!configured) return false;
    try { return originUrl.origin === new URL(configured).origin; }
    catch { return false; }
  }
  const requestUrl = new URL(request.url);
  if (originUrl.origin === requestUrl.origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '');
    if (`${proto}://${host}` === originUrl.origin) return true;
  }
  if (!configured) return false;
  try {
    return originUrl.origin === new URL(configured).origin;
  } catch {
    return false;
  }
}
