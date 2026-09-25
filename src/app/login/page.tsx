import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/LoginForm';
import { getVerifiedHost } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const host = await getVerifiedHost();
  if (host) redirect('/dashboard');
  return (
    <main className="app-status">
      <h1>Đăng nhập</h1>
      <LoginForm />
      <p className="auth-note">Liên hệ người cung cấp để được cấp hoặc đặt lại mật khẩu.</p>
    </main>
  );
}
