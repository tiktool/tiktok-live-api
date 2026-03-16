/**
 * 🔍 RAW PROTO BATTLE LOGGER
 * 
 * Connects to a TikTok LIVE stream and captures ALL raw protobuf data
 * for battle-related messages, plus any unknown/unhandled message types.
 * 
 * Goal: Locate activation of special events like gloves, mist, extra time, x2/x3 multipliers,
 * timer countdown data, and any other battle mechanics.
 * 
 * Usage: bun run battle-logger.ts <username> [duration_minutes]
 * Example: bun run battle-logger.ts katarina.live 5
 */

import { TikTokLive } from './src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// ─── Raw proto decoder (copied from SDK for standalone use) ───
function decodeVarint(buf: Uint8Array, offset: number): { value: number; offset: number } {
    let result = 0;
    let shift = 0;
    while (offset < buf.length) {
        const b = buf[offset++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result, offset };
}

function decodeVarint64(buf: Uint8Array, offset: number): { value: bigint; offset: number } {
    let result = 0n;
    let shift = 0n;
    while (offset < buf.length) {
        const b = buf[offset++];
        result |= BigInt(b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7n;
    }
    return { value: result, offset };
}

interface RawField {
    fieldNumber: number;
    wireType: number;
    value: Uint8Array | bigint | number;
}

function decodeProtoRaw(buf: Uint8Array): RawField[] {
    const fields: RawField[] = [];
    let offset = 0;
    while (offset < buf.length) {
        const tagResult = decodeVarint(buf, offset);
        offset = tagResult.offset;
        const fieldNumber = tagResult.value >> 3;
        const wireType = tagResult.value & 7;
        if (wireType === 0) {
            const r = decodeVarint64(buf, offset);
            offset = r.offset;
            fields.push({ fieldNumber, wireType, value: r.value });
        } else if (wireType === 2) {
            const lenR = decodeVarint(buf, offset);
            offset = lenR.offset;
            const data = buf.slice(offset, offset + lenR.value);
            offset += lenR.value;
            fields.push({ fieldNumber, wireType, value: data });
        } else if (wireType === 5) {
            fields.push({ fieldNumber, wireType, value: buf.slice(offset, offset + 4) });
            offset += 4;
        } else if (wireType === 1) {
            fields.push({ fieldNumber, wireType, value: buf.slice(offset, offset + 8) });
            offset += 8;
        } else {
            break;
        }
    }
    return fields;
}

function getStr(fields: RawField[], fn: number): string | null {
    const f = fields.find(x => x.fieldNumber === fn && x.wireType === 2);
    if (!f) return null;
    try {
        return new TextDecoder().decode(f.value as Uint8Array);
    } catch {
        return null;
    }
}

function getInt(fields: RawField[], fn: number): number {
    const f = fields.find(x => x.fieldNumber === fn && x.wireType === 0);
    return f ? Number(f.value) : 0;
}

function getBigInt(fields: RawField[], fn: number): bigint {
    const f = fields.find(x => x.fieldNumber === fn && x.wireType === 0);
    return f ? BigInt(f.value as bigint) : 0n;
}

function getBytes(fields: RawField[], fn: number): Uint8Array | null {
    const f = fields.find(x => x.fieldNumber === fn && x.wireType === 2);
    return f ? f.value as Uint8Array : null;
}

function getAllBytes(fields: RawField[], fn: number): Uint8Array[] {
    return fields
        .filter(x => x.fieldNumber === fn && x.wireType === 2)
        .map(x => x.value as Uint8Array);
}

// ─── Deep field explorer ───
function exploreProtoFields(buf: Uint8Array, depth: number = 0, maxDepth: number = 4): any {
    if (depth > maxDepth) return '[MAX_DEPTH]';

    try {
        const fields = decodeProtoRaw(buf);
        if (fields.length === 0) return '[EMPTY]';

        const result: any = {};

        for (const field of fields) {
            const key = `field_${field.fieldNumber}`;
            let value: any;

            if (field.wireType === 0) {
                // Varint — show as number and also as signed (for timestamps, etc.)
                const num = Number(field.value);
                value = { type: 'varint', value: num };
                // If it looks like a millisecond timestamp (13+ digits), mark it
                if (num > 1_000_000_000_000 && num < 10_000_000_000_000) {
                    value.asTimestamp = new Date(num).toISOString();
                }
                // If it looks like a second timestamp (10 digits)
                if (num > 1_000_000_000 && num < 10_000_000_000) {
                    value.asTimestamp = new Date(num * 1000).toISOString();
                }
            } else if (field.wireType === 2) {
                const bytes = field.value as Uint8Array;
                // Try to decode as UTF-8 string
                let asString: string | null = null;
                try {
                    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    // Check if it looks like a readable string (mostly printable chars)
                    if (/^[\x20-\x7E\u00A0-\uFFFF]{1,}$/.test(decoded) && decoded.length > 0) {
                        asString = decoded;
                    }
                } catch { }

                // Try to decode as nested proto
                let nested: any = null;
                try {
                    const innerFields = decodeProtoRaw(bytes);
                    if (innerFields.length > 0 && innerFields.length < 100) {
                        // Validate: check that the fields make sense (not garbage)
                        const validFields = innerFields.every(f => f.fieldNumber > 0 && f.fieldNumber < 1000);
                        if (validFields) {
                            nested = exploreProtoFields(bytes, depth + 1, maxDepth);
                        }
                    }
                } catch { }

                value = {
                    type: 'bytes',
                    length: bytes.length,
                    ...(asString ? { asString } : {}),
                    ...(nested && typeof nested === 'object' && Object.keys(nested).length > 0 ? { nested } : {}),
                    hex: bytes.length <= 64 ? Buffer.from(bytes).toString('hex') : `[${bytes.length} bytes]`,
                };
            } else if (field.wireType === 5) {
                const bytes = field.value as Uint8Array;
                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                value = { type: 'fixed32', value: view.getUint32(0, true), asFloat: view.getFloat32(0, true) };
            } else if (field.wireType === 1) {
                const bytes = field.value as Uint8Array;
                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                value = { type: 'fixed64', value: Number(view.getBigUint64(0, true)), asDouble: view.getFloat64(0, true) };
            }

            // Handle repeated fields
            if (result[key]) {
                if (!Array.isArray(result[key])) {
                    result[key] = [result[key]];
                }
                result[key].push(value);
            } else {
                result[key] = value;
            }
        }

        return result;
    } catch {
        return { error: 'Failed to decode', hex: Buffer.from(buf).toString('hex').substring(0, 200) };
    }
}

// ─── Message types we care about (battle + potentially related) ───
const BATTLE_MESSAGE_TYPES = new Set([
    'WebcastLinkMicBattle',
    'WebcastLinkMicArmies',
    'WebcastLinkMicMethod',
    'WebcastLinkmicBattleTaskMessage',
    'WebcastBarrageMessage',       // Barrage events (gloves, effects)
    'WebcastBannerMessage',        // Banner / timer updates
    'WebcastRoomMessage',          // Room state changes
    'WebcastControlMessage',       // Control signals
]);

// Track ALL unknown/unhandled types too
const ALL_SEEN_TYPES = new Map<string, number>();

// ─── Main ───
async function main() {
    const username = process.argv[2] || 'katarina.live';
    const durationMinutes = parseInt(process.argv[3] || '5');
    const durationMs = durationMinutes * 60 * 1000;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const logDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'logs');
    fs.mkdirSync(logDir, { recursive: true });

    const logFile = path.join(logDir, `battle-raw-${username}-${timestamp}.jsonl`);
    const summaryFile = path.join(logDir, `battle-raw-${username}-${timestamp}-summary.json`);

    console.log(`\n🔍 RAW PROTO BATTLE LOGGER`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📡 Connecting to: @${username}`);
    console.log(`⏱️  Duration: ${durationMinutes} minutes`);
    console.log(`📄 Log file: ${logFile}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    let messageCount = 0;
    let battleMessageCount = 0;
    let battleStarted = false;
    let battleId = '';

    function logEntry(entry: any) {
        logStream.write(JSON.stringify(entry) + '\n');
    }

    // Monkey-patch the SDK to intercept raw WebSocket frames
    const client = new TikTokLive({
        uniqueId: username,
        apiKey: 'tk_free_09b2950b03494c076d0534ef75b6ee013e8a489f125b91ac',
    });

    // Store the original handleFrame
    const originalHandleFrame = (client as any).handleFrame.bind(client);

    // Override handleFrame to capture raw data
    (client as any).handleFrame = function (buf: Buffer) {
        try {
            const outerFields = decodeProtoRaw(buf);
            const typeField = outerFields.find(f => f.fieldNumber === 7 && f.wireType === 2);
            const binaryField = outerFields.find(f => f.fieldNumber === 8 && f.wireType === 2);

            const frameType = typeField ? new TextDecoder().decode(typeField.value as Uint8Array) : 'unknown';

            if (frameType === 'msg' && binaryField) {
                let inner = binaryField.value as Uint8Array;

                // Gunzip if needed
                if (inner.length > 2 && inner[0] === 0x1f && inner[1] === 0x8b) {
                    try { inner = zlib.gunzipSync(Buffer.from(inner)); } catch { }
                }

                // Parse the WebcastResponse
                const respFields = decodeProtoRaw(inner);

                for (const mf of respFields.filter(f => f.fieldNumber === 1 && f.wireType === 2)) {
                    const msgBuf = mf.value as Uint8Array;
                    const msgFields = decodeProtoRaw(msgBuf);
                    const method = getStr(msgFields, 1);
                    const innerPayload = getBytes(msgFields, 2);

                    if (!method) continue;

                    // Track all message types
                    ALL_SEEN_TYPES.set(method, (ALL_SEEN_TYPES.get(method) || 0) + 1);
                    messageCount++;

                    // Log battle-related messages with FULL raw proto dump
                    if (BATTLE_MESSAGE_TYPES.has(method) || method.toLowerCase().includes('battle') || method.toLowerCase().includes('mic')) {
                        battleMessageCount++;

                        const entry: any = {
                            timestamp: new Date().toISOString(),
                            messageNumber: messageCount,
                            method,
                            battleMessageNumber: battleMessageCount,
                        };

                        if (innerPayload) {
                            // Full recursive proto field dump
                            entry.rawFields = exploreProtoFields(innerPayload, 0, 5);

                            // Also store hex of the raw payload for later re-analysis
                            entry.rawPayloadHex = Buffer.from(innerPayload).toString('hex');
                            entry.rawPayloadLength = innerPayload.length;
                        }

                        // Detect battle start/end
                        if (method === 'WebcastLinkMicBattle' && innerPayload) {
                            const fields = decodeProtoRaw(innerPayload);
                            const status = getInt(fields, 2);
                            const bid = getBigInt(fields, 1);
                            const duration = getInt(fields, 3);

                            entry.parsed = {
                                battleId: bid.toString(),
                                status,
                                statusText: status === 1 ? 'ACTIVE' : status === 2 ? 'STARTING' : status === 3 ? 'ENDED' : status === 4 ? 'PREPARING' : `UNKNOWN(${status})`,
                                duration,
                            };

                            if (status === 1 && !battleStarted) {
                                battleStarted = true;
                                battleId = bid.toString();
                                console.log(`\n⚔️  BATTLE STARTED! ID: ${battleId}, Duration: ${duration}s`);
                            } else if (status === 3) {
                                battleStarted = false;
                                console.log(`\n🏁 BATTLE ENDED! ID: ${bid}`);
                            }
                        }

                        // For armies, extract scores
                        if (method === 'WebcastLinkMicArmies' && innerPayload) {
                            const fields = decodeProtoRaw(innerPayload);
                            const bid = getBigInt(fields, 1);
                            const bStatus = getInt(fields, 7);

                            entry.parsed = {
                                battleId: bid.toString(),
                                status: bStatus,
                                statusText: bStatus === 1 ? 'ACTIVE' : bStatus === 3 ? 'ENDED' : `STATUS(${bStatus})`,
                            };
                        }

                        // For BattleTask messages, try to identify special events
                        if (method === 'WebcastLinkmicBattleTaskMessage' && innerPayload) {
                            entry.parsed = {
                                note: '🔥 BATTLE TASK/SPECIAL EVENT — check rawFields for gloves/mist/x2/x3/extra time data',
                            };
                        }

                        // For Barrage messages
                        if (method === 'WebcastBarrageMessage' && innerPayload) {
                            entry.parsed = {
                                note: '🎆 BARRAGE EVENT — may contain gloves/effects/multipliers',
                            };
                        }

                        logEntry(entry);

                        // Console summary
                        const statusInfo = entry.parsed ? ` [${entry.parsed.statusText || ''}]` : '';
                        console.log(`📦 #${battleMessageCount} ${method}${statusInfo} (${entry.rawPayloadLength || 0} bytes)`);
                    }

                    // Also log ANY message type we haven't seen before (discovery)
                    if (!BATTLE_MESSAGE_TYPES.has(method) && ALL_SEEN_TYPES.get(method) === 1) {
                        // First time seeing this type — log a sample
                        const entry: any = {
                            timestamp: new Date().toISOString(),
                            messageNumber: messageCount,
                            method,
                            note: 'FIRST_OCCURRENCE — sample capture of unknown message type',
                        };

                        if (innerPayload && innerPayload.length < 10000) {
                            entry.rawFields = exploreProtoFields(innerPayload, 0, 3);
                            entry.rawPayloadHex = Buffer.from(innerPayload).toString('hex');
                        }

                        logEntry(entry);
                        console.log(`🆕 New message type discovered: ${method}`);
                    }
                }
            }
        } catch (e) {
            // Don't crash on parse errors
        }

        // Call original handler so the SDK still processes events normally
        originalHandleFrame(buf);
    };

    // Connect
    try {
        console.log('🔌 Connecting...');
        await client.connect();
        console.log(`✅ Connected! Room ID: ${client.roomId}`);
        console.log(`⏳ Logging for ${durationMinutes} minutes... (press Ctrl+C to stop early)\n`);
    } catch (error) {
        console.error('❌ Failed to connect:', error);
        process.exit(1);
    }

    // Also log SDK events for context
    client.on('event', (evt) => {
        // Log battle and unknown events from SDK's perspective too
        if (evt.type === 'battle' || evt.type === 'battleArmies' || evt.type === 'linkMic' || evt.type === 'unknown') {
            logEntry({
                timestamp: new Date().toISOString(),
                source: 'SDK_EVENT',
                type: evt.type,
                data: evt,
            });
        }
    });

    // Auto-stop after duration
    const stopTimer = setTimeout(async () => {
        console.log(`\n\n⏱️  ${durationMinutes} minutes elapsed — stopping...`);
        await shutdown();
    }, durationMs);

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Interrupted — stopping...');
        clearTimeout(stopTimer);
        await shutdown();
    });

    async function shutdown() {
        client.disconnect();

        // Write summary
        const summary = {
            username,
            duration: `${durationMinutes} minutes`,
            totalMessages: messageCount,
            battleMessages: battleMessageCount,
            messageTypes: Object.fromEntries(ALL_SEEN_TYPES),
            logFile,
        };

        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

        console.log(`\n📊 SUMMARY`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Total messages: ${messageCount}`);
        console.log(`Battle-related: ${battleMessageCount}`);
        console.log(`\nMessage type counts:`);
        const sorted = [...ALL_SEEN_TYPES.entries()].sort((a, b) => b[1] - a[1]);
        for (const [type, count] of sorted) {
            const marker = BATTLE_MESSAGE_TYPES.has(type) ? '⚔️ ' : '   ';
            console.log(`  ${marker}${type}: ${count}`);
        }
        console.log(`\n📄 Raw log: ${logFile}`);
        console.log(`📄 Summary: ${summaryFile}`);

        logStream.end();
        process.exit(0);
    }
}

main().catch(console.error);
