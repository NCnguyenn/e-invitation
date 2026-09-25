'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { HostInvitationsListResponse } from '@/lib/contracts';
import { ResponsesPoller, type PollerState } from './polling';

export type UseResponsesOptions = {
  active: boolean;
  page?: number;
  status?: 'all' | 'pending' | 'accepted' | 'declined';
  query?: string;
  pollIntervalMs?: number;
};

export type UseResponsesResult = {
  data: HostInvitationsListResponse | null;
  loading: boolean;
  isInitialLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
};

export function useResponses({
  active,
  page = 1,
  status = 'all',
  query = '',
  pollIntervalMs = 10_000,
}: UseResponsesOptions): UseResponsesResult {
  const [state, setState] = useState<PollerState>({
    data: null,
    loading: false,
    isInitialLoading: true,
    error: null,
    isStale: false,
    lastUpdated: null,
  });

  const pollerRef = useRef<ResponsesPoller | null>(null);

  useEffect(() => {
    const poller = new ResponsesPoller({
      active,
      page,
      status,
      query,
      pollIntervalMs,
      onStateChange: (newState) => {
        setState(newState);
      },
      onUnauthorized: () => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },
    });

    pollerRef.current = poller;

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        poller.onVisibilityChange(document.visibilityState);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    if (active) {
      poller.executeFetch(true);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      poller.destroy();
      pollerRef.current = null;
    };
  }, []); // Run once on mount

  useEffect(() => {
    pollerRef.current?.updateConfig({ active, page, status, query });
  }, [active, page, status, query]);

  const refresh = useCallback(async () => {
    await pollerRef.current?.refresh();
  }, []);

  return {
    ...state,
    refresh,
  };
}
