import type { LiveEvent, TikTokUser } from './types.js';

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
    return { id, nickname, uniqueId: uniqueId || nickname || id };
}

export function parseWebcastMessage(method: string, payload: Buffer): LiveEvent {
    const f = decodeProto(payload);
    const userBuf = getBytes(f, 2);
    const user = userBuf ? parseUser(userBuf) : { id: '0', nickname: '', uniqueId: '' };
    const base = { timestamp: Date.now(), msgId: String(getInt(f, 1) || '') };

    switch (method) {
        case 'WebcastChatMessage':
            return { ...base, type: 'chat' as const, user, comment: getStr(f, 3) };

        case 'WebcastMemberMessage':
            return { ...base, type: 'member' as const, user, action: getInt(f, 3) };

        case 'WebcastLikeMessage':
            return { ...base, type: 'like' as const, user, likeCount: getInt(f, 5), totalLikes: getInt(f, 6) || getInt(f, 7) };

        case 'WebcastGiftMessage': {
            const giftBuf = getBytes(f, 3);
            let giftName = '', giftId = 0, diamondCount = 0;
            if (giftBuf) {
                const gf = decodeProto(giftBuf);
                giftId = getInt(gf, 1);
                giftName = getStr(gf, 2);
                diamondCount = getInt(gf, 5);
            }
            const repeatCount = getInt(f, 5);
            const repeatEnd = getInt(f, 9) === 1;
            return { ...base, type: 'gift' as const, user, giftId, giftName, diamondCount, repeatCount, repeatEnd, combo: repeatCount > 1 && !repeatEnd };
        }

        case 'WebcastSocialMessage': {
            const action = getInt(f, 3);
            const actionMap: Record<number, string> = { 1: 'follow', 2: 'share', 3: 'like' };
            return { ...base, type: 'social' as const, user, action: actionMap[action] || `action_${action}` };
        }

        case 'WebcastRoomUserSeqMessage':
            return { ...base, type: 'roomUserSeq' as const, viewerCount: getInt(f, 3), totalViewers: getInt(f, 4) };

        case 'WebcastLinkMicBattle':
            return { ...base, type: 'battle' as const, status: getInt(f, 3) };

        case 'WebcastLinkMicArmies':
            return { ...base, type: 'battleArmies' as const };

        case 'WebcastSubNotifyMessage':
            return { ...base, type: 'subscribe' as const, user, subMonth: getInt(f, 8) };

        case 'WebcastEmoteChatMessage':
            return { ...base, type: 'emoteChat' as const, user, emoteId: getStr(f, 3) };

        case 'WebcastEnvelopeMessage':
            return { ...base, type: 'envelope' as const, diamondCount: getInt(f, 3) };

        case 'WebcastQuestionNewMessage':
            return { ...base, type: 'question' as const, user, questionText: getStr(f, 3) };

        case 'WebcastRankUpdateMessage':
        case 'WebcastHourlyRankMessage':
            return { ...base, type: 'rankUpdate' as const, rankType: getStr(f, 3) };

        case 'WebcastControlMessage':
            return { ...base, type: 'control' as const, action: getInt(f, 2) };

        case 'WebcastRoomMessage':
        case 'RoomMessage':
            return { ...base, type: 'room' as const, status: getStr(f, 3) };

        case 'WebcastLiveIntroMessage':
            return { ...base, type: 'liveIntro' as const, title: getStr(f, 3) };

        case 'WebcastLinkMicMethod':
        case 'WebcastLinkmicBattleTaskMessage':
            return { ...base, type: 'linkMic' as const, action: getInt(f, 3) };

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
