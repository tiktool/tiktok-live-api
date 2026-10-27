# Changelog

## 1.5.1 - 2026-10-27

### Removed

- `TikTool.chat()` (REST client) - the endpoint it called has been retired.

### Changed

- Leaner package: build comments are no longer shipped.

## 1.5.0 - 2026-10-27

### Added

- `TikTokUser.followStatus?: number` - whether the viewer follows the streamer: 0 = not following, 1 = follows, 2 = mutual (friends). Present on chat, like, member and social users; absent on gift senders and nested users. On a follow event it is the state before that follow.
- `GiftEvent.primaryEffectId?: number` - default animation effect id of the gift (absent when none).
- `GiftEvent.colorId?: number` - colour the sender picked (1-based), only on colour-selectable gifts such as Fireworks, Paper Crane, Sunglasses.
- `GiftEvent.colorName?: string` - name of the picked colour, e.g. "Starry Blue".
- `GiftEvent.effectId?: number` - animation effect id of the picked colour; overrides `primaryEffectId` for this send.

All fields are optional and additive. Nothing was renamed or removed.
