import { NextResponse } from 'next/server';
import { GuestServiceError, submitRsvpOnce } from '@/features/guest/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { parseRsvpSubmission, ValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };

function failure(error: unknown) {
  if (error instanceof ValidationError) return NextResponse.json({ code: 'invalid_input', message: error.message }, { status: 422, headers });
  if (error instanceof GuestServiceError) return NextResponse.json({ code: 'guest_error', message: 'Không thể lưu phản hồi lúc này. Vui lòng thử lại.' }, { status: 503, headers });
  return NextResponse.json({ code: 'guest_error', message: 'Không thể lưu phản hồi lúc này. Vui lòng thử lại.' }, { status: 503, headers });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isAllowedMutationOrigin(request)) return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers });
  try {
    const { token } = await context.params;
    let body: unknown;
    try { body = await request.json(); } catch { throw new ValidationError('Phản hồi không hợp lệ.'); }
    const input = parseRsvpSubmission(body);
    const result = await submitRsvpOnce(token, input.decision, input.guestMessage);
    if (result.kind === 'not_found') return NextResponse.json({ code: 'not_found', message: 'Không tìm thấy thư mời.' }, { status: 404, headers });
    return NextResponse.json(result, { status: result.kind === 'saved' ? 200 : 409, headers });
  } catch (error) { return failure(error); }
}
