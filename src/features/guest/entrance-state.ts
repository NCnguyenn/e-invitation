export type EntranceStage = 'checking' | 'closed' | 'opening' | 'opened' | 'leaving' | 'invitation';
export type EntranceAction = 'new' | 'remembered' | 'open' | 'view' | 'settled' | 'replay';

export function entranceTransition(stage: EntranceStage, action: EntranceAction): EntranceStage {
  if (stage === 'checking' && action === 'new') return 'closed';
  if (stage === 'checking' && action === 'remembered') return 'invitation';
  if (stage === 'closed' && action === 'open') return 'opening';
  if (stage === 'opening' && action === 'settled') return 'opened';
  if (stage === 'opened' && action === 'view') return 'leaving';
  if (stage === 'leaving' && action === 'settled') return 'invitation';
  if (stage === 'invitation' && action === 'replay') return 'closed';
  return stage;
}

type EntranceStorage = Pick<Storage, 'getItem' | 'setItem'> | null;
const prefix = 'invitation-viewed:v1:';

export function hasViewedInvitation(storage: EntranceStorage, key?: string): boolean {
  try { return Boolean(key && storage?.getItem(prefix + key) === '1'); }
  catch { return false; }
}

export function rememberInvitation(storage: EntranceStorage, key?: string): void {
  try { if (key) storage?.setItem(prefix + key, '1'); }
  catch { /* Browser storage is optional; guests can still view and respond. */ }
}
