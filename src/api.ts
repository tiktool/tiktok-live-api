/**
 * TikTool API utilities for the sign-and-return API flow.
 *
 * The API server returns signed URLs instead of fetching TikTok data directly.
 * These utilities handle the two-step flow:
 *   1. resolve_required — scrape TikTok HTML to get room_id
 *   2. fetch_signed_url — use the signed URL to get actual TikTok data
 *
 * @module
 */

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_SIGN_SERVER = 'https://api.tik.tools';

const pageCache = new Map<string, { info: LivePageInfo; ts: number }>();
const PAGE_CACHE_TTL = 5 * 60 * 1000;

/**
 * Resolved live page metadata from a TikTok live page.
 */
export interface LivePageInfo {
    /** Active room ID for the livestream */
    roomId: string;
    /** Session cookie required for WebSocket authentication */
    ttwid: string;
    /** Server cluster region (e.g. 'us', 'eu') */
    clusterRegion: string;
}

/**
 * Scrape a TikTok live page to extract room metadata.
 * Returns the room ID, session cookie, and cluster region.
 * Results are cached for 5 minutes. Returns `null` if the user is not live.
 */
export async function resolveLivePage(uniqueId: string): Promise<LivePageInfo | null> {
    const clean = uniqueId.replace(/^@/, '');
    const cached = pageCache.get(clean);
    if (cached && Date.now() - cached.ts < PAGE_CACHE_TTL) {
        return cached.info;
    }

    try {
        const resp = await fetch(`https://www.tiktok.com/@${clean}/live`, {
            headers: {
                'User-Agent': DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
        });

        if (!resp.ok) return null;

        // Extract ttwid session cookie
        let ttwid = '';
        const setCookies = resp.headers.get('set-cookie') || '';
        for (const part of setCookies.split(',')) {
            const trimmed = part.trim();
            if (trimmed.startsWith('ttwid=')) {
                ttwid = trimmed.split(';')[0].split('=').slice(1).join('=');
                break;
            }
        }
        if (!ttwid && typeof (resp.headers as any).getSetCookie === 'function') {
            for (const sc of (resp.headers as any).getSetCookie()) {
                if (typeof sc === 'string' && sc.startsWith('ttwid=')) {
                    ttwid = sc.split(';')[0].split('=').slice(1).join('=');
                    break;
                }
            }
        }

        const html = await resp.text();

        // Extract roomId from SIGI_STATE JSON block
        let roomId = '';
        const sigiMatch = html.match(/id="SIGI_STATE"[^>]*>([^<]+)/);
        if (sigiMatch) {
            try {
                const json = JSON.parse(sigiMatch[1]);
                const jsonStr = JSON.stringify(json);
                const m = jsonStr.match(/"roomId"\s*:\s*"(\d+)"/);
                if (m) roomId = m[1];
            } catch { }
        }

        // Fallback patterns
        if (!roomId) {
            const patterns = [
                /"roomId"\s*:\s*"(\d+)"/,
                /room_id[=/](\d{10,})/,
                /"idStr"\s*:\s*"(\d{10,})"/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) { roomId = m[1]; break; }
            }
        }

        if (!roomId) return null;

        // Extract cluster region
        const crMatch = html.match(/"clusterRegion"\s*:\s*"([^"]+)"/);
        const clusterRegion = crMatch ? crMatch[1] : '';

        const info: LivePageInfo = { roomId, ttwid, clusterRegion };
        pageCache.set(clean, { info, ts: Date.now() });
        return info;
    } catch { }

    return null;
}

/**
 * Resolve a TikTok username to a room ID.
 * Returns `null` if the user is not currently live.
 * Results are cached for 5 minutes.
 */
export async function resolveRoomId(uniqueId: string): Promise<string | null> {
    const info = await resolveLivePage(uniqueId);
    return info?.roomId ?? null;
}

export interface SignedUrlResponse {
    status_code: number;
    action?: string;
    signed_url: string;
    headers: Record<string, string>;
    cookies: string;
}

/**
 * Execute a signed-URL API response: fetch the signed URL and return the
 * parsed JSON data from TikTok.
 */
