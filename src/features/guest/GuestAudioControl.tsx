'use client';

import { AudioPlayer, AudioRateLimitError } from '@/features/template/AudioPlayer';

export function GuestAudioControl({
  token,
  hasMusic,
}: {
  token: string;
  hasMusic: boolean;
}) {
  async function resolveSource() {
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

    return {
      signedUrl: body.signedUrl,
      expiresAt: body.expiresAt,
      expiresIn: body.expiresIn,
    };
  }

  return (
    <AudioPlayer
      resolveSource={hasMusic ? resolveSource : undefined}
      hasMusic={hasMusic}
    />
  );
}
