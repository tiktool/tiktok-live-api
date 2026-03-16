/**
 * Chat Bot example — simple bot with commands and gift leaderboard.
 *
 * Usage:
 *   TIKTOOL_API_KEY=your_key TIKTOK_USERNAME=streamer npx tsx chat-bot.ts
 */

import { TikTokLive } from 'tiktok-live-api';

const username = process.env.TIKTOK_USERNAME || '';
if (!username) {
  console.error('Set TIKTOK_USERNAME environment variable.');
  process.exit(1);
}

const client = new TikTokLive(username);
const giftLeaderboard = new Map<string, number>();
let messageCount = 0;

client.on('chat', (event) => {
  messageCount++;
  const msg = event.comment.toLowerCase().trim();
  const user = event.user.uniqueId;

  if (msg === '!hello') {
    console.log(`>> BOT: Welcome ${user}! 👋`);
  } else if (msg === '!stats') {
    console.log(`>> BOT: ${messageCount} messages, ${giftLeaderboard.size} gifters`);
  } else if (msg === '!top') {
    const top = [...giftLeaderboard.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    top.forEach(([name, diamonds], i) => {
      console.log(`  ${i + 1}. ${name} — ${diamonds} 💎`);
    });
  }
});

client.on('gift', (event) => {
  const user = event.user.uniqueId;
  const diamonds = event.diamondCount || 0;
  giftLeaderboard.set(user, (giftLeaderboard.get(user) || 0) + diamonds);
});

client.connect().catch(console.error);
