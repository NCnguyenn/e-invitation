import { NextResponse } from 'next/server';
import { requestGuestAudioUrl } from '@/features/guest/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { isInvitationToken } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (request.headers.get('origin') && !isAllowedMutationOrigin(request)) {
    return NextResponse.json(
      { code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' },
      { status: 403, headers },
    );
  }

  try {
    const { token } = await context.params;
    if (!isInvitationToken(token)) {
      return NextResponse.json(
        { code: 'not_found', message: 'Không tìm thấy thư mời hoặc sự kiện không truy cập được.' },
        { status: 404, headers },
      );
    }

    const result = await requestGuestAudioUrl(token);

    if (result.kind === 'not_found') {
      return NextResponse.json(
        { code: 'not_found', message: 'Không tìm thấy thư mời hoặc sự kiện không truy cập được.' },
        { status: 404, headers },
      );
    }

    if (result.kind === 'no_music') {
      return NextResponse.json(
        { code: 'no_music', message: 'Sự kiện chưa có nhạc nền.' },
        { status: 404, headers },
      );
    }

    if (result.kind === 'rate_limited') {
      return NextResponse.json(
        {
          code: 'rate_limited',
          message: `Bạn đã yêu cầu phát nhạc quá nhiều lần. Vui lòng thử lại sau ${result.retryAfterSeconds} giây.`,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': String(result.retryAfterSeconds),
          },
        },
      );
    }

    return NextResponse.json(
      {
        signedUrl: result.signedUrl,
        expiresIn: result.expiresIn,
        expiresAt: result.expiresAt,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error('[api/guest/audio] requestGuestAudioUrl failed', error);
    return NextResponse.json(
      { code: 'guest_error', message: 'Dịch vụ phát nhạc tạm thời gián đoạn. Vui lòng thử lại sau.' },
      { status: 503, headers },
    );
  }
}
