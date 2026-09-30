import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

function applyPrivateHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) {
    response.headers.set(key, value);
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public samples never need a session or data from the visitor's account.
  if (path === '/demo' || path.startsWith('/demo/')) {
    return NextResponse.next();
  }

  // Guest invitation pages and public RSVP/audio APIs do not use the visitor's
  // Supabase session — they are accessed via an opaque token. Skipping the auth
  // refresh removes one Supabase round-trip per public request.
  const isPublicGuestRoute = path.startsWith('/invite') || path.startsWith('/api/guest');
  if (isPublicGuestRoute) {
    const response = NextResponse.next();
    applyPrivateHeaders(response);
    return response;
  }

  const response = await updateSession(request);
  if (
    path.startsWith('/preview') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/system-admin') ||
    path.startsWith('/api/host') ||
    path.startsWith('/api/admin')
  ) {
    applyPrivateHeaders(response);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)'],
};
