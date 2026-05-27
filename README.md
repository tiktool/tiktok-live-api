<p align="center">
  <img src="https://raw.githubusercontent.com/tiktool/tiktok-live-api/main/banner.png" alt="tiktok-live-api" width="100%" />
</p>

# tiktok-live-api

> 📖 **Full documentation, guides, and dashboard → [tik.tools](https://tik.tools)** &nbsp;|&nbsp; 🐍 **Python SDK → [tik.tools/guides/python-tiktok-live](https://tik.tools/guides/python-tiktok-live)** &nbsp;|&nbsp; 🔌 **WebSocket API → [tik.tools/websocket](https://tik.tools/websocket)**

**Unofficial TikTok LIVE API Client for Node.js & TypeScript** - Connect to any TikTok LIVE stream and receive real-time chat messages, gifts, likes, follows, viewer counts, battles, and more. Includes AI-powered live captions (speech-to-text). Powered by the [TikTool](https://tik.tools) managed API.

[![npm](https://img.shields.io/npm/v/tiktok-live-api)](https://www.npmjs.com/package/tiktok-live-api)
[![npm downloads](https://img.shields.io/npm/dm/tiktok-live-api)](https://www.npmjs.com/package/tiktok-live-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/tiktok-live-api)](https://github.com/tiktool/tiktok-live-api/blob/main/LICENSE)

<p align="center">
  <img src="https://raw.githubusercontent.com/tiktool/tiktok-live-api/main/tiktok-live-api.gif" alt="TikTok Live API Demo - real-time chat, gifts, and viewer events" width="700">
</p>

> This package is **not affiliated with or endorsed by TikTok**. It connects to the [TikTool Live](https://tik.tools) managed API service - 99.9% uptime, no reverse engineering, no maintenance required. Also available for [Python](https://pypi.org/project/tiktok-live-api/) and [any language via WebSocket](https://tik.tools/docs).

## Install

```bash
npm install tiktok-live-api
```

```bash
# or with yarn / pnpm / bun
yarn add tiktok-live-api
pnpm add tiktok-live-api
bun add tiktok-live-api
```

## Quick Start

```typescript
import { TikTokLive } from 'tiktok-live-api';

const client = new TikTokLive('streamer_username', { apiKey: 'YOUR_API_KEY' });

client.on('chat', (event) => {
  console.log(`${event.user.uniqueId}: ${event.comment}`);
});

client.on('gift', (event) => {
  console.log(`${event.user.uniqueId} sent ${event.giftName} (${event.diamondCount} 💎)`);
});

client.on('like', (event) => {
  console.log(`${event.user.uniqueId} liked (total: ${event.totalLikes})`);
});

client.on('follow', (event) => {
  console.log(`${event.user.uniqueId} followed!`);
});

client.on('roomUserSeq', (event) => {
  console.log(`${event.viewerCount} viewers watching`);
});

client.connect();
```

That's it. **No complex setup, no protobuf, no reverse engineering, no breakages when TikTok updates.**

---

## 🚀 Try It Now - Live Demo

Copy-paste this into a file and run it. Connects to a live TikTok stream and prints every event in real time. Works on the free Community tier - 2 hours per WebSocket connection.

**Save as `demo.mjs` and run with `node demo.mjs`:**

```javascript
// demo.mjs - TikTok LIVE in real time
// npm install tiktok-live-api
import { TikTokLive } from 'tiktok-live-api';

const API_KEY       = 'YOUR_API_KEY';        // Get free key → https://tik.tools
const LIVE_USERNAME = 'tv_asahi_news';       // Any live TikTok username

const client = new TikTokLive(LIVE_USERNAME, { apiKey: API_KEY });
let events = 0;

client.on('chat',        e => { events++; console.log(`💬 ${e.user.uniqueId}: ${e.comment}`); });
client.on('gift',        e => { events++; console.log(`🎁 ${e.user.uniqueId} sent ${e.giftName} (${e.diamondCount}💎)`); });
client.on('like',        e => { events++; console.log(`❤️  ${e.user.uniqueId} liked × ${e.likeCount}`); });
client.on('member',      e => { events++; console.log(`👋 ${e.user.uniqueId} joined`); });
client.on('follow',      e => { events++; console.log(`➕ ${e.user.uniqueId} followed`); });
client.on('roomUserSeq', e => { events++; console.log(`👀 Viewers: ${e.viewerCount}`); });

client.on('connected',    () => console.log(`\n✅ Connected to @${LIVE_USERNAME} - streaming events...\n`));
client.on('disconnected', () => console.log(`\n📊 Disconnected. Received ${events} events.\n`));

client.connect();
// Press Ctrl+C to stop. Community tier caps each WebSocket at 2 hours.
```

<details>
<summary><strong>🔌 Pure WebSocket version (no SDK, any language)</strong></summary>

```javascript
// ws-demo.mjs - Pure WebSocket, zero SDK
// npm install ws
import WebSocket from 'ws';

const API_KEY       = 'YOUR_API_KEY';
const LIVE_USERNAME = 'tv_asahi_news';

const ws = new WebSocket(`wss://api.tik.tools?uniqueId=${LIVE_USERNAME}&apiKey=${API_KEY}`);
let events = 0;

ws.on('open', () => console.log(`\n✅ Connected to @${LIVE_USERNAME} - streaming events...\n`));
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  events++;
  const d = msg.data || {};
  const user = d.user?.uniqueId || '';
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
ws.on('close', () => console.log(`\n📊 Disconnected. Received ${events} events.\n`));
// Press Ctrl+C to stop. Community tier caps each WebSocket at 2 hours.
```

</details>

---

## JavaScript (CommonJS)

```javascript
const { TikTokLive } = require('tiktok-live-api');

const client = new TikTokLive('streamer_username', { apiKey: 'YOUR_API_KEY' });
client.on('chat', (e) => console.log(`${e.user.uniqueId}: ${e.comment}`));
client.connect();
```

## Get a Free API Key

1. Go to [tik.tools](https://tik.tools)
2. Sign up (no credit card required)
3. Copy your API key

The free **Community** tier gives you 2,500 requests/day and 15 WebSocket connections (2 hours per connection). Forever free.

## Environment Variable

Instead of passing `apiKey` directly, you can set it as an environment variable:

```bash
# Linux / macOS
export TIKTOOL_API_KEY=your_api_key_here

# Windows (CMD)
set TIKTOOL_API_KEY=your_api_key_here

# Windows (PowerShell)
$env:TIKTOOL_API_KEY="your_api_key_here"
```

```typescript
import { TikTokLive } from 'tiktok-live-api';

// Automatically reads TIKTOOL_API_KEY from environment
const client = new TikTokLive('streamer_username');
client.on('chat', (e) => console.log(e.comment));
client.connect();
```

## Events

| Event | Description | Key Fields |
|-------|-------------|------------|
| `chat` | Chat message | `user`, `comment`, `emotes`, `starred?` |
| `gift` | Virtual gift | `user`, `giftName`, `diamondCount`, `repeatCount` |
| `like` | Like event | `user`, `likeCount`, `totalLikes` |
| `follow` | New follower | `user` |
| `share` | Stream share | `user` |
| `member` | Viewer joined | `user` |
| `subscribe` | New subscriber | `user` |
| `roomUserSeq` | Viewer count | `viewerCount`, `topViewers` |
| `battle` | PK start / end / status change | `battleId`, `status` (1=ACTIVE / 2=STARTING / 3=ENDED / 4=PREPARING), `battleDuration`, `teams` |
| `battleArmies` | Live PK score update | `battleId`, `status`, `matchId`, `sessionId`, `durationSec`, `secsRemaining`, `hosts[]` - each host has `teamTotalScore` + `contributors[]` (MVP first) |
| `battleItemCard` | Booster multipliers, gloves, mist, match-guide, thunder, extra-time | `effect` (`'gloves'` / `'mist'` / `'booster_x2'` / `'booster_x3'` / `'match_guide'` / ...), `multiplier` (2 or 3), `senderUserId`, `senderNickname`, `activatedAtSec`, `durationSec`, `endsAtSec`, `commentTemplate` |
| `roomPin` | Pinned/starred message | `user`, `comment`, `action`, `durationSeconds` |
| `envelope` | Treasure chest | `diamonds`, `user` |
| `streamEnd` | Stream ended | `reason` |
| `connected` | Connected | `uniqueId` |
| `disconnected` | Disconnected | `uniqueId` |
| `error` | Error occurred | `error` |
| `event` | Catch-all | Full raw event |

All events are fully typed with TypeScript interfaces. Your IDE will show autocompletion for every field.

### Battle / PK example

```typescript
import { TikTokLive } from 'tiktok-live-api';

const client = new TikTokLive({ uniqueId: 'creator_username', apiKey: 'tk_...' });

client.on('battle', e => console.log('PK', e.status, e.battleId, 'duration=', e.battleDuration));

client.on('battleArmies', e => {
  console.log('Countdown:', e.secsRemaining, 's');
  for (const host of e.hosts ?? []) {
    console.log(`@${host.hostUserId} team total=${host.teamTotalScore}`);
    const mvp = host.contributors[0];
    if (mvp) console.log(`  MVP @${mvp.nickname} score=${mvp.score}`);
  }
});

client.on('battleItemCard', e => {
  if (e.multiplier > 0) console.log(`x${e.multiplier} booster from @${e.senderUniqueId}`);
  else console.log(`Effect ${e.effect} from @${e.senderUniqueId} (${e.durationSec}s)`);
});

await client.connect();
```


## Live Captions (Speech-to-Text)

Transcribe and translate any TikTok LIVE stream in real-time. **This feature is unique to TikTool Live - no other TikTok library offers it.**

```typescript
import { TikTokCaptions } from 'tiktok-live-api';

const captions = new TikTokCaptions('streamer_username', {
  apiKey: 'YOUR_API_KEY',
  translate: 'en',       // translate to English
  diarization: true,     // identify who is speaking
});

captions.on('caption', (event) => {
  const speaker = event.speaker ? `[${event.speaker}] ` : '';
  console.log(`${speaker}${event.text}${event.isFinal ? ' ✓' : '...'}`);
});

captions.on('translation', (event) => {
  console.log(`  → ${event.text}`);
});

captions.on('credits', (event) => {
  console.log(`${event.remaining}/${event.total} minutes remaining`);
});

captions.connect();
```

### Caption Events

| Event | Description | Key Fields |
|-------|-------------|------------|
| `caption` | Real-time caption text | `text`, `speaker`, `isFinal`, `language` |
| `translation` | Translated caption | `text`, `sourceLanguage`, `targetLanguage` |
| `credits` | Credit balance update | `total`, `used`, `remaining` |
| `credits_low` | Low credit warning | `remaining`, `percentage` |
| `status` | Session status | `status`, `message` |

## Chat Bot Example

```typescript
import { TikTokLive } from 'tiktok-live-api';

const client = new TikTokLive('streamer_username', { apiKey: 'YOUR_API_KEY' });
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
      console.log(`  ${i + 1}. ${name} - ${diamonds} 💎`);
    });
  }
});

client.on('gift', (event) => {
  const user = event.user.uniqueId;
  const diamonds = event.diamondCount || 0;
  giftLeaderboard.set(user, (giftLeaderboard.get(user) || 0) + diamonds);
});

client.connect();
```

## TypeScript

This package ships with full TypeScript support. All events are typed:

```typescript
import { TikTokLive, ChatEvent, GiftEvent } from 'tiktok-live-api';

const client = new TikTokLive('streamer', { apiKey: 'KEY' });

// Full autocompletion - your IDE knows the type of `event`
client.on('chat', (event: ChatEvent) => {
  console.log(event.user.uniqueId);  // ✓ typed
  console.log(event.comment);        // ✓ typed
});

client.on('gift', (event: GiftEvent) => {
  console.log(event.giftName);       // ✓ typed
  console.log(event.diamondCount);   // ✓ typed
});
```

## API Reference

### `new TikTokLive(uniqueId, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.TIKTOOL_API_KEY` | Your TikTool API key |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `number` | `5` | Max reconnection attempts |

**Methods:**
- `client.on(event, handler)` - Register event handler
- `client.off(event, handler)` - Remove event handler
- `client.connect()` - Connect to stream (returns Promise)
- `client.disconnect()` - Disconnect from stream
- `client.connected` - Whether currently connected
- `client.eventCount` - Total events received

### `new TikTokCaptions(uniqueId, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.TIKTOOL_API_KEY` | Your TikTool API key |
| `translate` | `string` | `undefined` | Target translation language |
| `diarization` | `boolean` | `true` | Enable speaker identification |
| `maxDurationMinutes` | `number` | `60` | Auto-disconnect timer |

**Methods:**
- `captions.on(event, handler)` - Register event handler
- `captions.off(event, handler)` - Remove event handler
- `captions.connect()` - Start receiving captions (returns Promise)
- `captions.disconnect()` - Stop receiving captions
- `captions.connected` - Whether currently connected

## Why tiktok-live-api?

| | tiktok-live-api | tiktok-live-connector | TikTokLive (Python) |
|---|---|---|---|
| **Type** | Managed agency-grade platform | Self-hosted client | Self-hosted client |
| **Hosting** | ✓ Fully managed, 99.9% uptime | You run the client; signing via paid backend | You run the client; signing via paid backend |
| **TypeScript** | ✓ First-class, fully typed | ✓ Typed | N/A (Python) |
| **AI Live Captions (STT + translation)** | ✓ 60+ languages | ✗ | ✗ |
| **Unreal Engine plugin** | ✓ | ✗ | ✗ |
| **Gifter Intel (LTV, archetypes)** | ✓ | ✗ | ✗ |
| **Live Leaderboards (real-time)** | ✓ Regional + global | ✗ | ✗ |
| **Battle History + Per-Match Timeline** | ✓ | ✗ | ✗ |
| **League Rankings (Diamond Rush)** | ✓ | ✗ | ✗ |
| **Real-time Discord + Telegram Alerts** | ✓ | ✗ | ✗ |
| **Sniper Gap (live battle tracker)** | ✓ | ✗ | ✗ |
| **Agency CRM + Watchlists** | ✓ | ✗ | ✗ |
| **Public Profile Pages (creator + gifter)** | ✓ Indexed | ✗ | ✗ |
| **CAPTCHA Solving** | ✓ Built-in (Pro+) | Via signing backend | Via signing backend |
| **Feed Discovery** | ✓ See who's live | ✗ | ✗ |
| **Free Tier** | ✓ 2,500 req/day, 15 WS, 2h per WS | ✓ MIT-licensed | ✓ MIT-licensed |
| **ESM + CJS** | ✓ Both supported | ✓ | N/A (Python) |

## Pricing

| Tier | Requests/Day | WebSocket Connections | Price |
|------|-------------|----------------------|-------|
| Community | 2,500 | 15 (2h per WS) | Free forever |
| Pro | 75,000 | 50 (8h per WS) | from $19/wk +tax |
| Ultra | 300,000 | 250 (8h per WS) | from $69/wk +tax |
| **Global Agency** | 300,000 | 250 (8h per WS) + Firehose | $149/wk or $549/mo +tax |

Full plan details at [tik.tools/pricing](https://tik.tools/pricing). Highlights:

- **Community** ($0 forever): 2,500 req/day · 15 WS · 2 hours per connection · masked leaderboards. Designed for devs building apps - upgrade when you need real usernames. No datacenter proxies; calls must come from your own IP.
- **Pro** ($19/wk): 75K req/day · 50 WS · unmasked leaderboards · Feed Discovery · 5 AI caption streams · priority routing · chat support
- **Ultra** ($69/wk): 300K req/day · 250 WS · 20 AI caption streams · **League Rankings API** unmasked · 99.5% uptime SLA · priority chat support
- **Global Agency** ($149/wk or $549/mo): Everything in Ultra + **Live Gifter Firehose WS** (region/league/global filters, min-diamond threshold) + VIP Telegram alerts + VIP Web Vault (unmasked historical visual access)

### Live Gifter Firehose - Global Agency

Real-time gift event stream from our Dragonfly fan-out. Filter by region, league, or globally; cap by minimum diamond threshold. Mid-stream filter updates supported via `update_filter` frame, no reconnect needed.

```js
const ws = new WebSocket(
  `wss://api.tik.tools/firehose/gifters?apiKey=${KEY}&mode=region&region=US%2B&min_diamonds=1000`
)
ws.on('message', (raw) => {
  const evt = JSON.parse(raw)
  // evt: { type:'gifter_alert', ts, gifter:{username,displayName,isAnonymous},
  //        creator:{uniqueId}, gift:{name,totalDiamonds}, region }
})
// Update filter without reconnect
ws.send(JSON.stringify({ type: 'update_filter', mode: 'global', min_diamonds: 5000 }))
```

Modes: `global` (all regions), `region` (single region code), `league` (region + league class, e.g. `B2`).

## Also Available

- **Python**: [`pip install tiktok-live-api`](https://pypi.org/project/tiktok-live-api/)
- **Any language**: Connect via WebSocket: `wss://api.tik.tools?uniqueId=USERNAME&apiKey=KEY`
- **Unreal Engine**: Native C++/Blueprint plugin

## Links

- 🌐 **Website**: [tik.tools](https://tik.tools)
- 📖 **Documentation**: [tik.tools/docs](https://tik.tools/docs)
- 🐍 **Python SDK**: [pypi.org/project/tiktok-live-api](https://pypi.org/project/tiktok-live-api/)
- 💻 **GitHub**: [github.com/tiktool/tiktok-live-api](https://github.com/tiktool/tiktok-live-api)

## License

MIT
