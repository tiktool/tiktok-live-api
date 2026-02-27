# @tiktool/live

### Connect to any TikTok LIVE stream in 4 lines of code.

[![npm version](https://img.shields.io/npm/v/@tiktool/live?color=%23ff0050&label=npm&logo=npm)](https://www.npmjs.com/package/@tiktool/live)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)

Real-time chat, gifts, viewers, battles, follows & 18+ event types from any TikTok livestream.

**NEW:** 🎤 [Real-Time Live Captions](#-real-time-live-captions) — AI-powered speech-to-text transcription & translation with speaker diarization and sub-second latency.

[Quick Start](#-quick-start) · [Events](#-events) · [Live Captions](#-real-time-live-captions) · [API](#-api-reference) · [Rate Limits](#-rate-limits) · [Get API Key](https://tik.tools)

---

## ⚡ Quick Start

```bash
npm install @tiktool/live
```

Get your free API key at [tik.tools](https://tik.tools)

```typescript
import { TikTokLive } from '@tiktool/live';

const live = new TikTokLive({
    uniqueId: 'tv_asahi_news',
    apiKey: 'YOUR_API_KEY',
});

live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
live.on('gift', e => console.log(`${e.user.uniqueId} sent ${e.giftName} (${e.diamondCount} diamonds)`));
live.on('member', e => console.log(`${e.user.uniqueId} joined`));
live.on('roomUserSeq', e => console.log(`Viewers: ${e.viewerCount}`));

await live.connect();
```

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

Every API key includes a **60-minute free trial** for live captions (speech-to-text with auto-detect to any language).

| Tier | Included Credits | Additional Top-Ups |
|------|-----------------|-------------------|
| **Free** | 60 min free trial | — |
| **Pro** | 2,000 min/month | Available |
| **Ultra** | 10,000 min/month | Available |

**Top-Up Packages:**

| Package | Credits | Price | Per Credit |
|---------|---------|-------|------------|
| Starter | 150 min | $4.99 | $0.033/min |
| Growth | 600 min | $14.99 | $0.025/min |
| Scale | 2,000 min | $39.99 | $0.020/min |
| Whale | 10,000 min | $149.99 | $0.015/min |

> **1 credit = 1 minute** of audio transcribed/translated into one language.

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

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Connect to livestream |
| `disconnect()` | `void` | Disconnect |
| `connected` | `boolean` | Connection status |
| `eventCount` | `number` | Total events received |
| `roomId` | `string` | Current room ID |

---

## Rate Limits

All API requests require an API key. Get yours at [tik.tools](https://tik.tools).

| Tier | Rate Limit | WS Connections | Bulk Check | Caption Credits | Price |
|------|-----------|----------------|------------|-----------------|-------|
| **Free** | 30/min | 3 | 5 | 60 min trial | Free |
| **Pro** | 120/min | 50 | 50 | 2,000/month | Paid |
| **Ultra** | Unlimited | 10,000 | 500 | 10,000/month | Paid |

The SDK calls the sign server **once per connection**, then stays connected via WebSocket. A free key is sufficient for most use cases.

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
