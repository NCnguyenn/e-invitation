import { NextResponse } from 'next/server';
import { AuthRequiredError, AuthServiceError, requireHost } from '@/features/auth/server';
import { EmailServiceError, sendInvitation } from '@/features/email/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { isUuid, parseSendInvitation, ValidationError } from '@/lib/validation';

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
  if (error instanceof AuthServiceError) {
    console.error('[api] auth service unavailable', error);
    return NextResponse.json(
      { code: 'auth_unavailable', message: 'Dịch vụ xác thực tạm thời gián đoạn. Vui lòng thử lại sau.' },
      { status: 503, headers },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ code: 'invalid_input', message: error.message }, { status: 422, headers });
  }
  return NextResponse.json(
    { code: 'email_error', message: 'Không thể xử lý yêu cầu gửi lúc này. Vui lòng thử lại.' },
    { status: 503, headers },
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers });
  }
  try {
    const { userId } = await requireHost();
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ code: 'not_found', message: 'Không tìm thấy thư mời.' }, { status: 404, headers });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Yêu cầu gửi không hợp lệ.');
    }
    const input = parseSendInvitation(body);
    const result = await sendInvitation(userId, id, input.requestId);
    if (result.kind === 'not_found') {
      return NextResponse.json({ code: 'not_found', message: 'Không tìm thấy thư mời.' }, { status: 404, headers });
    }
    if (result.kind === 'config') {
      return NextResponse.json({ code: 'email_config', message: result.message }, { status: 503, headers });
    }
    if (result.kind === 'request_conflict') {
      return NextResponse.json({ code: 'request_conflict', message: result.message }, { status: 409, headers });
    }
    if (result.kind === 'unresolved') {
      return NextResponse.json(
        {
          code: 'unresolved_attempt',
          message: result.message,
          emailStatus: result.emailStatus,
          attemptId: result.attemptId,
          invitePath: result.invitePath,
        },
        { status: 409, headers },
      );
    }
    if (result.kind === 'cooldown') {
      return NextResponse.json(
        {
          code: 'cooldown',
          message: result.message,
          retryAfterSeconds: result.retryAfterSeconds,
          invitePath: result.invitePath,
        },
        { status: 429, headers: { ...headers, 'Retry-After': String(result.retryAfterSeconds) } },
      );
    }
    if (result.kind === 'internal_cap') {
      return NextResponse.json({ code: 'internal_cap', message: result.message }, { status: 429, headers });
    }
    return NextResponse.json(
      {
        emailStatus: result.emailStatus,
        attemptId: result.attemptId,
        invitePath: result.invitePath,
        message: result.message,
      },
      { status: 200, headers },
    );
  } catch (error) {
    if (error instanceof EmailServiceError) return failure(error);
    return failure(error);
  }
}
