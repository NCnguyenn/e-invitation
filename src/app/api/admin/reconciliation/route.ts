import { NextResponse } from 'next/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import {
  listUnknownAttempts,
  resolveUnknownAttemptAction,
  listMaintenanceJobs,
  retryMaintenanceJobAction,
} from '@/features/admin/operations/reconciliation';
import { isAllowedMutationOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'Referrer-Policy': 'no-referrer',
};

export async function GET() {
  const developer = await getVerifiedDeveloper();
  if (!developer) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Yêu cầu quyền Developer để truy cập.' },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const [attemptsResult, jobsResult] = await Promise.all([
      listUnknownAttempts(1, 100),
      listMaintenanceJobs(1, 100),
    ]);

    return NextResponse.json(
      {
        attempts: attemptsResult.attempts,
        attemptsCount: attemptsResult.totalCount,
        jobs: jobsResult.jobs,
        jobsCount: jobsResult.totalCount,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      { code: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu đối soát.' },
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
    action?: 'resolve' | 'retry_job';
    attemptId?: string;
    resolution?: string;
    allowResend?: boolean;
    jobId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_input', message: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: NO_STORE });
  }

  try {
    if (body.action === 'resolve') {
      if (!body.attemptId || !body.resolution) {
        return NextResponse.json({ code: 'invalid_input', message: 'Thiếu attemptId hoặc resolution.' }, { status: 400, headers: NO_STORE });
      }
      const result = await resolveUnknownAttemptAction(body.attemptId, body.resolution, !!body.allowResend);
      return NextResponse.json(result, { headers: NO_STORE });
    }

    if (body.action === 'retry_job') {
      if (!body.jobId) {
        return NextResponse.json({ code: 'invalid_input', message: 'Thiếu jobId.' }, { status: 400, headers: NO_STORE });
      }
      const result = await retryMaintenanceJobAction(body.jobId);
      return NextResponse.json(result, { headers: NO_STORE });
    }

    return NextResponse.json({ code: 'invalid_action', message: 'Hành động không hợp lệ.' }, { status: 400, headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { code: 'action_failed', message: error instanceof Error ? error.message : 'Thao tác thất bại.' },
      { status: 400, headers: NO_STORE },
    );
  }
}
