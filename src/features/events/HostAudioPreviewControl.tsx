'use client';

import { AudioPlayer } from '@/features/template/AudioPlayer';

export function HostAudioPreviewControl({
  hasMusic,
  sourceKey,
}: {
  hasMusic: boolean;
  sourceKey?: string | number;
}) {
  async function resolveSource() {
    const res = await fetch('/api/host/audio/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Không thể tạo liên kết nghe thử.');
    }

    if (!body.signedUrl) {
      throw new Error('Không nhận được liên kết nghe thử.');
    }

    return {
      signedUrl: body.signedUrl,
      expiresIn: body.expiresIn,
    };
  }

  return (
    <AudioPlayer
      resolveSource={hasMusic ? resolveSource : undefined}
      hasMusic={hasMusic}
      sourceKey={sourceKey}
    />
  );
}