export async function fetchSignedUrl(response: SignedUrlResponse): Promise<any> {
    if (!response.signed_url) {
        return null;
    }

    const headers: Record<string, string> = { ...(response.headers || {}) };
    if (response.cookies) {
        headers['Cookie'] = response.cookies;
    }

    const resp = await fetch(response.signed_url, { headers, redirect: 'follow' });
    const text = await resp.text();
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export interface CallApiOptions {
    /** API server URL (default: https://api.tik.tools) */
    serverUrl?: string;
    /** API key for authentication */
    apiKey: string;
    /** API endpoint path (e.g. '/webcast/room_video') */
    endpoint: string;
    /** TikTok unique_id to resolve */
    uniqueId: string;
    /** HTTP method (default: POST) */
    method?: 'GET' | 'POST';
    /** Additional body fields for POST requests */
    extraBody?: Record<string, any>;
}

/**
 * Call a TikTool API endpoint, handling the full
 * resolve_required → room_id → signed_url → fetch flow automatically.
 *
 * Returns the actual TikTok data, or `null` if the user is not live.
 */
export async function callApi(opts: CallApiOptions): Promise<any> {
    const serverUrl = (opts.serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const isGet = opts.method === 'GET';
    const ak = encodeURIComponent(opts.apiKey);

    const url1 = isGet
        ? `${serverUrl}${opts.endpoint}?apiKey=${ak}&unique_id=${encodeURIComponent(opts.uniqueId)}`
        : `${serverUrl}${opts.endpoint}?apiKey=${ak}`;

    const fetchOpts1: RequestInit = isGet
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unique_id: opts.uniqueId, ...opts.extraBody }),
        };

    const resp1 = await fetch(url1, fetchOpts1);
    const data1 = await resp1.json() as any;

    // If the response contains a signed URL to fetch (with or without explicit action),
    // follow through and fetch the actual TikTok data
    if (data1.signed_url || data1.action === 'fetch_signed_url') {
        return fetchSignedUrl(data1);
    }

    if (data1.status_code === 0 && data1.action !== 'resolve_required') {
        return data1;
    }

    if (data1.action === 'resolve_required') {
        const roomId = await resolveRoomId(opts.uniqueId);
        if (!roomId) return null;

        const url2 = isGet
            ? `${serverUrl}${opts.endpoint}?apiKey=${ak}&room_id=${encodeURIComponent(roomId)}`
            : `${serverUrl}${opts.endpoint}?apiKey=${ak}`;

        const fetchOpts2: RequestInit = isGet
            ? {}
            : {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id: roomId, ...opts.extraBody }),
            };

        const resp2 = await fetch(url2, fetchOpts2);
        const data2 = await resp2.json() as any;

        if (data2.signed_url || data2.action === 'fetch_signed_url') {
            return fetchSignedUrl(data2);
        }

        return data2;
    }

    return data1;
}

// ── Ranklist API ────────────────────────────────────────────────────

import type { RanklistResponse } from './types.js';

export interface GetRanklistOptions {
    /** API server URL (default: https://api.tik.tools) */
    serverUrl?: string;
    /** API key for authentication */
    apiKey: string;
    /** TikTok username to look up (auto-resolves room_id and anchor_id) */
    uniqueId?: string;
    /** Direct room ID (skip resolution) */
    roomId?: string;
    /** Direct anchor/owner ID (skip resolution) */
    anchorId?: string;
    /**
     * TikTok session cookie string for authentication.
     * Required — ranklist endpoints return 20003 without login.
     * Example: "sessionid=abc123; sid_guard=def456"
     */
    sessionCookie?: string;
    /**
     * Which ranklist sub-endpoint to call:
     * - "online_audience" (default) — top gifters with scores
     * - "anchor_rank_list" — gifter ranking by rank_type
     * - "entrance" — entrance UI metadata, tabs, gap-to-rank
     */
    type?: 'online_audience' | 'anchor_rank_list' | 'entrance';
    /**
     * For "anchor_rank_list" type only:
     * - "1" = hourly ranking (default)
     * - "8" = daily ranking
     */
    rankType?: string;
}

/**
 * Fetch ranked user lists from TikTok via the sign server.
 *
 * When `sessionCookie` is provided, the server returns a **sign-and-return**
 * response with a signed URL that you must fetch from your own IP
 * (TikTok sessions are IP-bound). Check for `sign_and_return: true` in
 * the response to detect this mode.
 *
 * @example
 * ```ts
 * const data = await getRanklist({
 *     apiKey: 'your-key',
 *     uniqueId: 'katarina.live',
 *     sessionCookie: 'sessionid=abc; sid_guard=def',
 *     type: 'online_audience',
 * });
 *
 * if (data.sign_and_return) {
 *     // Fetch the signed URL from YOUR IP with your session cookie
 *     const resp = await fetch(data.signed_url, {
 *         method: data.method,
 *         headers: { ...data.headers, Cookie: sessionCookie },
 *         ...(data.body ? { body: data.body } : {}),
 *     });
 *     const tikData = await resp.json();
 *     console.log(tikData); // TikTok's raw response
 * } else {
 *     console.log(data); // Direct TikTok response (no session)
 * }
 * ```
 */
