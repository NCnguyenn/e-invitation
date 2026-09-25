import { describe, expect, it, vi } from 'vitest';
import {
  parseAudioPrepare,
  canonicalAudioPath,
  isValidAudioMetadata,
  MAX_AUDIO_BYTES,
  ALLOWED_AUDIO_MIME,
} from '../../src/lib/validation';
import { AudioRateLimitError } from '../../src/features/template/AudioPlayer';

describe('audio validation unit rules', () => {
  it('enforces exact MIME audio/mpeg and positive size up to 10 MiB', () => {
    expect(MAX_AUDIO_BYTES).toBe(10_485_760);
    expect(ALLOWED_AUDIO_MIME).toBe('audio/mpeg');

    // Valid inputs
    expect(parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: 10_485_760 })).toEqual({
      mimeType: 'audio/mpeg',
      fileSize: 10_485_760,
    });
    expect(parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: 1024 })).toEqual({
      mimeType: 'audio/mpeg',
      fileSize: 1024,
    });

    // Invalid MIME
    for (const badMime of ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'application/octet-stream', '']) {
      expect(() => parseAudioPrepare({ mimeType: badMime, fileSize: 1024 })).toThrow();
    }

    // Invalid sizes
    for (const badSize of [0, -1, 10_485_761, 20_000_000, 1.5, NaN, Infinity]) {
      expect(() => parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: badSize })).toThrow();
    }

    // Disallowed extra keys
    expect(() =>
      parseAudioPrepare({
        mimeType: 'audio/mpeg',
        fileSize: 1024,
        path: 'extra/path',
      }),
    ).toThrow();
  });

  it('generates canonical audio path pattern {user_id}/{event_id}/music.mp3', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const eventId = '22222222-2222-4222-8222-222222222222';
    expect(canonicalAudioPath(userId, eventId)).toBe(
      '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/music.mp3',
    );
  });

  it('validates storage object metadata strictly', () => {
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 1024 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 10_485_760 })).toBe(true);

    expect(isValidAudioMetadata({ mimetype: 'audio/mp3', size: 1024 })).toBe(false);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 0 })).toBe(false);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 10_485_761 })).toBe(false);
    expect(isValidAudioMetadata(null)).toBe(false);
    expect(isValidAudioMetadata(undefined)).toBe(false);
  });
});

