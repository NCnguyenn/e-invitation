import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/LoginForm';
import { LoginIcon } from '@/features/auth/LoginIcon';
import { getVerifiedHost } from '@/features/auth/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/playfair-display/500.css';
import styles from '@/features/auth/login.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Đăng nhập | e-invitation' };

export default async function LoginPage() {
  const host = await getVerifiedHost();
  if (host) redirect('/dashboard');
  const developer = await getVerifiedDeveloper();
  if (developer) redirect('/system-admin');
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.brand} href="/login" aria-label="e-invitation — Trang đăng nhập">
            <LoginIcon name="envelope" />
            <span>e-invitation</span>
          </a>
          <a className={styles.helpLink} href="#account-support">Cần hỗ trợ?</a>
        </header>

        <main className={styles.main}>
          <section className={styles.hero} aria-labelledby="login-hero-title">
            <Image
              className={styles.heroImage}
              src="/images/login-stationery.webp"
              alt=""
              fill
              sizes="(max-width: 800px) 440px, (max-width: 1100px) 50vw, 55vw"
              loading="eager"
            />
            <div className={styles.heroCopy}>
              <h2 id="login-hero-title" className={styles.heroTitle}>
                <span>Khởi đầu cho</span>
                <span>khoảnh khắc đẹp.</span>
              </h2>
              <div className={styles.heroRule} aria-hidden="true" />
              <p>Thiệp mời tinh tế, kết nối yêu thương.</p>
            </div>
          </section>

          <section className={styles.login} aria-labelledby="login-title">
            <LoginIcon name="envelope" className={styles.loginMark} />
            <h1 id="login-title" className={styles.title}>Chào mừng trở lại</h1>
            <p className={styles.description}>Đăng nhập để quản lý thiệp mời của bạn.</p>
            <LoginForm />

            <section id="account-support" className={styles.support} aria-labelledby="support-title" tabIndex={-1}>
              <div className={styles.supportBadge}><LoginIcon name="support" /></div>
              <div className={styles.supportContent}>
                <h2 id="support-title">Bạn cần hỗ trợ tài khoản?</h2>
                <p>Liên hệ nhà cung cấp để được cấp<br />hoặc đặt lại mật khẩu.</p>
                <details className={styles.supportDetails}>
                  <summary>Liên hệ hỗ trợ <LoginIcon name="arrow" /></summary>
                  <p>Vui lòng liên hệ người đã cung cấp tài khoản hoặc thiết kế thiệp mời cho bạn qua kênh liên lạc đang sử dụng để được hỗ trợ.</p>
                </details>
              </div>
            </section>
          </section>
        </main>

        <footer className={styles.footer}>e-invitation <span aria-hidden="true">·</span> Gửi lời mời, trao cảm xúc</footer>
      </div>
    </div>
  );
}
