/**
 * 🔍 ANALYZE BATTLE LOG — Extract and pretty-print key findings
 * Usage: bun run analyze-battle.ts <logfile>
 */
import * as fs from 'fs';

const logFile = process.argv[2] || 'D:\\Works\\B4\\Scripts\\ttsignatureserver\\logs\\battle-raw-katarina.live-2026-02-17T01-53-20.jsonl';

const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(l => l.trim());

console.log(`\n📊 ANALYZING ${lines.length} entries from ${logFile}\n`);

// Group by method
const byMethod = new Map<string, any[]>();
for (const line of lines) {
    try {
        const entry = JSON.parse(line);
        const method = entry.method || entry.type || 'unknown';
        if (!byMethod.has(method)) byMethod.set(method, []);
        byMethod.get(method)!.push(entry);
    } catch { }
}

// ═══════════════════════════════════════════════════
// 1. WebcastLinkmicBattleTaskMessage — SPECIAL EVENTS
// ═══════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('⚔️  WebcastLinkmicBattleTaskMessage (SPECIAL BATTLE EVENTS)');
console.log('═══════════════════════════════════════════════════════════════\n');

const taskMessages = byMethod.get('WebcastLinkmicBattleTaskMessage') || [];
for (const msg of taskMessages) {
    console.log(`--- #${msg.battleMessageNumber} (${msg.rawPayloadLength} bytes) @ ${msg.timestamp} ---`);

    // Deep recurse to find all strings and interesting values
    function findAllStrings(obj: any, path: string = ''): void {
        if (!obj) return;
        if (typeof obj === 'string') {
            // Only show interesting strings (not just hex)
            if (path.endsWith('.asString') || path.endsWith('.asTimestamp')) {
                console.log(`  ${path}: ${obj}`);
            }
        } else if (typeof obj === 'number') {
            if (path.endsWith('.value')) {
                const parent = path.replace('.value', '');
                console.log(`  ${parent}: ${obj}`);
            }
        } else if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                findAllStrings(obj[key], path ? `${path}.${key}` : key);
            }
        }
    }

    findAllStrings(msg.rawFields);
    console.log('');
}

// ═══════════════════════════════════════════════════
// 2. WebcastBarrageMessage — EFFECTS/GLOVES
// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🎆 WebcastBarrageMessage (EFFECTS/GLOVES)');
console.log('═══════════════════════════════════════════════════════════════\n');

const barrageMessages = byMethod.get('WebcastBarrageMessage') || [];
for (const msg of barrageMessages) {
    console.log(`--- #${msg.battleMessageNumber} (${msg.rawPayloadLength} bytes) @ ${msg.timestamp} ---`);

    function findAllValues(obj: any, path: string = ''): void {
        if (!obj) return;
        if (typeof obj === 'string') {
            if (path.endsWith('.asString') || path.endsWith('.asTimestamp')) {
                console.log(`  ${path}: ${obj.substring(0, 200)}`);
            }
        } else if (typeof obj === 'number') {
            if (path.endsWith('.value') || path.endsWith('.asFloat') || path.endsWith('.asDouble')) {
                console.log(`  ${path}: ${obj}`);
            }
        } else if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                findAllValues(obj[key], path ? `${path}.${key}` : key);
            }
        }
    }

    findAllValues(msg.rawFields);
    console.log('');
}

// ═══════════════════════════════════════════════════
// 3. WebcastLinkMicBattle — BATTLE START/END
// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🏁 WebcastLinkMicBattle (BATTLE START/END)');
console.log('═══════════════════════════════════════════════════════════════\n');

const battleMessages = byMethod.get('WebcastLinkMicBattle') || [];
for (const msg of battleMessages) {
    console.log(`--- #${msg.battleMessageNumber} (${msg.rawPayloadLength} bytes) @ ${msg.timestamp} ---`);
    console.log(`  Parsed: ${JSON.stringify(msg.parsed, null, 2)}`);

    // Show ALL raw fields for battle messages (these are critical)
    console.log(`  Raw fields (full):`);
    console.log(JSON.stringify(msg.rawFields, null, 4));
    console.log('');
}

// ═══════════════════════════════════════════════════
// 4. WebcastInRoomBannerMessage — TIMER/BANNER
// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📢 WebcastInRoomBannerMessage (TIMER/BANNER)');
console.log('═══════════════════════════════════════════════════════════════\n');

const bannerMessages = byMethod.get('WebcastInRoomBannerMessage') || [];
for (const msg of bannerMessages) {
    console.log(`--- #${msg.battleMessageNumber || 'N/A'} (${msg.rawPayloadLength || '?'} bytes) @ ${msg.timestamp} ---`);

    function findBannerStrings(obj: any, path: string = ''): void {
        if (!obj) return;
        if (typeof obj === 'string') {
            if (path.endsWith('.asString') || path.endsWith('.asTimestamp')) {
                console.log(`  ${path}: ${obj.substring(0, 300)}`);
            }
        } else if (typeof obj === 'number') {
            if (path.endsWith('.value')) {
                console.log(`  ${path}: ${obj}`);
            }
        } else if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                findBannerStrings(obj[key], path ? `${path}.${key}` : key);
            }
        }
    }

    findBannerStrings(msg.rawFields);
    console.log('');
}

// ═══════════════════════════════════════════════════
// 5. FIRST WebcastLinkMicArmies with ACTIVE status — check for timer fields
// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 WebcastLinkMicArmies — FIRST active message (check timer fields)');
console.log('═══════════════════════════════════════════════════════════════\n');

const armiesMessages = byMethod.get('WebcastLinkMicArmies') || [];
const firstActive = armiesMessages.find(m => m.parsed?.status === 1);
if (firstActive) {
    console.log(`--- #${firstActive.battleMessageNumber} (${firstActive.rawPayloadLength} bytes) ---`);
    // Show top-level fields (not deeply nested)
    const fields = firstActive.rawFields;
    for (const key of Object.keys(fields)) {
        const val = fields[key];
        if (val?.type === 'varint') {
            console.log(`  ${key}: varint = ${val.value}${val.asTimestamp ? ` (${val.asTimestamp})` : ''}`);
        } else if (val?.type === 'bytes') {
            console.log(`  ${key}: bytes[${val.length}]${val.asString ? ` = "${val.asString.substring(0, 100)}"` : ''}`);
        }
    }
}

// ═══════════════════════════════════════════════════
// 6. SDK events for battle type
// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔧 SDK Battle Events (parsed by SDK)');
console.log('═══════════════════════════════════════════════════════════════\n');

const sdkBattleEvents = lines.filter(l => l.includes('"SDK_EVENT"') && (l.includes('"battle"') || l.includes('"battleArmies"'))).slice(0, 3);
for (const line of sdkBattleEvents) {
    try {
        const entry = JSON.parse(line);
        console.log(`  ${entry.type}: ${JSON.stringify(entry.data, null, 2).substring(0, 500)}`);
    } catch { }
}

console.log('\n✅ Analysis complete!');
