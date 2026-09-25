import { NextResponse } from 'next/server';
import { AuthRequiredError, requireHost } from '@/features/auth/server';
import { prepareHostAudioUpload } from '@/features/events/server';
import { parseAudioPrepare, ValidationError } from '@/lib/validation';
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
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { code: 'invalid_input', message: error.message },
      { status: 422, headers },
    );
  }
  return NextResponse.json(
    { code: 'audio_error', message: 'Không thể chuẩn bị tải nhạc lúc này. Vui lòng thử lại.' },
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Thông tin tệp âm thanh không hợp lệ.');
    }

    const input = parseAudioPrepare(body);
    const result = await prepareHostAudioUpload(userId, input);

    if (!result) {
      return NextResponse.json(
        { code: 'not_found', message: 'Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.' },
        { status: 404, headers },
      );
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
