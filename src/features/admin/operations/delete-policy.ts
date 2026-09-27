export type MaintenanceRetryPlan = {
  cleanupStorage: boolean;
  deleteAuthUser: boolean;
  deleteEventRow: boolean;
};

export function planMaintenanceRetry(job: { status: string; kind: string }): MaintenanceRetryPlan {
  if (job.status !== 'failed' && job.status !== 'running') {
    throw new Error('Chỉ thử lại maintenance job đang failed hoặc running.');
  }
  if (job.kind === 'delete_host') {
    return { cleanupStorage: true, deleteAuthUser: true, deleteEventRow: false };
  }
  if (job.kind === 'delete_event') {
    return { cleanupStorage: true, deleteAuthUser: false, deleteEventRow: true };
  }
  if (job.kind === 'cleanup_assets') {
    return { cleanupStorage: true, deleteAuthUser: false, deleteEventRow: false };
  }
  throw new Error('Loại maintenance job không được hỗ trợ.');
}

export function requireWriteData<T>(
  result: { data: T | null; error: { message: string } | null },
  action: string,
): T {
  if (result.error || result.data == null) {
    throw new Error(`${action}: ${result.error?.message || 'không có dữ liệu'}`);
  }
  return result.data;
}
