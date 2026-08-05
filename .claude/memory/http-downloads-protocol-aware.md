---
name: http-downloads-protocol-aware
description: Downloads only speak plain http:// through initHttpRequest; appProvider.httpUtils.request is still https-only
metadata:
  type: project
---

`initHttpRequest` (`src/helper/bible-helpers/downloadHelpers.ts`) now picks
`node:http` vs `node:https` from `url.protocol` and honours `url.port` — before
2026-08-04 it hardcoded https + port 443, so plain `http://` and any non-443
port were impossible for **every** download in the app. Added for the playlist
[[playlist-archive-owapl]] **Import From URL** entry, which has to reach a LAN
server like `http://<laptop>:8000/x.owapl.tar.gz`.

**Why:** the preload exposes two functions now — `appProvider.httpUtils.request`
is STILL `https.request` only, and `requestHttp` is the plain-http one. Only
`initHttpRequest` chooses between them.

**How to apply:** route new downloads through `initHttpRequest` +
`streamDownloadFile`. Calling `appProvider.httpUtils.request` directly (as
`httpsRequestBible` in `bibleDownloadHelpers.ts` still does) silently keeps the
https-only limitation. `streamDownloadFile` takes a 4th `isSilentSuccess` arg for
flows that download into a temp dir and shouldn't toast that path.
