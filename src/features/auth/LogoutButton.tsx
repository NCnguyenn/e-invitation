'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError('Không thể đăng xuất. Hãy thử lại.');
        return;
      }
      router.push('/login');
      router.refresh();
    } catch {
      setError('Không thể đăng xuất. Hãy thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-row">
      <button type="button" onClick={logout} disabled={pending}>
        {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
    </div>
  );
}
