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

// ── FLV Audio Extractor ──────────────────────────────────────────────
// Extracts AAC audio frames from FLV byte stream and wraps them in ADTS
// headers for Soniox ingestion. Uses Uint8Array for Node.js + browser compat.

const FLV_TAG_AUDIO = 8;
const FLV_HEADER_SIZE = 9;
const FLV_PREV_TAG_SIZE = 4;

class FlvAudioExtractor {
    private buffer = new Uint8Array(0);
    private headerParsed = false;
    private onAudio: (data: Uint8Array) => void;
    private aacProfile = 2;
    private sampleRateIndex = 4;
    private channelConfig = 2;
    private ascParsed = false;

    constructor(onAudio: (data: Uint8Array) => void) {
        this.onAudio = onAudio;
    }

    private parseASC(asc: Uint8Array): void {
        if (asc.length < 2) return;
        this.aacProfile = (asc[0] >> 3) & 0x1F;
        this.sampleRateIndex = ((asc[0] & 0x07) << 1) | ((asc[1] >> 7) & 0x01);
        this.channelConfig = (asc[1] >> 3) & 0x0F;
        this.ascParsed = true;
    }

    private buildAdtsHeader(frameLength: number): Uint8Array {
        const adts = new Uint8Array(7);
        const fullLength = frameLength + 7;
        const profile = this.aacProfile - 1;
        adts[0] = 0xFF;
        adts[1] = 0xF1;
        adts[2] = ((profile & 0x03) << 6) |
            ((this.sampleRateIndex & 0x0F) << 2) |
            ((this.channelConfig >> 2) & 0x01);
        adts[3] = ((this.channelConfig & 0x03) << 6) |
            ((fullLength >> 11) & 0x03);
        adts[4] = (fullLength >> 3) & 0xFF;
        adts[5] = ((fullLength & 0x07) << 5) | 0x1F;
        adts[6] = 0xFC;
        return adts;
    }

    push(chunk: Uint8Array): void {
        const newBuf = new Uint8Array(this.buffer.length + chunk.length);
        newBuf.set(this.buffer, 0);
        newBuf.set(chunk, this.buffer.length);
        this.buffer = newBuf;

        if (!this.headerParsed) {
            if (this.buffer.length < FLV_HEADER_SIZE + FLV_PREV_TAG_SIZE) return;
            if (this.buffer[0] !== 0x46 || this.buffer[1] !== 0x4C || this.buffer[2] !== 0x56) return;
            const dv = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
            const dataOffset = dv.getUint32(5);
            this.buffer = this.buffer.subarray(dataOffset + FLV_PREV_TAG_SIZE);
            this.headerParsed = true;
        }

        while (this.buffer.length >= 11) {
            const tagType = this.buffer[0] & 0x1F;
            const dataSize = (this.buffer[1] << 16) | (this.buffer[2] << 8) | this.buffer[3];
            const totalTagSize = 11 + dataSize + FLV_PREV_TAG_SIZE;
            if (this.buffer.length < totalTagSize) break;

            if (tagType === FLV_TAG_AUDIO) {
                const audioData = this.buffer.subarray(11, 11 + dataSize);
                if (audioData.length > 0) {
                    const soundFormat = (audioData[0] >> 4) & 0x0F;
                    if (soundFormat === 10 && audioData.length > 2) {
                        const aacPacketType = audioData[1];
                        if (aacPacketType === 0) {
                            this.parseASC(audioData.subarray(2));
                        } else if (aacPacketType === 1 && this.ascParsed) {
                            const rawFrame = audioData.subarray(2);
                            const adtsHeader = this.buildAdtsHeader(rawFrame.length);
                            const adtsFrame = new Uint8Array(adtsHeader.length + rawFrame.length);
                            adtsFrame.set(adtsHeader, 0);
                            adtsFrame.set(rawFrame, adtsHeader.length);
                            this.onAudio(adtsFrame);
                        }
                    }
                }
            }

            this.buffer = this.buffer.subarray(totalTagSize);
        }
    }

