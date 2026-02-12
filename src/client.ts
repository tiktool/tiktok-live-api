import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import WebSocket from 'ws';
import type { TikTokLiveOptions, TikTokLiveEvents, RoomInfo, LiveEvent } from './types.js';
import {
    decodeProto,
    getStr,
    getBytes,
    buildHeartbeat,
    buildImEnterRoom,
    buildAck,
    parseWebcastResponse,
} from './proto.js';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_SIGN_SERVER = 'https://api.tik.tools';

function httpGet(url: string, headers: Record<string, string>): Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
}> {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { headers }, (res) => {
            const chunks: Buffer[] = [];
            const enc = res.headers['content-encoding'];
            const stream = (enc === 'gzip' || enc === 'br')
                ? res.pipe(enc === 'br' ? zlib.createBrotliDecompress() : zlib.createGunzip())
                : res;
            stream.on('data', (c: Buffer) => chunks.push(c));
            stream.on('end', () => resolve({
                status: res.statusCode || 0,
                headers: res.headers,
                body: Buffer.concat(chunks),
            }));
            stream.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timeout')); });
    });
}

function getWsHost(clusterRegion: string): string {
    if (!clusterRegion) return 'webcast-ws.tiktok.com';
    const r = clusterRegion.toLowerCase();
    if (r.startsWith('eu') || r.includes('eu')) return 'webcast-ws.eu.tiktok.com';
    if (r.startsWith('us') || r.includes('us')) return 'webcast-ws.us.tiktok.com';
    return 'webcast-ws.tiktok.com';
}

export class TikTokLive extends EventEmitter {
    private ws: WebSocket | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts = 0;
    private intentionalClose = false;
    private _connected = false;
    private _eventCount = 0;
    private _roomId = '';

    private readonly uniqueId: string;
    private readonly signServerUrl: string;
    private readonly apiKey: string;
    private readonly autoReconnect: boolean;
    private readonly maxReconnectAttempts: number;
    private readonly heartbeatInterval: number;
    private readonly debug: boolean;

    constructor(options: TikTokLiveOptions) {
        super();
        this.uniqueId = options.uniqueId.replace(/^@/, '');
        this.signServerUrl = (options.signServerUrl || DEFAULT_SIGN_SERVER).replace(/\/$/, '');
        if (!options.apiKey) throw new Error('apiKey is required. Get a free key at https://tik.tools');
        this.apiKey = options.apiKey;
        this.autoReconnect = options.autoReconnect ?? true;
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
        this.heartbeatInterval = options.heartbeatInterval ?? 10_000;
        this.debug = options.debug ?? false;
    }

    async connect(): Promise<void> {
        this.intentionalClose = false;

        const resp = await httpGet(`https://www.tiktok.com/@${this.uniqueId}/live`, {
            'User-Agent': DEFAULT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        });

        let ttwid = '';
        for (const sc of [resp.headers['set-cookie'] || []].flat()) {
            if (typeof sc === 'string' && sc.startsWith('ttwid=')) {
                ttwid = sc.split(';')[0].split('=').slice(1).join('=');
                break;
            }
        }
        if (!ttwid) throw new Error('Failed to obtain session cookie');

        const html = resp.body.toString();
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
        if (!roomId) throw new Error(`User @${this.uniqueId} is not currently live`);
        this._roomId = roomId;

        const crMatch = html.match(/"clusterRegion"\s*:\s*"([^"]+)"/);
        const clusterRegion = crMatch ? crMatch[1] : '';
        const wsHost = getWsHost(clusterRegion);

        const wsParams = new URLSearchParams({
            version_code: '270000', device_platform: 'web', cookie_enabled: 'true',
            screen_width: '1920', screen_height: '1080', browser_language: 'en-US',
            browser_platform: 'Win32', browser_name: 'Mozilla',
            browser_version: DEFAULT_UA.split('Mozilla/')[1] || '5.0',
            browser_online: 'true', tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
            app_name: 'tiktok_web', sup_ws_ds_opt: '1', update_version_code: '2.0.0',
            compress: 'gzip', webcast_language: 'en', ws_direct: '1', aid: '1988',
            live_id: '12', app_language: 'en', client_enter: '1', room_id: roomId,
            identity: 'audience', history_comment_count: '6', last_rtt: '0',
            heartbeat_duration: '10000', resp_content_type: 'protobuf', did_rule: '3',
        });

