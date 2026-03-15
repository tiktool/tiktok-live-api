/**
 * Type definitions for TikTok LIVE API events.
 *
 * These types provide IDE autocompletion and type safety
 * when handling events from {@link TikTokLive} and {@link TikTokCaptions}.
 *
 * @packageDocumentation
 */

/** User profile attached to most LIVE events. */
export interface TikTokUser {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  followRole: number;
  isSubscriber: boolean;
}

/** Payload for `chat` events. */
export interface ChatEvent {
  user: TikTokUser;
  comment: string;
  emotes: Array<{ emoteId: string; image: string }>;
  /** Present only for starred (paid highlighted) chat messages. */
  starred?: { claps: number; score: number };
}

/** Payload for `gift` events. */
export interface GiftEvent {
  user: TikTokUser;
  giftId: number;
  giftName: string;
  diamondCount: number;
  repeatCount: number;
  repeatEnd: boolean;
}

/** Payload for `like` events. */
export interface LikeEvent {
  user: TikTokUser;
  likeCount: number;
  totalLikes: number;
}

/** Payload for `member` (viewer join) events. */
export interface MemberEvent {
  user: TikTokUser;
  actionId: number;
}

/** Payload for `follow` and `share` events. */
export interface SocialEvent {
  user: TikTokUser;
  eventType: string;
}

/** Payload for `roomUserSeq` (viewer count) events. */
export interface RoomUserSeqEvent {
  viewerCount: number;
  topViewers: TikTokUser[];
}

/** Payload for `battle` events. */
export interface BattleEvent {
  type: string;
  teams: Array<Record<string, unknown>>;
  scores: number[];
}

/** Payload for `roomPin` (starred/pinned message) events. */
export interface RoomPinEvent {
  /** User who wrote the pinned message. */
  user: TikTokUser;
  /** The pinned comment text. */
  comment: string;
  /** Pin action: 1 = pin, 2 = unpin. */
  action: number;
  /** How long the message stays pinned (seconds). */
  durationSeconds: number;
  /** Timestamp when the message was pinned (ms). */
  pinnedAt: number;
  /** Original message type (e.g. "WebcastChatMessage"). */
  originalMsgType: string;
  /** Original message ID that was pinned. */
  originalMsgId: string;
  /** User ID of the operator who pinned the message. */
  operatorUserId: string;
}

/** Payload for `caption` events from {@link TikTokCaptions}. */
export interface CaptionEvent {
  text: string;
  speaker: string;
  isFinal: boolean;
  language: string;
}

/** Payload for `translation` events from {@link TikTokCaptions}. */
export interface TranslationEvent {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

/** Payload for `credits` events from {@link TikTokCaptions}. */
export interface CreditsEvent {
  total: number;
  used: number;
  remaining: number;
}

/** Connection event payload. */
export interface ConnectedEvent {
  uniqueId: string;
}

/** Disconnection event payload. */
export interface DisconnectedEvent {
  uniqueId: string;
}

/** Error event payload. */
export interface ErrorEvent {
  error: string;
}

/**
 * Map of event names to their payload types for {@link TikTokLive}.
 */
export interface TikTokLiveEventMap {
  chat: ChatEvent;
  gift: GiftEvent;
  like: LikeEvent;
  follow: SocialEvent;
  share: SocialEvent;
  member: MemberEvent;
  subscribe: SocialEvent;
  roomUserSeq: RoomUserSeqEvent;
  battle: BattleEvent;
  roomPin: RoomPinEvent;
  envelope: Record<string, unknown>;
  streamEnd: Record<string, unknown>;
  roomInfo: Record<string, unknown>;
  connected: ConnectedEvent;
  disconnected: DisconnectedEvent;
  error: ErrorEvent;
  event: Record<string, unknown>;
}

/**
 * Map of event names to their payload types for {@link TikTokCaptions}.
 */
export interface TikTokCaptionsEventMap {
  caption: CaptionEvent;
  translation: TranslationEvent;
  credits: CreditsEvent;
  credits_low: CreditsEvent;
  status: Record<string, unknown>;
  connected: ConnectedEvent;
  disconnected: DisconnectedEvent;
  error: ErrorEvent;
}
