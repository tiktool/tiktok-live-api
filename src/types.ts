export interface TikTokUser {
    id: string;
    nickname: string;
    uniqueId: string;
    profilePicture?: string;
    profilePictureUrl?: string;
    badges?: string[];
    /** User's gifter/spender level (1-50). Higher = more coins spent platform-wide. */
    payGrade?: number;
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
    giftType: number;
    groupId: string;
    giftPictureUrl?: string;
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

export interface BattleTeamUser {
    user: TikTokUser;
    score: number;
}

export interface BattleTeam {
    hostUserId: string;
    score: number;
    users: BattleTeamUser[];
    hostUser?: TikTokUser;
}

export interface BattleEvent extends BaseEvent {
    type: 'battle';
    battleId: string;
    status: number;
    battleDuration: number;
    teams: BattleTeam[];
    battleSettings?: {
        startTimeMs?: number;
        duration?: number;
        endTimeMs?: number;
    };
}

export interface BattleArmiesEvent extends BaseEvent {
    type: 'battleArmies';
    battleId: string;
    status: number;
    teams: BattleTeam[];
    battleSettings?: {
        startTimeMs?: number;
        duration?: number;
        endTimeMs?: number;
    };
    scoreUpdateTime?: number;
    giftSentTime?: number;
}

export interface BattleTaskEvent extends BaseEvent {
    type: 'battleTask';
    taskAction: number;
    battleRefId: string;
    missionType: string;
    multiplier: number;
    missionDuration: number;
    missionTarget: number;
    remainingSeconds: number;
    endTimestampS: number;
    timerType: number;
}

export interface BarrageEvent extends BaseEvent {
    type: 'barrage';
    msgType: number;
    subType: number;
    displayType: number;
    duration: number;
    defaultPattern: string;
    content: string;
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
    emoteUrl: string;
    emoteName?: string;
}

export interface EnvelopeEvent extends BaseEvent {
    type: 'envelope';
    envelopeId: string;
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
    status: number;
}

export interface LiveIntroEvent extends BaseEvent {
    type: 'liveIntro';
    roomId: string;
    title: string;
}

export interface RankUpdateEvent extends BaseEvent {
    type: 'rankUpdate';
    rankType: string;
    rankList: Array<{ user: TikTokUser; rank: number; score: number }>;
}

export interface LinkMicEvent extends BaseEvent {
    type: 'linkMic';
    action: string;
    users: TikTokUser[];
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
    | BattleTaskEvent
    | BarrageEvent
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
    battleTask: (event: BattleTaskEvent) => void;
    barrage: (event: BarrageEvent) => void;
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
    ownerUserId?: string;
}

export interface TikTokLiveOptions {
    uniqueId: string;
    signServerUrl?: string;
    apiKey: string;
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    debug?: boolean;
    webSocketImpl?: any;
    /**
     * TikTok browser session ID cookie for authenticated connections.
     * Enables ranklist API access and authenticated WebSocket features.
     * Obtain from the user's tiktok.com browser cookies.
     */
    sessionId?: string;
    /**
     * TikTok target IDC region (e.g. 'useast5').
     * Required when sessionId is provided — must match the account's region.
     */
    ttTargetIdc?: string;
    /**
     * HTTP agent for routing connections through a proxy.
     * Pass an HttpsProxyAgent (or any http.Agent) to route both the
     * initial HTTP request and WebSocket connection through a proxy.
     *
     * Example:
     *   import { HttpsProxyAgent } from 'https-proxy-agent';
     *   agent: new HttpsProxyAgent('http://user:pass@host:port')
     */
    agent?: import('http').Agent;

    /**
     * If you already know the room ID (e.g. from a leaderboard API),
     * pass it here to skip the HTML page scrape entirely.
     * This avoids geo-restriction issues and speeds up connection.
     */
    roomId?: string;

    /**
     * Pre-fetched ttwid cookie. When provided along with roomId,
     * the library skips the HTTP fetch to tiktok.com entirely.
     * Fetch once and share across multiple TikTokLive instances.
     */
    ttwid?: string;
}

// ── Ranklist Types ────────────────────────────────────────────

export interface RanklistUser {
    /** TikTok user ID */
    id_str: string;
    /** Display name */
    nickname: string;
    /** Username (@handle) */
    display_id?: string;
    unique_id?: string;
    /** Avatar thumbnail URLs */
    avatar_thumb?: { url_list: string[] };
    /** Full avatar URLs */
    avatar_medium?: { url_list: string[] };
    /** Follower info */
    follow_info?: {
        follow_status: number;
        follower_count: number;
        following_count: number;
    };
}

/**
 * Entry from online_audience endpoint (in-room top gifters).
 * Has explicit `rank` (1-based) and `score` fields.
 */
export interface OnlineAudienceEntry {
    rank: number;
    score: number;
    user: RanklistUser;
}

/**
 * Entry from anchor/rank_list endpoint (leaderboard/gifter rankings).
 * Position is the array index. Uses `value` (not `score`).
 */
export interface AnchorRankListEntry {
    /** Gift value (diamonds/coins) */
    value: number;
    /** Rank category type (e.g. 3 = gifter) */
    rank_type: number;
    /** Time period type (e.g. 1 = hourly) */
    rank_time_type: number;
    /** Auto-thanks message configured by anchor */
    auto_thanks_message?: string;
    /** Schema URL for navigation */
    schema_url?: string;
    /** Highlight DM share status */
    highlight_dm_share_status?: number;
    /** Ranked user data */
    user: RanklistUser;
}

export interface RanklistSelfInfo {
    rank: number;
    score: number;
    gap_description?: string;
}

/** Response from "online_audience" sub-endpoint — in-room top gifters */
export interface OnlineAudienceResponse {
    status_code: number;
    data: {
        ranks: OnlineAudienceEntry[];
        self_info?: RanklistSelfInfo;
        currency?: string;
        total?: number;
    };
}

/** Response from "anchor_rank_list" sub-endpoint — gifter leaderboard */
export interface AnchorRankListResponse {
    status_code: number;
    data: {
        rank_list: AnchorRankListEntry[];
        /** Room where ranks were accumulated */
        latest_room_id_str?: string;
        /** Rank period start (unix timestamp) */
        rank_time_begin?: number;
        /** Rank period end (unix timestamp) */
        rank_time_end?: number;
        /** Whether to show rank summary */
        show_rank_summary?: boolean;
        /** Default rank type for this anchor */
        default_rank_type?: number;
    };
}

/** Entrance tab info from "entrance" sub-endpoint */
export interface EntranceTab {
    title: string;
    rank_type: number;
    list_lynx_type?: number;
}

/** Entrance config for a single rank_type */
export interface EntranceInfo {
    rank_type: number;
    /** Whether the anchor appears in this ranking */
    owner_on_rank: boolean;
    /** Anchor's position in this ranking (0-based) */
    owner_rank_idx?: number;
    /** Current score in this ranking */
    current_score?: number;
    /** Countdown in seconds until ranking resets */
    countdown?: number;
    /** Window size in seconds (86400 = daily) */
    window_size?: number;
    /** Unix timestamp when ranking resets */
    reset_time?: number;
    /** Related tab to show when clicking this entrance */
    related_tab_rank_type?: number;
    /** Gap description with points needed to reach a rank */
    affiliated_content?: {
        gap_desc?: {
            default_pattern: string;
            pieces?: Array<{ string_value: string; type: number }>;
        };
    };
    /** Class/League info */
    class_info?: {
        class_type: number;
        star_count: number;
    };
}

export interface EntranceResponse {
    status_code: number;
    data: Array<{
        group_type?: number;
        Priority?: number;
        data?: {
            tabs?: EntranceTab[];
            entrances?: EntranceInfo[];
        };
    }>;
}

export type RanklistResponse = OnlineAudienceResponse | AnchorRankListResponse | EntranceResponse;

// ── CAPTCHA Solver Types ────────────────────────────────────────────

export interface PuzzleSolveResult {
    /** Proportion of slide position (0-1) */
    slide_x_proportion: number;
    /** Pixel X position to slide to */
    slide_x_px: number;
    /** Solver confidence (0-1) */
    confidence: number;
    /** Time taken to solve in milliseconds */
    solve_time_ms: number;
}

export interface RotateSolveResult {
    /** Rotation angle in degrees */
    angle: number;
    /** Solver confidence (0-1) */
    confidence: number;
    /** Time taken to solve in milliseconds */
    solve_time_ms: number;
}

export interface ShapesSolveResult {
    /** First matching shape coordinate */
    point1: { x: number; y: number };
    /** Second matching shape coordinate */
    point2: { x: number; y: number };
    /** Solver confidence (0-1) */
    confidence: number;
    /** Time taken to solve in milliseconds */
    solve_time_ms: number;
}