    reset(): void {
        this.buffer = new Uint8Array(0);
        this.headerParsed = false;
        this.ascParsed = false;
    }
}

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
    private streamAbortController: AbortController | null = null;
    private flvExtractor: FlvAudioExtractor | null = null;
    private streamUrl: string | null = null;

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
        // Abort stream download if active
        if (this.streamAbortController) {
            this.streamAbortController.abort();
            this.streamAbortController = null;
        }
        if (this.flvExtractor) {
            this.flvExtractor.reset();
            this.flvExtractor = null;
        }
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
                case 'stream_info':
                    // Server resolved stream URLs — connect to the FLV stream
                    if (this.debug) console.log(`[Captions] Received stream_info: flv=${!!msg.flvUrl}, hls=${!!msg.hlsUrl}, ao=${!!msg.audioOnlyUrl}`);
                    this.connectToStream(msg);
                    break;

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

                // Handle interim/final captions from server (sentence-level accumulation)
                case 'interim':
                    this.emit('caption', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: false,
                        confidence: msg.confidence || 0,
                        speaker: msg.speaker,
                    });
                    break;

                case 'final':
                    this.emit('caption', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: true,
                        confidence: msg.confidence || 0,
                        speaker: msg.speaker,
                    });
                    break;

                case 'translation_interim':
                    this.emit('translation', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: false,
                        confidence: msg.confidence || 0,
                        speaker: msg.speaker,
                    });
                    break;

                case 'translation_final':
                    this.emit('translation', {
                        text: msg.text,
                        language: msg.language,
                        isFinal: true,
                        confidence: msg.confidence || 0,
                        speaker: msg.speaker,
                    });
                    break;

                default:
                    if (this.debug) {
                        if (this.debug) console.log(`[Captions] Unknown message type: ${msg.type}`, msg);
                    }
            }
        } catch {
            if (this.debug) console.error('[Captions] Failed to parse message:', raw);
        }
    }

    /**
     * Connect to the TikTok FLV stream and extract audio.
     * Sends binary audio buffers to the server via WebSocket.
     */
    private async connectToStream(streamInfo: { flvUrl?: string; hlsUrl?: string; audioOnlyUrl?: string }): Promise<void> {
        // Prefer audio-only URL (smallest bandwidth), fall back to regular FLV
        const url = streamInfo.audioOnlyUrl || streamInfo.flvUrl;
        if (!url) {
            this.emit('error', { code: 'NO_STREAM_URL', message: 'Server did not provide a usable stream URL' });
            return;
        }

        this.streamUrl = url;
        if (this.debug) console.log(`[Captions] connectToStream: URL selected: ${url.substring(0, 80)}...`);

        // Abort any previous stream
        if (this.streamAbortController) {
            this.streamAbortController.abort();
        }
        this.streamAbortController = new AbortController();

        // Set up FLV audio extractor — sends ADTS-wrapped AAC to server
        let audioFramesSent = 0;
        let audioBytesSent = 0;
        this.flvExtractor = new FlvAudioExtractor((adtsFrame: Uint8Array) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(adtsFrame);
                audioFramesSent++;
                audioBytesSent += adtsFrame.length;
                if (this.debug && (audioFramesSent <= 3 || audioFramesSent % 100 === 0)) {
                    if (this.debug) console.log(`[Captions] Audio frame #${audioFramesSent}: ${adtsFrame.length}b (total: ${audioBytesSent}b)`);
                }
            } else if (this.debug && audioFramesSent === 0) {
                if (this.debug) console.log(`[Captions] WARNING: WS not open (readyState=${this.ws?.readyState}), cannot send audio`);
            }
        });

        try {
            if (this.debug) console.log(`[Captions] connectToStream: calling fetch()...`);
            const resp = await fetch(url, {
                signal: this.streamAbortController.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (this.debug) console.log(`[Captions] connectToStream: fetch returned status=${resp.status}, hasBody=${!!resp.body}`);

            if (!resp.ok || !resp.body) {
                throw new Error(`FLV stream HTTP ${resp.status}`);
            }

            if (this.debug) console.log(`[Captions] FLV stream connected (${resp.status})`);

            // Stream the response body
            const reader = (resp.body as any).getReader ?
                (resp.body as ReadableStream<Uint8Array>).getReader() : null;

            if (this.debug) console.log(`[Captions] connectToStream: hasReader=${!!reader}, hasAsyncIterator=${typeof (resp.body as any)[Symbol.asyncIterator] === 'function'}`);

            if (reader) {
                // Browser / modern Node.js ReadableStream
                const processStream = async () => {
                    let chunks = 0;
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done || this.intentionalClose) {
                                if (this.debug) console.log(`[Captions] FLV stream ended (done=${done}, intentionalClose=${this.intentionalClose}), chunks=${chunks}, audioFrames=${audioFramesSent}`);
                                break;
                            }
                            chunks++;
                            if (value && this.flvExtractor) {
                                this.flvExtractor.push(value);
                            }
                            if (this.debug && chunks <= 3) {
                                if (this.debug) console.log(`[Captions] FLV chunk #${chunks}: ${value?.length || 0}b`);
                            }
                        }
                    } catch (err: any) {
                        if (err.name !== 'AbortError' && !this.intentionalClose) {
                            if (this.debug) console.error('[Captions] FLV stream read error:', err.message);
                            this.emit('error', { code: 'STREAM_READ_ERROR', message: err.message });
                        } else if (this.debug) {
                            if (this.debug) console.log(`[Captions] FLV stream aborted after ${chunks} chunks, ${audioFramesSent} audio frames`);
                        }
                    }
                };
                processStream();
            } else if (typeof (resp.body as any)[Symbol.asyncIterator] === 'function') {
                // Node.js streams (undici body)
                const processNodeStream = async () => {
                    let chunks = 0;
                    try {
                        for await (const chunk of resp.body as any) {
                            if (this.intentionalClose) break;
                            chunks++;
                            const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                            if (this.flvExtractor) {
                                this.flvExtractor.push(u8);
                            }
                            if (this.debug && chunks <= 3) {
                                if (this.debug) console.log(`[Captions] FLV chunk #${chunks}: ${u8.length}b`);
                            }
                        }
                        if (this.debug) console.log(`[Captions] Node stream ended, chunks=${chunks}, audioFrames=${audioFramesSent}`);
                    } catch (err: any) {
                        if (err.name !== 'AbortError' && !this.intentionalClose) {
                            if (this.debug) console.error('[Captions] FLV stream read error:', err.message);
                            this.emit('error', { code: 'STREAM_READ_ERROR', message: err.message });
                        } else if (this.debug) {
                            if (this.debug) console.log(`[Captions] FLV node stream aborted after ${chunks} chunks, ${audioFramesSent} audio frames`);
                        }
                    }
                };
                processNodeStream();
            } else {
                if (this.debug) console.error(`[Captions] ERROR: resp.body has no getReader() and no asyncIterator!`);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError' && !this.intentionalClose) {
                if (this.debug) console.error('[Captions] FLV stream connect error:', err.message);
                this.emit('error', { code: 'STREAM_CONNECT_ERROR', message: err.message });
            }
        }
    }
}
