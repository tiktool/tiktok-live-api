/**
 * TikTok-Live-Connector (TTLC) compatibility layer.
 *
 * Drop-in replacement for `WebcastPushConnection` from `tiktok-live-connector`.
 * Users can switch to TikTools by changing a single import line:
 *
 * ```diff
 * - const { WebcastPushConnection } = require('tiktok-live-connector');
 * + const { WebcastPushConnection } = require('tiktok-live-api');
 * ```
 *
 * All TTLC event names, constructor options, and methods are supported.
 *
 * @packageDocumentation
 */

import { TikTokLive, type TikTokLiveOptions } from './client';

// ── TTLC-compatible event enums ──

/**
 * Control events matching TikTok-Live-Connector's ControlEvents.
 */
export const ControlEvents = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    RAWDATA: 'rawData',
    DECODEDDATA: 'decodedData',
    STREAMEND: 'streamEnd',
    WSCONNECTED: 'websocketConnected',
} as const;

/**
 * Message events matching TikTok-Live-Connector's MessageEvents.
 */
export const MessageEvents = {
    CHAT: 'chat',
    MEMBER: 'member',
    GIFT: 'gift',
    ROOMUSER: 'roomUser',
    SOCIAL: 'social',
    LIKE: 'like',
    QUESTIONNEW: 'questionNew',
    LINKMICBATTLE: 'linkMicBattle',
    LINKMICARMIES: 'linkMicArmies',
    LIVEINTRO: 'liveIntro',
    EMOTE: 'emote',
    ENVELOPE: 'envelope',
    SUBSCRIBE: 'subscribe',
    BARRAGE: 'barrage',
    SUPERFAN: 'superFan',
    SUPERFANJOIN: 'superFanJoin',
    SUPERFANBOX: 'superFanBox',
    ROOMPIN: 'roomPin',
} as const;

/**
 * Custom events matching TikTok-Live-Connector's CustomEvents.
 */
export const CustomEvents = {
    FOLLOW: 'follow',
    SHARE: 'share',
} as const;

// ── TTLC-compatible constructor options ──

export interface WebcastPushConnectionOptions extends TikTokLiveOptions {
    /** Euler Stream API key (maps to TikTools apiKey). */
    signApiKey?: string;
    /** @deprecated Handled server-side. Accepted for compatibility. */
    processInitialData?: boolean;
    /** @deprecated Handled server-side. Accepted for compatibility. */
    fetchRoomInfoOnConnect?: boolean;
    /** @deprecated Always enabled. Accepted for compatibility. */
    enableExtendedGiftInfo?: boolean;
    /** @deprecated Always true. Accepted for compatibility. */
    enableWebsocketUpgrade?: boolean;
    /** @deprecated Not used. Accepted for compatibility. */
    enableRequestPolling?: boolean;
    /** @deprecated Not used. Accepted for compatibility. */
    requestPollingIntervalMs?: number;
    /** TikTok session ID. */
    sessionId?: string;
    /** @deprecated Not used. Accepted for compatibility. */
    clientParams?: Record<string, any>;
    /** @deprecated Not used. Accepted for compatibility. */
    requestHeaders?: Record<string, string>;
    /** @deprecated Not used. Accepted for compatibility. */
    websocketHeaders?: Record<string, string>;
    /** @deprecated Not used. Accepted for compatibility. */
    requestOptions?: Record<string, any>;
    /** @deprecated Not used. Accepted for compatibility. */
    websocketOptions?: Record<string, any>;
    /** @deprecated Not used. Accepted for compatibility. */
    signProviderOptions?: Record<string, any>;
}

/**
 * Drop-in replacement for TikTok-Live-Connector's `WebcastPushConnection`.
 *
 * Accepts the exact same constructor signature and event names.
 * Under the hood, connects to the TikTools managed WebSocket API
 * for 99.9% uptime and zero maintenance.
 *
 * @example
 * ```typescript
 * // Before (TikTok-Live-Connector):
 * // const { WebcastPushConnection } = require('tiktok-live-connector');
 *
 * // After (TikTools - one-line change):
 * const { WebcastPushConnection } = require('tiktok-live-api');
 *
 * const connection = new WebcastPushConnection('username', {
 *   signApiKey: 'YOUR_TIKTOOL_API_KEY', // Get free at tik.tools
 * });
 *
 * connection.on('chat', (data) => {
 *   console.log(`${data.uniqueId}: ${data.comment}`);
 * });
 *
 * connection.connect();
 * ```
 */
export class WebcastPushConnection extends TikTokLive {
    constructor(uniqueId: string, options: WebcastPushConnectionOptions = {}) {
        // Map signApiKey to apiKey for seamless TTLC migration
        const opts: TikTokLiveOptions = {
            ...options,
            apiKey: options.apiKey || options.signApiKey,
        };
        super(uniqueId, opts);
    }

    /**
     * Get current connection state - TTLC-compatible shape.
     *
     * Returns the same structure as TikTok-Live-Connector's `getState()`.
     */
    override getState() {
        return {
            isConnected: this._connected,
            upgradedToWebsocket: this._connected,
            roomId: this._roomId,
            roomInfo: this._roomInfo,
            availableGifts: [],
            uniqueId: this.uniqueId,
        };
    }

    /**
     * Get available gifts - TTLC-compatible.
     * Note: Gift info is included in event payloads automatically.
     */
    getAvailableGifts(): any[] {
        return [];
    }
}
