'use client';

import { AudioPlayer, AudioRateLimitError, type AudioSourceResult } from '@/features/template/AudioPlayer';

// Persist the signed URL per invitation token so a page reload within the
// token's session does not burn another rate-limited request slot.
function cacheKey(token: string) {
  return `guest-audio-src:${token}`;
}

function readCachedSource(token: string): AudioSourceResult | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { signedUrl?: string; expiresAt?: string };
    if (!parsed.signedUrl) return null;
    // Keep a 60s safety margin before the signed URL actually expires.
    const expiresAtMs = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : 0;
    if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > 60_000) {
      return { signedUrl: parsed.signedUrl, expiresAt: parsed.expiresAt };
    }
  } catch {
    // sessionStorage unavailable or malformed entry — fall through to fetch.
  }
  return null;
}

function writeCachedSource(token: string, source: AudioSourceResult) {
  try {
    if (typeof source === 'string') return;
    sessionStorage.setItem(
      cacheKey(token),
      JSON.stringify({ signedUrl: source.signedUrl, expiresAt: source.expiresAt }),
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function GuestAudioControl({
  token,
  hasMusic,
}: {
  token: string;
  hasMusic: boolean;
}) {
  async function resolveSource() {
    const cached = readCachedSource(token);
    if (cached) return cached;

    const response = await fetch(`/api/guest/${encodeURIComponent(token)}/audio`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter =
          typeof body.retryAfterSeconds === 'number'
            ? body.retryAfterSeconds
            : parseInt(response.headers.get('Retry-After') || '60', 10) || 60;
        throw new AudioRateLimitError(
          body.message || 'Bạn đã yêu cầu phát nhạc quá nhiều lần. Vui lòng thử lại sau.',
          retryAfter,
        );
      }
      throw new Error(body.message || 'Không thể tải nhạc lúc này. Vui lòng thử lại sau.');
    }

    if (!body.signedUrl) {
      throw new Error('Không nhận được liên kết nhạc từ máy chủ.');
    }

    const result: AudioSourceResult = {
      signedUrl: body.signedUrl,
      expiresAt: body.expiresAt,
      expiresIn: body.expiresIn,
    };
    writeCachedSource(token, result);
    return result;
  }

  return (
    <AudioPlayer
      resolveSource={hasMusic ? resolveSource : undefined}
      hasMusic={hasMusic}
    />
  );
}
