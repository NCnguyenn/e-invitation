import { NextResponse } from 'next/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json(
      { code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' },
      { status: 403, headers: NO_STORE },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'invalid_input', message: 'Email hoặc mật khẩu không đúng.' },
      { status: 422, headers: NO_STORE },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password || !email.includes('@')) {
    return NextResponse.json(
      { code: 'invalid_credentials', message: 'Email hoặc mật khẩu không đúng.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json(
      { code: 'invalid_credentials', message: 'Email hoặc mật khẩu không đúng.' },
      { status: 401, headers: NO_STORE },
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
