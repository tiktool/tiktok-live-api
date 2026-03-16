/**
 * TikTokCaptions — Real-time AI speech-to-text for TikTok LIVE streams.
 *
 * Transcribe and translate any TikTok LIVE stream in real-time.
 * This feature is unique to TikTool Live — no other service offers it.
 *
 * @example
 * ```typescript
 * import { TikTokCaptions } from 'tiktok-live-api';
 *
 * const captions = new TikTokCaptions('streamer', {
 *   apiKey: 'YOUR_KEY',
 *   translate: 'en',
 *   diarization: true,
 * });
 *
 * captions.on('caption', (event) => {
 *   console.log(`[${event.speaker}] ${event.text}`);
 * });
 *
 * captions.connect();
 * ```
 *
 * @packageDocumentation
 */

import WebSocket from 'ws';
import type { TikTokCaptionsEventMap } from './types';

const CAPTIONS_BASE = 'wss://api.tik.tools/captions';
const VERSION = '1.0.0';

/** Options for {@link TikTokCaptions} constructor. */
export interface TikTokCaptionsOptions {
  /** Your TikTool API key. Get one at https://tik.tools */
  apiKey?: string;
  /** Target language code for real-time translation (e.g. "en", "es"). */
  translate?: string;
  /** Enable speaker identification (default: true). */
  diarization?: boolean;
  /** Auto-disconnect after N minutes (default: 60, max: 300). */
  maxDurationMinutes?: number;
}

type EventHandler<T> = (data: T) => void | Promise<void>;

/**
 * Real-time AI speech-to-text for TikTok LIVE streams.
 *
 * @example
 * ```typescript
 * const captions = new TikTokCaptions('streamer', {
 *   apiKey: 'KEY',
 *   translate: 'en',
 * });
 * captions.on('caption', (e) => console.log(e.text));
 * captions.on('translation', (e) => console.log(`→ ${e.text}`));
 * captions.connect();
 * ```
 */
export class TikTokCaptions {
  /** TikTok username (without @). */
  readonly uniqueId: string;
  /** Your TikTool API key. */
  readonly apiKey: string;
  /** Target translation language. */
  readonly translate?: string;
  /** Whether speaker diarization is enabled. */
  readonly diarization: boolean;
  /** Max session duration in minutes. */
  readonly maxDurationMinutes?: number;

  private _handlers = new Map<string, Set<EventHandler<any>>>();
  private _ws: WebSocket | null = null;
  private _connected = false;
  private _intentionalClose = false;

  /**
   * Create a new TikTokCaptions client.
   *
   * @param uniqueId - TikTok username (without @)
   * @param options - Configuration options
   */
  constructor(uniqueId: string, options: TikTokCaptionsOptions = {}) {
    this.uniqueId = uniqueId.replace(/^@/, '');
    this.apiKey = options.apiKey || process.env.TIKTOOL_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('apiKey is required. Get a free key at https://tik.tools');
    }
    this.translate = options.translate;
    this.diarization = options.diarization ?? true;
    this.maxDurationMinutes = options.maxDurationMinutes;
  }

  /** Whether currently connected and receiving captions. */
  get connected(): boolean {
    return this._connected;
  }

  /**
   * Register an event handler.
   *
   * @param event - Event name (caption, translation, credits, status, error)
   * @param handler - Callback function
   *
   * @example
   * ```typescript
   * captions.on('caption', (event) => {
   *   const prefix = event.speaker ? `[${event.speaker}] ` : '';
   *   console.log(`${prefix}${event.text}${event.isFinal ? ' ✓' : '...'}`);
   * });
   * ```
   */
  on<K extends keyof TikTokCaptionsEventMap>(
    event: K,
    handler: EventHandler<TikTokCaptionsEventMap[K]>,
  ): this;
  on(event: string, handler: EventHandler<any>): this;
  on(event: string, handler: EventHandler<any>): this {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    return this;
  }

  /** Remove an event handler. */
  off(event: string, handler: EventHandler<any>): this {
    this._handlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(event: string, data: any): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error(`Error in '${event}' handler:`, err),
          );
        }
      } catch (err) {
        console.error(`Error in '${event}' handler:`, err);
      }
    }
  }

  /**
   * Start receiving captions from the stream.
   *
   * @returns Promise that resolves when connected.
   */
  async connect(): Promise<void> {
    this._intentionalClose = false;
    let params = `uniqueId=${this.uniqueId}&apiKey=${this.apiKey}`;
    if (this.translate) params += `&translate=${this.translate}`;
    if (this.diarization) params += '&diarization=true';
    if (this.maxDurationMinutes)
      params += `&max_duration_minutes=${this.maxDurationMinutes}`;

    const uri = `${CAPTIONS_BASE}?${params}`;

    return new Promise<void>((resolve, reject) => {
      this._ws = new WebSocket(uri, {
        headers: { 'User-Agent': `tiktok-live-api/${VERSION}` },
      });

      this._ws.on('open', () => {
        this._connected = true;
        this._emit('connected', { uniqueId: this.uniqueId });
        resolve();
      });

      this._ws.on('message', (raw: Buffer) => {
        try {
          const event = JSON.parse(raw.toString());
          const msgType: string = event.type || 'unknown';
          this._emit(msgType, event);
        } catch {
          // skip malformed
        }
      });

      this._ws.on('close', () => {
        this._connected = false;
        this._emit('disconnected', { uniqueId: this.uniqueId });
      });

      this._ws.on('error', (err: Error) => {
        this._emit('error', { error: err.message });
        if (!this._connected) reject(err);
      });
    });
  }

  /** Stop receiving captions. */
  disconnect(): void {
    this._intentionalClose = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }
}
