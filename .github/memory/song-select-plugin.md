---
name: song-select-plugin
description: CCLI SongSelect integration lives in src/plugins/song-select (user wants plugin isolation); OAuth rides main:app:oauth-authorize, refresh tokens are one-time-use, and the real-credential path is UNVERIFIED
metadata:
  type: project
---

The SongSelect integration (2026-08-24, branch enhance-after-release) keeps ALL
its frontend in `src/plugins/song-select/` — the user explicitly asked for
plugin-style isolation, so new song-select code belongs there, not in feature
dirs. Only three outside touchpoints: `SettingOthersComp` (renders
`SettingOthersSongSelectComp` from the plugin dir), `VaryAppDocumentListComp`
(gated "Import From SongSelect" menu item + popup state; the menu item is
gated by `checkIsSongSelectSignedIn(getSongSelectSetting())` read fresh per
menu build — sign-out hides it with no reload), and
`electron/electronEventListener.ts` registering `main:app:oauth-authorize` →
`electron/oauthHelpers.ts` `captureOAuthRedirectUrl` (generic: authorize URL +
redirect-prefix in, full redirected URL out; window closed → rejects with
`Sign in window was closed`, which the renderer maps to the "canceled" toast
by message match — keep the two strings in sync).

**Why the shape matters:** CCLI refresh tokens are ONE-TIME USE and rotated —
`getFreshAccessToken` single-flights concurrent refreshes and persists the
rotated token immediately; a second window refreshing in parallel can still
burn one (accepted v1 risk). All API calls are plain renderer `fetch` (the
`Ocp-Apim-Subscription-Key` header is whitelisted in `electron/fsServe.ts`).
`Lyric.createWithContent` (not create-then-`setContent`) lands imported
markdown clean on disk. Since 2026-08-24 the client secret, subscription key
and BOTH tokens live in a separate encrypted store — see
[[secure-storage-safestorage]]; `clientId`/`redirectUri` stay plaintext, and
`getSongSelectSetting()` merges the two halves, so callers saw no change.

**How to apply:** CCLI retired new partner signups, so the REAL sign-in +
api.ccli.com path has never run — verified against mocks only (matrix ST-52 /
PL-103 / PL-104, workflow W-35). To re-verify in dev, do NOT hand-inject
tokens or patch fetch: click **`(dev) Use Mock Data`** beside Sign In
(added 2026-08-24 at the user's request) — it writes fake credentials +
`isDevMock: true` and `songSelectApiHelpers` then serves the canned 13-song
catalog in `songSelectDevMockData.ts` (lazy-loaded; `How Great Thou Art` =
unauthorized-disabled row, `Instrumental Reflection` = no-lyrics row) with
zero network. Sign Out in mock mode resets the WHOLE setting, and the flag is
double-gated on `appProvider.systemUtils.isDev`. The Settings card's own
status still only re-reads in its window after reload (AI-key precedent).
Delete the imported `.owl` test files afterwards.
