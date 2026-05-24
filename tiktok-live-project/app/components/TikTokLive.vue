<template>
  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background: #fff">
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb">
      <h2 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 600">TikTok Live SDK</h2>
      <p style="margin: 0; font-size: 0.875rem; color: #6b7280">
        Get your own API key and unlock unlimited connections at <a href="https://tik.tools" target="_blank" style="color: #3b82f6; text-decoration: none">tik.tools</a>
      </p>
    </div>
    <div style="padding: 24px">
      <form @submit.prevent="handleConnect" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px">
        <div>
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 6px">TikTok Username</label>
          <input type="text" v-model="inputUsername" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; box-sizing: border-box" placeholder="e.g. aljazeeraenglish" />
        </div>
        <div>
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 6px">API Key</label>
          <input type="text" v-model="apiKey" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; box-sizing: border-box; font-family: monospace" />
          <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: #9ca3af">The demo key is rate-limited. Replace with your own key for production.</p>
        </div>
        <button type="submit" style="background: #000; color: #fff; padding: 10px 16px; border-radius: 6px; border: none; font-weight: 500; cursor: pointer">Connect Stream</button>
      </form>
      <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
        <div :style="{ width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444', transition: 'background 0.3s' }"></div>
        <span style="font-size: 0.875rem; color: '#374151'; font-weight: 500">{{ connected ? 'Connected to @' + activeUsername : 'Disconnected' }}</span>
      </div>
      <div style="height: 350px; overflow-y: auto; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 0.875rem; display: flex; flex-direction: column">
        <div v-for="(e, i) in events" :key="i" style="padding: 6px 0; border-bottom: 1px solid #f3f4f6; word-break: break-word">
          {{ e }}
        </div>
        <div v-if="events.length === 0" style="color: #9ca3af; text-align: center; margin: auto 0">{{ connected ? "Waiting for events..." : "Connect to a valid stream to see events" }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const inputUsername = ref('aljazeeraenglish')
const activeUsername = ref('aljazeeraenglish')
const apiKey = ref('demo_tiktokliveapi_public_2026')
const events = ref([])

let hook = null;
try { if (typeof useTikTokLive !== 'undefined') hook = useTikTokLive; } catch (e) { }
const tiktok = hook ? hook(activeUsername, { apiKey, autoConnect: false }) : { connected: ref(false), allEvents: ref([]) }
const connected = tiktok.connected

watch(() => tiktok.allEvents.value, (all) => {
  if (all && all.length) {
    const last = all[all.length - 1];
    if (last.type === 'chat') addEvent(`💬 ${last.data.user.uniqueId}: ${last.data.comment}`)
    if (last.type === 'gift') addEvent(`🎁 ${last.data.user.uniqueId} sent ${last.data.giftName}`)
    if (last.type === 'like') addEvent(`❤️ ${last.data.user.uniqueId} liked`)
    if (last.type === 'member') addEvent(`👋 ${last.data.user.uniqueId} joined`)
    if (last.type === 'connected') addEvent('✅ Connected successfully!')
    if (last.type === 'disconnected') addEvent('❌ Disconnected from stream.')
  }
}, { deep: true })

watch(() => tiktok.error ? tiktok.error.value : null, (e) => {
  if(e) addEvent('⚠️ Error: ' + e)
})

const addEvent = (str) => {
  events.value.push(str)
  if(events.value.length > 50) events.value.shift()
}

const handleConnect = () => {
  if (tiktok.disconnect) tiktok.disconnect()
  events.value = []
  activeUsername.value = inputUsername.value
  if (!activeUsername.value) return
  if (tiktok.connect) {
    tiktok.connect().catch(e => addEvent('⚠️ Failed: ' + e.message))
  }
}

onMounted(() => {
  handleConnect()
})
</script>
