/**
 * TikTokLive — Connect to any TikTok LIVE stream via WebSocket.
 *
 * Receives real-time events: chat messages, gifts, likes, follows,
 * viewer counts, battles, and more. Powered by the TikTool managed API.
 *
 * @example
 * ```typescript
 * import { TikTokLive } from 'tiktok-live-api';
 *
 * const client = new TikTokLive('streamer_username', { apiKey: 'YOUR_KEY' });
 *
 * client.on('chat', (event) => {
 *   console.log(`${event.user.uniqueId}: ${event.comment}`);
 * });
 *
 * client.connect();
 * ```
 *
 * @packageDocumentation
 */

import WebSocket from 'ws';
import type { TikTokLiveEventMap } from './types';

const WS_BASE = 'wss://api.tik.tools';
const VERSION = '1.0.0';

/** Options for {@link TikTokLive} constructor. */
export interface TikTokLiveOptions {
  /** Your TikTool API key. Get one free at https://tik.tools */
  apiKey?: string;
  /** Auto-reconnect on disconnect (default: true). */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5). */
  maxReconnectAttempts?: number;
}

type EventHandler<T> = (data: T) => void | Promise<void>;

/**
 * Connect to a TikTok LIVE stream and receive real-time events.
 *
 * @example
 * ```typescript
 * const client = new TikTokLive('username', { apiKey: 'KEY' });
 * client.on('chat', (e) => console.log(e.comment));
 * client.on('gift', (e) => console.log(`${e.giftName} worth ${e.diamondCount} 💎`));
 * client.connect();
 * ```
 */
export class TikTokLive {
  /** TikTok username (without @). */
  readonly uniqueId: string;
  /** Your TikTool API key. */
  readonly apiKey: string;
  /** Whether to auto-reconnect on disconnect. */
  readonly autoReconnect: boolean;
  /** Maximum reconnection attempts. */
  readonly maxReconnectAttempts: number;

  private _handlers = new Map<string, Set<EventHandler<any>>>();
  private _ws: WebSocket | null = null;
  private _connected = false;
  private _intentionalClose = false;
  private _reconnectAttempts = 0;
  private _eventCount = 0;

  /**
   * Create a new TikTokLive client.
   *
   * @param uniqueId - TikTok username (without @)
   * @param options - Configuration options
   *
   * @example
   * ```typescript
   * const client = new TikTokLive('streamer', { apiKey: 'YOUR_KEY' });
   * ```
   */
  constructor(uniqueId: string, options: TikTokLiveOptions = {}) {
    this.uniqueId = uniqueId.replace(/^@/, '');
    this.apiKey = options.apiKey || process.env.TIKTOOL_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('apiKey is required. Get a free key at https://tik.tools');
    }
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  /** Whether the client is currently connected. */
  get connected(): boolean {
    return this._connected;
  }

  /** Total number of events received this session. */
  get eventCount(): number {
    return this._eventCount;
  }

  /**
   * Register an event handler.
   *
   * @param event - Event name (chat, gift, like, follow, etc.)
   * @param handler - Callback function
   * @returns this (for chaining)
   *
   * @example
   * ```typescript
   * client.on('chat', (event) => console.log(event.comment));
   * client.on('gift', (event) => console.log(event.giftName));
   * ```
   */
  on<K extends keyof TikTokLiveEventMap>(
    event: K,
    handler: EventHandler<TikTokLiveEventMap[K]>,
  ): this;
  on(event: string, handler: EventHandler<any>): this;
  on(event: string, handler: EventHandler<any>): this {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   *
   * @param event - Event name
   * @param handler - The handler to remove
   */
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
   * Connect to the TikTok LIVE stream.
   *
   * @returns Promise that resolves when connected, rejects on fatal error.
   *
   * @example
   * ```typescript
   * await client.connect();
   * ```
   */
  async connect(): Promise<void> {
    this._intentionalClose = false;
    const uri = `${WS_BASE}?uniqueId=${this.uniqueId}&apiKey=${this.apiKey}`;

    return new Promise<void>((resolve, reject) => {
      this._ws = new WebSocket(uri, {
        headers: { 'User-Agent': `tiktok-live-api/${VERSION}` },
      });

      this._ws.on('open', () => {
        this._connected = true;
        this._reconnectAttempts = 0;
        this._emit('connected', { uniqueId: this.uniqueId });
        resolve();
      });

      this._ws.on('message', (raw: Buffer) => {
        try {
          const event = JSON.parse(raw.toString());
          this._eventCount++;
          const eventType: string = event.event || 'unknown';
          const data = event.data || event;
          this._emit('event', event);
          this._emit(eventType, data);
        } catch {
          // skip malformed messages
        }
      });

      this._ws.on('close', () => {
        this._connected = false;
        this._emit('disconnected', { uniqueId: this.uniqueId });
        this._maybeReconnect();
      });

      this._ws.on('error', (err: Error) => {
        this._emit('error', { error: err.message });
        if (!this._connected) reject(err);
      });
    });
  }

  /**
   * Disconnect from the stream.
   */
  disconnect(): void {
    this._intentionalClose = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }

  private async _maybeReconnect(): Promise<void> {
    if (
      this._intentionalClose ||
      !this.autoReconnect ||
      this._reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }
    this._reconnectAttempts++;
    const delay = Math.min(2 ** (this._reconnectAttempts - 1) * 1000, 30_000);
    await new Promise((r) => setTimeout(r, delay));
    try {
      await this.connect();
    } catch {
      // reconnect will retry
    }
  }
}
