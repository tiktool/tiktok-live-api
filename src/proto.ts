import type { LiveEvent, TikTokUser, BattleTeam, BattleTeamUser } from './types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// TikTok LIVE emote name → Unicode emoji mapping
// TikTok uses [emote_name] placeholders in chat text. These are resolved client-side.
const TIKTOK_EMOTE_MAP: Record<string, string> = {
    // Standard emojis
    'happy': '😊', 'angry': '😡', 'cry': '😢', 'embarrassed': '😳',
    'surprised': '😮', 'wronged': '😞', 'shout': '😤', 'flushed': '😳',
    'yummy': '😋', 'complacent': '😌', 'drool': '🤤', 'scream': '😱',
    'weep': '😭', 'speechless': '😶', 'funnyface': '🤪', 'laughwithtears': '😂',
    'wicked': '😈', 'facewithrollingeyes': '🙄', 'sulk': '😒', 'thinking': '🤔',
    'lovely': '🥰', 'greedy': '🤑', 'wow': '😯', 'joyful': '😃',
    'hehe': '😁', 'slap': '👋', 'tears': '😿', 'stun': '😵',
    'cute': '🥺', 'blink': '😉', 'disdain': '😏', 'astonish': '😲',
    'cool': '😎', 'excited': '🤩', 'proud': '😤', 'smileface': '😊',
    'evil': '👿', 'angel': '😇', 'laugh': '😆', 'pride': '🦁',
    'nap': '😴', 'loveface': '😍', 'awkward': '😬', 'shock': '😨',
    'funny': '😄', 'rage': '🤬',
    // Common aliases used in TikTok LIVE
    'laughcry': '😂', 'heart': '❤️', 'like': '👍', 'love': '💕',
    'shy': '🙈', 'smile': '😊',
};

/** Replace [emote_name] placeholders with Unicode emoji equivalents */
function replaceEmotes(text: string, imageMap?: Record<string, string>): string {
    return text.replace(/\[([a-zA-Z_]+)\]/g, (match, name) => {
        const lower = name.toLowerCase();
        const emoji = TIKTOK_EMOTE_MAP[lower];
        return emoji || match; // Keep original if unknown
    });
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) totalLength += arr.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function readInt32LE(buf: Uint8Array, offset: number): number {
    return buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        (buf[offset + 3] << 24);
}

function readBigInt64LE(buf: Uint8Array, offset: number): bigint {
    const lo = BigInt(buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        ((buf[offset + 3] << 24) >>> 0));
    const hi = BigInt(buf[offset + 4] |
        (buf[offset + 5] << 8) |
        (buf[offset + 6] << 16) |
        ((buf[offset + 7] << 24) >>> 0));
    return (hi << 32n) | (lo & 0xFFFFFFFFn);
}

export function decodeVarint(buf: Uint8Array, offset: number): { value: number; offset: number } {
    let result = 0, shift = 0;
    while (offset < buf.length) {
        const byte = buf[offset++];
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result >>> 0, offset };
}

export function decodeVarint64(buf: Uint8Array, offset: number): { value: bigint; offset: number } {
    let result = 0n, shift = 0n;
    while (offset < buf.length) {
        const byte = BigInt(buf[offset++]);
        result |= (byte & 0x7Fn) << shift;
        if ((byte & 0x80n) === 0n) break;
        shift += 7n;
    }
    return { value: result, offset };
}

export function encodeVarint(v: number | bigint): Uint8Array {
    const bytes: number[] = [];
    let n = typeof v === 'bigint' ? v : BigInt(v);
    do {
        let b = Number(n & 0x7Fn);
        n >>= 7n;
        if (n > 0n) b |= 0x80;
        bytes.push(b);
    } while (n > 0n);
    return new Uint8Array(bytes);
}

export interface ProtoField {
    fn: number;
    wt: number;
    value: Uint8Array | number | bigint;
}

