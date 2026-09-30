import { NextResponse } from 'next/server';
import { AuthRequiredError, AuthServiceError, requireHost } from '@/features/auth/server';
import { prepareHostAudioUpload } from '@/features/events/server';
import { parseAudioPrepare, ValidationError } from '@/lib/validation';
import { isAllowedMutationOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function failure(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.' },
      { status: 401, headers },
    );
  }
  if (error instanceof AuthServiceError) {
    console.error('[api] auth service unavailable', error);
    return NextResponse.json(
      { code: 'auth_unavailable', message: 'Dịch vụ xác thực tạm thời gián đoạn. Vui lòng thử lại sau.' },
      { status: 503, headers },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { code: 'invalid_input', message: error.message },
      { status: 422, headers },
    );
  }
  return NextResponse.json(
    { code: 'audio_error', message: 'KhÃ´ng thá»ƒ chuáº©n bá»‹ táº£i nháº¡c lÃºc nÃ y. Vui lÃ²ng thá»­ láº¡i.' },
    { status: 503, headers },
  );
}

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json(
      { code: 'invalid_origin', message: 'YÃªu cáº§u khÃ´ng há»£p lá»‡.' },
      { status: 403, headers },
    );
  }

  try {
    const { userId } = await requireHost();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('ThÃ´ng tin tá»‡p Ã¢m thanh khÃ´ng há»£p lá»‡.');
    }

    const input = parseAudioPrepare(body);
    const result = await prepareHostAudioUpload(userId, input);

    if (!result) {
      return NextResponse.json(
        { code: 'not_found', message: 'ChÆ°a cÃ³ sá»± kiá»‡n. LiÃªn há»‡ ngÆ°á»i thiáº¿t káº¿ Ä‘á»ƒ táº¡o sá»± kiá»‡n.' },
        { status: 404, headers },
      );
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
