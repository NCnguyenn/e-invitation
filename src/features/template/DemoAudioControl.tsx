'use client';

import { AudioPlayer } from './AudioPlayer';

export function DemoAudioControl({
  sampleUrl = '/audio/graduation-sample.mp3',
}: {
  sampleUrl?: string;
}) {
  async function resolveSource() {
    return sampleUrl;
  }

  return (
    <AudioPlayer
      hasMusic={true}
      resolveSource={resolveSource}
      initialSource={sampleUrl}
      autoPlay={false}
    />
  );
}