export function encodeField(fn: number, wt: number, value: Uint8Array | bigint | number | string): Uint8Array {
    const tag = encodeVarint((fn << 3) | wt);
    if (wt === 0) {
        return concatBytes(tag, encodeVarint(typeof value === 'number' ? BigInt(value) : value as bigint));
    }
    const data = typeof value === 'string' ? encoder.encode(value) : value as Uint8Array;
    return concatBytes(tag, encodeVarint(data.length), data);
}

export function decodeProto(buf: Uint8Array): ProtoField[] {
    const fields: ProtoField[] = [];
    let offset = 0;
    while (offset < buf.length) {
        const tagResult = decodeVarint(buf, offset);
        offset = tagResult.offset;
        const fn = tagResult.value >> 3;
        const wt = tagResult.value & 7;
        if (wt === 0) {
            const r = decodeVarint64(buf, offset);
            offset = r.offset;
            fields.push({ fn, wt, value: r.value });
        } else if (wt === 2) {
            const lenR = decodeVarint(buf, offset);
            offset = lenR.offset;
            const data = buf.subarray(offset, offset + lenR.value);
            offset += lenR.value;
            fields.push({ fn, wt, value: data });
        } else if (wt === 1) {
            fields.push({ fn, wt, value: readBigInt64LE(buf, offset) });
            offset += 8;
        } else if (wt === 5) {
            fields.push({ fn, wt, value: BigInt(readInt32LE(buf, offset)) });
            offset += 4;
        } else {
            break;
        }
    }
    return fields;
}

export function getStr(fields: ProtoField[], fn: number): string {
    const f = fields.find(x => x.fn === fn && x.wt === 2);
    return f ? decoder.decode(f.value as Uint8Array) : '';
}

export function getBytes(fields: ProtoField[], fn: number): Uint8Array | null {
    const f = fields.find(x => x.fn === fn && x.wt === 2);
    return f ? f.value as Uint8Array : null;
}

export function getInt(fields: ProtoField[], fn: number): number {
    const f = fields.find(x => x.fn === fn && x.wt === 0);
    return f ? Number(f.value) : 0;
}

/** Get a varint field as a string without Number precision loss (safe for 64-bit IDs). */
export function getIntStr(fields: ProtoField[], fn: number): string {
    const f = fields.find(x => x.fn === fn && x.wt === 0);
    return f ? String(f.value) : '';
}

export function getAllBytes(fields: ProtoField[], fn: number): Uint8Array[] {
    return fields.filter(x => x.fn === fn && x.wt === 2).map(x => x.value as Uint8Array);
}

export function buildHeartbeat(roomId: string): Uint8Array {
    const payload = encodeField(1, 0, BigInt(roomId));
    return concatBytes(
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'hb'),
        encodeField(8, 2, payload),
    );
}

export function buildImEnterRoom(roomId: string): Uint8Array {
    const inner = concatBytes(
        encodeField(1, 0, BigInt(roomId)),
        encodeField(4, 0, 12n),
        encodeField(5, 2, 'audience'),
        encodeField(6, 2, ''),
        encodeField(9, 2, ''),
        encodeField(10, 2, ''),
    );
    return concatBytes(
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'im_enter_room'),
        encodeField(8, 2, inner),
    );
}

export function buildAck(id: bigint): Uint8Array {
    return concatBytes(
        encodeField(2, 0, id),
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'ack'),
    );
}

// NOTE: Army users in WebcastLinkMicArmies use a DIFFERENT layout where
//       field 38 contains avatar/image data, NOT uniqueId.
//       We detect this by checking if the string looks like a username (short, no URLs).
function looksLikeUsername(s: string): boolean {
    return s.length > 0 && s.length <= 50 && !s.includes('://') && !s.includes('\x00');
}

