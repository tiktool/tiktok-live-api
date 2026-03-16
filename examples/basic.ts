/**
 * Basic example — connect to a TikTok LIVE stream and print all events.
 *
 * Usage:
 *   TIKTOOL_API_KEY=your_key TIKTOK_USERNAME=streamer npx tsx basic.ts
 */

import { TikTokLive } from 'tiktok-live-api';

const username = process.env.TIKTOK_USERNAME || '';
if (!username) {
  console.error('Set TIKTOK_USERNAME environment variable.');
  process.exit(1);
}

const client = new TikTokLive(username);

client.on('connected', (event) => {
  console.log(`Connected to @${event.uniqueId}`);
});

client.on('chat', (event) => {
  console.log(`[chat] ${event.user.uniqueId}: ${event.comment}`);
});

client.on('gift', (event) => {
  console.log(`[gift] ${event.user.uniqueId} sent ${event.giftName} (${event.diamondCount} 💎)`);
});

client.on('like', (event) => {
  console.log(`[like] ${event.user.uniqueId} liked (total: ${event.totalLikes})`);
});

client.on('follow', (event) => {
  console.log(`[follow] ${event.user.uniqueId} followed`);
});

client.on('roomUserSeq', (event) => {
  console.log(`[viewers] ${event.viewerCount} watching`);
});

client.on('streamEnd', () => {
  console.log('[stream] Stream has ended.');
});

client.connect().catch(console.error);
