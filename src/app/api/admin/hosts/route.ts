import { NextResponse } from 'next/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import { listAdminHosts, createHostAction, deleteHostAction } from '@/features/admin/operations/hosts';
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
  const search = searchParams.get('search') || '';

  try {
    const result = await listAdminHosts(page, pageSize, search);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải danh sách host.' },
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

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ code: 'invalid_input', message: 'Vui lòng cung cấp email hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await createHostAction(body.email);
    return NextResponse.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'create_failed', message: error instanceof Error ? error.message : 'Không thể tạo host.' },
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

  let body: { hostUserId?: string; confirmationEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  if (!body.hostUserId || !body.confirmationEmail) {
    return NextResponse.json(
      { code: 'invalid_input', message: 'Thiếu hostUserId hoặc confirmationEmail.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await deleteHostAction(body.hostUserId, body.confirmationEmail);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'delete_failed', message: error instanceof Error ? error.message : 'Không thể xóa host.' },
      { status: 400, headers: NO_STORE },
    );
  }
}
