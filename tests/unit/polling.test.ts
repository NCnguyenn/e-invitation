import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResponsesPoller } from '../../src/features/responses/polling';
import type { HostInvitationsListResponse } from '../../src/lib/contracts';

const sampleResponse: HostInvitationsListResponse = {
  items: [
    {
      id: 'inv-1',
      guestName: 'Lan Chi',
      guestEmail: 'chi@example.com',
      invitationNote: null,
      status: 'pending',
      emailStatus: 'pending',
      hasSendHistory: false,
      canEdit: true,
      guestMessage: null,
      respondedAt: null,
      token: 'tok-1',
      invitePath: '/invite/tok-1',
      createdAt: '2026-09-25T10:00:00Z',
      lastSendAttemptAt: null,
    },
  ],
  page: 1,
  pageSize: 50,
  filteredTotal: 1,
  totals: {
    total: 1,
    pending: 1,
    accepted: 0,
    declined: 0,
  },
};

describe('ResponsesPoller lifecycle and behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('polls every 10 seconds when active and visible', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      };
    });

    const stateChanges: any[] = [];
    const poller = new ResponsesPoller({
      active: true,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: (state) => stateChanges.push(state),
    });

    await poller.executeFetch(true);
    expect(callCount).toBe(1);
    expect(poller.getState().data?.totals.total).toBe(1);

    // Fast-forward 10 seconds -> should poll again
    await vi.advanceTimersByTimeAsync(10_000);
    expect(callCount).toBe(2);

    // Fast-forward another 10 seconds -> 3rd poll
    await vi.advanceTimersByTimeAsync(10_000);
    expect(callCount).toBe(3);

    poller.destroy();
  });

  it('does not poll when active is false', async () => {
    const fetchMock = vi.fn();
    const poller = new ResponsesPoller({
      active: false,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).not.toHaveBeenCalled();

    poller.destroy();
  });

  it('stops polling when hidden and resumes immediately when visible', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      };
    });

    let currentVisibility: DocumentVisibilityState = 'visible';
    const poller = new ResponsesPoller({
      active: true,
      fetchFn: fetchMock as any,
      getVisibilityState: () => currentVisibility,
      onStateChange: () => {},
    });

    await poller.executeFetch(true);
    expect(callCount).toBe(1);

    // Tab becomes hidden
    currentVisibility = 'hidden';
    poller.onVisibilityChange('hidden');

    // 20s pass in hidden state -> no new calls
    await vi.advanceTimersByTimeAsync(20_000);
    expect(callCount).toBe(1);

    // Tab becomes visible again -> immediate fetch!
    currentVisibility = 'visible';
    poller.onVisibilityChange('visible');
    // Allow microtasks to complete
    await vi.advanceTimersByTimeAsync(1);
    expect(callCount).toBe(2);

    // After 10s -> next poll
    await vi.advanceTimersByTimeAsync(10_000);
    expect(callCount).toBe(3);

    poller.destroy();
  });

  it('prevents overlapping requests and refresh does not duplicate polling loop', async () => {
    let callCount = 0;
    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        await firstPromise;
      }
      return {
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      };
    });

    const poller = new ResponsesPoller({
      active: true,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
    });

    // Start first request (which hangs until resolveFirst is called)
    const p1 = poller.executeFetch(true);
    expect(callCount).toBe(1);

    // Timer fires while request 1 is still in flight -> should be skipped!
    await poller.executeFetch(false);
    expect(callCount).toBe(1);

    // Manual refresh is called -> aborts previous and starts immediately
    const pRefresh = poller.refresh();
    expect(callCount).toBe(2);

    resolveFirst!();
    await p1;
    await pRefresh;

    // Fast forward 10 seconds -> should only trigger ONE next poll (no duplicate loops)
    await vi.advanceTimersByTimeAsync(10_000);
    expect(callCount).toBe(3);

    poller.destroy();
  });

  it('discards delayed responses from older requests when filter changes', async () => {
    let resolveOld: (data: any) => void;
    const oldPromise = new Promise<any>((resolve) => {
      resolveOld = resolve;
    });

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('accepted')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...sampleResponse,
            items: [{ ...sampleResponse.items[0], status: 'accepted' }],
          }),
        };
      }
      // Pending request is delayed
      await oldPromise;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleResponse,
          items: [{ ...sampleResponse.items[0], status: 'pending' }],
        }),
      };
    });

    const poller = new ResponsesPoller({
      active: true,
      status: 'pending',
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
    });

    // Trigger request for pending
    const pPending = poller.executeFetch(true);

    // User switches filter to accepted
    poller.updateConfig({ status: 'accepted' });
    // This starts request for accepted immediately
    // Allow microtasks
    await vi.advanceTimersByTimeAsync(1);

    expect(poller.getState().data?.items[0].status).toBe('accepted');

    // Now delayed old response resolves
    resolveOld!({});
    await pPending;

    // State must STILL be accepted! Old response was discarded.
    expect(poller.getState().data?.items[0].status).toBe('accepted');

    poller.destroy();
  });

  it('keeps last successful snapshot on network error and marks isStale: true', async () => {
    let success = true;
    const fetchMock = vi.fn().mockImplementation(async () => {
      if (!success) {
        throw new Error('Network offline');
      }
      return {
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      };
    });

    const poller = new ResponsesPoller({
      active: true,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
    });

    await poller.executeFetch(true);
    expect(poller.getState().data).toEqual(sampleResponse);
    expect(poller.getState().isStale).toBe(false);

    // Network drops
    success = false;
    await vi.advanceTimersByTimeAsync(10_000);

    const stateAfterError = poller.getState();
    // Snapshot is KEPT, not set to null or 0!
    expect(stateAfterError.data).toEqual(sampleResponse);
    expect(stateAfterError.isStale).toBe(true);
    expect(stateAfterError.error).toContain('Mất kết nối máy chủ');

    poller.destroy();
  });

  it('stops polling and clears data upon 401 Unauthorized', async () => {
    let unauthorizedTriggered = false;
    const fetchMock = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ message: 'Session expired' }),
      };
    });

    const poller = new ResponsesPoller({
      active: true,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
      onUnauthorized: () => {
        unauthorizedTriggered = true;
      },
    });

    await poller.executeFetch(true);

    expect(unauthorizedTriggered).toBe(true);
    expect(poller.getState().data).toBeNull();
    expect(poller.getState().error).toContain('hết hạn');

    // Advancing timers should NOT poll again
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    poller.destroy();
  });

  it('synchronizes internal page when server clamps page and avoids redundant re-fetch on UI sync', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleResponse,
          page: 1,
        }),
      };
    });

    const poller = new ResponsesPoller({
      active: true,
      page: 5,
      fetchFn: fetchMock as any,
      getVisibilityState: () => 'visible',
      onStateChange: () => {},
    });

    // Initial fetch requesting page 5
    await poller.executeFetch(true);
    expect(callCount).toBe(1);
    expect(poller.getState().data?.page).toBe(1);
    expect(poller.getFilterKey()).toBe('all::1');

    // UI syncs to data.page and notifies updateConfig({ page: 1 })
    poller.updateConfig({ page: 1 });

    // Should NOT trigger a redundant second fetch or blank out data!
    expect(callCount).toBe(1);
    expect(poller.getState().data).not.toBeNull();
    expect(poller.getState().isInitialLoading).toBe(false);

    poller.destroy();
  });
});