export async function getRanklist(opts: GetRanklistOptions): Promise<RanklistResponse> {
    const base = (opts.serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const ak = encodeURIComponent(opts.apiKey);

    const body: Record<string, any> = {};
    if (opts.uniqueId) body.unique_id = opts.uniqueId;
    if (opts.roomId) body.room_id = opts.roomId;
    if (opts.anchorId) body.anchor_id = opts.anchorId;
    if (opts.sessionCookie) body.session_cookie = opts.sessionCookie;
    if (opts.type) body.type = opts.type;
    if (opts.rankType) body.rank_type = opts.rankType;

    const resp = await fetch(`${base}/webcast/ranklist?apiKey=${ak}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await resp.json() as any;

    // The server wraps TikTok's response in { status_code, data }
    if (data.status_code === 20003) {
        throw new Error(
            data.message || 'TikTok requires login. Provide sessionCookie with your TikTok session.'
        );
    }

    if (data.status_code !== 0) {
        throw new Error(data.error || `Ranklist failed (status ${data.status_code})`);
    }

    // Sign-and-return mode: session cookie was provided, return the full
    // response so the caller can fetch the signed URL from their own IP.
    if (data.sign_and_return) {
        return data as RanklistResponse;
    }

    return data.data as RanklistResponse;
}

// ── CAPTCHA Solver API ──────────────────────────────────────────────

import type { PuzzleSolveResult, RotateSolveResult, ShapesSolveResult } from './types.js';

/**
 * Solve a puzzle (slider) CAPTCHA using the TikTool solver.
 *
 * @param apiKey - API key for authentication
 * @param puzzleB64 - Base64-encoded background image (PNG/JPEG)
 * @param pieceB64 - Base64-encoded puzzle piece image (PNG/JPEG)
 * @param serverUrl - Custom server URL (default: https://api.tik.tools)
 * @returns Solve result with slide position and confidence
 */
export async function solvePuzzle(
    apiKey: string,
    puzzleB64: string,
    pieceB64: string,
    serverUrl?: string,
): Promise<PuzzleSolveResult> {
    const base = (serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const resp = await fetch(`${base}/captcha/solve/puzzle?apiKey=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle: puzzleB64, piece: pieceB64 }),
    });
    const data = await resp.json() as any;
    if (data.status_code !== 0) {
        throw new Error(data.error || `Solver failed (status ${data.status_code})`);
    }
    return data.data as PuzzleSolveResult;
}

/**
 * Solve a rotate (whirl) CAPTCHA using the TikTool solver.
 *
 * @param apiKey - API key for authentication
 * @param outerB64 - Base64-encoded outer ring image (PNG/JPEG)
 * @param innerB64 - Base64-encoded inner rotated image (PNG/JPEG)
 * @param serverUrl - Custom server URL (default: https://api.tik.tools)
 * @returns Solve result with rotation angle and confidence
 */
export async function solveRotate(
    apiKey: string,
    outerB64: string,
    innerB64: string,
    serverUrl?: string,
): Promise<RotateSolveResult> {
    const base = (serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const resp = await fetch(`${base}/captcha/solve/rotate?apiKey=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outer: outerB64, inner: innerB64 }),
    });
    const data = await resp.json() as any;
    if (data.status_code !== 0) {
        throw new Error(data.error || `Solver failed (status ${data.status_code})`);
    }
    return data.data as RotateSolveResult;
}

/**
 * Solve a shapes (3D matching) CAPTCHA using the TikTool solver.
 *
 * @param apiKey - API key for authentication
 * @param imageB64 - Base64-encoded CAPTCHA image with shape grid (PNG/JPEG)
 * @param serverUrl - Custom server URL (default: https://api.tik.tools)
 * @returns Solve result with two matching shape coordinates and confidence
 */
export async function solveShapes(
    apiKey: string,
    imageB64: string,
    serverUrl?: string,
): Promise<ShapesSolveResult> {
    const base = (serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const resp = await fetch(`${base}/captcha/solve/shapes?apiKey=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageB64 }),
    });
    const data = await resp.json() as any;
    if (data.status_code !== 0) {
        throw new Error(data.error || `Solver failed (status ${data.status_code})`);
    }
    return data.data as ShapesSolveResult;
}

