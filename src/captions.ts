/**
 * TikTokCaptions — Real-time speech-to-text transcription and translation for TikTok LIVE streams.
 *
 * AI-powered audio transcription with speaker diarization, multi-language auto-detection,
 * real-time translation, and sub-second latency. Connects via WebSocket to the TikTool
 * captions relay for continuous streaming transcription.
 *
 * @example
 * ```ts
 * import { TikTokCaptions } from '@tiktool/live';
 *
 * const captions = new TikTokCaptions({
 *   uniqueId: 'username',
 *   apiKey: 'your-api-key',
 *   language: 'en',      // translate to English
 * });
 *
 * captions.on('caption', (data) => {
 *   console.log(`[${data.language}] ${data.text}`);
 * });
 *
 * captions.on('translation', (data) => {
 *   console.log(`[translated] ${data.text}`);
 * });
 *
 * await captions.start();
 * ```
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';



export interface TikTokCaptionsOptions {
    /** TikTok username to transcribe (without @) */
    uniqueId: string;
    /** API key for authentication */
    apiKey: string;
    /** Source language hint (e.g. 'en', 'ja'). Leave empty for auto-detection. */
    language?: string;
    /** Target language for real-time translation (e.g. 'en', 'es', 'fr'). One language per session. */
    translate?: string;
    /** Enable speaker diarization to identify individual speakers (default: true) */
    diarization?: boolean;
    /** Max session duration in minutes before auto-disconnect (default: 60, max: 300) */
    maxDurationMinutes?: number;
    /** Custom server URL (default: wss://api.tik.tools) */
    signServerUrl?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Auto-reconnect on disconnect */
    autoReconnect?: boolean;
    /** Max reconnect attempts (default: 5) */
    maxReconnectAttempts?: number;
}

export interface CaptionData {
    /** Transcribed text */
    text: string;
    /** Detected source language */
    language: string;
    /** Whether this is the final version of this segment */
    isFinal: boolean;
    /** Confidence score (0-1) */
    confidence: number;
    /** Speaker identifier (if available) */
    speaker?: string;
    /** Start time in milliseconds */
    startMs?: number;
    /** End time in milliseconds */
    endMs?: number;
}

export interface TranslationData {
    /** Translated text */
    text: string;
    /** Target language */
    language: string;
    /** Whether this is the final version */
    isFinal: boolean;
    /** Confidence score (0-1) */
    confidence: number;
    /** Speaker identifier (if available) */
    speaker?: string;
}

export interface CaptionCredits {
    /** Credits remaining */
    remaining: number;
    /** Total credits purchased */
    total: number;
    /** Credits used in this session */
    used: number;
    /** Whether credits are low */
    warning: boolean;
}

export interface CaptionStatus {
    /** Current status */
    status: 'connecting' | 'waiting' | 'live' | 'transcribing' | 'ended' |
    'switching_language' | 'language_switched' | 'stream_ended';
    /** TikTok username */
    uniqueId?: string;
    /** Room ID (once resolved) */
    roomId?: string;
    /** Language (for language switch events) */
    language?: string;
    /** Status message */
    message?: string;
}

export interface CaptionError {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
}

export interface TikTokCaptionsEvents {
    /** Fired for each transcription token */
    caption: (data: CaptionData) => void;
    /** Fired for each translated token */
    translation: (data: TranslationData) => void;
    /** Status changes (connecting, live, transcribing, etc.) */
    status: (data: CaptionStatus) => void;
    /** Credit balance updates */
    credits: (data: CaptionCredits) => void;
    /** Low credit warning */
    credits_low: (data: { remaining: number; total: number; percent: number }) => void;
    /** Error events */
    error: (data: CaptionError) => void;
    /** WebSocket connected */
    connected: () => void;
    /** WebSocket disconnected */
    disconnected: (code: number, reason: string) => void;
}

const DEFAULT_CAPTIONS_SERVER = 'wss://api.tik.tools';

export class TikTokCaptions extends EventEmitter {
    private ws: WebSocket | null = null;
    private _connected = false;
    private intentionalClose = false;
    private reconnectAttempts = 0;

    private readonly uniqueId: string;
    private readonly apiKey: string;
    private readonly serverUrl: string;
    private readonly autoReconnect: boolean;
    private readonly maxReconnectAttempts: number;
    private readonly debug: boolean;
    private readonly _translate: string;
    private readonly _diarization: boolean;
    private readonly _maxDurationMinutes: number;
    private _language: string;

    constructor(options: TikTokCaptionsOptions) {
        super();
        this.uniqueId = options.uniqueId.replace(/^@/, '');
        if (!options.apiKey) throw new Error('apiKey is required. Get a free key at https://tik.tools');
        this.apiKey = options.apiKey;
        this._language = options.language || '';
        this._translate = options.translate || '';
        this._diarization = options.diarization ?? true;
        this._maxDurationMinutes = options.maxDurationMinutes ?? 60;
        this.serverUrl = (options.signServerUrl || DEFAULT_CAPTIONS_SERVER).replace(/\/$/, '');
        this.autoReconnect = options.autoReconnect ?? true;
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
        this.debug = options.debug ?? false;
    }