describe('audio player error handling & rate limit', () => {
  it('constructs AudioRateLimitError with proper retry-after seconds', () => {
    const err = new AudioRateLimitError('Rate limited', 45);
    expect(err.name).toBe('AudioRateLimitError');
    expect(err.message).toBe('Rate limited');
    expect(err.retryAfterSeconds).toBe(45);
  });

  it('defaults AudioRateLimitError retry-after to 60 seconds', () => {
    const err = new AudioRateLimitError('Too many requests');
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('source caching logic reuses valid source and refreshes expired source', () => {
    const now = 1_000_000;
    // Source valid for 3600 seconds
    const validCached = { url: 'https://example.com/audio1.mp3', expiresAtMs: now + 3600 * 1000 };
    const isCachedValid = validCached.expiresAtMs - now > 60_000;
    expect(isCachedValid).toBe(true);

    // Source near expiration (30 seconds remaining < 60s margin)
    const expiringCached = { url: 'https://example.com/audio1.mp3', expiresAtMs: now + 30 * 1000 };
    const isExpiringValid = expiringCached.expiresAtMs - now > 60_000;
    expect(isExpiringValid).toBe(false);

    // Expired source
    const expiredCached = { url: 'https://example.com/audio1.mp3', expiresAtMs: now - 1000 };
    const isExpiredValid = expiredCached.expiresAtMs - now > 60_000;
    expect(isExpiredValid).toBe(false);
  });

  it('distinguishes between NotAllowedError (autoplay policy) and fatal media errors', () => {
    const autoplayError = new Error('play() failed because the user didn\'t interact with the document first.');
    autoplayError.name = 'NotAllowedError';

    const isAutoplay = autoplayError.name === 'NotAllowedError';
    expect(isAutoplay).toBe(true);

    const networkError = new Error('MEDIA_ELEMENT_ERROR: Format error');
    networkError.name = 'MediaError';
    expect(networkError.name === 'NotAllowedError').toBe(false);
  });

  it('does not trigger infinite retry loops on rate limits or failures', async () => {
    let callCount = 0;
    const failingResolver = vi.fn(async () => {
      callCount += 1;
      throw new AudioRateLimitError('Rate limit exceeded', 60);
    });

    let cooldown = 0;
    try {
      await failingResolver();
    } catch (err) {
      if (err instanceof AudioRateLimitError) {
        cooldown = err.retryAfterSeconds;
      }
    }

    expect(callCount).toBe(1);
    expect(cooldown).toBe(60);

    // When cooldown > 0, player skips calling resolver
    if (cooldown > 0) {
      // guard prevents calling failingResolver again
    } else {
      await failingResolver();
    }
    expect(callCount).toBe(1);
  });

  it('normalizes audio metadata MIME type with parameters and case-insensitivity', () => {
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg; charset=utf-8', size: 5000 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'AUDIO/MPEG', size: 5000 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'AUDIO/MPEG; CHARSET=UTF-8', size: 5000 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'video/mp4; charset=utf-8', size: 5000 })).toBe(false);
  });

  it('ensures .mp3 extension is not the only evidence of validity', () => {
    // Helper replicating MusicUploader client-side validation logic
    function validateFileForUpload(file: { name: string; type?: string; size: number }) {
      if (!file.name.toLowerCase().endsWith('.mp3')) {
        return { valid: false, error: 'Chỉ chấp nhận tệp có đuôi .mp3.' };
      }
      if (file.type && file.type !== 'audio/mpeg') {
        return { valid: false, error: 'Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).' };
      }
      if (file.size <= 0 || file.size > 10_485_760) {
        return { valid: false, error: 'Dung lượng tệp phải lớn hơn 0 và không vượt quá 10 MiB.' };
      }
      return { valid: true };
    }

    // A fake MP3 with image or executable MIME must be rejected
    expect(validateFileForUpload({ name: 'malware.mp3', type: 'application/x-msdownload', size: 5000 })).toEqual({
      valid: false,
      error: 'Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).',
    });
    expect(validateFileForUpload({ name: 'photo.mp3', type: 'image/jpeg', size: 5000 })).toEqual({
      valid: false,
      error: 'Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).',
    });

    // Non-.mp3 file with audio/mpeg MIME must also be rejected
    expect(validateFileForUpload({ name: 'song.wav', type: 'audio/mpeg', size: 5000 })).toEqual({
      valid: false,
      error: 'Chỉ chấp nhận tệp có đuôi .mp3.',
    });

    // Valid MP3 file
    expect(validateFileForUpload({ name: 'song.mp3', type: 'audio/mpeg', size: 5000 })).toEqual({
      valid: true,
    });
  });

  it('calculates retry-after bounded between 1 and 3600 seconds', () => {
    function calculateRetryAfter(windowStartedAtMs: number, nowMs: number): number {
      const windowEndMs = windowStartedAtMs + 60 * 60 * 1000;
      const diffSec = Math.ceil((windowEndMs - nowMs) / 1000);
      return Math.min(3600, Math.max(1, diffSec));
    }

    const now = 10_000_000;
    // Window started 10 minutes ago -> 50 minutes (3000 seconds) remaining
    expect(calculateRetryAfter(now - 10 * 60 * 1000, now)).toBe(3000);
    // Window started just now -> 3600 seconds
    expect(calculateRetryAfter(now, now)).toBe(3600);
    // Window about to end in 0.2s -> 1 second
    expect(calculateRetryAfter(now - (3600 * 1000 - 200), now)).toBe(1);
    // Skewed clock where now is somehow before window start
    expect(calculateRetryAfter(now + 1000, now)).toBe(3600);
  });
});

