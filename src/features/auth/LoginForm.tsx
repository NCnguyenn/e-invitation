'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoginIcon } from './LoginIcon';
import styles from './login.module.css';

const GENERIC_LOGIN_ERROR = 'Email hoặc mật khẩu không đúng.';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setPending] = useState(false);
  const [navigating, startTransition] = useTransition();
  const pending = submitting || navigating;
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
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
      // The login response has already set the session cookies. A separate
      // refresh duplicates the destination request and its authenticated reads.
      startTransition(() => router.replace('/dashboard'));
    } catch {
      setError('Không thể đăng nhập lúc này. Hãy thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} method="post" action="/api/auth/login" onSubmit={onSubmit} aria-busy={pending}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="login-email">Email</label>
        <div className={styles.inputWrap}>
          <LoginIcon name="envelope" className={styles.inputIcon} />
          <input
            className={styles.input}
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="Nhập địa chỉ email"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={!ready}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="login-password">Mật khẩu</label>
        <div className={styles.inputWrap}>
          <LoginIcon name="lock" className={styles.inputIcon} />
          <input
            className={styles.input}
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            required
            disabled={!ready}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className={styles.passwordToggle}
            type="button"
            disabled={!ready}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-controls="login-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            <LoginIcon name={showPassword ? 'eye-off' : 'eye'} />
          </button>
        </div>
      </div>
      {error ? <p id="login-error" className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.submit} type="submit" disabled={!ready || pending}>
        <span aria-live="polite">{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</span>
        <LoginIcon name={pending ? 'spinner' : 'arrow'} className={pending ? styles.spinner : undefined} />
      </button>
      <noscript>Vui lòng bật JavaScript để đăng nhập.</noscript>
    </form>
  );
}
