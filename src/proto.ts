import type { LiveEvent, TikTokUser, BattleTeam, BattleTeamUser } from './types.js';

export function decodeVarint(buf: Buffer, offset: number): { value: number; offset: number } {
    let result = 0, shift = 0;
    while (offset < buf.length) {
        const byte = buf[offset++];
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result >>> 0, offset };
}

export function decodeVarint64(buf: Buffer, offset: number): { value: bigint; offset: number } {
    let result = 0n, shift = 0n;
    while (offset < buf.length) {
        const byte = BigInt(buf[offset++]);
        result |= (byte & 0x7Fn) << shift;
        if ((byte & 0x80n) === 0n) break;
        shift += 7n;
    }
    return { value: result, offset };
}

export function encodeVarint(v: number | bigint): Buffer {
    const bytes: number[] = [];
    let n = typeof v === 'bigint' ? v : BigInt(v);
    do {
        let b = Number(n & 0x7Fn);
        n >>= 7n;
        if (n > 0n) b |= 0x80;
        bytes.push(b);
    } while (n > 0n);
    return Buffer.from(bytes);
}

export interface ProtoField {
    fn: number;
    wt: number;
    value: Buffer | number | bigint;
}

export function encodeField(fn: number, wt: number, value: Buffer | bigint | number | string): Buffer {
    const tag = encodeVarint((fn << 3) | wt);
    if (wt === 0) {
        return Buffer.concat([tag, encodeVarint(typeof value === 'number' ? BigInt(value) : value as bigint)]);
    }
    const data = typeof value === 'string' ? Buffer.from(value) : value as Buffer;
    return Buffer.concat([tag, encodeVarint(data.length), data]);
}

export function decodeProto(buf: Buffer): ProtoField[] {
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
            fields.push({ fn, wt, value: buf.readBigInt64LE(offset) });
            offset += 8;
        } else if (wt === 5) {
            fields.push({ fn, wt, value: BigInt(buf.readInt32LE(offset)) });
            offset += 4;
        } else {
            break;
        }
    }
    return fields;
}

export function getStr(fields: ProtoField[], fn: number): string {
    const f = fields.find(x => x.fn === fn && x.wt === 2);
    return f ? (f.value as Buffer).toString('utf-8') : '';
}

export function getBytes(fields: ProtoField[], fn: number): Buffer | null {
    const f = fields.find(x => x.fn === fn && x.wt === 2);
    return f ? f.value as Buffer : null;
}

export function getInt(fields: ProtoField[], fn: number): number {
    const f = fields.find(x => x.fn === fn && x.wt === 0);
    return f ? Number(f.value) : 0;
}

export function getAllBytes(fields: ProtoField[], fn: number): Buffer[] {
    return fields.filter(x => x.fn === fn && x.wt === 2).map(x => x.value as Buffer);
}

export function buildHeartbeat(roomId: string): Buffer {
    const payload = encodeField(1, 0, BigInt(roomId));
    return Buffer.concat([
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'hb'),
        encodeField(8, 2, payload),
    ]);
}

export function buildImEnterRoom(roomId: string): Buffer {
    const inner = Buffer.concat([
        encodeField(1, 0, BigInt(roomId)),
        encodeField(4, 0, 12n),
        encodeField(5, 2, 'audience'),
        encodeField(6, 2, ''),
        encodeField(9, 2, ''),
        encodeField(10, 2, ''),
    ]);
    return Buffer.concat([
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'im_enter_room'),
        encodeField(8, 2, inner),
    ]);
}

export function buildAck(id: bigint): Buffer {
    return Buffer.concat([
        encodeField(2, 0, id),
        encodeField(6, 2, 'pb'),
        encodeField(7, 2, 'ack'),
    ]);
}

// ── User parsing ────────────────────────────────────────────────────
// Proto: User { userId=1, nickname=3, profilePicture=9, extraAttributes=22, badge=64, uniqueId=38 }
// Proto: LinkUser { userId=1, nickname=2, profilePicture=3, uniqueId=4 }
// Proto: ProfilePicture { repeated urls=1 }

