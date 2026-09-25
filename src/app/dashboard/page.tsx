import { redirect } from 'next/navigation';
import { getVerifiedHost } from '@/features/auth/server';
import { DashboardShell } from '@/features/events/DashboardShell';
import { readHostEvent } from '@/features/events/server';
import '@/features/template/fonts.css';
import '@/features/events/dashboard.css';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const host = await getVerifiedHost();
  if (!host) redirect('/login');
  const params = await searchParams;
  const section = params.section === 'guests' ? 'guests' : params.section === 'responses' ? 'responses' : 'event';
  return <DashboardShell event={await readHostEvent(host.userId)} section={section} />;
}

