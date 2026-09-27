export function assertResolvableUnknown(input: {
  status: string;
  resolved_at: string | null;
  invitationEmailStatus: string | null;
  allowResend: boolean;
}): void {
  if (input.resolved_at) {
    throw new Error('Attempt này đã đối soát.');
  }
  if (input.status !== 'unknown') {
    throw new Error('Chỉ đối soát attempt đang unknown.');
  }
  if (input.allowResend && input.invitationEmailStatus !== 'unknown') {
    throw new Error('Chỉ mở lại gửi khi thư đang ở trạng thái unknown.');
  }
}
