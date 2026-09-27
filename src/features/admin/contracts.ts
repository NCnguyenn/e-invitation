// Contract definitions for /system-admin and resource monitoring
// Reference: SPEC-SYSTEM-ADMIN-01 & YEU_CAU_DU_AN.md (Mục 7 & 5)

export type MetricStatus =
  | 'fresh'
  | 'stale'
  | 'not_connected'
  | 'forbidden'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_response'
  | 'dashboard_only'
  | 'not_applicable';

export type MetricProvider = 'supabase' | 'brevo' | 'netlify' | 'github' | 'internal';

export type MetricScopeType = 'project' | 'organization' | 'account' | 'team' | 'application';

export type MetricUnit = 'byte' | 'count' | 'credit' | 'percentage' | 'boolean' | 'text';

export type MetricSourceKind = 'api' | 'documentation' | 'internal' | 'dashboard';

export interface MetricSnapshot {
  id?: string;
  provider: MetricProvider;
  scope_type: MetricScopeType;
  scope_id: string;
  metric_key: string;
  display_name: string;
  environment: 'production' | 'staging' | 'local';
  value: number | null;
  unit: MetricUnit;
  limit_value: number | null;
  remaining_value: number | null;
  period_start: string | null;
  period_end: string | null;
  period_timezone: string | null;
  provider_updated_at: string | null;
  fetched_at: string;
  source_kind: MetricSourceKind;
  source_url: string | null;
  endpoint: string | null;
  field_path: string | null;
  status: MetricStatus;
  last_attempt_at: string | null;
  error_code: string | null;
  mapping_version: string;
  source_checked_at: string;
  raw_payload?: Record<string, unknown> | null;
}

export interface InternalActivityMetrics {
  status: 'ok' | 'partial' | 'unavailable';
  totalHosts: number | null;
  totalEvents: number | null;
  totalInvitations: number | null;
  rsvpBreakdown: {
    accepted: number | null;
    declined: number | null;
    pending: number | null;
    responded: number | null;
    total: number | null;
  };
  dailyEmailBudget: {
    budgetDate: string | null;
    cap: number;
    reservedAttempts: number | null;
    acceptedAttempts: number | null;
    rejectedAttempts: number | null;
    unknownAttempts: number | null;
  };
}

export type SyncBlockedReason = 'locked' | 'cooldown' | 'lease_unavailable';

export interface PublishedReferenceLimit {
  id: string;
  provider: MetricProvider;
  category: string;
  name: string;
  publishedLimit: string;
  notes: string;
  sourceUrl: string;
  checkedAt: string;
}

export interface DirectDashboardLink {
  provider: string;
  name: string;
  url: string;
  description: string;
}

export interface AdminHostItem {
  userId: string;
  email: string;
  createdAt: string;
  eventCount: number;
  lifecycleStatus: string;
}

export interface AdminEventItem {
  id: string;
  userId: string;
  hostEmail: string;
  title: string;
  templateKey: string;
  eventDate: string;
  timezone: string;
  guestCount: number;
  respondedCount: number;
  lifecycleStatus: string;
  createdAt: string;
}

export interface AdminGuestItem {
  id: string;
  guestName: string;
  guestEmail: string;
  invitationNote: string | null;
  status: 'pending' | 'accepted' | 'declined';
  emailStatus: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';
  guestMessage: string | null;
  respondedAt: string | null;
  sentAt: string | null;
  lastSendAttemptAt: string | null;
}

export interface AdminUnknownAttempt {
  id: string;
  invitationId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  eventTitle: string | null;
  budgetDate: string;
  startedAt: string | null;
  errorCode: string | null;
  providerMessageId: string | null;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface AdminMaintenanceJob {
  id: string;
  kind: 'delete_event' | 'delete_host' | 'cleanup_assets';
  targetId: string;
  objectPrefixes: string[];
  status: 'pending' | 'running' | 'failed' | 'completed';
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  snapshots: MetricSnapshot[];
  internalMetrics: InternalActivityMetrics;
  lastSyncedAt: string | null;
  isLocked?: boolean;
  syncBlockedReason?: SyncBlockedReason | null;
}
