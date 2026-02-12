<div align="center">

# @tiktool/live

### Connect to any TikTok LIVE stream in 3 lines of code.

[![npm version](https://img.shields.io/npm/v/@tiktool/live?color=%23ff0050&label=npm&logo=npm)](https://www.npmjs.com/package/@tiktool/live)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)

Real-time chat, gifts, viewers, battles, follows & 18+ event types from any TikTok livestream.

**No API key required** · **Zero config** · **Direct connection**

[Quick Start](#-quick-start) · [Events](#-events) · [API](#-api-reference) · [Rate Limits](#-rate-limits)

</div>

---

## ⚡ Quick Start

```bash
npm install @tiktool/live
```

```typescript
import { TikTokLive } from '@tiktool/live';

const live = new TikTokLive({ uniqueId: 'tv_asahi_news' });

live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
live.on('gift', e => console.log(`${e.user.uniqueId} sent ${e.giftName} (${e.diamondCount} diamonds)`));
live.on('member', e => console.log(`${e.user.uniqueId} joined`));
live.on('roomUserSeq', e => console.log(`Viewers: ${e.viewerCount}`));

await live.connect();
```

No API key, no configuration, no server setup. Install and connect.

---

## How It Works

```
    Your App                    tik.tools                    TikTok
  +-----------+              +--------------+           +--------------+
  |          -+-- sign_url -->  Signs URL   |           |              |
  |  Your   <-+-- X-Bogus --|  with params |           |   TikTok     |
  |  Code    |              |              |           |   WebSocket  |
  |          -+------------ Connect directly ---------->|   Server     |
  |          <-+------------ Live events (protobuf) <---|              |
  +-----------+              +--------------+           +--------------+
                            ^ Only interaction             ^ Direct from
                              with our server                YOUR IP
```

- Your app connects directly to TikTok from your IP address
- The sign server only generates cryptographic signatures
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

## API Reference

### `new TikTokLive(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uniqueId` | `string` | — | TikTok username (without @) |
| `signServerUrl` | `string` | `https://api.tik.tools` | Sign server URL |
| `apiKey` | `string` | — | API key for higher rate limits |
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

| Tier | Rate Limit | API Key | Price |
|------|-----------|---------|-------|
| Free | 5 signs/min | No | Free |
| Basic | 30 signs/min | Yes | Free (with key) |
| Premium | 120 signs/min | Yes | Coming soon |

Most users only need the free tier. The SDK calls the sign server once per connection, then stays connected via WebSocket.

### Using an API Key

```typescript
const live = new TikTokLive({
    uniqueId: 'username',
    apiKey: 'your-api-key',
});
```

---

## Examples

### Chat Bot

```typescript
import { TikTokLive } from '@tiktool/live';

const live = new TikTokLive({ uniqueId: 'streamer_name' });

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
const live = new TikTokLive({ uniqueId: 'streamer_name' });

live.on('event', (event) => {
    for (const client of wss.clients) {
        client.send(JSON.stringify(event));
    }
});

await live.connect();
console.log('Forwarding events to ws://localhost:8080');
```

### Gift Tracker

```typescript
import { TikTokLive } from '@tiktool/live';

const live = new TikTokLive({ uniqueId: 'streamer_name' });
let totalDiamonds = 0;

live.on('gift', (e) => {
    if (e.repeatEnd || !e.combo) {
        const diamonds = e.diamondCount * (e.repeatCount || 1);
        totalDiamonds += diamonds;
        console.log(`${e.user.uniqueId}: ${e.giftName} = ${diamonds} diamonds (Total: ${totalDiamonds})`);
    }
});

await live.connect();
```

---

## TypeScript

Full TypeScript support with type inference:

```typescript
import { TikTokLive, ChatEvent, GiftEvent } from '@tiktool/live';

const live = new TikTokLive({ uniqueId: 'username' });

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
