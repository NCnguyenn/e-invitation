import 'server-only';
import { loadTemplate } from './registry';
import { resolveTemplateKey } from './resolve-key';
import { TemplateUnavailable } from './TemplateUnavailable';
import type { TemplateProps } from './types';

export async function InvitationTemplate(props: TemplateProps) {
  const key = resolveTemplateKey(props.invitation.event.templateKey);
  if (!key) return <TemplateUnavailable />;
  const TemplateComponent = await loadTemplate(key);
  return <TemplateComponent {...props} />;
}
