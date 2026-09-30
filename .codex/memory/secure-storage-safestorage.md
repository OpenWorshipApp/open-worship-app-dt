---
name: secure-storage-safestorage
description: Credentials live in a SECOND store (appSecureStorage → safeStorage), split field-by-field from the plaintext one; legacy cleartext is scrubbed on launch, never migrated
metadata:
  type: project
---

Every settings module that holds a credential is split across **two** storage
keys (2026-08-24, branch enhance-after-release):

| plaintext (`appHomeStorage`) | encrypted (`appSecureStorage`) |
| --- | --- |
| `ai-setting` → `isAutoPlay` | `ai-setting-secret` → `openAIAPIKey`, `anthropicAPIKey` |
| `song-select-setting` → `clientId`, `redirectUri`, `accessTokenExpiresAt`, `isDevMock` | `song-select-setting-secret` → `clientSecret`, `subscriptionKey`, `accessToken`, `refreshToken` |

`appSecureStorage` (`src/server/appSecureStorage.ts`) mirrors `appHomeStorage`
exactly but rides `main:app:secure-setting` → `ElectronSettingManager`'s
`secureSetting` map, whose values are base64 `safeStorage.encryptString` blobs.
Both maps live in the same `userData/setting.json`.

**Why the shape matters:**

- `getAISetting()` / `getSongSelectSetting()` / their setters / their hooks kept
  IDENTICAL signatures and merge the halves, so no consumer changed — the
  wholesale `vi.mock('./songSelectSettingHelpers')` in four existing test files
  still passes untouched, which is the proof the split is call-site-invisible.
- **No renderer-side cache, deliberately.** Refresh tokens are one-time-use and
  rotated, so a second window holding a cached copy would present a token the
  server already retired. The decrypt cost is absorbed by a cache on the MAIN
  side (`secureCache`), bounded at one entry per secure key.
- `save(isImmediate)` exists for this: `genTimeoutAttempt` reschedules by
  clearing the pending timer, so a burst of window move/resize events can starve
  the write indefinitely. Every secure write passes `true`. Do not extend that to
  the plaintext path.
- `setSecureSetting` **returns** on a non-string rather than copying
  `setClientSetting`'s coerce-to-`null` — storing null over a credential is worse
  than a no-op.

**How to apply:**

- Legacy cleartext is **scrubbed on every launch and never migrated**
  (`scrubLegacyPlaintextSecrets`, called from the `ElectronSettingManager`
  constructor). A machine upgrading into this build starts with no API key and
  signed out of SongSelect — that is designed, not a regression. The scrub also
  resets the fields that depend on a removed secret (`isAutoPlay` → false,
  `accessTokenExpiresAt` → 0), or they become lies the app reads back.
- Scrubbing belongs in MAIN, not renderer getters: the getters may never run, and
  4+ renderers racing on the settings file is the corruption class in
  [[settings-write-race-corrupts-onscreen-map]].
- Blobs are bound to the OS user/machine. A copied profile makes `decryptString`
  throw; `getSecureSetting` catches, **deletes the unreadable entry**, and returns
  null so the UI reads "not set" rather than a green tick over a dead credential.
- `checkIsSafeStorageAvailable()` rejects Linux's `basic_text` backend (hardcoded
  key = obfuscation) and anything before `app.isReady()`. When unavailable the
  value is kept in main memory for the session and NEVER written, a stale blob for
  that key is deleted, and both Settings cards render
  `SettingOthersSecureStorageWarningComp`.
- Honest scope: `contextIsolation: false` + `nodeIntegration: true` means renderer
  code already has full access, and the SDKs still run in the renderer with
  `dangerouslyAllowBrowser`. This protects secrets **at rest** only. It is also
  not a secure erase — tell users to ROTATE, not just re-enter.
- The scrub's field lists duplicate the renderer ones on purpose (`electron/` and
  `src/` are separate tsconfig projects sharing no modules). Change both together.
