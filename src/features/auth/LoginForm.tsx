'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const GENERIC_LOGIN_ERROR = 'Email hoặc mật khẩu không đúng.';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message || GENERIC_LOGIN_ERROR);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Không thể đăng nhập lúc này. Hãy thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" method="post" action="/api/auth/login" onSubmit={onSubmit}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!ready}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Mật khẩu
        <span className="auth-row">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={!ready}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" disabled={!ready} onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          </button>
        </span>
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={!ready || pending}>
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
      <noscript>Vui lòng bật JavaScript để đăng nhập.</noscript>
    </form>
  );
}
