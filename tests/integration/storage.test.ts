import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { anonClient, setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';
import {
  prepareHostAudioUpload,
  finalizeHostAudio,
  previewHostAudio,
} from '../../src/features/events/server';
import { requestGuestAudioUrl } from '../../src/features/guest/server';
import { canonicalAudioPath, MAX_AUDIO_BYTES } from '../../src/lib/validation';

const jar: { name: string; value: string }[] = [];
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => jar,
    set: (name: string, value: string) => {
      const index = jar.findIndex(item => item.name === name);
      if (index >= 0) jar[index] = { name, value };
      else jar.push({ name, value });
    },
  }),
}));


let fx: AuthorizationFixtures;
const createdInvitationIds: string[] = [];
const uploadedStoragePaths: string[] = [];

// Load a slice of the real music.mp3 fixture for valid audio/mpeg bytes
const realMp3Buffer = readFileSync('music.mp3');
const mp3SampleA = realMp3Buffer.subarray(0, 4096);
const mp3SampleB = realMp3Buffer.subarray(0, 8192);

beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
}, 120_000);

afterAll(async () => {
  // Cleanup test invitations
  if (createdInvitationIds.length > 0) {
    await fx.admin.from('invitations').delete().in('id', createdInvitationIds);
    createdInvitationIds.length = 0;
  }
  // Cleanup uploaded audio objects in storage
  if (uploadedStoragePaths.length > 0) {
    await fx.admin.storage.from('audio').remove(uploadedStoragePaths);
    uploadedStoragePaths.length = 0;
  }
  // Reset music_path on host events
  if (fx?.hostA?.eventId) {
    await fx.admin.from('events').update({ music_path: null }).eq('id', fx.hostA.eventId);
  }
  if (fx?.hostB?.eventId) {
    await fx.admin.from('events').update({ music_path: null }).eq('id', fx.hostB.eventId);
  }
});