// ── Regional Leaderboard API ────────────────────────────────────────

export interface GetRegionalRanklistOptions {
    /** API server URL (default: https://api.tik.tools) */
    serverUrl?: string;
    /** API key for authentication (Pro or Ultra tier required) */
    apiKey: string;
    /** TikTok username to look up (auto-resolves room_id and anchor_id) */
    uniqueId?: string;
    /** Direct room ID (skip resolution) */
    roomId?: string;
    /** Direct anchor/owner ID (skip resolution) */
    anchorId?: string;
    /**
     * Ranking period:
     * - "1" = Hourly
     * - "8" = Daily (default)
     * - "15" = Popular LIVE
     * - "16" = League
     */
    rankType?: '1' | '8' | '15' | '16';
    /**
     * Sub-endpoint type:
     * - "list" (default) — ranked users with scores
     * - "entrance" — available ranking tabs/metadata
     */
    type?: 'list' | 'entrance';
    /** Gap interval filter (default: "0") */
    gapInterval?: string;
    /**
     * TikTok session cookie string for authentication.
     * Passed to the API server for proxied requests.
     * Example: "sessionid=abc123; sessionid_ss=abc123"
     */
    sessionCookie?: string;
    /**
     * Client's real IP address (for deployed server scenarios).
     * When running on a remote server, pass the end-user's IP so the
     * API server can proxy the TikTok request from the correct IP.
     */
    clientIp?: string;
}

export interface RegionalRanklistSignedResponse {
    /** Always 0 on success */
    status_code: number;
    /** Always "fetch_signed_url" */
    action: string;
    /** The signed TikTok URL to POST */
    signed_url: string;
    /** HTTP method (always POST) */
    method: string;
    /** Required headers for the fetch */
    headers: Record<string, string>;
    /** URL-encoded POST body */
    body: string;
    /** Cookies to include (ttwid etc.) — append your sessionid */
    cookies: string;
    /** Human-readable note */
    note: string;
}

/**
 * Get a signed URL for fetching regional LIVE leaderboard data.
 *
 * **Two-step pattern**: TikTok sessions are IP-bound, so instead of
 * server-side fetching, this returns a signed URL with headers/body
 * that you POST from your own IP with your session cookie.
 *
 * Requires **Pro** or **Ultra** API key tier.
 *
 * @example
 * ```ts
 * // Step 1: Get signed URL
 * const signed = await getRegionalRanklist({
 *     apiKey: 'your-pro-key',
 *     roomId: '7607695933891218198',
 *     anchorId: '7444599004337652758',
 *     rankType: '8', // Daily
 * });
 *
 * // Step 2: Fetch from YOUR IP with YOUR session
 * const resp = await fetch(signed.signed_url, {
 *     method: signed.method,
 *     headers: { ...signed.headers, Cookie: `sessionid=YOUR_SID; ${signed.cookies}` },
 *     body: signed.body,
 * });
 * const { data } = await resp.json();
 * data.rank_view.ranks.forEach((r, i) =>
 *     console.log(`${i+1}. ${r.user.nickname} — ${r.score} pts`)
 * );
 * ```
 */
