import type { HostInvitationsListResponse } from '@/lib/contracts';

export type PollerState = {
  data: HostInvitationsListResponse | null;
  loading: boolean;
  isInitialLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastUpdated: Date | null;
};

export type PollerConfig = {
  active: boolean;
  page?: number;
  status?: 'all' | 'pending' | 'accepted' | 'declined';
  query?: string;
  pollIntervalMs?: number;
  fetchFn?: typeof fetch;
  getVisibilityState?: () => DocumentVisibilityState;
  onStateChange: (state: PollerState) => void;
  onUnauthorized?: () => void;
};

export class ResponsesPoller {
  private active: boolean;
  private page: number;
  private status: 'all' | 'pending' | 'accepted' | 'declined';
  private query: string;
  private pollIntervalMs: number;
  private fetchFn: typeof fetch;
  private getVisibilityState: () => DocumentVisibilityState;
  private onStateChange: (state: PollerState) => void;
  private onUnauthorized?: () => void;

  private state: PollerState = {
    data: null,
    loading: false,
    isInitialLoading: true,
    error: null,
    isStale: false,
    lastUpdated: null,
  };

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private abortController: AbortController | null = null;
  private requestId = 0;
  private loadedFilterKey: string | null = null;
  private stoppedDueTo401 = false;
  private destroyed = false;

  constructor(config: PollerConfig) {
    this.active = config.active;
    this.page = config.page ?? 1;
    this.status = config.status ?? 'all';
    this.query = config.query ?? '';
    this.pollIntervalMs = config.pollIntervalMs ?? 10_000;
    this.fetchFn =
      config.fetchFn ??
      (typeof fetch !== 'undefined'
        ? (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)
        : (null as any));
    this.getVisibilityState =
      config.getVisibilityState ??
      (() => (typeof document !== 'undefined' ? document.visibilityState : 'visible'));
    this.onStateChange = config.onStateChange;
    this.onUnauthorized = config.onUnauthorized;
  }

  public getState(): PollerState {
    return { ...this.state };
  }

  private setState(updates: Partial<PollerState>) {
    this.state = { ...this.state, ...updates };
    this.onStateChange(this.getState());
  }

  public getFilterKey(): string {
    return `${this.status}:${this.query}:${this.page}`;
  }

  public clearPollTimer() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNextPoll() {
    this.clearPollTimer();
    if (
      this.destroyed ||
      !this.active ||
      this.stoppedDueTo401 ||
      this.getVisibilityState() !== 'visible'
    ) {
      return;
    }
    this.pollTimer = setTimeout(() => {
      this.executeFetch(false);
    }, this.pollIntervalMs);
  }

  public async executeFetch(isManualOrParamChange = false): Promise<void> {
    if (this.destroyed || this.stoppedDueTo401) return;
    if (!this.active && !isManualOrParamChange) return;

    if (this.inFlight) {
      if (isManualOrParamChange) {
        this.abortController?.abort();
      } else {
        return; // Prevent overlapping requests
      }
    }

    this.clearPollTimer();

    const targetFilterKey = this.getFilterKey();

    // If filter key changed, do not display previous filter's data
    if (this.loadedFilterKey !== targetFilterKey) {
      this.setState({
        data: null,
        isInitialLoading: true,
        loading: true,
      });
    } else {
      this.setState({ loading: true });
    }

    this.inFlight = true;
    const reqId = ++this.requestId;
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const urlParams = new URLSearchParams();
      urlParams.set('page', String(this.page));
      if (this.status !== 'all') urlParams.set('status', this.status);
      if (this.query) urlParams.set('query', this.query);

      const response = await this.fetchFn(`/api/host/invitations?${urlParams.toString()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });

      if (controller.signal.aborted || reqId !== this.requestId) return;

      if (response.status === 401) {
        this.stoppedDueTo401 = true;
        this.clearPollTimer();
        this.setState({
          data: null,
          loading: false,
          isInitialLoading: false,
          error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        });
        this.onUnauthorized?.();
        return;
      }

      if (response.ok) {
        const json: HostInvitationsListResponse = await response.json();
        if (controller.signal.aborted || reqId !== this.requestId) return;

        // If the server clamped the page (e.g. page > totalPages), align internal page
        this.page = json.page;
        this.loadedFilterKey = this.getFilterKey();
        this.setState({
          data: json,
          loading: false,
          isInitialLoading: false,
          error: null,
          isStale: false,
          lastUpdated: new Date(),
        });
      } else {
        const body = await response.json().catch(() => ({}));
        if (controller.signal.aborted || reqId !== this.requestId) return;

        const errMsg = body.message || 'Không thể tải danh sách phản hồi.';
        if (this.loadedFilterKey === targetFilterKey && this.state.data !== null) {
          this.setState({
            loading: false,
            isInitialLoading: false,
            isStale: true,
            error: errMsg,
          });
        } else {
          this.setState({
            loading: false,
            isInitialLoading: false,
            error: errMsg,
          });
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
        return;
      }
      if (reqId !== this.requestId) return;

      if (this.loadedFilterKey === targetFilterKey && this.state.data !== null) {
        this.setState({
          loading: false,
          isInitialLoading: false,
          isStale: true,
          error: 'Mất kết nối máy chủ. Đang hiển thị dữ liệu đã lưu gần nhất.',
        });
      } else {
        this.setState({
          loading: false,
          isInitialLoading: false,
          error: 'Không thể kết nối máy chủ.',
        });
      }
    } finally {
      if (reqId === this.requestId) {
        this.inFlight = false;
        this.scheduleNextPoll();
      }
    }
  }

  public async refresh(): Promise<void> {
    await this.executeFetch(true);
  }

  public onVisibilityChange(visibility: DocumentVisibilityState) {
    if (visibility === 'visible' && this.active && !this.stoppedDueTo401) {
      this.executeFetch(true);
    } else {
      this.clearPollTimer();
    }
  }

  public updateConfig(newConfig: Partial<Pick<PollerConfig, 'active' | 'page' | 'status' | 'query'>>) {
    const prevActive = this.active;
    const prevKey = this.getFilterKey();

    if (newConfig.active !== undefined) this.active = newConfig.active;
    if (newConfig.page !== undefined) this.page = newConfig.page;
    if (newConfig.status !== undefined) this.status = newConfig.status;
    if (newConfig.query !== undefined) this.query = newConfig.query;

    if (!this.active) {
      this.clearPollTimer();
      this.abortController?.abort();
      this.inFlight = false;
      this.setState({ loading: false });
      return;
    }

    if (!prevActive && this.active) {
      this.stoppedDueTo401 = false;
      this.executeFetch(true);
      return;
    }

    const newKey = this.getFilterKey();
    if (newKey !== prevKey) {
      this.executeFetch(true);
    }
  }

  public destroy() {
    this.destroyed = true;
    this.clearPollTimer();
    this.abortController?.abort();
    this.inFlight = false;
  }
}