describe('Storage Integration: Host Audio Upload and Replace', () => {
  it('prepares upload, uploads MP3 directly via Host client, finalizes, and verifies music_path', async () => {
    const hostAId = fx.hostA.id;
    const eventAId = fx.hostA.eventId!;

    // 1. Prepare
    const prep = await prepareHostAudioUpload(hostAId, {
      mimeType: 'audio/mpeg',
      fileSize: mp3SampleA.byteLength,
    });
    expect(prep).not.toBeNull();
    expect(prep?.bucket).toBe('audio');
    const expectedPath = canonicalAudioPath(hostAId, eventAId);
    expect(prep?.path).toBe(expectedPath);
    uploadedStoragePaths.push(expectedPath);

    // 2. Direct browser upload with Host A client (JWT authenticated)
    const blobA = new Blob([mp3SampleA], { type: 'audio/mpeg' });
    const { error: uploadError } = await fx.hostA.client.storage
      .from('audio')
      .upload(expectedPath, blobA, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '0',
      });
    expect(uploadError).toBeNull();

    // 3. Finalize
    const finalized = await finalizeHostAudio(hostAId);
    expect(finalized).not.toBeNull();
    expect(finalized?.hasMusic).toBe(true);

    // 4. Verify in database
    const { data: eventRow } = await fx.admin
      .from('events')
      .select('music_path')
      .eq('id', eventAId)
      .single();
    expect(eventRow?.music_path).toBe(expectedPath);

    // 5. Verify downloaded file bytes match sample A
    const { data: downloadA, error: dlErrA } = await fx.admin.storage
      .from('audio')
      .download(expectedPath, { cacheNonce: String(Date.now()) }, { cache: 'no-store' });
    expect(dlErrA).toBeNull();
    const downloadedBufA = Buffer.from(await downloadA!.arrayBuffer());
    expect(downloadedBufA.byteLength).toBe(mp3SampleA.byteLength);
    expect(downloadedBufA.equals(mp3SampleA)).toBe(true);
  });

  it('replaces audio with different MP3 at canonical path and verifies actual content changed', async () => {
    const hostAId = fx.hostA.id;
    const eventAId = fx.hostA.eventId!;
    const expectedPath = canonicalAudioPath(hostAId, eventAId);

    // Upload different content (sample B has 8192 bytes vs 4096)
    const blobB = new Blob([mp3SampleB], { type: 'audio/mpeg' });
    const { error: uploadError } = await fx.hostA.client.storage
      .from('audio')
      .upload(expectedPath, blobB, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '0',
      });
    expect(uploadError).toBeNull();

    // Verify metadata size in storage
    const { data: listB } = await fx.admin.storage
      .from('audio')
      .list(`${hostAId}/${eventAId}`);
    const fileB = listB?.find((f) => f.name === 'music.mp3');
    expect(fileB?.metadata?.size).toBe(mp3SampleB.byteLength);

    // Finalize again (idempotent)
    const finalized = await finalizeHostAudio(hostAId);
    expect(finalized?.hasMusic).toBe(true);

    // Download and verify content is actually sample B, not sample A
    const { data: downloadB, error: dlErrB } = await fx.admin.storage
      .from('audio')
      .download(expectedPath, { cacheNonce: String(Date.now() + 1) }, { cache: 'no-store' });
    expect(dlErrB).toBeNull();
    const downloadedBufB = Buffer.from(await downloadB!.arrayBuffer());
    expect(downloadedBufB.byteLength).toBe(mp3SampleB.byteLength);
    expect(downloadedBufB.byteLength).not.toBe(mp3SampleA.byteLength);
    expect(downloadedBufB.equals(mp3SampleB)).toBe(true);
  });

  it('rejects finalize when object does not exist or has invalid metadata', async () => {
    // Event with no storage file
    const hostBId = fx.hostB.id;
    await expect(finalizeHostAudio(hostBId)).rejects.toThrow();

    // Upload an invalid text file with text/plain
    const badPath = canonicalAudioPath(hostBId, fx.hostB.eventId!);
    uploadedStoragePaths.push(badPath);
    const badBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' });
    const { error: upErr } = await fx.hostB.client.storage
      .from('audio')
      .upload(badPath, badBlob, { contentType: 'text/plain', upsert: true });
    // Bucket level allowed_mime_types may reject or upload with text/plain
    if (!upErr) {
      await expect(finalizeHostAudio(hostBId)).rejects.toThrow();
    }
  });

  it('blocks Host A from uploading to Host B path and prevents client from updating music_path directly', async () => {
    const otherPath = canonicalAudioPath(fx.hostB.id, fx.hostB.eventId!);
    const blob = new Blob([mp3SampleA], { type: 'audio/mpeg' });

    // Host A uploads to Host B path -> blocked by Storage RLS
    const { error: crossUploadError } = await fx.hostA.client.storage
      .from('audio')
      .upload(otherPath, blob, { contentType: 'audio/mpeg', upsert: true });
    expect(crossUploadError).toBeTruthy();

    // Anon upload -> blocked
    const anon = anonClient(fx.url, fx.anonKey);
    const { error: anonUploadError } = await anon.storage
      .from('audio')
      .upload(otherPath, blob, { contentType: 'audio/mpeg', upsert: true });
    expect(anonUploadError).toBeTruthy();

    // Client direct UPDATE music_path -> blocked by database trigger
    const { error: directMusicUpdate } = await fx.hostA.client
      .from('events')
      .update({ music_path: 'fake/path/music.mp3' })
      .eq('id', fx.hostA.eventId);
    expect(directMusicUpdate).toBeTruthy();
  });

  it('proves private bucket: public URL cannot read private file, but signed URL can', async () => {
    const path = canonicalAudioPath(fx.hostA.id, fx.hostA.eventId!);

    // Public URL
    const { data: pubData } = fx.admin.storage.from('audio').getPublicUrl(path);
    const pubRes = await fetch(pubData.publicUrl);
    // Private bucket returns 400 or 403 or 404 for public access
    expect(pubRes.ok).toBe(false);

    // Signed URL
    const { data: signData, error: signErr } = await fx.admin.storage
      .from('audio')
      .createSignedUrl(path, 60);
    expect(signErr).toBeNull();
    expect(signData?.signedUrl).toBeTruthy();

    const signRes = await fetch(signData!.signedUrl);
    expect(signRes.ok).toBe(true);
    const signBuf = Buffer.from(await signRes.arrayBuffer());
    expect(signBuf.byteLength).toBe(mp3SampleB.byteLength);
  });

  it('provides Host preview signed URL without token or guest quota', async () => {
    const preview = await previewHostAudio(fx.hostA.id);
    expect(preview).not.toBeNull();
    expect(preview?.signedUrl).toContain('token=');
    expect(preview?.expiresIn).toBe(3600);

    const res = await fetch(preview!.signedUrl);
    expect(res.ok).toBe(true);
  });
});

