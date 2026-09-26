export const REGISTERED_TEMPLATE_KEYS = ['wedding-floral-01', 'graduation-floral-01'] as const;

export type RegisteredTemplateKey = (typeof REGISTERED_TEMPLATE_KEYS)[number];

export function resolveTemplateKey(key?: string | null): RegisteredTemplateKey | null {
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  if ((REGISTERED_TEMPLATE_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as RegisteredTemplateKey;
  }
  return null;
}
