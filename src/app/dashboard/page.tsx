import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getVerifiedHost } from '@/features/auth/server';
import { getVerifiedDeveloper } from '@/features/admin/server';
import { DashboardShell } from '@/features/events/DashboardShell';
import { readHostEvent } from '@/features/events/server';
import '@/features/template/fonts.css';
import '@/features/events/dashboard.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bảng điều khiển | e-invitation',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const host = await getVerifiedHost();
  if (!host) {
    const developer = await getVerifiedDeveloper();
    if (developer) redirect('/system-admin');
    redirect('/login');
  }
  const params = await searchParams;
  const section = params.section === 'guests' ? 'guests' : params.section === 'responses' ? 'responses' : 'event';
  return <DashboardShell event={await readHostEvent(host.userId)} section={section} />;
}

