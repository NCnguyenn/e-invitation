'use client';

import { useEffect, useRef, useState } from 'react';

export type AudioSourceResult =
  | { signedUrl: string; expiresAt?: string; expiresIn?: number }
  | string;

export class AudioRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds = 60) {
    super(message);
    this.name = 'AudioRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function AudioPlayer({
  resolveSource,
  hasMusic = true,
  sourceKey,
  autoPlay = false,
  initialSource,
}: {
  resolveSource?: () => Promise<AudioSourceResult>;
  hasMusic?: boolean;
  sourceKey?: string | number;
  autoPlay?: boolean;
  initialSource?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const busyRef = useRef(false);
  const isMountedRef = useRef(true);
  const cachedSourceRef = useRef<{ url: string; expiresAtMs: number } | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    const element = audioRef.current;
    return () => {
      isMountedRef.current = false;
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, []);

  // When sourceKey changes (e.g. host replaced audio track), cancel old source and reset state
  useEffect(() => {
    const element = audioRef.current;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    cachedSourceRef.current = null;
    setPlaying(false);
    setError('');
  }, [sourceKey]);

  // Cooldown countdown timer for 429 rate limit
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      if (!isMountedRef.current) return;
      setCooldown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Prefetch audio source on mount so it's ready for instant playback when user clicks "Xem thư mời"
  useEffect(() => {
    if (!hasMusic || !resolveSource) return;
    const fetcher = resolveSource;
    let cancelled = false;

    async function prefetchSource() {
      const element = audioRef.current;
      if (!element || element.getAttribute('src')) return;
      try {
        const now = Date.now();
        const cached = cachedSourceRef.current;
        const isCachedValid = cached && cached.expiresAtMs - now > 60_000;
        if (isCachedValid) {
          element.src = cached.url;
          element.load();
          return;
        }

        const result = await fetcher();
        if (cancelled || !isMountedRef.current) return;

        let url: string;
        let expiresAtMs: number;
        if (typeof result === 'string') {
          url = result;
          expiresAtMs = now + 3600 * 1000;
        } else {
          url = result.signedUrl;
          if (result.expiresAt) {
            expiresAtMs = new Date(result.expiresAt).getTime();
            if (!Number.isFinite(expiresAtMs)) expiresAtMs = now + 3600 * 1000;
          } else if (result.expiresIn) {
            expiresAtMs = now + result.expiresIn * 1000;
          } else {
            expiresAtMs = now + 3600 * 1000;
          }
        }

        cachedSourceRef.current = { url, expiresAtMs };
        if (element && !element.getAttribute('src')) {
          element.src = url;
          element.load();
        }
      } catch {
        // Silent prefetch failure; will retry on explicit user toggle
      }
    }

    prefetchSource();
    return () => {
      cancelled = true;
    };
  }, [hasMusic, resolveSource, sourceKey]);

  // Auto-play when enabled and ready
  useEffect(() => {
    let cancelled = false;
    if (autoPlay && hasMusic && resolveSource) {
      const timer = setTimeout(() => {
        if (!cancelled && audioRef.current?.paused && !busyRef.current) {
          toggle();
        }
      }, 350);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [autoPlay, hasMusic, resolveSource]);

  // Listen for invitation entrance "Xem thư mời" transition
  useEffect(() => {
    async function handlePlayEvent() {
      const element = audioRef.current;
      if (!element || !hasMusic) return;
      if (initialSource && !element.getAttribute('src')) {
        element.src = initialSource;
        cachedSourceRef.current = { url: initialSource, expiresAtMs: Date.now() + 86400 * 1000 };
      }
      if (element.paused) {
        try {
          element.volume = 1.0;
          await element.play();
        } catch {
          if (!busyRef.current) {
            toggle();
          }
        }
      }
    }
    window.addEventListener('invitation:play-audio', handlePlayEvent);
    return () => window.removeEventListener('invitation:play-audio', handlePlayEvent);
  }, [hasMusic, resolveSource, initialSource]);

  async function toggle() {
    const element = audioRef.current;
    if (!element || !hasMusic || busyRef.current) return;
    if (!resolveSource && !initialSource) return;

    // Pausing is immediate and keeps current valid source
    if (!element.paused) {
      element.pause();
      return;
    }

    // Fast-path: If source is already attached to audio element, play directly
    const currentSrc = element.getAttribute('src');
    if (currentSrc) {
      try {
        element.volume = 1.0;
        await element.play();
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Playback error:', err);
        }
      }
      return;
    }

    // Rate limited cooldown guard
    if (cooldown > 0) {
      setError(`Bạn đã yêu cầu phát nhạc quá nhiều lần. Vui lòng thử lại sau ${cooldown} giây.`);
      return;
    }

    busyRef.current = true;
    setLoading(true);
    setError('');

    try {
      const now = Date.now();
      const cached = cachedSourceRef.current;
      const isCachedValid = cached && cached.expiresAtMs - now > 60_000; // 1-minute safety margin

      let currentSrc = element.getAttribute('src');

      if (!currentSrc || !isCachedValid) {
        if (!resolveSource) {
          throw new Error('Chưa có nguồn nhạc.');
        }
        const result = await resolveSource();
        let url: string;
        let expiresAtMs: number;

        if (typeof result === 'string') {
          url = result;
          expiresAtMs = now + 3600 * 1000;
        } else {
          url = result.signedUrl;
          if (result.expiresAt) {
            expiresAtMs = new Date(result.expiresAt).getTime();
            if (!Number.isFinite(expiresAtMs)) expiresAtMs = now + 3600 * 1000;
          } else if (result.expiresIn) {
            expiresAtMs = now + result.expiresIn * 1000;
          } else {
            expiresAtMs = now + 3600 * 1000;
          }
        }

        cachedSourceRef.current = { url, expiresAtMs };
        element.src = url;
        currentSrc = url;
      }

      await element.play();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      if (err instanceof AudioRateLimitError) {
        setCooldown(err.retryAfterSeconds);
        setError(`Bạn đã yêu cầu phát nhạc quá nhiều lần. Vui lòng thử lại sau ${err.retryAfterSeconds} giây.`);
        element.removeAttribute('src');
        element.load();
        cachedSourceRef.current = null;
        return;
      }

      // Check if error is autoplay NotAllowedError or interruption AbortError
      const isAbortOrNotAllowed = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError');
      if (isAbortOrNotAllowed) {
        // Keep the source intact for next user interaction
        if (err.name === 'NotAllowedError') {
          setError('Trình duyệt yêu cầu tương tác để phát nhạc. Vui lòng bấm vào đĩa than để phát.');
        }
      } else {
        element.removeAttribute('src');
        element.load();
        cachedSourceRef.current = null;
        setError(err instanceof Error ? err.message : 'Chưa phát được nhạc. Bạn có thể thử lại.');
      }
    } finally {
      if (isMountedRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  function handleMediaError() {
    if (!isMountedRef.current) return;
    setPlaying(false);
    cachedSourceRef.current = null;
    setError('Chưa phát được nhạc. Bạn có thể thử lại.');
  }

  if (!hasMusic || (!resolveSource && !initialSource)) {
    return <audio ref={audioRef} hidden aria-hidden="true" />;
  }

  const label = cooldown > 0
    ? `Tạm thời bị giới hạn (${cooldown} giây)`
    : playing
    ? 'Tạm dừng nhạc'
    : 'Phát nhạc';

  return (
    <div className="audio-controls">
      <audio
        ref={audioRef}
        src={initialSource}
        loop
        preload="auto"
        onPlay={() => {
          if (isMountedRef.current) setPlaying(true);
        }}
        onPause={() => {
          if (isMountedRef.current) setPlaying(false);
        }}
        onError={handleMediaError}
      />
      <button
        type="button"
        className={`float-btn ${playing ? 'is-playing' : ''}`}
        aria-label={label}
        disabled={loading || cooldown > 0}
        aria-pressed={playing}
        onClick={toggle}
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 5a7 7 0 0 1 7 7" />
        </svg>
      </button>
      {error && (
        <p className="audio-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
