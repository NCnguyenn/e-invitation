import { NextResponse } from 'next/server';
import { readGuestInvitation } from '@/features/guest/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const invitation = await readGuestInvitation(token);
    if (!invitation) return NextResponse.json({ code: 'not_found', message: 'Không tìm thấy thư mời.' }, { status: 404, headers });
    return NextResponse.json({ invitation }, { headers });
  } catch (error) {
    console.error('[api/guest] readGuestInvitation failed', error);
    return NextResponse.json({ code: 'guest_error', message: 'Không thể tải thư mời lúc này. Vui lòng thử lại.' }, { status: 503, headers });
  }
}
