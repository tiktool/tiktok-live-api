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

function parseUser(data: Buffer): TikTokUser {
    const f = decodeProto(data);
    const id = String(getInt(f, 1) || getStr(f, 1));
    const nickname = getStr(f, 3) || getStr(f, 5);
    const uniqueId = getStr(f, 38) || getStr(f, 4) || getStr(f, 2);

    let profilePicture: string | undefined;
    const avatarBuf = getBytes(f, 9);
    if (avatarBuf) {
        try {
            const avatarFields = decodeProto(avatarBuf);
            const urlBuf = getBytes(avatarFields, 1);
            if (urlBuf) profilePicture = urlBuf.toString('utf-8');
        } catch { }
    }

    return { id, nickname, uniqueId: uniqueId || nickname || id, profilePicture };
}

function parseBattleTeam(teamBuf: Buffer): BattleTeam {
    const fields = decodeProto(teamBuf);
    const hostUserId = String(getInt(fields, 1));
    const score = getInt(fields, 2);
    const users: BattleTeamUser[] = [];

    const userFields = getAllBytes(fields, 3);
    for (const uf of userFields) {
        try {
            const uFields = decodeProto(uf);
            const userBuf = getBytes(uFields, 1);
            const userScore = getInt(uFields, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            users.push({ user, score: userScore });
        } catch { }
    }

    return { hostUserId, score, users };
}

export function parseWebcastMessage(method: string, payload: Buffer): LiveEvent {
    const f = decodeProto(payload);
    const base = { timestamp: Date.now(), msgId: String(getInt(f, 1) || '') };

    switch (method) {
        case 'WebcastChatMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'chat' as const, user, comment: getStr(f, 3) };
        }

        case 'WebcastMemberMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'member' as const, user, action: getInt(f, 1) };
        }

        case 'WebcastLikeMessage': {
            const userBuf = getBytes(f, 5);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'like' as const, user, likeCount: getInt(f, 1), totalLikes: getInt(f, 2) || getInt(f, 7) };
        }

        case 'WebcastGiftMessage': {
            const userBuf = getBytes(f, 7);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            const giftId = getInt(f, 1);
            const repeatCount = getInt(f, 5);
            const repeatEnd = getInt(f, 9) === 1;
            const giftType = getInt(f, 6);
            const groupId = getStr(f, 11);

            let giftName = '', diamondCount = 0;
            const giftInfoBuf = getBytes(f, 15);
            if (giftInfoBuf) {
                const gf = decodeProto(giftInfoBuf);
                giftName = getStr(gf, 1);
                diamondCount = getInt(gf, 5) || getInt(gf, 2);
            }
            if (!giftName) {
                const giftBuf3 = getBytes(f, 3);
                if (giftBuf3) {
                    const gf3 = decodeProto(giftBuf3);
                    if (!giftName) giftName = getStr(gf3, 2);
                    if (!diamondCount) diamondCount = getInt(gf3, 5);
                }
            }

            return {
                ...base, type: 'gift' as const, user, giftId, giftName, diamondCount,
                repeatCount, repeatEnd, combo: repeatCount > 1 && !repeatEnd,
                giftType, groupId,
            };
        }

        case 'WebcastSocialMessage': {
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            const actionInt = getInt(f, 1);
            const actionMap: Record<number, string> = { 1: 'follow', 2: 'share', 3: 'like' };
            return { ...base, type: 'social' as const, user, action: actionMap[actionInt] || `action_${actionInt}` };
        }

        case 'WebcastRoomUserSeqMessage':
            return {
                ...base, type: 'roomUserSeq' as const,
                totalViewers: getInt(f, 1) || getInt(f, 3),
                viewerCount: getInt(f, 2) || getInt(f, 4),
            };

        case 'WebcastLinkMicBattle': {
            const battleId = String(getInt(f, 1) || getStr(f, 1));
            const status = getInt(f, 2);
            const battleDuration = getInt(f, 3);
            const teams: BattleTeam[] = [];
            const teamBufs = getAllBytes(f, 7);
            for (const tb of teamBufs) {
                try { teams.push(parseBattleTeam(tb)); } catch { }
            }
            return { ...base, type: 'battle' as const, battleId, status, battleDuration, teams };
        }

        case 'WebcastLinkMicArmies': {
            const battleId = String(getInt(f, 1) || getStr(f, 1));
            const teams: BattleTeam[] = [];
            const teamBufs = getAllBytes(f, 3);
            for (const tb of teamBufs) {
                try { teams.push(parseBattleTeam(tb)); } catch { }
            }
            return { ...base, type: 'battleArmies' as const, battleId, teams };
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
            const userBuf = getBytes(f, 2);
            const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
            return { ...base, type: 'question' as const, user, questionText: getStr(f, 3) || getStr(f, 4) };
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
            const roomId = String(getInt(f, 1));
            return { ...base, type: 'liveIntro' as const, roomId, title: getStr(f, 4) || getStr(f, 2) };
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
