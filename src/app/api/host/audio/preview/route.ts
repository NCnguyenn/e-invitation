import { NextResponse } from 'next/server';
import { AuthRequiredError, AuthServiceError, requireHost } from '@/features/auth/server';
import { previewHostAudio } from '@/features/events/server';
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
  return NextResponse.json(
    { code: 'preview_error', message: 'KhÃ´ng thá»ƒ táº¡o liÃªn káº¿t nghe thá»­ lÃºc nÃ y. Vui lÃ²ng thá»­ láº¡i.' },
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
    const result = await previewHostAudio(userId);

    if (!result) {
      return NextResponse.json(
        { code: 'no_music', message: 'Sá»± kiá»‡n chÆ°a cÃ³ nháº¡c ná»n.' },
        { status: 404, headers },
      );
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
