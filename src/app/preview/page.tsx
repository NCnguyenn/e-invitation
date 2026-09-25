import { notFound } from 'next/navigation';
import { InvitationTemplate } from '@/features/template/InvitationTemplate';
export default async function PreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { previewInvitation } = await import('@/features/template/preview.fixture');
  return <InvitationTemplate invitation={previewInvitation} mode="preview" />;
}
