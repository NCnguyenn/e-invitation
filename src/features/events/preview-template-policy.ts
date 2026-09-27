import type { RegisteredTemplateKey } from '../template/resolve-key';

export type PreviewTemplateDecision =
  | { status: 'selected'; templateKey: RegisteredTemplateKey }
  | { status: 'unavailable' }
  | { status: 'not_found' };

export function decidePreviewTemplate(input: {
  isDevelopment: boolean;
  hasHost: boolean;
  requestedKey?: string | null;
  ownEventKey?: string | null;
  fallbackKey?: string | null;
}, resolveKey: (key?: string | null) => RegisteredTemplateKey | null): PreviewTemplateDecision {
  if (!input.isDevelopment && !input.hasHost) return { status: 'not_found' };

  const requestedWasPresent = typeof input.requestedKey === 'string';
  const requested = requestedWasPresent ? resolveKey(input.requestedKey) : null;
  if (requestedWasPresent && !requested) return { status: 'unavailable' };

  const own = resolveKey(input.ownEventKey);
  if (!input.isDevelopment) {
    if (!own || (requested && requested !== own)) return { status: 'unavailable' };
    return { status: 'selected', templateKey: own };
  }

  const selected = requested ?? own ?? resolveKey(input.fallbackKey);
  return selected ? { status: 'selected', templateKey: selected } : { status: 'unavailable' };
}
