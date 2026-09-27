import type { ComponentType } from 'react';
import type { TemplateProps, TemplateCoverProps } from './types';
import { REGISTERED_TEMPLATE_KEYS, resolveTemplateKey, type RegisteredTemplateKey } from './resolve-key';

type TemplateLoader = () => Promise<ComponentType<TemplateProps>>;

async function loadWeddingFloral01() {
  const loaded = await import('./templates/WeddingFloral01');
  return loaded.WeddingFloral01;
}

const LOADERS: Record<RegisteredTemplateKey, TemplateLoader> = {
  'wedding-floral-01': loadWeddingFloral01,
  'graduation-floral-01': loadWeddingFloral01,
};

async function loadWeddingFloral01Cover() {
  const loaded = await import('./templates/WeddingFloral01Cover');
  return loaded.WeddingFloral01Cover;
}

const COVER_LOADERS: Record<RegisteredTemplateKey, () => Promise<ComponentType<TemplateCoverProps>>> = {
  'wedding-floral-01': loadWeddingFloral01Cover,
  'graduation-floral-01': loadWeddingFloral01Cover,
};

export async function loadTemplateCover(key: string): Promise<ComponentType<TemplateCoverProps>> {
  const resolved = resolveTemplateKey(key);
  if (!resolved) throw new Error('Unregistered template');
  return COVER_LOADERS[resolved]();
}

export function isRegisteredTemplate(key?: string | null): key is RegisteredTemplateKey {
  return resolveTemplateKey(key) !== null;
}

export function listTemplateKeys(): RegisteredTemplateKey[] {
  return [...REGISTERED_TEMPLATE_KEYS];
}

export async function loadTemplate(key: string): Promise<ComponentType<TemplateProps>> {
  const resolved = resolveTemplateKey(key);
  if (!resolved) {
    throw new Error('Unregistered template');
  }
  return LOADERS[resolved]();
}

export { resolveTemplateKey };