describe('Storage Integration: Guest Audio & Atomic Rate Limiting', () => {
  let guestToken: string;
  let invitationId: string;

  beforeAll(async () => {
    // Create an accessible invitation for Host A's event (which has music_path set)
    guestToken = randomBytes(32).toString('hex');
    const { data, error } = await fx.admin
      .from('invitations')
      .insert({
        event_id: fx.hostA.eventId!,
        guest_name: 'Khach Nghe Nhac',
        guest_email: `audio-test-${randomBytes(4).toString('hex')}@example.com`,
        invitation_note: 'Loi moi rieng',
        token: guestToken,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) throw error ?? new Error('Failed to create test invitation');
    invitationId = data.id;
    createdInvitationIds.push(invitationId);
  });

  it('returns valid signed URL for guest and increments counter', async () => {
    const result = await requestGuestAudioUrl(guestToken);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.signedUrl).toBeTruthy();
      expect(result.expiresIn).toBe(3600);
      expect(Number.isFinite(new Date(result.expiresAt).getTime())).toBe(true);

      const res = await fetch(result.signedUrl);
      expect(res.ok).toBe(true);
    }

    // Verify counter is now 1 in database
    const { data: inv } = await fx.admin
      .from('invitations')
      .select('audio_requests_in_window, audio_window_started_at')
      .eq('id', invitationId)
      .single();
    expect(inv?.audio_requests_in_window).toBe(1);
    expect(inv?.audio_window_started_at).not.toBeNull();
  });

  it('rejects client direct update to audio rate limiting columns', async () => {
    const { error } = await fx.hostA.client
      .from('invitations')
      .update({
        audio_requests_in_window: 0,
        audio_window_started_at: null,
      })
      .eq('id', invitationId);
    expect(error).toBeTruthy();
  });

  it('blocks anon and authenticated from calling privileged RPC consume_audio_request_slot directly', async () => {
    const anon = anonClient(fx.url, fx.anonKey);
    const anonRpc = await anon.rpc('consume_audio_request_slot', { p_token: guestToken });
    expect(anonRpc.error).toBeTruthy();

    const hostRpc = await fx.hostA.client.rpc('consume_audio_request_slot', { p_token: guestToken });
    expect(hostRpc.error).toBeTruthy();
  });

  it('handles concurrency at slot 29: exactly one request gets the 30th slot, remainder gets 429', async () => {
    // Set counter to 29 within an active window
    const nowIso = new Date().toISOString();
    await fx.admin
      .from('invitations')
      .update({
        audio_requests_in_window: 29,
        audio_window_started_at: nowIso,
      })
      .eq('id', invitationId);

    // Fire 3 concurrent requests
    const results = await Promise.all([
      requestGuestAudioUrl(guestToken),
      requestGuestAudioUrl(guestToken),
      requestGuestAudioUrl(guestToken),
    ]);

    const successes = results.filter((r) => r.kind === 'success');
    const rateLimited = results.filter((r) => r.kind === 'rate_limited');

    expect(successes).toHaveLength(1);
    expect(rateLimited).toHaveLength(2);

    if (rateLimited[0].kind === 'rate_limited') {
      expect(rateLimited[0].retryAfterSeconds).toBeGreaterThan(0);
      expect(rateLimited[0].retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it('resets counter when 60-minute window expires and preserves finalized RSVP', async () => {
    // Lock an RSVP on this invitation first
    const { error: rsvpErr } = await fx.admin
      .from('invitations')
      .update({
        status: 'accepted',
        guest_message: 'Toi tham gia',
        responded_at: new Date().toISOString(),
      })
      .eq('id', invitationId);
    expect(rsvpErr).toBeNull();

    // Expire the window: started 61 minutes ago with 30 requests
    const pastWindow = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    await fx.admin
      .from('invitations')
      .update({
        audio_requests_in_window: 30,
        audio_window_started_at: pastWindow,
      })
      .eq('id', invitationId);

    // Request audio again -> window resets to 1, request succeeds!
    const result = await requestGuestAudioUrl(guestToken);
    expect(result.kind).toBe('success');

    // Check DB: counter is 1, window reset, and RSVP remained untouched!
    const { data: inv } = await fx.admin
      .from('invitations')
      .select('audio_requests_in_window, status, guest_message, responded_at')
      .eq('id', invitationId)
      .single();

    expect(inv?.audio_requests_in_window).toBe(1);
    expect(inv?.status).toBe('accepted');
    expect(inv?.guest_message).toBe('Toi tham gia');
    expect(inv?.responded_at).not.toBeNull();
  });
});