function parseUser(data: Buffer): TikTokUser {
    const f = decodeProto(data);
    const id = String(getInt(f, 1) || getStr(f, 1));
    const nickname = getStr(f, 3) || getStr(f, 2);
    const uniqueId = getStr(f, 38) || getStr(f, 4) || getStr(f, 2) || '';

    let profilePicture: string | undefined;
    const avatarBuf = getBytes(f, 9) || getBytes(f, 3);
    if (avatarBuf) {
        try {
            const avatarFields = decodeProto(avatarBuf);
            // ProfilePicture.urls is repeated string at field 1
            const urlBufs = getAllBytes(avatarFields, 1);
            if (urlBufs.length > 0) profilePicture = urlBufs[0].toString('utf-8');
        } catch { }
    }

    // Badges from field 64 → field 21 (repeated UserBadge)
    const badges: string[] = [];
    const badgeBuf = getBytes(f, 64);
    if (badgeBuf) {
        try {
            const badgeFields = decodeProto(badgeBuf);
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
        profilePicture,
        badges: badges.length > 0 ? badges : undefined,
    };
}

// ── Battle parsing ──────────────────────────────────────────────────
// Proto: WebcastLinkMicBattle { repeated battleUsers=10 }
//   battleUsers → WebcastLinkMicBattleItems { battleGroup=2 }
//     battleGroup → WebcastLinkMicBattleGroup { LinkUser user=1 }
//
// Proto: WebcastLinkMicArmies { repeated battleItems=3, battleStatus=7 }
//   battleItems → WebcastLinkMicArmiesItems { hostUserId=1, repeated battleGroups=2 }
//     battleGroups → WebcastLinkMicArmiesGroup { repeated users=1, points=2 }

function parseBattleTeamFromArmies(itemBuf: Buffer): BattleTeam {
    const f = decodeProto(itemBuf);
    const hostUserId = String(getInt(f, 1));
    let teamScore = 0;
    const users: BattleTeamUser[] = [];

    // battleGroups at field 2
    const groups = getAllBytes(f, 2);
    for (const gb of groups) {
        try {
            const gf = decodeProto(gb);
            const points = getInt(gf, 2);
            teamScore += points;

            // users at field 1 (repeated)
            const userBufs = getAllBytes(gf, 1);
            for (const ub of userBufs) {
                try {
                    const user = parseUser(ub);
                    users.push({ user, score: points });
                } catch { }
            }
        } catch { }
    }

    return { hostUserId, score: teamScore, users };
}

// ── Message-specific parsers ────────────────────────────────────────

export function parseWebcastMessage(method: string, payload: Buffer): LiveEvent {
    const f = decodeProto(payload);
    const base = { timestamp: Date.now(), msgId: '' };

    // Try to extract msgId from MessageType (field 1 submessage, field 4 = timestamp)
    const typeBuf = getBytes(f, 1);
    if (typeBuf) {
        try {
            const tf = decodeProto(typeBuf);
            const ts = getInt(tf, 4);
            if (ts) base.timestamp = ts;
        } catch { }
    }

    switch (method) {
        // Proto: WebcastChatMessage { MessageType type=1, User user=2, string comment=3 }
        case 'WebcastChatMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'chat' as const, user, comment: getStr(f, 3) };
        }

        // Proto: WebcastMemberMessage { User user=2, WebcastMessageEvent event=1 }
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

        // Proto: WebcastLikeMessage { User user=5, WebcastMessageEvent event=1, int32 likeCount=2, int32 totalLikeCount=3 }
        case 'WebcastLikeMessage': {
            const userBuf = getBytes(f, 5);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return {
                ...base, type: 'like' as const, user,
                likeCount: getInt(f, 2),
                totalLikes: getInt(f, 3),
            };
        }

        // Proto: WebcastGiftMessage {
        //   User user=7, int32 giftId=2, int32 repeatCount=5, int32 repeatEnd=9,
        //   GiftDetails giftDetails=15, GiftExtra giftExtra=23
        // }
        // GiftDetails { GiftImage giftImage=1, string giftName=16, string describe=2,
        //               int32 giftType=11, int32 diamondCount=12 }
        // GiftExtra { uint64 timestamp=6, uint64 toUserId=8 }
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
                toUserId = String(getInt(ef, 8));
            }

            const groupId = toUserId || getStr(f, 11);

            return {
                ...base, type: 'gift' as const, user, giftId, giftName, diamondCount,
                repeatCount, repeatEnd, combo: repeatCount > 1 && !repeatEnd,
                giftType, groupId,
            };
        }

        // Proto: WebcastSocialMessage { User user=2, WebcastMessageEvent event=1 }
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

        // Proto: WebcastRoomUserSeqMessage { int32 viewerCount=3 }
        case 'WebcastRoomUserSeqMessage': {
            const viewerCount = getInt(f, 3) || getInt(f, 2);
            const totalViewers = getInt(f, 1) || viewerCount;
            return { ...base, type: 'roomUserSeq' as const, totalViewers, viewerCount };
        }

        // Proto: WebcastLinkMicBattle { repeated WebcastLinkMicBattleItems battleUsers=10 }
        //   battleUsers → { battleGroup=2 → { LinkUser user=1 } }
        case 'WebcastLinkMicBattle': {
            const battleId = String(getInt(f, 1) || '');
            const status = getInt(f, 2) || 1;
            const battleDuration = getInt(f, 3);
            const teams: BattleTeam[] = [];

            // battleUsers at field 10
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

            // Also try field 7 as fallback (some message versions)
            if (teams.length === 0) {
                const teamBufs7 = getAllBytes(f, 7);
                for (const tb of teamBufs7) {
                    try {
                        teams.push(parseBattleTeamFromArmies(tb));
                    } catch { }
                }
            }

            return { ...base, type: 'battle' as const, battleId, status, battleDuration, teams };
        }

        // Proto: WebcastLinkMicArmies { repeated battleItems=3, int32 battleStatus=7 }
        //   battleItems → { hostUserId=1, repeated battleGroups=2 }
        //     battleGroups → { repeated users=1, int32 points=2 }
        case 'WebcastLinkMicArmies': {
            const battleId = String(getInt(f, 1) || '');
            const battleStatus = getInt(f, 7);
            const teams: BattleTeam[] = [];

            const itemBufs = getAllBytes(f, 3);
            for (const ib of itemBufs) {
                try {
                    teams.push(parseBattleTeamFromArmies(ib));
                } catch { }
            }

            return {
                ...base, type: 'battleArmies' as const, battleId, teams,
                status: battleStatus,
            };
        }

        // Proto: WebcastSubNotifyMessage { User user=2, ... subMonth=3 }
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

        // Proto: WebcastQuestionNewMessage { MessageType type=1, QuestionDetails questionDetails=2 }
        //   QuestionDetails { string questionText=2, User user=5 }
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

        // Proto: WebcastControlMessage { int32 action=2 }
        case 'WebcastControlMessage':
            return { ...base, type: 'control' as const, action: getInt(f, 2) || getInt(f, 1) };

        case 'WebcastRoomMessage':
        case 'RoomMessage':
            return { ...base, type: 'room' as const, status: getInt(f, 2) };

        // Proto: WebcastLiveIntroMessage { uint64 id=2, string description=4, User user=5 }
        case 'WebcastLiveIntroMessage': {
            const roomId = String(getInt(f, 2));
            const title = getStr(f, 4) || getStr(f, 2);
            return { ...base, type: 'liveIntro' as const, roomId, title };
        }

        case 'WebcastLinkMicMethod':
        case 'WebcastLinkmicBattleTaskMessage': {
            const action = getStr(f, 1) || `action_${getInt(f, 1)}`;
            const users: TikTokUser[] = [];
            const userBufs = getAllBytes(f, 2);
            for (const ub of userBufs) {
                try { users.push(parseUser(ub)); } catch { }
            }
            return { ...base, type: 'linkMic' as const, action, users };
        }

        default:
            return { ...base, type: 'unknown' as const, method };
    }
}

export function parseWebcastResponse(payload: Buffer): LiveEvent[] {
    const events: LiveEvent[] = [];
    const respFields = decodeProto(payload);

    for (const mf of respFields.filter(f => f.fn === 1 && f.wt === 2)) {
        const msgBuf = mf.value as Buffer;
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
