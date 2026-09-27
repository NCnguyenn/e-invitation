import { NextResponse } from 'next/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import { getOrSyncMetrics } from '@/features/admin/metrics/sync';

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
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    const result = await getOrSyncMetrics(forceRefresh);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'metrics_error', message: error instanceof Error ? error.message : 'Không thể lấy dữ liệu giám sát.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
