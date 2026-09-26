'use client';

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { listTemplateKeys, loadTemplate } from './registry';
import { resolveTemplateKey } from './resolve-key';
import { TemplateUnavailable } from './TemplateUnavailable';
import type { TemplateProps } from './types';

const lazyTemplates = new Map<string, LazyExoticComponent<ComponentType<TemplateProps>>>(
  listTemplateKeys().map((key) => [
    key,
    lazy(async () => ({ default: await loadTemplate(key) })),
  ]),
);

export function ClientInvitationTemplate(props: TemplateProps) {
  const key = resolveTemplateKey(props.invitation.event.templateKey);
  const TemplateComponent = key ? lazyTemplates.get(key) : undefined;
  if (!TemplateComponent) return <TemplateUnavailable />;
  return (
    <Suspense fallback={<TemplateUnavailable pending />}>
      <TemplateComponent {...props} />
    </Suspense>
  );
}
