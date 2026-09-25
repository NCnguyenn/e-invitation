import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
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
    if (profileError || profile?.role !== 'host' || profile.lifecycle_status !== 'active') {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

export async function requireHost(): Promise<{ userId: string }> {
  const host = await getVerifiedHost();
  if (!host) throw new AuthRequiredError();
  return host;
}

