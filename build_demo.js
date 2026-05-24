const fs = require('fs');

const E_lit = 'String.fromCharCode(27)';
const E = String.fromCharCode(27);

let REACT_TEMPLATE = \`"use client";
import React, { useEffect, useState } from 'react';
import { TikTokLive } from 'tiktok-live-api';

export default function TikTokLiveComponent() {
  const [events, setEvents] = useState([]);
  const [username, setUsername] = useState('aljazeeraenglish');
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const client = new TikTokLive(username, { apiKey: 'demo_tiktokliveapi_public_2026' });
    
    client.on('chat', (e) => setEvents(prev => [...prev.slice(-20), "💬 " + e.user.uniqueId + ": " + e.comment]));
    client.on('gift', (e) => setEvents(prev => [...prev.slice(-20), "🎁 " + e.user.uniqueId + " sent " + e.giftName]));
    client.on('connected', () => setConnected(true));
    client.on('disconnected', () => setConnected(false));
    
    client.connect();
    return () => client.disconnect();
  }, [username]);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 400, margin: '40px auto', border: '1px solid #e5e7eb', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 600 }}>TikTok Live SDK Test</h2>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }}></div>
        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{connected ? 'Connected to @' + username : 'Disconnected'}</span>
      </div>
      <div style={{ height: 320, overflowY: 'auto', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
        {events.map((e, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>{e}</div>)}
        {events.length === 0 && <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: 120 }}>Waiting for events...</div>}
      </div>
    </div>
  );
}\`;

let VUE_TEMPLATE = \`<template>
  <div style="font-family: sans-serif; max-width: 400px; margin: 40px auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)">
    <h2 style="margin: 0 0 16px 0; font-size: 1.25rem; font-weight: 600">TikTok Live SDK Test</h2>
    <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
      <div :style="{ width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }"></div>
      <span style="font-size: 0.875rem; color: '#374151'">{{ connected ? 'Connected to @' + username : 'Disconnected' }}</span>
    </div>
    <div style="height: 320px; overflow-y: auto; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 0.875rem">
      <div v-for="(e, i) in events" :key="i" style="padding: 6px 0; border-bottom: 1px solid #f3f4f6">
        {{ e }}
      </div>
      <div v-if="events.length === 0" style="color: #9ca3af; text-align: center; margin-top: 120px">Waiting for events...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { TikTokLive } from 'tiktok-live-api'

const username = ref('aljazeeraenglish')
const connected = ref(false)
const events = ref([])
let client = null

onMounted(() => {
  client = new TikTokLive(username.value, { apiKey: 'demo_tiktokliveapi_public_2026' })
  
  client.on('chat', (e) => {
    events.value.push("💬 " + e.user.uniqueId + ": " + e.comment)
    if (events.value.length > 20) events.value.shift()
  })
  
  client.on('gift', (e) => {
    events.value.push("🎁 " + e.user.uniqueId + " sent " + e.giftName)
    if (events.value.length > 20) events.value.shift()
  })

  client.on('connected', () => connected.value = true)
  client.on('disconnected', () => connected.value = false)
  
  client.connect()
})

onUnmounted(() => {
  if (client) client.disconnect()
})
</script>\`;

const appVue = \`"<template>\\n  <div style=\\"min-height: 100vh; background: #fdfdfd; padding-top: 40px;\\">\\n    <TikTokLive />\\n  </div>\\n</template>\\n"\`;

const pageJs = \`"import TikTokLive from '@/components/TikTokLive';\\n\\nexport default function Home() {\\n  return (\\n    <main className=\\"min-h-screen bg-neutral-50 pt-10\\">\\n      <TikTokLive />\\n    </main>\\n  );\\n}\\n"\`;

const appJsx = \`"import TikTokLive from './components/TikTokLive';\\n\\nexport default function App() {\\n  return (\\n    <div style={{ minHeight: '100vh', background: '#fdfdfd', paddingTop: '40px' }}>\\n      <TikTokLive />\\n    </div>\\n  );\\n}\\n"\`;

let lines = [
  "#!/usr/bin/env node",
  "",
  "import WebSocket from 'ws';",
  "import readline from 'readline';",
  "import { execSync } from 'child_process';",
  "import fs from 'fs';",
  "import path from 'path';",
  "",
  "// \u2500\u2500 Boilerplate Components \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "",
  "const REACT_TEMPLATE = \`" + REACT_TEMPLATE.replace(/\`/g, "\\\`").replace(/\\$/g, "\\\\$") + "\`;",
  "",
  "const VUE_TEMPLATE = \`" + VUE_TEMPLATE.replace(/\`/g, "\\\`").replace(/\\$/g, "\\\\$") + "\`;",
  "",
  "const E = " + E_lit + ";",
  "const R  = E + \"[0m\";",
  "const B  = E + \"[1m\";",
  "const D  = E + \"[2m\";",
  "const C  = { ",
  "  cyan: E + \"[38;5;80m\",  green: E + \"[38;5;114m\", yellow: E + \"[38;5;222m\",",
  "  mag:  E + \"[38;5;176m\", blue:  E + \"[38;5;111m\", red:    E + \"[38;5;203m\",",
  "  gray: E + \"[38;5;242m\", white: E + \"[38;5;252m\", pink:   E + \"[38;5;218m\",",
  "};",
  "",
  "// \u2500\u2500 Interactive Prompt \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "",
  "const args = process.argv.slice(2);",
  "const isInteractive = args.length === 0;",
  "",
  "if (!isInteractive) {",
  "  runDemo();",
  "} else {",
  "  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });",
  "",
  "  console.log(\"\\n  \" + B + \"tiktok-live-api\" + R + \"\\n  Unofficial TikTok LIVE SDK by TikTool\\n\");",
  "  console.log(\"  What would you like to do?\");",
  "  console.log(\"  1) \" + C.cyan + \"Watch Live Terminal Demo\" + R + \" (Default)\");",
  "  console.log(\"  2) \" + C.green + \"Scaffold a Nuxt 3 (Vue) App\" + R);",
  "  console.log(\"  3) \" + C.blue + \"Scaffold a Next.js (React) App\" + R);",
  "  console.log(\"  4) \" + C.yellow + \"Scaffold a Vite (React) App\" + R + \"\\n\");",
  "",
  "  const timeoutId = setTimeout(() => {",
  "    console.log(D + \"\\r  No input received. Auto-starting Terminal Demo...\" + R + \"\\n\");",
  "    rl.close();",
  "    runDemo();",
  "  }, 10000);",
  "",
  "  rl.question(\"  Choose [1-4]: \", (answer) => {",
  "    clearTimeout(timeoutId);",
  "    handleMenu(answer.trim() || '1');",
  "  });",
  "",
  "  function handleMenu(choice) {",
  "    if (choice === '1') {",
  "      rl.close();",
  "      return runDemo();",
  "    }",
  "    ",
  "    if (!['2', '3', '4'].includes(choice)) {",
  "      console.log(\"  \" + C.red + \"Invalid choice.\" + R);",
  "      rl.close();",
  "      process.exit(1);",
  "    }",
  "",
  "    rl.question(\"\\n  Target directory (e.g. ./my-app) [./tiktok-live-project]: \", (dir) => {",
  "      dir = dir.trim() || './tiktok-live-project';",
  "      rl.close();",
  "      runScaffold(choice, dir);",
  "    });",
  "  }",
  "}",
  "",
  "// \u2500\u2500 Scaffolding Logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "",
  "function runScaffold(choice, targetDir) {",
  "  const isNuxt = choice === '2';",
  "  const isNext = choice === '3';",
  "  const isVite = choice === '4';",
  "  const fullPath = path.resolve(process.cwd(), targetDir);",
  "",
  "  console.log(\"\\n  \" + B + \"🚀 Scaffolding project into \" + targetDir + \"...\" + R + \"\\n\");",
  "  ",
  "  try {",
  "    if (isNuxt) {",
  "      execSync('npx --yes nuxi@latest init \"' + targetDir + '\" --packageManager npm', { stdio: 'inherit' });",
  "    } else if (isNext) {",
  "      execSync('npx --yes create-next-app@latest \"' + targetDir + '\" --js --eslint --tailwind --app --src-dir --import-alias \"@/*\" --use-npm', { stdio: 'inherit' });",
  "    } else if (isVite) {",
  "      execSync('npm create vite@latest \"' + targetDir + '\" -- --template react', { stdio: 'inherit' });",
  "    }",
  "",
  "    console.log(\"\\n  \" + B + \"📦 Installing \" + C.cyan + \"tiktok-live-api\" + B + \" SDK...\" + R + \"\\n\");",
  "    execSync('npm install tiktok-live-api', { cwd: fullPath, stdio: 'inherit' });",
  "    ",
  "    // Inject components based on framework",
  "    if (isNuxt) {",
  "      const compDir = path.join(fullPath, 'components');",
  "      if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });",
  "      fs.writeFileSync(path.join(compDir, 'TikTokLive.vue'), VUE_TEMPLATE);",
  "      ",
  "      const appVue = path.join(fullPath, 'app.vue');",
  "      if (fs.existsSync(appVue)) {",
  "        fs.writeFileSync(appVue, " + appVue + ");",
  "      }",
  "    } else if (isNext) {",
  "      const compDir = path.join(fullPath, 'src', 'components');",
  "      if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });",
  "      fs.writeFileSync(path.join(compDir, 'TikTokLive.jsx'), REACT_TEMPLATE);",
  "      ",
  "      const pageJs = path.join(fullPath, 'src', 'app', 'page.js');",
  "      if (fs.existsSync(pageJs)) {",
  "        fs.writeFileSync(pageJs, " + pageJs + ");",
  "      }",
  "    } else if (isVite) {",
  "      const compDir = path.join(fullPath, 'src', 'components');",
  "      if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });",
  "      fs.writeFileSync(path.join(compDir, 'TikTokLive.jsx'), REACT_TEMPLATE);",
  "      ",
  "      const appJsx = path.join(fullPath, 'src', 'App.jsx');",
  "      if (fs.existsSync(appJsx)) {",
  "        fs.writeFileSync(appJsx, " + appJsx + ");",
  "      }",
  "    }",
  "",
  "    console.log(\"\\n  \" + C.green + \"✔ Project successfully scaffolded!\" + R + \"\\n\");",
  "    console.log(\"  \" + B + \"Next steps:\" + R);",
  "    console.log(\"    cd \" + targetDir);",
  "    console.log(\"    npm run dev\\n\");",
  "",
  "  } catch (err) {",
  "    console.error(\"\\n  \" + C.red + \"Error during scaffolding:\" + R, err.message);",
  "    process.exit(1);",
  "  }",
  "}",
  "",
  "// \u2500\u2500 Terminal Demo Logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "",
  "async function runDemo() {",
  "  const WS_BASE = 'wss://api.tik.tools';",
  "  const DEMO_KEY = 'demo_tiktokliveapi_public_2026';",
  "  const CHANNELS = [",
  "    'aljazeeraenglish', 'cgtnofficial', 'france24_en',",
  "    'weathernewslive', 'gbnews', 'bbcnews',",
  "    'skynews', 'tv_asahi_news', 'abc7chicago', 'thairath_news',",
  "  ];",
  "",
  "  const TAG = {",
  "    chat:   C.cyan + \"chat\" + R,",
  "    gift:   C.yellow + \"gift\" + R,",
  "    like:   C.mag + \"like\" + R,",
  "    member: C.green + \"join\" + R,",
  "    follow: C.green + \"follow\" + R,",
  "    viewer: C.blue + \"viewers\" + R,",
  "    share:  C.white + \"share\" + R,",
  "  };",
  "",
  "  let target = '';",
  "  let apiKey = DEMO_KEY;",
  "  for (let i = 0; i < args.length; i++) {",
  "    const a = args[i];",
  "    if (a === '--key' || a === '-k') { apiKey = args[++i] || DEMO_KEY; }",
  "    else if (a === '--help' || a === '-h') { help(); process.exit(0); }",
  "    else if (!a.startsWith('-')) { target = a.replace(/^@/, ''); }",
  "  }",
  "",
  "  function help() {",
  "    console.log(\"\\n  \" + B + \"tiktok-live-api\" + R + \"  \" + D + \"Real-time TikTok Live SDK\" + R);",
  "    console.log(\"\\n  \" + B + \"Usage\" + R);",
  "    console.log(\"    \" + C.cyan + \"npx tiktok-live-api\" + R + \"                  \" + D + \"interactive menu (demo or scaffold)\" + R);",
  "    console.log(\"    \" + C.cyan + \"npx tiktok-live-api\" + R + \" \" + C.white + \"@username\" + R + \"        \" + D + \"connect to a specific user\" + R);",
  "    console.log(\"    \" + C.cyan + \"npx tiktok-live-api\" + R + \" \" + C.gray + \"--key KEY\" + R + \"        \" + D + \"use your own API key\" + R);",
  "    console.log(\"\\n  \" + D + \"Unofficial API by TikTool \u00B7 https://tik.tools\" + R + \"\\n\");",
  "  }",
  "",
  "  function probe(uid, ms = 8000) {",
  "    return new Promise(resolve => {",
  "      const ws = new WebSocket(\`\${WS_BASE}?uniqueId=\${uid}&apiKey=\${apiKey}\`);",
  "      const t = setTimeout(() => { ws.close(); resolve(null); }, ms);",
  "      ws.on('message', () => { clearTimeout(t); resolve(ws); });",
  "      ws.on('error',   () => { clearTimeout(t); resolve(null); });",
  "      ws.on('close',   () => { clearTimeout(t); });",
  "    });",
  "  }",
  "",
  "  function ts() {",
  "    const d = new Date();",
  "    return C.gray + String(d.getHours()).padStart(2,'0') + \":\" + String(d.getMinutes()).padStart(2,'0') + \":\" + String(d.getSeconds()).padStart(2,'0') + R;",
  "  }",
  "",
  "  function fmt(event, data) {",
  "    const tag = TAG[event] || (C.gray + event.padEnd(7) + R);",
  "    const u = data.user?.uniqueId || '';",
  "    const pad = tag.length < 20 ? '  ' : ' ';",
  "",
  "    switch (event) {",
  "      case 'chat': return ts() + \" \" + tag + pad + \"  \" + B + u + R + \"  \" + (data.comment || '');",
  "      case 'gift': return ts() + \" \" + tag + pad + \"  \" + B + u + R + \"  \" + C.yellow + (data.giftName || 'gift') + R + \" x\" + (data.repeatCount || 1) + \" \" + D + \"(\" + (data.diamondCount || 0) + \"💎)\" + R;",
  "      case 'like': return ts() + \" \" + tag + pad + \"  \" + B + u + R + \"  \" + D + \"total \" + (data.totalLikeCount || 0).toLocaleString() + R;",
  "      case 'member': return ts() + \" \" + tag + pad + \"  \" + C.green + u + R;",
  "      case 'follow': return ts() + \" \" + tag + \"  \" + C.green + u + R;",
  "      case 'roomUserSeq':",
  "      case 'viewer': return ts() + \" \" + TAG.viewer + \"  \" + B + (data.viewerCount || 0).toLocaleString() + R;",
  "      case 'share': return ts() + \" \" + tag + \" \" + u;",
  "      default: return null;",
  "    }",
  "  }",
  "",
  "  console.log(\"\\n  \" + B + \"tiktok-live-api\" + R + \"  \" + D + \"\u00B7\" + R + \"  \" + D + \"Real-time TikTok Live events\" + R);",
  "  console.log(\"  \" + D + \"Unofficial API by TikTool \u00B7 https://tik.tools\" + R + \"\\n\");",
  "",
  "  let ws = null, who = '';",
  "",
  "  if (target) {",
  "    process.stdout.write(\"  \" + D + \"connecting to\" + R + \" \" + B + \"@\" + target + R + \" \" + D + \"...\" + R);",
  "    ws = await probe(target);",
  "    if (ws) { who = target; console.log(\" \" + C.green + \"●\" + R); }",
  "    else { console.log(\" \" + C.red + \"✗\" + R + \"\\n\\n  \" + C.red + \"Stream not found.\" + R + \" Make sure \" + B + \"@\" + target + R + \" is live.\\n\"); process.exit(1); }",
  "  } else {",
  "    console.log(\"  \" + D + \"scanning for live streams...\" + R + \"\\n\");",
  "    for (const uid of CHANNELS) {",
  "      process.stdout.write(\"  \" + C.gray + \"@\" + uid + R);",
  "      ws = await probe(uid);",
  "      if (ws) { who = uid; console.log(\"  \" + C.green + \"● live\" + R); break; }",
  "      else { console.log(\"  \" + D + \"-\" + R); }",
  "    }",
  "    if (!ws) {",
  "      console.log(\"\\n  \" + C.red + \"No live streams found.\" + R + \" Try: \" + C.cyan + \"npx tiktok-live-api @username\" + R + \"\\n\");",
  "      console.log(\"  \" + D + \"Get your own API key at\" + R + \" \" + C.cyan + \"https://tik.tools\" + R + \"\\n\");",
  "      process.exit(1);",
  "    }",
  "  }",
  "",
  "  console.log(\"\\n  \" + C.green + \"●\" + R + \" \" + B + \"@\" + who + R + \"  \" + D + \"- streaming events. Ctrl+C to stop.\" + R);",
  "  console.log(\"  \" + D + \"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\" + R + \"\\n\");",
  "",
  "  let count = 0;",
  "  ws.on('message', raw => {",
  "    try {",
  "      const m = JSON.parse(raw.toString());",
  "      const line = fmt(m.event || 'unknown', m.data || m);",
  "      if (line) { count++; console.log(\"  \" + line); }",
  "    } catch {}",
  "  });",
  "",
  "  ws.on('close', () => {",
  "    console.log(\"\\n  \" + D + \"disconnected - \" + B + count + R + D + \" events received\" + R);",
  "    console.log(\"  \" + D + \"Get unlimited access:\" + R + \" \" + C.cyan + \"https://tik.tools\" + R + \"\\n\");",
  "    process.exit(0);",
  "  });",
  "",
  "  ws.on('error', e => console.error(\"  \" + C.red + \"error\" + R + \" \" + e.message));",
  "  process.on('SIGINT', () => {",
  "    console.log(\"\\n\\n  \" + D + \"stopped - \" + B + count + R + D + \" events received\" + R);",
  "    console.log(\"  \" + D + \"Get unlimited access:\" + R + \" \" + C.cyan + \"https://tik.tools\" + R + \"\\n\");",
  "    ws.close();",
  "    process.exit(0);",
  "  });",
  "}",
];

fs.writeFileSync('bin/demo.mjs', lines.join("\\n"));