        const rawWsUrl = `https://${wsHost}/webcast/im/ws_proxy/ws_reuse_supplement/?${wsParams}`;

        const signUrl = `${this.signServerUrl}/webcast/sign_url`;

        let wsUrl: string;
        try {
            const signResp = await fetch(signUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                body: JSON.stringify({ url: rawWsUrl }),
            });
            const signData = await signResp.json() as Record<string, any>;

            if (signData.status_code === 0 && signData.data?.signed_url) {
                wsUrl = (signData.data.signed_url as string).replace(/^https:\/\//, 'wss://');
            } else {
                wsUrl = rawWsUrl.replace(/^https:\/\//, 'wss://');
            }
        } catch {
            wsUrl = rawWsUrl.replace(/^https:\/\//, 'wss://');
        }

        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'User-Agent': DEFAULT_UA,
                    'Cookie': `ttwid=${ttwid}`,
                    'Origin': 'https://www.tiktok.com',
                },
            });

            this.ws.on('open', () => {
                this._connected = true;
                this.reconnectAttempts = 0;

                this.ws!.send(buildHeartbeat(roomId));
                this.ws!.send(buildImEnterRoom(roomId));
                this.startHeartbeat(roomId);

                const roomInfo: RoomInfo = {
                    roomId,
                    wsHost,
                    clusterRegion,
                    connectedAt: new Date().toISOString(),
                };

                this.emit('connected');
                this.emit('roomInfo', roomInfo);
                resolve();
            });

            this.ws.on('message', (rawData: Buffer) => {
                this.handleFrame(Buffer.from(rawData));
            });

            this.ws.on('close', (code, reason) => {
                this._connected = false;
                this.stopHeartbeat();

                const reasonStr = reason?.toString() || '';
                this.emit('disconnected', code, reasonStr);

                if (!this.intentionalClose && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30_000);
                    setTimeout(() => this.connect().catch(e => this.emit('error', e)), delay);
                }
            });

            this.ws.on('error', (err) => {
                this.emit('error', err);
                if (!this._connected) reject(err);
            });
        });
    }

    disconnect(): void {
        this.intentionalClose = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000);
            this.ws = null;
        }
        this._connected = false;
    }

    get connected(): boolean {
        return this._connected;
    }

    get eventCount(): number {
        return this._eventCount;
    }

    get roomId(): string {
        return this._roomId;
    }

    on<K extends keyof TikTokLiveEvents>(event: K, listener: TikTokLiveEvents[K]): this {
        return super.on(event, listener as (...args: any[]) => void);
    }

    once<K extends keyof TikTokLiveEvents>(event: K, listener: TikTokLiveEvents[K]): this {
        return super.once(event, listener as (...args: any[]) => void);
    }

    off<K extends keyof TikTokLiveEvents>(event: K, listener: TikTokLiveEvents[K]): this {
        return super.off(event, listener as (...args: any[]) => void);
    }

    emit<K extends keyof TikTokLiveEvents>(event: K, ...args: Parameters<TikTokLiveEvents[K]>): boolean {
        return super.emit(event, ...args);
    }

    private handleFrame(buf: Buffer): void {
        try {
            const fields = decodeProto(buf);
            const idField = fields.find(f => f.fn === 2 && f.wt === 0);
            const id = idField ? idField.value as bigint : 0n;
            const type = getStr(fields, 7);
            const binary = getBytes(fields, 8);

            if (id > 0n && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(buildAck(id));
            }

            if (type === 'msg' && binary && binary.length > 0) {
                let inner = binary;
                if (inner.length > 2 && inner[0] === 0x1f && inner[1] === 0x8b) {
                    try { inner = zlib.gunzipSync(inner); } catch { }
                }

                const events = parseWebcastResponse(inner);
                for (const evt of events) {
                    this._eventCount++;
                    this.emit('event', evt);
                    this.emit(evt.type as keyof TikTokLiveEvents, evt as any);
                }
            }
        } catch { }
    }

    private startHeartbeat(roomId: string): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(buildHeartbeat(roomId));
            }
        }, this.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
