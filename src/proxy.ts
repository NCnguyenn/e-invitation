import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Public samples never need a session or data from the visitor's account.
  if (path === '/demo' || path.startsWith('/demo/')) return NextResponse.next();
  const response = await updateSession(request);
  if (
    path.startsWith('/invite') ||
    path.startsWith('/preview') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/system-admin') ||
    path.startsWith('/api/guest') ||
    path.startsWith('/api/host') ||
    path.startsWith('/api/admin')
  ) {
    response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)'],
};
