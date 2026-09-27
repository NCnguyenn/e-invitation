import { NextResponse } from 'next/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import { listEventGuestsAction } from '@/features/admin/operations/events';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'Referrer-Policy': 'no-referrer',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để truy cập.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

  try {
    const result = await listEventGuestsAction(id, page, pageSize);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải danh sách khách.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
