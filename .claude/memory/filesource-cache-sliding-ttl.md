---
name: filesource-cache-sliding-ttl
description: CacheManager expiry used to be sliding — every read pushed the timestamp forward, so a frequently-read entry never expired (fixed 2026-08-06)
metadata:
  type: project
---

`CacheManager.getSync` (`src/others/CacheManager.ts`) used to do
`cacheItem.timestamp = Date.now()` on a cache HIT, which made every `expirationSecond` in
the app a **sliding** expiry rather than an absolute one: anything asked for more often than
its own TTL never expired at all. `FileSource`'s `fileDataCacheManager` is a 2-second cache,
so any file re-read on a timer stayed cached indefinitely.

**Fixed 2026-08-06** — the timestamp is now set only on write, with a regression test
("expiry is absolute: reading does not extend an entry lifetime").

**Why:** it contradicted CLAUDE.md's "caches must be short-lived; never accumulate
long-lived caches", and it is an easy thing to reintroduce while "optimising".

**How to apply:** when adding or reviewing a cache here, check whether the reader touches
the timestamp — an "expiring" cache with an LRU-style refresh is immortal under load. Note
this was NOT the cause of the stale-playlist symptom it was first blamed for; that was
[[playlist-reads-editing-history-head]].
