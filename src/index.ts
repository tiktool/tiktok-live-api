/**
 * tiktok-live-api — TikTok LIVE stream data client for Node.js & TypeScript.
 *
 * Connect to any TikTok LIVE stream and receive real-time events:
 * chat messages, gifts, likes, follows, viewer counts, battles, and more.
 * Also includes AI-powered live captions (speech-to-text) with real-time translation.
 *
 * @example
 * ```typescript
 * import { TikTokLive } from 'tiktok-live-api';
 *
 * const client = new TikTokLive('username', { apiKey: 'YOUR_KEY' });
 *
 * client.on('chat', (event) => {
 *   console.log(`${event.user.uniqueId}: ${event.comment}`);
 * });
 *
 * client.connect();
 * ```
 *
 * @see {@link https://tik.tools/docs | Full API Documentation}
 * @see {@link https://tik.tools | Get a free API key}
 *
 * @packageDocumentation
 */

export { TikTokLive } from './client';
export type { TikTokLiveOptions } from './client';
export { TikTokCaptions } from './captions';
export type { TikTokCaptionsOptions } from './captions';
export type {
  TikTokUser,
  ChatEvent,
  GiftEvent,
  LikeEvent,
  MemberEvent,
  SocialEvent,
  RoomUserSeqEvent,
  BattleEvent,
  CaptionEvent,
  TranslationEvent,
  CreditsEvent,
  ConnectedEvent,
  DisconnectedEvent,
  ErrorEvent,
  TikTokLiveEventMap,
  TikTokCaptionsEventMap,
} from './types';
