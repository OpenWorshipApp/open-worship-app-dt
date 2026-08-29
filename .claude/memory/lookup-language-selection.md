---
name: lookup-language-selection
description: The names/locations lookup has its own language setting; the in-text index stays English forever, only ONE language's dataset is ever loaded, and a translated record shows and is searchable by its English name
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

**A translated record carries its ENGLISH name (`kjvName`), added 2026-08-29.**
`bible-note` 0.4.0-dev parses it and folds it into the same `searchText` as
`name`/`oldName` (ranked `min(rank(name), rank(kjvName))`), so **searching in
either language is the DEP's job, not the app's** — do not build a second index
for it. The app only RENDERS it, `ម៉ូសេ (Moses)`, through one helper:

- `getRecordKjvName` / `getRecordDisplayName` live in `lookupPresentationHelpers`
  and deliberately REIMPLEMENT `bible-note`'s `getMentionKjvName` rather than
  import it — a value import would put that ~46MB graph in the eager chunk of
  every surface that renders before the dataset loads. Same reason as
  `normalizeNameType` right above them.
- Both return nothing when `kjvName` is empty or equals `name`, which is what
  keeps the English dataset from printing `Moses (Moses)`.
- The "in your reading" list has no manager, so it reads a `kjvNames` array in
  the labels sidecar. `verseTextIndexBuilder` fills it from the ENGLISH label the
  first pass already wrote, NOT from the translated package's `kjvName` field —
  that covers a record the translation misses too. `LOOKUP_TEXT_INDEX_VERSION`
  went to 3 for it, and `checkIsRecordLabelsValid` length-checks it like the
  other arrays.
- The in-text underlines are untouched: they match KJV wording, already English.

The language also decides how the records are WRITTEN, not only their words
(`useLookupLangPresentation`): the three surfaces take its `fontFamily`
(`app-Battambang` for km; English names none, so nothing is forced) — the detail
widget's TITLE BAR separately, since it renders in `FloatingWidgetComp` chrome
OUTSIDE the body, and NOT for a verse panel, whose title is a KJV reference —
and the
name TYPE is translated through `tranByLangData` — the datasets keep `type`,
`gender` and `age` in English in EVERY language, so `type` reaches the panel as
a key. Only `type` is translatable: it is one of nine enum values, while `age`
is free text ("123 years") and a LOCATION's type is open-ended prose.
Two traps there:

- `tranByLangData` must NOT throw on a missing key the way `tran` does. The
  interface locale is guaranteed complete; a language picked for its DATA is
  not, and blanking the panel over one category label is the worse failure.
- Guard `unknown` on the ENGLISH key and translate afterwards. Both the fact-chip
  filter and `checkHasDetailValue` compare the string to `'unknown'`, so
  translating first gives an untyped record a `មិនស្គាល់` chip it does not have
  in English.

A non-English lookup language also re-reads the stored VERSE references in the
bible the reader is showing (`toLookupVerseBibleKey` in `bibleVerseHelpers`).
Safe because the dataset's keys and the app's targets are both canonical —
`bibleRenderHelper.toTitle` localizes book name and numerals per bible key
without renumbering — so it is a rendering choice only. English stays KJV (the
dataset was extracted from it), and the chapter READ behind the in-text scan is
always KJV. Watch out for:

- A verse panel's TITLE came from `panel.name`, frozen when the panel opened, so
  a language change re-titled the body and left the chrome on the old bible. It
  is driven by what the body resolved now.
- That title takes the BIBLE's font (`useLookupVerseFontFamily`), not the lookup
  language's — two independent settings.
- The ` (KJV)` suffix on "names and locations in your reading" is shown only
  while the heading is actually a KJV title.
- A record's PROSE cites the bible in three schemes, not one — `book-key://ACT`,
  `chapter-key://GEN 14`, `verse-key://ACT 28:15` (dataset version 71 added the
  first two) — and every one of them is re-titled the same way
  (`shortToReferenceTitle`): book from that bible's book map, chapter through its
  numerals. A book or a chapter renders as PROSE, not a button — there is no verse
  text behind it to open. Resolution is SKIPPED while the bible is the KJV, which
  is what keeps English free.
- The scheme list lives in ONE place (`REFERENCE_TOKEN_SCHEME_LIST`) because two
  regexes consume it — the renderer's and `getPlainReferenceText`'s stripper. A
  scheme missing from either shows its raw `[label](scheme://key)` markup on
  screen, which is exactly how `book-key` arrived.
- The list SUMMARIES (search rows, "in your reading", hover titles) go through the
  stripper, so a token there keeps its stored English label whatever the lookup
  language is. Only a detail BODY re-reads them.

Related: [[onscreen-setting-parse-amplification]], [[filesource-cache-sliding-ttl]],
[[tran-missing-key-throws-in-dev]].
