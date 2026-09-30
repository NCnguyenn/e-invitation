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
    if (!hasMusic) {
      return '/mb3/mono.mp3';
    }
    try {
      const res = await fetch('/api/host/audio/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok && body.signedUrl) {
        return {
          signedUrl: body.signedUrl,
          expiresIn: body.expiresIn,
        };
      }
    } catch {
      // Fallback below
    }

    return '/mb3/mono.mp3';
  }

  return (
    <AudioPlayer
      resolveSource={resolveSource}
      hasMusic={true}
      initialSource="/mb3/mono.mp3"
      sourceKey={sourceKey}
    />
  );
}
