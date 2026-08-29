---
name: lookup-language-selection
description: The names/locations lookup has its own language setting; the in-text index stays English forever and only ONE language's dataset is ever loaded
metadata:
  type: project
---

The location/name lookup picks its dataset language from
`location-name-lookup-lang-code` (`src/location-name-lookup/lookupLangHelpers.ts`),
chosen from the `en` / `km` button in the bible-lookup header — **not** from the
app locale. Added 2026-08-29.

Three things about it are easy to get wrong:

- **`fromRawDataset` normalizes EVERY language in the map it is handed, eagerly.**
  So `loadLookupData` must build `{[langCode]: data}` with exactly one entry.
  Passing every shipped package read ~70MB to serve one language. Switching
  languages therefore RELOADS rather than setting `manager.defaultLang`.
- **The in-text index (`verse-text-index.json`) is English and must stay English.**
  It matches KJV wording in rendered verse text (`TOKEN_PATTERN` is `[A-Za-z]`,
  gated to `BIBLE_KJV_KEY`), so the underlines never follow the setting. Only the
  LABELS sidecar is per-language — `verse-record-labels-<code>.json`, built by
  overlaying the translated package onto the English id list, keeping English text
  for records the translation misses (an empty label makes `toVerseRecord` drop
  the row) and always keeping the English `type` (it keys the icon map).
- **Invalidation is driven by the CHANGE, not by the next read.**
  `lookupDataHelpers` subscribes to `subscribeLookupLangCode` at module load and
  drops the held managers plus the `globalCacheManager10Seconds` entries; between
  the change and the next `acquireLookupData` there may be no consumer left to
  ask. Both it and `genLookupFileStore` carry a generation counter so a load
  already in flight cannot install itself afterwards.

Related: [[onscreen-setting-parse-amplification]], [[filesource-cache-sliding-ttl]].
