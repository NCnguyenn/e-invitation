export function previewReadUserId(userId?: string | null): string | null {
  if (typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}