export async function getRegionalRanklist(opts: GetRegionalRanklistOptions): Promise<RegionalRanklistSignedResponse> {
    const base = (opts.serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const ak = encodeURIComponent(opts.apiKey);

    const body: Record<string, any> = {};
    if (opts.uniqueId) body.unique_id = opts.uniqueId;
    if (opts.roomId) body.room_id = opts.roomId;
    if (opts.anchorId) body.anchor_id = opts.anchorId;
    if (opts.rankType) body.rank_type = opts.rankType;
    if (opts.type) body.type = opts.type;
    if (opts.gapInterval) body.gap_interval = opts.gapInterval;
    if (opts.sessionCookie) body.session_cookie = opts.sessionCookie;
    if (opts.clientIp) body.client_ip = opts.clientIp;

    const resp = await fetch(`${base}/webcast/ranklist/regional?apiKey=${ak}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await resp.json() as any;

    if (data.status_code !== 0) {
        throw new Error(data.error || `Regional ranklist failed (status ${data.status_code})`);
    }

    return data as RegionalRanklistSignedResponse;
}

// ── Feed Discovery API ──────────────────────────────────────────────

import type { FeedSignedResponse, FeedRoom } from './types.js';

export interface GetLiveFeedOptions {
    /** API server URL (default: https://api.tik.tools) */
    serverUrl?: string;
    /** API key for authentication (Pro or Ultra tier required) */
    apiKey: string;
    /** Region code (default: 'US') */
    region?: string;
    /**
     * Feed channel:
     * - '87' = Recommended (default)
     * - '86' = Suggested
     * - '42' = Following
     * - '1111006' = Gaming
     */
    channelId?: string;
    /** Number of rooms to return (max 50, default 20) */
    count?: number;
    /** Pagination cursor from previous response (default: '0') */
    maxTime?: string;
    /** TikTok sessionid cookie — required for populated results */
    sessionId?: string;
    /** TikTok ttwid cookie */
    ttwid?: string;
    /** TikTok msToken cookie */
    msToken?: string;
}

/**
 * Get a signed URL for fetching the TikTok LIVE feed.
 *
 * **Two-step pattern**: Returns a signed URL with headers and cookies.
 * Fetch the signed URL from your own IP to get the feed data.
 *
 * Requires **Pro** or **Ultra** API key tier.
 *
 * @example
 * ```ts
 * // Step 1: Get signed URL
 * const signed = await getLiveFeed({
 *     apiKey: 'your-pro-key',
 *     sessionId: 'your-tiktok-sessionid',
 *     region: 'US',
 *     count: 10,
 * });
 *
 * // Step 2: Fetch from YOUR IP
 * const resp = await fetch(signed.signed_url, {
 *     headers: { ...signed.headers, Cookie: signed.cookies || '' },
 * });
 * const data = await resp.json();
 * console.log(`Found ${data.data?.length || 0} live rooms`);
 *
 * // Step 3: Load more (pagination)
 * const nextSigned = await getLiveFeed({
 *     apiKey: 'your-pro-key',
 *     sessionId: 'your-tiktok-sessionid',
 *     maxTime: data.extra?.max_time || '0',
 * });
 * ```
 */
export async function getLiveFeed(opts: GetLiveFeedOptions): Promise<FeedSignedResponse> {
    const base = (opts.serverUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('apiKey', opts.apiKey);
    if (opts.region) params.set('region', opts.region);
    if (opts.channelId) params.set('channel_id', opts.channelId);
    if (opts.count !== undefined) params.set('count', String(Math.min(opts.count, 50)));
    if (opts.maxTime) params.set('max_time', opts.maxTime);
    if (opts.sessionId) params.set('session_id', opts.sessionId);
    if (opts.ttwid) params.set('ttwid', opts.ttwid);
    if (opts.msToken) params.set('ms_token', opts.msToken);

    const resp = await fetch(`${base}/webcast/feed?${params.toString()}`);
    const data = await resp.json() as any;

    if (resp.status === 429) {
        throw new Error(data.error || 'Feed daily limit reached. Upgrade your plan for more calls.');
    }
    if (!resp.ok) {
        throw new Error(data.error || `Feed request failed (HTTP ${resp.status})`);
    }

    return data as FeedSignedResponse;
}

/**
 * Convenience: Get the feed AND fetch the signed URL in one step.
 * Returns the parsed JSON feed data from TikTok.
 *
 * @example
 * ```ts
 * const feed = await fetchFeed({
 *     apiKey: 'your-pro-key',
 *     sessionId: 'your-tiktok-sessionid',
 *     region: 'GR',
 *     count: 10,
 * });
 * for (const entry of feed.data || []) {
 *     const room = entry.data;
 *     console.log(`🔴 @${room.owner.display_id}: "${room.title}" — ${room.user_count} viewers`);
 * }
 * ```
 */
export async function fetchFeed(opts: GetLiveFeedOptions): Promise<any> {
    const signed = await getLiveFeed(opts);
    const headers: Record<string, string> = { ...(signed.headers || {}) };
    if (signed.cookies) {
        headers['Cookie'] = signed.cookies;
    }
    const resp = await fetch(signed.signed_url, { headers, redirect: 'follow' });
    const text = await resp.text();
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