function parseUser(data: Uint8Array): TikTokUser {
    const f = decodeProto(data);
    const id = getIntStr(f, 1) || getStr(f, 1);
    const nickname = getStr(f, 3) || getStr(f, 2);

    // uniqueId: Try field 4 (LinkUser format) first, then field 38 (User format)
    // Validate that the result looks like a username, not binary/URL data
    let uniqueId = '';
    const uid4 = getStr(f, 4);
    const uid38 = getStr(f, 38);
    if (uid4 && looksLikeUsername(uid4)) {
        uniqueId = uid4;
    } else if (uid38 && looksLikeUsername(uid38)) {
        uniqueId = uid38;
    } else {
        const uid2 = getStr(f, 2);
        if (uid2 && looksLikeUsername(uid2)) uniqueId = uid2;
    }

    // profilePicture: Try field 9 (User format), field 4 (army users — avatar at field 4), field 3 (LinkUser format)
    // Can't use OR chain because field 3 = nickname bytes in User format (truthy but wrong)
    // Must try each and pick the first that yields a valid URL
    let profilePicture: string | undefined;
    for (const fieldNum of [9, 4, 3]) {
        if (profilePicture) break;
        const avatarBuf = getBytes(f, fieldNum);
        if (!avatarBuf) continue;
        try {
            const avatarFields = decodeProto(avatarBuf);
            const urlBufs = getAllBytes(avatarFields, 1);
            for (const urlBuf of urlBufs) {
                const url = decoder.decode(urlBuf);
                if (url.includes('://')) {
                    profilePicture = url;
                    break;
                }
            }
        } catch { }
    }

    const badges: string[] = [];
    let payGrade: number | undefined;

    // field_64 is repeated — iterate ALL occurrences
    const badgeBufs = getAllBytes(f, 64);
    for (const badgeBuf of badgeBufs) {
        try {
            const badgeFields = decodeProto(badgeBuf);
            const badgeCategory = getInt(badgeFields, 2);  // 20 = user level, 30 = fan level, 10 = moderator
            const badgeSubCat = getInt(badgeFields, 3);     // 8 = grade/level

            // Extract user level (pay grade) from the user-level badge
            // Badge with category=20, subCategory=8 is the "user level" (gifter grade) badge
            if (badgeCategory === 20 && badgeSubCat === 8 && !payGrade) {
                const privBuf = getBytes(badgeFields, 12);
                if (privBuf) {
                    const privFields = decodeProto(privBuf);
                    const levelStr = getStr(privFields, 5);
                    if (levelStr) {
                        const level = parseInt(levelStr, 10);
                        if (level > 0) payGrade = level;
                    }
                }
            }

            // Also extract badge names from field_21 (existing behavior)
            const badgeItems = getAllBytes(badgeFields, 21);
            for (const bi of badgeItems) {
                const bf = decodeProto(bi);
                const name = getStr(bf, 3) || getStr(bf, 2);
                if (name) badges.push(name);
            }
        } catch { }
    }

    return {
        id,
        nickname,
        uniqueId: uniqueId || nickname || id,
        profilePictureUrl: profilePicture,
        badges: badges.length > 0 ? badges : undefined,
        payGrade,
    };
}

function parseBattleTeamFromArmies(itemBuf: Uint8Array): BattleTeam {
    const f = decodeProto(itemBuf);
    const hostUserId = getIntStr(f, 1) || '0';
    let teamScore = 0;
    const users: BattleTeamUser[] = [];
    let hostUser: TikTokUser | undefined;

    // Field 2: Groups of gifter users (repeated)
    const groups = getAllBytes(f, 2);
    for (const gb of groups) {
        try {
            const gf = decodeProto(gb);
            const points = getInt(gf, 2);
            teamScore += points;

            const userBufs = getAllBytes(gf, 1);
            for (const ub of userBufs) {
                try {
                    // TikTok's LinkMicArmies user entry is a flat proto:
                    //   f1(varint) = userId
                    //   f2(varint) = individual score (diamonds gifted by this user)
                    //   f3(bytes)  = nickname
                    //   f4(bytes)  = avatar/profile data
                    //   f6(bytes)  = badge data
                    // The individual score is f2 varint — same buffer, no wrapper.
                    const userFields = decodeProto(ub);
                    const individualScore = getInt(userFields, 2);
                    const user = parseUser(ub);
                    users.push({ user, score: individualScore });
                } catch { }
            }
        } catch { }
    }

    // Try to extract the HOST USER from other fields (3-8)
    // NOTE: Currently armies protobuf only has fields [1, 2], but kept
    // as a silent fallback in case TikTok adds host user data later.
    for (const fieldNum of [3, 4, 5, 6, 7, 8]) {
        if (hostUser) break;
        const buf = getBytes(f, fieldNum);
        if (!buf) continue;
        try {
            const parsed = parseUser(buf);
            if (parsed && (parsed.nickname || parsed.uniqueId) &&
                parsed.uniqueId !== parsed.id &&
                looksLikeUsername(parsed.uniqueId || '')) {
                hostUser = parsed;
            }
        } catch { }
    }

    return { hostUserId, score: teamScore, users, hostUser };
}

