import { redirect } from 'next/navigation';
import { getVerifiedHost } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const host = await getVerifiedHost();
  redirect(host ? '/dashboard' : '/login');
}
