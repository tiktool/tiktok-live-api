# TikTok LIVE API — Node.js & TypeScript

### The managed TikTok Live Connector — receive chat, gifts, viewers, battles & 18+ events from any TikTok LIVE stream via WebSocket.

[![npm version](https://img.shields.io/npm/v/@tiktool/live?color=%23ff0050&label=npm&logo=npm)](https://www.npmjs.com/package/@tiktool/live)
[![npm downloads](https://img.shields.io/npm/dm/@tiktool/live)](https://www.npmjs.com/package/@tiktool/live)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)
[![Discord](https://img.shields.io/discord/1482387222912172159?logo=discord&label=Discord&color=5865F2)](https://discord.gg/y8TwuFBAmD)

> **99.9% uptime** — Never breaks when TikTok updates. No protobuf, no reverse engineering, no maintenance. Also available for [Python](https://pypi.org/project/tiktok-live-api/), [Java, Go, C#, and any language via WebSocket](https://tik.tools/docs).

**🎤 NEW:** [Real-Time Live Captions](#-real-time-live-captions) — AI-powered speech-to-text transcription & translation with speaker diarization. **No other TikTok library offers this.**

[Try It Now](#-try-it-now--5-minute-live-demo) · [Events](#-events) · [Live Captions](#-real-time-live-captions) · [API](#-api-reference) · [Rate Limits](#-rate-limits) · [Get API Key](https://tik.tools)

---

## ⚡ Quick Start

```bash
npm install @tiktool/live
```

Get your free API key at [tik.tools](https://tik.tools) — then run the demo below.

## 🚀 Try It Now — 5-Minute Live Demo

Copy-paste this into a file and run it. Connects to a live TikTok stream, prints every event for 5 minutes, then exits. Works on the free Sandbox tier.

**Save as `demo.mjs` and run with `node demo.mjs`:**

```javascript
// demo.mjs — TikTok LIVE in 5 minutes
// npm install @tiktool/live
import { TikTokLive } from '@tiktool/live';

const API_KEY       = 'YOUR_API_KEY';        // Get free key → https://tik.tools
const LIVE_USERNAME = 'tv_asahi_news';       // Any live TikTok username

const live = new TikTokLive({ uniqueId: LIVE_USERNAME, apiKey: API_KEY });
let events = 0;

live.on('chat',        e => { events++; console.log(`💬 ${e.user.uniqueId}: ${e.comment}`); });
live.on('gift',        e => { events++; console.log(`🎁 ${e.user.uniqueId} sent ${e.giftName} (${e.diamondCount}💎)`); });
live.on('like',        e => { events++; console.log(`❤️  ${e.user.uniqueId} liked × ${e.likeCount}`); });
live.on('member',      e => { events++; console.log(`👋 ${e.user.uniqueId} joined`); });
live.on('follow',      e => { events++; console.log(`➕ ${e.user.uniqueId} followed`); });
live.on('share',       e => { events++; console.log(`🔗 ${e.user.uniqueId} shared`); });
live.on('roomUserSeq', e => { events++; console.log(`👀 Viewers: ${e.viewerCount}`); });
live.on('subscribe',   e => { events++; console.log(`⭐ ${e.user.uniqueId} subscribed`); });
live.on('battle',      e => { events++; console.log(`⚔️  Battle update`); });

live.on('connected',   () => console.log(`\n✅ Connected to @${LIVE_USERNAME} — listening for 5 min...\n`));
live.on('disconnected', () => console.log(`\n📊 Done! Received ${events} events.\n`));

await live.connect();
setTimeout(() => { live.disconnect(); }, 300_000);
```

<details>
<summary><strong>🔌 Pure WebSocket version (no SDK, any language)</strong></summary>

Works with any WebSocket client. No dependencies except `ws` (Node.js) or your language's WebSocket library.

```javascript
// ws-demo.mjs — Pure WebSocket, zero SDK
// npm install ws
import WebSocket from 'ws';

const API_KEY       = 'YOUR_API_KEY';
const LIVE_USERNAME = 'tv_asahi_news';

const ws = new WebSocket(`wss://api.tik.tools?uniqueId=${LIVE_USERNAME}&apiKey=${API_KEY}`);
let events = 0;

ws.on('open', () => console.log(`\n✅ Connected to @${LIVE_USERNAME} — listening for 5 min...\n`));
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  events++;
  const d = msg.data || {};
  const user = d.user?.uniqueId || d.uniqueId || '';
  switch (msg.event) {
    case 'chat':        console.log(`💬 ${user}: ${d.comment}`); break;
    case 'gift':        console.log(`🎁 ${user} sent ${d.giftName} (${d.diamondCount}💎)`); break;
    case 'like':        console.log(`❤️  ${user} liked × ${d.likeCount}`); break;
    case 'member':      console.log(`👋 ${user} joined`); break;
    case 'roomUserSeq': console.log(`👀 Viewers: ${d.viewerCount}`); break;
    case 'roomInfo':    console.log(`📡 Room: ${msg.roomId}`); break;
    default:            console.log(`📦 ${msg.event}`); break;
  }
});
ws.on('close', () => console.log(`\n📊 Done! Received ${events} events.\n`));

setTimeout(() => ws.close(), 300_000);
```

</details>

---

## How It Works

```
    Your App                    tik.tools                    TikTok
  +-----------+              +--------------+           +--------------+
  |          -+-- sign_url --> Signs URL    |           |              |
  |  Your   <-+-- X-Bogus --|  with params |           |   TikTok     |
  |  Code    |              |              |           |   WebSocket  |
  |          -+------------ Connect directly ---------->|   Server     |
  |          <-+------------ Live events (protobuf) <---|              |
  +-----------+              +--------------+           +--------------+
                            ^ Only interaction             ^ Direct from
                              with our server                YOUR IP
```

- Your app connects directly to TikTok — from your IP or through a proxy
- The sign server only generates cryptographic signatures (requires API key)
- TikTok never sees the sign server
- Built-in protobuf parser, no external dependencies

---

## Events

### Listening

```typescript
live.on('chat', (event) => {
    event.user.uniqueId  // string
    event.comment        // string
});

live.on('event', (event) => {
    console.log(event.type, event);
});
```

### Reference

| Event | Type | Description | Fields |
|-------|------|-------------|--------|
| `chat` | `ChatEvent` | Chat message | `user`, `comment` |
| `member` | `MemberEvent` | User joined | `user`, `action` |
| `like` | `LikeEvent` | User liked | `user`, `likeCount`, `totalLikes` |
| `gift` | `GiftEvent` | Gift sent | `user`, `giftName`, `diamondCount`, `repeatCount`, `combo` |
| `social` | `SocialEvent` | Follow / Share | `user`, `action` |
| `roomUserSeq` | `RoomUserSeqEvent` | Viewer count | `viewerCount`, `totalViewers` |
| `battle` | `BattleEvent` | Link Mic battle | `status` |
| `battleArmies` | `BattleArmiesEvent` | Battle teams | — |
| `subscribe` | `SubscribeEvent` | New subscriber | `user`, `subMonth` |
| `emoteChat` | `EmoteChatEvent` | Emote in chat | `user`, `emoteId` |
| `envelope` | `EnvelopeEvent` | Treasure chest | `diamondCount` |
| `question` | `QuestionEvent` | Q&A question | `user`, `questionText` |
| `control` | `ControlEvent` | Stream control | `action` (3 = ended) |
| `room` | `RoomEvent` | Room status | `status` |
| `liveIntro` | `LiveIntroEvent` | Stream intro | `title` |
| `rankUpdate` | `RankUpdateEvent` | Rank update | `rankType` |
| `linkMic` | `LinkMicEvent` | Link Mic | `action` |
| `unknown` | `UnknownEvent` | Unrecognized | `method` |

### Connection Events

| Event | Callback | Description |
|-------|----------|-------------|
| `connected` | `() => void` | Connected to stream |
| `disconnected` | `(code, reason) => void` | Disconnected |
| `roomInfo` | `(info: RoomInfo) => void` | Room info |
| `error` | `(error: Error) => void` | Error |

---

## 🎤 Real-Time Live Captions

AI-powered speech-to-text transcription and translation for TikTok LIVE streams. Features include:

- **Auto-detect language** — Automatically identifies the spoken language
- **Speaker diarization** — Identifies individual speakers in multi-person streams
- **Real-time translation** — Translate to any supported language with sub-second latency
- **Partial + final results** — Get streaming partial transcripts and confirmed final text
- **Credit-based billing** — 1 credit = 1 minute of transcription/translation

### Quick Start

```typescript
import { TikTokCaptions } from '@tiktool/live';

const captions = new TikTokCaptions({
    uniqueId: 'streamer_name',
    apiKey: 'YOUR_API_KEY',
    translate: 'en',
    diarization: true,
});

captions.on('caption', (event) => {
    const prefix = event.speaker ? `[${event.speaker}] ` : '';
    console.log(`${prefix}${event.text}${event.isFinal ? ' ✓' : '...'}`);
});

captions.on('translation', (event) => {
    console.log(`  → ${event.text}`);
});

captions.on('credits', (event) => {
    console.log(`${event.remaining}/${event.total} min remaining`);
});

captions.on('credits_low', (event) => {
    console.warn(`Low credits! ${event.remaining} min left`);
});

await captions.start();
```

### `new TikTokCaptions(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uniqueId` | `string` | — | TikTok username (without @) |
| `apiKey` | `string` | — | **Required.** API key from [tik.tools](https://tik.tools) |
| `language` | `string` | `''` | Source language hint (empty = auto-detect) |
| `translate` | `string` | `''` | Target translation language (e.g. `'en'`, `'es'`, `'fr'`) |
| `diarization` | `boolean` | `true` | Enable speaker identification |
| `maxDurationMinutes` | `number` | `60` | Auto-disconnect after N minutes (max: 300) |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `number` | `5` | Max reconnect attempts |
| `debug` | `boolean` | `false` | Debug logging |

### Caption Events

| Event | Callback | Description |
|-------|----------|-------------|
| `caption` | `(data: CaptionData) => void` | Real-time transcription (partial + final) |
| `translation` | `(data: TranslationData) => void` | Translated text |
| `status` | `(data: CaptionStatus) => void` | Session status changes |
| `credits` | `(data: CaptionCredits) => void` | Credit balance updates |
| `credits_low` | `(data) => void` | Low credit warning (≤20%) |
| `connected` | `() => void` | WebSocket connected |
| `disconnected` | `(code, reason) => void` | Disconnected |
| `error` | `(data: CaptionError) => void` | Error |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `Promise<void>` | Connect and start transcription |
| `stop()` | `void` | Stop and disconnect |
| `setLanguage(lang)` | `void` | Switch translation language on-the-fly |
| `getCredits()` | `void` | Request credit balance update |
| `connected` | `boolean` | Connection status |
| `language` | `string` | Current target language |

### Raw WebSocket

You can also connect directly via WebSocket without the SDK:

```
wss://api.tik.tools/captions?uniqueId=USERNAME&apiKey=YOUR_KEY&translate=en&diarization=true&max_duration_minutes=120
```

### Caption Credits

Caption credits are **pay-as-you-go add-ons** — no credits are included in the base subscription. Requires Basic tier or higher.

| Package | Credits | Price | Per Credit |
|---------|---------|-------|------------|
| **Starter** | 1,000 min | $10 | $0.010/min |
| **Creator** | 5,000 min | $35 | $0.007/min |
| **Agency** | 20,000 min | $100 | $0.005/min |

> **1 credit = 1 minute** of audio transcribed/translated into one language. If translating to 2 languages simultaneously, it burns 2 credits per minute.

Try the live demo at [tik.tools/captions](https://tik.tools/captions) — see real-time transcription and translation on actual TikTok LIVE streams.

---

## API Reference

### `new TikTokLive(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uniqueId` | `string` | — | TikTok username (without @) |
| `apiKey` | `string` | — | **Required.** API key from [tik.tools](https://tik.tools) |
| `signServerUrl` | `string` | `https://api.tik.tools` | Sign server URL |
| `agent` | `http.Agent` | — | HTTP agent for proxying connections |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `number` | `5` | Max reconnect attempts |
| `heartbeatInterval` | `number` | `10000` | Heartbeat interval (ms) |
| `debug` | `boolean` | `false` | Debug logging |
| `sessionId` | `string` | — | TikTok `sessionid` cookie for authenticated features (ranklist, chat) |
| `ttTargetIdc` | `string` | — | TikTok target IDC region (e.g. `useast5`). Required with `sessionId` |
| `roomId` | `string` | — | Pre-known room ID — skips HTML page scrape |
| `ttwid` | `string` | — | Pre-fetched `ttwid` cookie. With `roomId`, skips all HTTP requests |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Connect to livestream |
| `disconnect()` | `void` | Disconnect |
| `setSession(sessionId, ttTargetIdc?)` | `void` | Update session at runtime |
| `buildSessionCookieHeader()` | `string \| undefined` | Build cookie header for auth API requests |
| `connected` | `boolean` | Connection status |
| `eventCount` | `number` | Total events received |
| `roomId` | `string` | Current room ID |
| `sessionId` | `string \| undefined` | Current session ID |

---

## Rate Limits

All API requests require an API key. Get yours at [tik.tools](https://tik.tools).

| Tier | Requests/Day | Rate Limit | WS Connections | WS Duration | WS Connects | Bulk Check | CAPTCHA | Feed Discovery | Price |
|------|-------------|-----------|----------------|-------------|-------------|------------|---------|----------------|-------|
| **Sandbox** | 50 | 5/min | 1 | 5 min | 10/hr · 30/day | 1 | ✕ | ✕ | Free |
| **Basic** | 10,000 | 60/min | 3 | 8 hours | 60/hr · 200/day | 10 | ✕ | ✕ | From $7/wk |
| **Pro** | 75,000 | Unlimited | 50 | 8 hours | Unlimited | 50 | 50/day | 100/day | From $15/wk |
| **Ultra** | 300,000 | Unlimited | 500 | 8 hours | Unlimited | 500 | 500/day | 2,000/day | From $45/wk |

**Caption Credits** are available as pay-as-you-go add-ons (1 credit = 1 min of audio in 1 language):
- **Starter**: 1,000 credits — $10
- **Creator**: 5,000 credits — $35
- **Agency**: 20,000 credits — $100

The SDK calls the sign server **once per connection**, then stays connected via WebSocket. Sandbox is for API verification only — use Basic or higher for production.

---

## 🔍 Feed Discovery

Discover recommended TikTok LIVE streams. **Requires Pro or Ultra tier.**

```typescript
import { getLiveFeed, fetchFeed } from '@tiktool/live';

// Option 1: Two-step (sign-and-return)
const signed = await getLiveFeed({
    apiKey: 'YOUR_PRO_KEY',
    sessionId: 'YOUR_TIKTOK_SESSIONID',
    region: 'US',
    count: 10,
});

const resp = await fetch(signed.signed_url, {
    headers: { ...signed.headers, Cookie: signed.cookies || '' },
});
const data = await resp.json();

// Option 2: One-step convenience
const feed = await fetchFeed({
    apiKey: 'YOUR_PRO_KEY',
    sessionId: 'YOUR_TIKTOK_SESSIONID',
    count: 10,
});

for (const entry of feed.data || []) {
    const room = entry.data;
    console.log(`🔴 @${room.owner.display_id}: "${room.title}" — ${room.user_count} viewers`);
}
```

### Channel Types

| Value | Channel |
|-------|--------|
| `"87"` | Recommended (default) |
| `"86"` | Suggested |
| `"42"` | Following |
| `"1111006"` | Gaming |

### Pagination

Use `maxTime` from the previous response to load more:

```typescript
const page2 = await getLiveFeed({
    apiKey: 'YOUR_PRO_KEY',
    sessionId: 'YOUR_TIKTOK_SESSIONID',
    maxTime: data.extra?.max_time, // cursor from previous response
});
```

---

## 🏆 Regional Leaderboard

Get daily, hourly, popular, or league LIVE rankings for any streamer. **Requires Pro or Ultra tier.**

This endpoint uses a **two-step sign-and-return pattern** because TikTok sessions are IP-bound:

1. Call `getRegionalRanklist()` to get a signed URL from the server
2. POST the signed URL from **your own IP** with your TikTok session cookie

```typescript
import { getRegionalRanklist } from '@tiktool/live';

const signed = await getRegionalRanklist({
    apiKey: 'YOUR_PRO_KEY',
    roomId: '7607695933891218198',
    anchorId: '7444599004337652758',
    rankType: '8',
});

const resp = await fetch(signed.signed_url, {
    method: signed.method,
    headers: { ...signed.headers, Cookie: `sessionid=YOUR_SID; ${signed.cookies}` },
    body: signed.body,
});

const { data } = await resp.json();
data.rank_view.ranks.forEach((r: any, i: number) =>
    console.log(`${i+1}. ${r.user.nickname} — ${r.score} pts`)
);
```

### Rank Types

| Value | Period |
|-------|--------|
| `"1"` | Hourly |
| `"8"` | Daily (default) |
| `"15"` | Popular LIVE |
| `"16"` | League |

---

## Examples

### Chat Bot

```typescript
import { TikTokLive } from '@tiktool/live';

const live = new TikTokLive({
    uniqueId: 'streamer_name',
    apiKey: 'YOUR_API_KEY',
});

live.on('chat', (e) => {
    if (e.comment.toLowerCase() === '!hello') {
        console.log(`Hello, ${e.user.nickname}!`);
    }
});

live.on('gift', (e) => {
    if (e.repeatEnd) {
        console.log(`${e.user.uniqueId} sent ${e.repeatCount}x ${e.giftName} (${e.diamondCount * e.repeatCount} diamonds)`);
    }
});

await live.connect();
```

### OBS Overlay

```typescript
import { TikTokLive } from '@tiktool/live';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const live = new TikTokLive({
    uniqueId: 'streamer_name',
    apiKey: 'YOUR_API_KEY',
});

live.on('event', (event) => {
    for (const client of wss.clients) {
        client.send(JSON.stringify(event));
    }
});

await live.connect();
console.log('Forwarding events to ws://localhost:8080');
```

---

## 🌐 Proxy Support

Route all connections through an HTTP proxy. Works with any HTTPS proxy provider (residential, datacenter, etc.).

```typescript
import { TikTokLive } from '@tiktool/live';
import { HttpsProxyAgent } from 'https-proxy-agent';

const agent = new HttpsProxyAgent('http://user:pass@proxy.example.com:1234');

const live = new TikTokLive({
    uniqueId: 'streamer_name',
    apiKey: 'YOUR_API_KEY',
    agent,
});

await live.connect();
```

Both the initial page request and the WebSocket connection are routed through the proxy. This is useful for:
- Running multiple concurrent connections from different IPs
- Avoiding rate limits
- Geo-targeting specific regions

---

## TypeScript

Full TypeScript support with type inference:

```typescript
import { TikTokLive, ChatEvent, GiftEvent } from '@tiktool/live';

const live = new TikTokLive({
    uniqueId: 'username',
    apiKey: 'YOUR_API_KEY',
});

live.on('chat', (event: ChatEvent) => {
    const username: string = event.user.uniqueId;
    const message: string = event.comment;
});

live.on('gift', (event: GiftEvent) => {
    const diamonds: number = event.diamondCount;
    const isCombo: boolean = event.combo;
});
```

---

## License

MIT © [tiktool](https://tik.tools)
