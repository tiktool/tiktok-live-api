/**
 * TikTool REST client - typed methods for every customer-facing tik.tools
 * REST endpoint. Pairs with the {@link TikTokLive} WebSocket client.
 *
 * @example
 * ```typescript
 * import { TikTool } from 'tiktok-live-api';
 *
 * const api = new TikTool({ apiKey: 'YOUR_KEY' });
 *
 * const live = await api.isLive('username');
 * const board = await api.leaderboard({ region: 'US+' });
 * const recruits = await api.eligibleCreators({ region: 'US+', limit: 50 });
 * ```
 *
 * Uses the global `fetch` (Node 18+ or any browser).
 */

const REST_BASE = 'https://api.tik.tools'

export interface TikToolOptions {
  apiKey: string
  /** Override the API base URL. Defaults to https://api.tik.tools */
  baseUrl?: string
}

/** Thrown when an endpoint returns a non-2xx status. `body` holds the parsed error payload. */
export class TikToolError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : `Request failed with status ${status}`
    super(msg)
    this.name = 'TikToolError'
    this.status = status
    this.body = body
  }
}

type Query = Record<string, string | number | boolean | undefined | null>
interface RequestOpts {
  method?: 'GET' | 'POST'
  query?: Query
  body?: unknown
}

export class TikTool {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(options: TikToolOptions) {
    if (!options?.apiKey) throw new Error('TikTool requires an apiKey')
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? REST_BASE).replace(/\/$/, '')
  }

  /** Low-level request. Use the named methods below; this is exposed for endpoints not yet wrapped. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API boundary
  async request<T = any>(path: string, opts: RequestOpts = {}): Promise<T> {
    const url = new URL(this.baseUrl + path)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
      }
    }
    const headers: Record<string, string> = { 'x-api-key': this.apiKey }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'

    const res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!res.ok) throw new TikToolError(res.status, data)
    return data as T
  }

  /**
   * Creator-identifier query params. The API is inconsistent about whether an
   * endpoint reads `unique_id`, `username`, or `uniqueId`, so we send all three;
   * unused ones are ignored server-side.
   */
  private uid(uniqueId: string): Query {
    return { unique_id: uniqueId, username: uniqueId, uniqueId }
  }

  // --- Signing / connection ---
  signUrl(url: string) { return this.request('/webcast/sign_url', { method: 'POST', body: { url } }) }
  signWebsocket(body: Record<string, unknown>) { return this.request('/webcast/sign_websocket', { method: 'POST', body }) }
  wsCredentials(uniqueId: string) { return this.request('/webcast/ws_credentials', { query: this.uid(uniqueId) }) }
  connectionMode(uniqueId: string) { return this.request('/webcast/connection_mode', { query: this.uid(uniqueId) }) }
  checkAlive(uniqueId: string) { return this.request('/webcast/check_alive', { query: this.uid(uniqueId) }) }
  rateLimits() { return this.request('/webcast/rate_limits') }
  wsSessions() { return this.request('/webcast/ws_sessions') }
  jwt(body?: Record<string, unknown>) { return this.request('/authentication/jwt', { method: 'POST', body: body ?? {} }) }

  // --- Live status ---
  isLive(uniqueId: string) { return this.request('/webcast/is_live', { query: this.uid(uniqueId) }) }
  liveStatus(uniqueId: string) { return this.request('/webcast/live_status', { query: this.uid(uniqueId) }) }
  bulkLiveCheck(usernames: string[]) { return this.request('/webcast/bulk_live_check', { method: 'POST', body: { usernames } }) }
  liveCounts(region?: string) { return this.request('/webcast/live_counts', { query: { region } }) }
  roomId(uniqueId: string) { return this.request('/webcast/room_id', { query: this.uid(uniqueId) }) }
  roomInfo(uniqueId: string) { return this.request('/webcast/room_info', { query: this.uid(uniqueId) }) }
  roomCover(uniqueId: string) { return this.request('/webcast/room_cover', { query: this.uid(uniqueId) }) }
  roomVideo(uniqueId: string) { return this.request('/webcast/room_video', { query: this.uid(uniqueId) }) }

  // --- Rankings / leaderboards ---
  rankings(query?: Query) { return this.request('/webcast/rankings', { query }) }
  ranklist(query?: Query) { return this.request('/webcast/ranklist', { query }) }
  ranklistRegional(region: string) { return this.request('/webcast/ranklist/regional', { query: { region } }) }
  ranklistGaming(region: string) { return this.request('/webcast/ranklist/gaming', { query: { region } }) }
  gamingMovers(region: string) { return this.request('/webcast/ranklist/gaming_movers', { query: { region } }) }
  regionMovers(region: string) { return this.request('/webcast/ranklist/region_movers', { query: { region } }) }
  leaderboard(query: { region: string } & Query) { return this.request('/webcast/leaderboard', { query }) }
  eligibleCreators(query: { region?: string; page?: number; limit?: number; min_score?: number } & Query) {
    return this.request('/webcast/eligible_creators', { query })
  }

  // --- Gifts ---
  giftInfo(query?: Query) { return this.request('/webcast/gift_info', { query }) }
  giftGallery(query?: Query) { return this.request('/webcast/gift_gallery', { query }) }
  giftsByCountry(country: string) { return this.request('/webcast/gifts_by_country', { query: { country } }) }

  // --- User / profile ---
  lookupUsername(uniqueId: string) { return this.request('/webcast/lookup_username', { query: this.uid(uniqueId) }) }
  profileInfo(uniqueId: string) { return this.request('/webcast/profile_info', { query: this.uid(uniqueId) }) }
  resolveUserIds(usernames: string[]) { return this.request('/webcast/resolve_user_ids', { method: 'POST', body: { usernames } }) }
  userProfile(uniqueId: string) { return this.request('/webcast/user_profile', { query: this.uid(uniqueId) }) }
  userVideos(uniqueId: string, query?: Query) { return this.request('/webcast/user_videos', { query: { ...this.uid(uniqueId), ...query } }) }
  userFollowers(uniqueId: string, query?: Query) { return this.request('/webcast/user_followers', { query: { ...this.uid(uniqueId), ...query } }) }
  userFollowing(uniqueId: string, query?: Query) { return this.request('/webcast/user_following', { query: { ...this.uid(uniqueId), ...query } }) }
  userLikes(uniqueId: string, query?: Query) { return this.request('/webcast/user_likes', { query: { ...this.uid(uniqueId), ...query } }) }
  userEarnings(uniqueId: string) { return this.request('/webcast/user_earnings', { query: this.uid(uniqueId) }) }

  // --- Content / feed ---
  hashtagList(query?: Query) { return this.request('/webcast/hashtag_list', { query }) }
  fetch(body: Record<string, unknown>) { return this.request('/webcast/fetch', { method: 'POST', body }) }
  feed(query?: Query) { return this.request('/webcast/feed', { query }) }
  chat(uniqueId: string, query?: Query) { return this.request('/webcast/chat', { query: { ...this.uid(uniqueId), ...query } }) }

  // --- Live analytics ---
  analyticsVideoList(query?: Query) { return this.request('/webcast/live_analytics/video_list', { query }) }
  analyticsVideoDetail(query?: Query) { return this.request('/webcast/live_analytics/video_detail', { query }) }
  analyticsUserInteractions(query?: Query) { return this.request('/webcast/live_analytics/user_interactions', { query }) }

  // --- Moderation ---
  moderationMutes(uniqueId: string) { return this.request('/webcast/moderation/mutes', { query: this.uid(uniqueId) }) }
  moderationBans(uniqueId: string) { return this.request('/webcast/moderation/bans', { query: this.uid(uniqueId) }) }

  // --- CAPTCHA solver (Pro+) ---
  solvePuzzle(body: Record<string, unknown>) { return this.request('/captcha/solve/puzzle', { method: 'POST', body }) }
  solveRotate(body: Record<string, unknown>) { return this.request('/captcha/solve/rotate', { method: 'POST', body }) }
  solveShapes(body: Record<string, unknown>) { return this.request('/captcha/solve/shapes', { method: 'POST', body }) }

  // --- Captions ---
  captionsCredits() { return this.request('/captions/credits') }
}
