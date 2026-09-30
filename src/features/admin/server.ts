import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class DeveloperAuthRequiredError extends Error {
  constructor(message = 'Yêu cầu quyền Developer để truy cập.') {
    super(message);
    this.name = 'DeveloperAuthRequiredError';
  }
}

export class DeveloperForbiddenError extends Error {
  constructor(message = 'Tài khoản không có quyền truy cập trang quản trị hệ thống.') {
    super(message);
    this.name = 'DeveloperForbiddenError';
  }
}

/**
 * Raised when the developer session/profile lookup fails due to an
 * infrastructure problem (database/network), not a genuine "not signed in".
 * Surfacing it as a 5xx prevents a transient DB outage from looking like a
 * logged-out session. Callers that only check the null return value will let
 * this propagate to the route's error boundary / a 500 — which is correct.
 */
export class DeveloperServiceError extends Error {
  constructor() {
    super('Admin authentication service unavailable');
    this.name = 'DeveloperServiceError';
  }
}

export interface VerifiedDeveloper {
  userId: string;
  email: string;
}

export async function getVerifiedDeveloper(): Promise<VerifiedDeveloper | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, lifecycle_status')
      .eq('id', authData.user.id)
      .maybeSingle();

    // A profile lookup failure after a successful auth lookup is an
    // infrastructure problem, not a signed-out session.
    if (profileError) {
      console.error('[admin-auth] profile lookup failed', profileError);
      throw new DeveloperServiceError();
    }
    if (!profile) {
      return null;
    }

    if (profile.role !== 'developer' || profile.lifecycle_status !== 'active') {
      return null;
    }

    return {
      userId: authData.user.id,
      email: authData.user.email ?? '',
    };
  } catch (cause) {
    if (cause instanceof DeveloperServiceError) throw cause;
    console.error('[admin-auth] getVerifiedDeveloper failed', cause);
    throw new DeveloperServiceError();
  }
}

export async function requireDeveloper(): Promise<VerifiedDeveloper> {
  const developer = await getVerifiedDeveloper();
  if (!developer) {
    throw new DeveloperAuthRequiredError();
  }
  return developer;
}
