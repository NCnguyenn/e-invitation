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

    if (profileError || !profile) {
      return null;
    }

    if (profile.role !== 'developer' || profile.lifecycle_status !== 'active') {
      return null;
    }

    return {
      userId: authData.user.id,
      email: authData.user.email ?? '',
    };
  } catch {
    return null;
  }
}

export async function requireDeveloper(): Promise<VerifiedDeveloper> {
  const developer = await getVerifiedDeveloper();
  if (!developer) {
    throw new DeveloperAuthRequiredError();
  }
  return developer;
}