    /**
     * Start real-time captions for the configured TikTok user.
     * Connects to the captions WebSocket relay and begins transcription
     * once the user goes live (or immediately if already live).
     */
    async start(): Promise<void> {
        this.intentionalClose = false;

        const wsUrl = this.buildWsUrl();
        if (this.debug) console.log(`[Captions] Connecting to ${wsUrl}`);

        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this._connected = true;
                this.reconnectAttempts = 0;
                if (this.debug) console.log('[Captions] Connected');
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data: Buffer | string) => {
                this.handleMessage(typeof data === 'string' ? data : data.toString());
            });

            this.ws.on('close', (code: number, reason: Buffer) => {
                this._connected = false;
                const reasonStr = reason?.toString() || '';
                if (this.debug) console.log(`[Captions] Disconnected: ${code} ${reasonStr}`);
                this.emit('disconnected', code, reasonStr);

                if (!this.intentionalClose && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30_000);
                    if (this.debug) console.log(`[Captions] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.start().catch(e => this.emit('error', { code: 'RECONNECT_FAILED', message: e.message })), delay);
                }
            });

            this.ws.on('error', (err: Error) => {
                this.emit('error', { code: 'WS_ERROR', message: err.message });
                if (!this._connected) reject(err);
            });
        });
    }

    /**
     * Stop captions and disconnect.
     */
    stop(): void {
        this.intentionalClose = true;
        if (this.ws) {
            // Send stop action before closing
            this.send({ action: 'stop' });
            this.ws.close(1000);
            this.ws = null;
        }
        this._connected = false;
    }

    /**
     * Switch the translation target language on-the-fly.
     * Causes a brief interruption while the transcription engine reconfigures.
     */
    setLanguage(language: string): void {
        this._language = language;
        this.send({ action: 'set_language', language });
    }

    /**
     * Request a credit balance update from the server.
     */
    getCredits(): void {
        this.send({ action: 'get_credits' });
    }

    /** Whether the WebSocket is currently connected */
    get connected(): boolean {
        return this._connected;
    }

    /** The current target language */
    get language(): string {
        return this._language;
    }



    on<K extends keyof TikTokCaptionsEvents>(event: K, listener: TikTokCaptionsEvents[K]): this {
        return super.on(event, listener as (...args: any[]) => void);
    }

    once<K extends keyof TikTokCaptionsEvents>(event: K, listener: TikTokCaptionsEvents[K]): this {
        return super.once(event, listener as (...args: any[]) => void);
    }

    off<K extends keyof TikTokCaptionsEvents>(event: K, listener: TikTokCaptionsEvents[K]): this {
        return super.off(event, listener as (...args: any[]) => void);
    }

    emit<K extends keyof TikTokCaptionsEvents>(event: K, ...args: Parameters<TikTokCaptionsEvents[K]>): boolean {
        return super.emit(event, ...args);
    }

    private buildWsUrl(): string {
        const base = this.serverUrl.replace(/^http/, 'ws');
        const params = new URLSearchParams({
            uniqueId: this.uniqueId,
            apiKey: this.apiKey,
        });
        if (this._language) params.set('language', this._language);
        if (this._translate) params.set('translate', this._translate);
        if (this._diarization !== undefined) params.set('diarization', String(this._diarization));
        if (this._maxDurationMinutes) params.set('max_duration_minutes', String(this._maxDurationMinutes));
        return `${base}/captions?${params}`;
    }

    private send(msg: Record<string, any>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(raw: string): void {
        try {
            const msg = JSON.parse(raw);

            switch (msg.type) {
                case 'caption':
                    this.emit('caption', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: msg.isFinal,
                        confidence: msg.confidence,
                        speaker: msg.speaker,
                        startMs: msg.startMs,
                        endMs: msg.endMs,
                    });
                    break;

                case 'translation':
                    this.emit('translation', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: msg.isFinal,
                        confidence: msg.confidence,
                        speaker: msg.speaker,
                    });
                    break;

                case 'status':
                    this.emit('status', {
                        status: msg.status,
                        uniqueId: msg.uniqueId,
                        roomId: msg.roomId,
                        language: msg.language,
                        message: msg.message,
                    });
                    break;

                case 'credits':
                    this.emit('credits', {
                        remaining: msg.remaining,
                        total: msg.total,
                        used: msg.used,
                        warning: msg.warning,
                    });
                    break;

                case 'credits_low':
                    this.emit('credits_low', {
                        remaining: msg.remaining,
                        total: msg.total,
                        percent: msg.percent,
                    });
                    break;

                case 'error':
                    this.emit('error', {
                        code: msg.code,
                        message: msg.message,
                    });
                    break;

                default:
                    if (this.debug) {
                        console.log(`[Captions] Unknown message type: ${msg.type}`, msg);
                    }
            }
        } catch {
            if (this.debug) console.error('[Captions] Failed to parse message:', raw);
        }
    }
}
