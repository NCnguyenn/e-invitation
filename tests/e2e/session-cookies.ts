import type { BrowserContext } from '@playwright/test';
import type { Session } from '@supabase/supabase-js';
import { combineChunks, createChunks } from '@supabase/ssr';
import testProject from '../../supabase/test-project.json' with { type: 'json' };

export const authCookieName = `sb-${new URL(testProject.url).hostname.split('.')[0]}-auth-token`;
const belongsToSession = (name: string) => name === authCookieName || name.startsWith(`${authCookieName}.`);

export async function readSession(context: BrowserContext): Promise<Session> {
  const cookies = await context.cookies();
  const value = await combineChunks(authCookieName, name => cookies.find(cookie => cookie.name === name)?.value);
  if (!value?.startsWith('base64-')) throw new Error('Expected the actual Supabase project session cookie');
  return JSON.parse(Buffer.from(value.slice(7), 'base64url').toString('utf8')) as Session;
}

export async function writeSession(context: BrowserContext, session: Session): Promise<void> {
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  await replaceSessionCookie(context, encoded);
}

export async function replaceSessionCookie(context: BrowserContext, value: string): Promise<void> {
  const existing = (await context.cookies()).filter(cookie => belongsToSession(cookie.name));
  for (const cookie of existing) await context.clearCookies({ name: cookie.name });
  await context.addCookies(createChunks(authCookieName, value).map(chunk => ({
    ...chunk, url: 'http://127.0.0.1:3100', sameSite: 'Lax' as const,
  })));
}