export function parseWebcastMessage(method: string, payload: Uint8Array): LiveEvent {
    const f = decodeProto(payload);
    const base = { timestamp: Date.now(), msgId: '' };

    const typeBuf = getBytes(f, 1);
    if (typeBuf) {
        try {
            const tf = decodeProto(typeBuf);
            const ts = getInt(tf, 4);
            if (ts) base.timestamp = ts;
        } catch { }
    }

    switch (method) {
        case 'WebcastChatMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            const rawComment = getStr(f, 3);

            // Parse emote images from field 22 (emotes_with_index) if present
            const emoteImages: Record<string, string> = {};
            for (const field of f) {
                if (field.fn === 22 && field.wt === 2) {
                    try {
                        const ewi = decodeProto(field.value as Uint8Array);
                        const emoteKey = getStr(ewi, 1);
                        const imgBuf = getBytes(ewi, 2);
                        if (imgBuf && emoteKey) {
                            const imgFields = decodeProto(imgBuf);
                            const url = getStr(imgFields, 1);
                            if (url) emoteImages[emoteKey] = url;
                        }
                    } catch { }
                }
            }

            // Replace [emote_name] placeholders with Unicode equivalents
            const comment = replaceEmotes(rawComment, emoteImages);

            return { ...base, type: 'chat' as const, user, comment };
        }

        case 'WebcastMemberMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            let action = 1;
            const eventBuf = getBytes(f, 1);
            if (eventBuf) {
                const ef = decodeProto(eventBuf);
                const detailBuf = getBytes(ef, 8);
                if (detailBuf) {
                    const df = decodeProto(detailBuf);
                    const label = getStr(df, 2);
                    if (label.includes('followed')) action = 2;
                    else if (label.includes('share')) action = 3;
                }
            }
            return { ...base, type: 'member' as const, user, action };
        }

        case 'WebcastLikeMessage': {
            const userBuf = getBytes(f, 5);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return {
                ...base, type: 'like' as const, user,
                likeCount: getInt(f, 2),
                totalLikes: getInt(f, 3),
            };
        }

        case 'WebcastGiftMessage': {
            const userBuf = getBytes(f, 7);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            const giftId = getInt(f, 2);
            const repeatCount = getInt(f, 5);
            const repeatEnd = getInt(f, 9) === 1;

            let giftName = '', diamondCount = 0, giftType = 0;
            let giftImageUrl = '';
            const detailsBuf = getBytes(f, 15);
            if (detailsBuf) {
                const df = decodeProto(detailsBuf);
                giftName = getStr(df, 16) || getStr(df, 2);
                diamondCount = getInt(df, 12);
                giftType = getInt(df, 11);

                const imgBuf = getBytes(df, 1);
                if (imgBuf) {
                    const imgf = decodeProto(imgBuf);
                    giftImageUrl = getStr(imgf, 1);
                }
            }

            let toUserId = '';
            const extraBuf = getBytes(f, 23);
            if (extraBuf) {
                const ef = decodeProto(extraBuf);
                toUserId = getIntStr(ef, 8) || '';
            }

            const groupId = toUserId || getStr(f, 11);

            return {
                ...base, type: 'gift' as const, user, giftId, giftName, diamondCount,
                repeatCount, repeatEnd, combo: repeatCount > 1 && !repeatEnd,
                giftType, groupId, giftPictureUrl: giftImageUrl,
            };
        }

        case 'WebcastSocialMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            let action = 'follow';
            const eventBuf = getBytes(f, 1);
            if (eventBuf) {
                const ef = decodeProto(eventBuf);
                const detailBuf = getBytes(ef, 8);
                if (detailBuf) {
                    const df = decodeProto(detailBuf);
                    const label = getStr(df, 2);
                    if (label.includes('share')) action = 'share';
                    else if (label.includes('follow')) action = 'follow';
                    const displayType = getStr(df, 1);
                    if (displayType === 'pm_mt_msg_viewer_share') action = 'share';
                }
            }
            return { ...base, type: 'social' as const, user, action };
        }

        case 'WebcastRoomUserSeqMessage': {
            const viewerCount = getInt(f, 3) || getInt(f, 2);
            const totalViewers = getInt(f, 1) || viewerCount;
            return { ...base, type: 'roomUserSeq' as const, totalViewers, viewerCount };
        }

        case 'WebcastLinkMicBattle': {
            // Proto field mapping for WebcastLinkMicBattle:
            //   field_1 = header sub-message (method name, msgId, roomId, timestamp)
            //   field_2 = battleId (varint — the main battle identifier)
            //   field_3 = battle settings sub-message containing timer data:
            //     field_3.field_1 = battleId (duplicate)
            //     field_3.field_2 = startTimeMs (millisecond timestamp)
            //     field_3.field_3 = duration (seconds, e.g. 301)
            //     field_3.field_5 = phase/status (1=active, 3=ended)
            //     field_3.field_10 = lastUpdateTimeMs
            //   field_4 = overall status (e.g. 5 = ended)
            //   field_5 = team user list (repeated)
            //   field_9 = detailed user data with avatars (repeated)
            //   field_10 = battle user bufs (repeated — used for team parsing)
            const battleId = getIntStr(f, 2) || getIntStr(f, 1) || '';
            const overallStatus = getInt(f, 4);
            const teams: BattleTeam[] = [];

            // Parse battle settings from field_3 sub-message
            let battleDuration = 0;
            let battleSettings: { startTimeMs?: number; duration?: number; endTimeMs?: number } | undefined;
            const settingsBuf = getBytes(f, 3);
            if (settingsBuf) {
                try {
                    const sf = decodeProto(settingsBuf);
                    const startTimeMs = getInt(sf, 2);
                    const duration = getInt(sf, 3);
                    const phase = getInt(sf, 5);
                    const endTimeMs = getInt(sf, 10);
                    battleDuration = duration;
                    battleSettings = {
                        startTimeMs: startTimeMs || undefined,
                        duration: duration || undefined,
                        endTimeMs: endTimeMs || undefined,
                    };
                } catch { }
            }

            // Determine status: use phase from settings, fall back to overall status
            // field_4 sometimes returns a large TikTok ID instead of a status code.
            // Valid battle status codes are small (1=active, 3=ended, 5=finalizing).
            // Only use overallStatus if it looks like a real status code (1-10).
            const settingsPhase = settingsBuf ? (() => {
                try { return getInt(decodeProto(settingsBuf), 5); } catch { return 0; }
            })() : 0;
            const status = settingsPhase || (overallStatus > 0 && overallStatus <= 10 ? overallStatus : 0) || 1;

            const battleUserBufs = getAllBytes(f, 10);
            for (const bub of battleUserBufs) {
                try {
                    const bf = decodeProto(bub);
                    const groupBuf = getBytes(bf, 2);
                    if (groupBuf) {
                        const gf = decodeProto(groupBuf);
                        const linkUserBuf = getBytes(gf, 1);
                        if (linkUserBuf) {
                            const user = parseUser(linkUserBuf);
                            teams.push({
                                hostUserId: user.id,
                                score: 0,
                                users: [{ user, score: 0 }],
                            });
                        }
                    }
                } catch { }
            }

            // Also try field_5 for team users (new proto format)
            if (teams.length === 0) {
                const teamBufs5 = getAllBytes(f, 5);
                for (const tb of teamBufs5) {
                    try {
                        const tf = decodeProto(tb);
                        const userId = getIntStr(tf, 1);
                        if (userId && userId !== '0') {
                            teams.push({
                                hostUserId: userId,
                                score: 0,
                                users: [],
                            });
                        }
                    } catch { }
                }
            }

            if (teams.length === 0) {
                const teamBufs7 = getAllBytes(f, 7);
                for (const tb of teamBufs7) {
                    try {
                        teams.push(parseBattleTeamFromArmies(tb));
                    } catch { }
                }
            }

            return { ...base, type: 'battle' as const, battleId, status, battleDuration, teams, battleSettings };
        }

        case 'WebcastLinkMicArmies': {
            const battleId = getIntStr(f, 2) || getIntStr(f, 1) || '';
            const battleStatus = getInt(f, 7);
            const teams: BattleTeam[] = [];

            // Parse battle settings from field_18 sub-message
            // Same structure as WebcastLinkMicBattle field_3:
            //   field_1 = battleId, field_2 = startTimeMs, field_3 = duration,
            //   field_5 = status, field_10 = endTimeMs
            let battleSettings: { startTimeMs?: number; duration?: number; endTimeMs?: number } | undefined;
            const settingsBuf18 = getBytes(f, 18);
            if (settingsBuf18) {
                try {
                    const sf = decodeProto(settingsBuf18);
                    const startTimeMs = getInt(sf, 2);
                    const duration = getInt(sf, 3);
                    const endTimeMs = getInt(sf, 10);
                    battleSettings = {
                        startTimeMs: startTimeMs || undefined,
                        duration: duration || undefined,
                        endTimeMs: endTimeMs || undefined,
                    };
                } catch { }
            }

            // Parse live server timestamps (update on every score tick)
            const scoreUpdateTime = getInt(f, 5);
            const giftSentTime = getInt(f, 6);

            const itemBufs = getAllBytes(f, 3);
            for (const ib of itemBufs) {
                try {
                    teams.push(parseBattleTeamFromArmies(ib));
                } catch { }
            }

            return {
                ...base, type: 'battleArmies' as const, battleId, teams,
                status: battleStatus, battleSettings, scoreUpdateTime, giftSentTime,
            };
        }

        case 'WebcastSubNotifyMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'subscribe' as const, user, subMonth: getInt(f, 3) };
        }

        case 'WebcastEmoteChatMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            let emoteId = '', emoteUrl = '';
            const emoteBuf = getBytes(f, 3);
            if (emoteBuf) {
                const ef = decodeProto(emoteBuf);
                emoteId = getStr(ef, 1);
                const imageBuf = getBytes(ef, 2);
                if (imageBuf) {
                    const imgFields = decodeProto(imageBuf);
                    emoteUrl = getStr(imgFields, 1);
                }
            }
            return { ...base, type: 'emoteChat' as const, user, emoteId, emoteUrl };
        }

        case 'WebcastEnvelopeMessage': {
            const envelopeId = String(getInt(f, 1) || getStr(f, 1));
            return { ...base, type: 'envelope' as const, envelopeId, diamondCount: getInt(f, 3) };
        }

        case 'WebcastQuestionNewMessage': {
            let questionText = '', user: TikTokUser = { id: '0', nickname: '', uniqueId: '' };
            const detailBuf = getBytes(f, 2);
            if (detailBuf) {
                const df = decodeProto(detailBuf);
                questionText = getStr(df, 2);
                const userBuf = getBytes(df, 5);
                if (userBuf) user = parseUser(userBuf);
            }
            return { ...base, type: 'question' as const, user, questionText };
        }

        case 'WebcastRankUpdateMessage':
        case 'WebcastHourlyRankMessage': {
            const rankType = getStr(f, 1) || `rank_${getInt(f, 1)}`;
            const rankList: Array<{ user: TikTokUser; rank: number; score: number }> = [];
            const listBufs = getAllBytes(f, 2);
            for (const lb of listBufs) {
                try {
                    const rf = decodeProto(lb);
                    const userBuf = getBytes(rf, 1);
                    const rank = getInt(rf, 2);
                    const score = getInt(rf, 3);
                    const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
                    rankList.push({ user, rank, score });
                } catch { }
            }
            return { ...base, type: 'rankUpdate' as const, rankType, rankList };
        }

        case 'WebcastControlMessage':
            return { ...base, type: 'control' as const, action: getInt(f, 2) || getInt(f, 1) };

        case 'WebcastRoomMessage':
        case 'RoomMessage':
            return { ...base, type: 'room' as const, status: getInt(f, 2) };

        case 'WebcastLiveIntroMessage': {
            const roomId = String(getInt(f, 2));
            const title = getStr(f, 4) || getStr(f, 2);
            return { ...base, type: 'liveIntro' as const, roomId, title };
        }

        case 'WebcastLinkMicMethod': {
            const action = getStr(f, 1) || `action_${getInt(f, 1)}`;
            const users: TikTokUser[] = [];
            const userBufs = getAllBytes(f, 2);
            for (const ub of userBufs) {
                try { users.push(parseUser(ub)); } catch { }
            }
            return { ...base, type: 'linkMic' as const, action, users };
        }

        case 'WebcastLinkmicBattleTaskMessage': {
            // Battle task/buff events (multipliers, bonus missions, timer updates)
            // Raw proto fields:
            //   field_2 = taskAction (1=start, 2=update, 3=mission complete)
            //   field_3 = bonus mission details sub-message:
            //     field_3.field_1.field_1 = target score
            //     field_3.field_1.field_2 = mission items with multiplier/duration
            //     field_3.field_1.field_3 = countdown (field_1=target, field_2=duration, field_3=endTimestamp)
            //     field_3.field_1.field_6 = mission start timestamp
            //   field_5 = timer sub-message:
            //     field_5.field_1 = timer type
            //     field_5.field_2 = remaining seconds
            //     field_5.field_3 = end timestamp (seconds)
            //   field_6 = mission description with multiplier info
            //   field_20 = battle reference ID
            const taskAction = getInt(f, 2);
            const battleRefId = getIntStr(f, 20) || '';

            // Extract timer info from field_5
            let timerType = 0;
            let remainingSeconds = 0;
            let endTimestampS = 0;
            const timerBuf = getBytes(f, 5);
            if (timerBuf) {
                try {
                    const tf = decodeProto(timerBuf);
                    timerType = getInt(tf, 1);
                    remainingSeconds = getInt(tf, 2);
                    endTimestampS = getInt(tf, 3);
                } catch { }
            }

            // Extract multiplier and mission details from field_3 or field_6
            let multiplier = 0;
            let missionDuration = 0;
            let missionTarget = 0;
            let missionType = '';

            // Try field_3.field_1 (bonus mission)
            const bonusBuf = getBytes(f, 3);
            if (bonusBuf) {
                try {
                    const bf = decodeProto(bonusBuf);
                    const missionBuf = getBytes(bf, 1);
                    if (missionBuf) {
                        const mf = decodeProto(missionBuf);
                        missionTarget = getInt(mf, 1);
                        // Check mission items (field_2, repeated) for multiplier
                        const items = getAllBytes(mf, 2);
                        for (const item of items) {
                            try {
                                const itemFields = decodeProto(item);
                                const descBuf = getBytes(itemFields, 2);
                                if (descBuf) {
                                    const descFields = decodeProto(descBuf);
                                    // Look for "multi" key in param pairs
                                    const paramBufs = getAllBytes(descFields, 2);
                                    for (const pb of paramBufs) {
                                        try {
                                            const pf = decodeProto(pb);
                                            const key = getStr(pf, 1);
                                            const val = getStr(pf, 2);
                                            if (key === 'multi' && val) multiplier = parseInt(val) || 0;
                                            if (key === 'dur' && val) missionDuration = parseInt(val) || 0;
                                            if (key === 'sum' && val) missionTarget = parseInt(val) || missionTarget;
                                        } catch { }
                                    }
                                    // Get mission type from field_1
                                    const typeStr = getStr(descFields, 1);
                                    if (typeStr) missionType = typeStr;
                                }
                            } catch { }
                        }
                        // Check countdown sub-message (field_3 of mission)
                        const countdownBuf = getBytes(mf, 3);
                        if (countdownBuf) {
                            try {
                                const cf = decodeProto(countdownBuf);
                                if (!missionDuration) missionDuration = getInt(cf, 2);
                            } catch { }
                        }
                    }
                } catch { }
            }

            // Try field_6 for mission descriptions (e.g. mission complete with sum)
            if (!missionType) {
                const descBuf6 = getBytes(f, 6);
                if (descBuf6) {
                    try {
                        const d6 = decodeProto(descBuf6);
                        const innerBuf = getBytes(d6, 1);
                        if (innerBuf) {
                            const innerF = decodeProto(innerBuf);
                            const typeStr = getStr(innerF, 1);
                            if (typeStr) missionType = typeStr;
                            const paramBufs = getAllBytes(innerF, 2);
                            for (const pb of paramBufs) {
                                try {
                                    const pf = decodeProto(pb);
                                    const key = getStr(pf, 1);
                                    const val = getStr(pf, 2);
                                    if (key === 'multi' && val) multiplier = parseInt(val) || 0;
                                    if (key === 'sum' && val) missionTarget = parseInt(val) || missionTarget;
                                } catch { }
                            }
                        }
                    } catch { }
                }
            }

            return {
                ...base, type: 'battleTask' as const,
                taskAction, battleRefId, missionType, multiplier,
                missionDuration, missionTarget,
                remainingSeconds, endTimestampS, timerType,
            };
        }

        case 'WebcastBarrageMessage': {


            const msgType = getInt(f, 3);
            const duration = getInt(f, 4);
            const displayType = getInt(f, 5);
            const subType = getInt(f, 6);

            let defaultPattern = '';
            let content = '';
            const contentBuf = getBytes(f, 2);
            if (contentBuf) {
                try {
                    const cf = decodeProto(contentBuf);
                    // field_1 = default pattern text
                    defaultPattern = getStr(cf, 1) || '';
                    // field_2 = pattern params (may have key=value pairs)
                    const paramBufs = getAllBytes(cf, 2);
                    const params: string[] = [];
                    for (const pb of paramBufs) {
                        try {
                            const pf = decodeProto(pb);
                            const key = getStr(pf, 1);
                            const val = getStr(pf, 2);
                            if (key && val) params.push(`${key}=${val}`);
                        } catch { }
                    }
                    if (params.length > 0) content = params.join(', ');
                } catch { }
            }

            // Also try field_1 as a direct string (some types send the text directly)
            if (!defaultPattern) {
                defaultPattern = getStr(f, 1) || '';
            }



            return {
                ...base, type: 'barrage' as const,
                msgType, subType, displayType, duration,
                defaultPattern, content,
            };
        }

        default:
            return { ...base, type: 'unknown' as const, method };
    }
}

export function parseWebcastResponse(payload: Uint8Array): LiveEvent[] {
    const events: LiveEvent[] = [];
    const respFields = decodeProto(payload);

    for (const mf of respFields.filter(f => f.fn === 1 && f.wt === 2)) {
        const msgBuf = mf.value as Uint8Array;
        const msgFields = decodeProto(msgBuf);
        const method = getStr(msgFields, 1);
        const innerPayload = getBytes(msgFields, 2);
        if (!method || !innerPayload) continue;

        try {
            events.push(parseWebcastMessage(method, innerPayload));
        } catch { }
    }

    return events;
}
