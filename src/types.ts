export interface TikTokUser {
    id: string;
    nickname: string;
    uniqueId: string;
    profilePicture?: string;
    badges?: string[];
}

export interface BaseEvent {
    type: string;
    timestamp: number;
    msgId: string;
}

export interface ChatEvent extends BaseEvent {
    type: 'chat';
    user: TikTokUser;
    comment: string;
}

export interface MemberEvent extends BaseEvent {
    type: 'member';
    user: TikTokUser;
    action: number;
}

export interface LikeEvent extends BaseEvent {
    type: 'like';
    user: TikTokUser;
    likeCount: number;
    totalLikes: number;
}

export interface GiftEvent extends BaseEvent {
    type: 'gift';
    user: TikTokUser;
    giftId: number;
    giftName: string;
    diamondCount: number;
    repeatCount: number;
    repeatEnd: boolean;
    combo: boolean;
}

export interface SocialEvent extends BaseEvent {
    type: 'social';
    user: TikTokUser;
    action: 'follow' | 'share' | string;
}

export interface RoomUserSeqEvent extends BaseEvent {
    type: 'roomUserSeq';
    viewerCount: number;
    totalViewers: number;
}

export interface BattleEvent extends BaseEvent {
    type: 'battle';
    status: number;
}

export interface BattleArmiesEvent extends BaseEvent {
    type: 'battleArmies';
}

export interface SubscribeEvent extends BaseEvent {
    type: 'subscribe';
    user: TikTokUser;
    subMonth: number;
}

export interface EmoteChatEvent extends BaseEvent {
    type: 'emoteChat';
    user: TikTokUser;
    emoteId: string;
}

export interface EnvelopeEvent extends BaseEvent {
    type: 'envelope';
    diamondCount: number;
}

export interface QuestionEvent extends BaseEvent {
    type: 'question';
    user: TikTokUser;
    questionText: string;
}

export interface ControlEvent extends BaseEvent {
    type: 'control';
    action: number;
}

export interface RoomEvent extends BaseEvent {
    type: 'room';
    status: string;
}

export interface LiveIntroEvent extends BaseEvent {
    type: 'liveIntro';
    title: string;
}

export interface RankUpdateEvent extends BaseEvent {
    type: 'rankUpdate';
    rankType: string;
}

export interface LinkMicEvent extends BaseEvent {
    type: 'linkMic';
    action: number;
}

export interface UnknownEvent extends BaseEvent {
    type: 'unknown';
    method: string;
}

export type LiveEvent =
    | ChatEvent
    | MemberEvent
    | LikeEvent
    | GiftEvent
    | SocialEvent
    | RoomUserSeqEvent
    | BattleEvent
    | BattleArmiesEvent
    | SubscribeEvent
    | EmoteChatEvent
    | EnvelopeEvent
    | QuestionEvent
    | ControlEvent
    | RoomEvent
    | LiveIntroEvent
    | RankUpdateEvent
    | LinkMicEvent
    | UnknownEvent;

export interface TikTokLiveEvents {
    connected: () => void;
    disconnected: (code: number, reason: string) => void;
    roomInfo: (info: RoomInfo) => void;
    error: (error: Error) => void;
    chat: (event: ChatEvent) => void;
    member: (event: MemberEvent) => void;
    like: (event: LikeEvent) => void;
    gift: (event: GiftEvent) => void;
    social: (event: SocialEvent) => void;
    roomUserSeq: (event: RoomUserSeqEvent) => void;
    battle: (event: BattleEvent) => void;
    battleArmies: (event: BattleArmiesEvent) => void;
    subscribe: (event: SubscribeEvent) => void;
    emoteChat: (event: EmoteChatEvent) => void;
    envelope: (event: EnvelopeEvent) => void;
    question: (event: QuestionEvent) => void;
    control: (event: ControlEvent) => void;
    room: (event: RoomEvent) => void;
    liveIntro: (event: LiveIntroEvent) => void;
    rankUpdate: (event: RankUpdateEvent) => void;
    linkMic: (event: LinkMicEvent) => void;
    unknown: (event: UnknownEvent) => void;
    event: (event: LiveEvent) => void;
}

export interface RoomInfo {
    roomId: string;
    wsHost: string;
    clusterRegion: string;
    connectedAt: string;
}

export interface TikTokLiveOptions {
    uniqueId: string;
    signServerUrl?: string;
    apiKey?: string;
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    debug?: boolean;
}
