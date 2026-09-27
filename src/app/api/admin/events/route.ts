import { NextResponse } from 'next/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import {
  listAdminEvents,
  createEventAction,
  changeEventTemplateAction,
  deleteEventAction,
} from '@/features/admin/operations/events';
import { isAllowedMutationOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'Referrer-Policy': 'no-referrer',
};

export async function GET(request: Request) {
  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để truy cập.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
  const hostId = searchParams.get('hostId') || undefined;

  try {
    const result = await listAdminEvents(page, pageSize, hostId);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải danh sách sự kiện.' },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers: NO_STORE });
  }

  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để thực hiện.' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: {
    hostUserId?: string;
    title?: string;
    templateKey?: string;
    eventDate?: string;
    timezone?: string;
    venueName?: string;
    venueAddress?: string;
    googleMapUrl?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  if (!body.hostUserId || !body.title || !body.templateKey || !body.eventDate) {
    return NextResponse.json(
      { code: 'invalid_input', message: 'Vui lòng điền đủ: hostUserId, title, templateKey, eventDate.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await createEventAction({
      hostUserId: body.hostUserId,
      title: body.title,
      templateKey: body.templateKey,
      eventDate: body.eventDate,
      timezone: body.timezone,
      venueName: body.venueName,
      venueAddress: body.venueAddress,
      googleMapUrl: body.googleMapUrl,
    });
    return NextResponse.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'create_failed', message: error instanceof Error ? error.message : 'Không thể tạo sự kiện.' },
      { status: 400, headers: NO_STORE },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers: NO_STORE });
  }

  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để thực hiện.' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: { eventId?: string; templateKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  if (!body.eventId || !body.templateKey) {
    return NextResponse.json(
      { code: 'invalid_input', message: 'Thiếu eventId hoặc templateKey.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await changeEventTemplateAction(body.eventId, body.templateKey);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'update_failed', message: error instanceof Error ? error.message : 'Không thể đổi template.' },
      { status: 400, headers: NO_STORE },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' }, { status: 403, headers: NO_STORE });
  }

  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để thực hiện.' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: { eventId?: string; confirmationTitle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  if (!body.eventId || !body.confirmationTitle) {
    return NextResponse.json(
      { code: 'invalid_input', message: 'Thiếu eventId hoặc confirmationTitle.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await deleteEventAction(body.eventId, body.confirmationTitle);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'delete_failed', message: error instanceof Error ? error.message : 'Không thể xóa sự kiện.' },
      { status: 400, headers: NO_STORE },
    );
  }
}
