import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

/**
 * Raised when the session or profile lookup fails because of an infrastructure
 * problem (database/network), as opposed to a genuine "not signed in" result.
 * Callers should surface this as a 5xx, not a redirect to /login — otherwise a
 * transient DB outage looks like a logged-out session to the user.
 */
export class AuthServiceError extends Error {
  constructor() {
    super('Authentication service unavailable');
    this.name = 'AuthServiceError';
  }
}

export async function getVerifiedHost(): Promise<{ userId: string } | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, lifecycle_status')
      .eq('id', data.user.id)
      .maybeSingle();
    // A profile lookup error after a successful auth lookup is an infrastructure
    // failure, not an expired session — surface it distinctly.
    if (profileError) {
      console.error('[auth] profile lookup failed', profileError);
      throw new AuthServiceError();
    }
    if (profile?.role !== 'host' || profile.lifecycle_status !== 'active') {
      return null;
    }
    return { userId: data.user.id };
  } catch (cause) {
    if (cause instanceof AuthServiceError) throw cause;
    // createServerSupabaseClient throwing means misconfiguration/session-store
    // failure — also an infrastructure problem.
    console.error('[auth] getVerifiedHost failed', cause);
    throw new AuthServiceError();
  }
}

export async function requireHost(): Promise<{ userId: string }> {
  const host = await getVerifiedHost();
  if (!host) throw new AuthRequiredError();
  return host;
}
