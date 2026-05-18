/**
 * Battle / PK example — listens for battle start, live armies score updates
 * (with per-host MVP), and item-card effects (boosters, gloves, mist).
 *
 * Usage:
 *   TIKTOOL_API_KEY=your_key TIKTOK_USERNAME=creator npx tsx battle.ts
 */

import { TikTokLive } from 'tiktok-live-api';

const username = process.env.TIKTOK_USERNAME || '';
if (!username) {
    console.error('Set TIKTOK_USERNAME env var (a creator currently in PK).');
    process.exit(1);
}

const client = new TikTokLive({
    uniqueId: username,
    apiKey: process.env.TIKTOOL_API_KEY,
});

client.on('connected', e => console.log(`Connected to @${e.uniqueId}`));

const STATUS: Record<number, string> = {
    1: 'ACTIVE', 2: 'STARTING', 3: 'ENDED', 4: 'PREPARING',
};

client.on('battle', e => {
    console.log(`\n=== PK ${STATUS[e.status] || e.status} === battleId=${e.battleId} duration=${e.battleDuration}s teams=${e.teams.length}`);
});

client.on('battleArmies', e => {
    console.log(`\n[armies] status=${STATUS[e.status] || e.status} countdown=${e.secsRemaining ?? '?'}s`);
    if (e.matchId)   console.log(`         matchId=${e.matchId}`);
    if (e.sessionId) console.log(`         sessionId=${e.sessionId}`);
    for (const h of e.hosts ?? []) {
        console.log(`  host ${h.hostUserId} teamIdx=${h.teamIdx} total=${h.teamTotalScore}`);
        for (let i = 0; i < Math.min(3, h.contributors.length); i++) {
            const c = h.contributors[i];
            const tag = i === 0 ? 'MVP' : `#${i + 1}`;
            console.log(`    ${tag} ${c.nickname || c.userId} score=${c.score}`);
        }
    }
});

client.on('battleItemCard', e => {
    const tag = e.multiplier ? `x${e.multiplier} BOOSTER` : e.effect.toUpperCase();
    console.log(`\n[card] ${tag} from @${e.senderUniqueId || e.senderUserId} (${e.senderNickname || 'unknown'})`);
    console.log(`       effect=${e.effect} key=${e.effectKey} duration=${e.durationSec}s`);
    if (e.commentTemplate) console.log(`       "${e.commentTemplate}"`);
});

client.on('disconnected', e => console.log(`Disconnected: @${e.uniqueId}`));
client.on('error', e => console.error('Error:', e.error));

await client.connect();
console.log('Listening for battle events… Ctrl+C to stop.');
