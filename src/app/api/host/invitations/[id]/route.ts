import { NextResponse } from 'next/server';
import { AuthRequiredError, requireHost } from '@/features/auth/server';
import { updateHostInvitation, InvitationServiceError } from '@/features/invitations/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { parseInvitationUpdate, ValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

function failure(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
      { status: 401, headers },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ code: 'invalid_input', message: error.message }, { status: 422, headers });
  }
  return NextResponse.json(
    { code: 'invitation_error', message: 'Không thể cập nhật thư mời lúc này. Vui lòng thử lại.' },
    { status: 503, headers },
  );
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers });
  }

  try {
    const { userId } = await requireHost();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Thông tin khách mời không hợp lệ.');
    }

    const input = parseInvitationUpdate(body);
    const result = await updateHostInvitation(userId, id, input);

    if (result.kind === 'not_found') {
      return NextResponse.json({ code: 'not_found', message: 'Không tìm thấy thư mời.' }, { status: 404, headers });
    }

    if (result.kind === 'locked') {
      return NextResponse.json(
        { code: 'invitation_locked', message: 'Thư mời đã có lịch sử gửi hoặc đang gửi, không thể chỉnh sửa.' },
        { status: 409, headers },
      );
    }

    if (result.kind === 'duplicate_email') {
      return NextResponse.json(
        { code: 'duplicate_email', message: 'Email này đã có thư mời trong sự kiện. Không thể đổi sang email này.' },
        { status: 409, headers },
      );
    }

    return NextResponse.json({ invitation: result.invitation }, { status: 200, headers });
  } catch (error) {
    return failure(error);
  }
}
