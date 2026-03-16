/**
 * Live Captions example — transcribe and translate a TikTok LIVE stream.
 *
 * Usage:
 *   TIKTOOL_API_KEY=your_key TIKTOK_USERNAME=streamer npx tsx captions.ts
 */

import { TikTokCaptions } from 'tiktok-live-api';

const username = process.env.TIKTOK_USERNAME || '';
if (!username) {
  console.error('Set TIKTOK_USERNAME environment variable.');
  process.exit(1);
}

const captions = new TikTokCaptions(username, {
  translate: 'en',
  diarization: true,
});

captions.on('connected', (event) => {
  console.log(`Listening to @${event.uniqueId}`);
});

captions.on('caption', (event) => {
  const speaker = event.speaker ? `[${event.speaker}] ` : '';
  const status = event.isFinal ? ' ✓' : '...';
  console.log(`${speaker}${event.text}${status}`);
});

captions.on('translation', (event) => {
  console.log(`  → ${event.text}`);
});

captions.on('credits', (event) => {
  console.log(`Credits: ${event.remaining}/${event.total} min remaining`);
});

captions.connect().catch(console.error);
