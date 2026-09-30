import { NextResponse } from 'next/server';
import { AuthRequiredError, AuthServiceError, requireHost } from '@/features/auth/server';
import { createHostInvitation, readHostInvitations, InvitationServiceError } from '@/features/invitations/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { isInvitationToken, parseHostInvitationsQuery, parseInvitationCreate, ValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };

function failure(error: unknown) {
  if (error instanceof AuthRequiredError) return NextResponse.json({ code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }, { status: 401, headers });
  if (error instanceof AuthServiceError) { console.error('[api] auth service unavailable', error); return NextResponse.json({ code: 'auth_unavailable', message: 'Dịch vụ xác thực tạm thời gián đoạn. Vui lòng thử lại sau.' }, { status: 503, headers }); }
  if (error instanceof ValidationError) return NextResponse.json({ code: 'invalid_input', message: error.message }, { status: 422, headers });
  return NextResponse.json({ code: 'invitation_error', message: 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.' }, { status: 503, headers });
}

function invitePath(token: string) {
  if (!isInvitationToken(token)) throw new InvitationServiceError();
  return `/invite/${token}`;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireHost();
    const url = new URL(request.url);
    const query = parseHostInvitationsQuery(url.searchParams);
    const result = await readHostInvitations(userId, query);
    if (!result) {
      return NextResponse.json(
        { code: 'not_found', message: 'Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.' },
        { status: 404, headers },
      );
    }
    return NextResponse.json(result, { status: 200, headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers });
  try {
    const { userId } = await requireHost();
    let body: unknown;
    try { body = await request.json(); } catch { throw new ValidationError('Thông tin khách mời không hợp lệ.'); }
    const result = await createHostInvitation(userId, parseInvitationCreate(body));
    if (result.kind === 'no_event') return NextResponse.json({ code: 'not_found', message: 'Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.' }, { status: 404, headers });
    const payload = { invitationId: result.invitationId, invitePath: invitePath(result.token), emailSent: false };
    if (result.kind === 'duplicate') {
      return NextResponse.json({ code: 'duplicate_email', message: 'Email này đã có thư mời trong sự kiện. Không tạo thêm thư mời hoặc token mới.', ...payload }, { status: 409, headers });
    }
    return NextResponse.json(payload, { status: 201, headers });
  } catch (error) { return failure(error); }
}

