import { NextResponse } from 'next/server';
import { AuthRequiredError, requireHost } from '@/features/auth/server';
import { previewHostAudio } from '@/features/events/server';
import { isAllowedMutationOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function failure(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
      { status: 401, headers },
    );
  }
  return NextResponse.json(
    { code: 'preview_error', message: 'Không thể tạo liên kết nghe thử lúc này. Vui lòng thử lại.' },
    { status: 503, headers },
  );
}

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json(
      { code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' },
      { status: 403, headers },
    );
  }

  try {
    const { userId } = await requireHost();
    const result = await previewHostAudio(userId);

    if (!result) {
      return NextResponse.json(
        { code: 'no_music', message: 'Sự kiện chưa có nhạc nền.' },
        { status: 404, headers },
      );
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
