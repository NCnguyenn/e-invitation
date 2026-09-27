'use client';

import { lazy, Suspense } from 'react';
import { listTemplateKeys, loadTemplateCover } from './registry';
import { resolveTemplateKey } from './resolve-key';
import { TemplateUnavailable } from './TemplateUnavailable';
import type { TemplateCoverProps } from './types';

const covers = new Map(listTemplateKeys().map(key => [
  key, lazy(async () => ({ default: await loadTemplateCover(key) })),
]));

export function ClientInvitationCover({ event }: TemplateCoverProps) {
  const key = resolveTemplateKey(event.templateKey);
  const Cover = key ? covers.get(key) : undefined;
  if (!Cover) return <TemplateUnavailable />;
  return <Suspense fallback={<TemplateUnavailable pending />}><Cover event={event} /></Suspense>;
}
