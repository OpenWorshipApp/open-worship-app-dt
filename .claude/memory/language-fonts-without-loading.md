---
name: language-fonts-without-loading
description: "A window that only DRAWS the installed languages registers their fonts from the plugin list's langFacts.json and loads no plugin (EN-59, 2026-11-10); a plugin built before it is loaded whole"
metadata:
  node_type: memory
  type: project
  originSessionId: 95345ada-ff2d-4e19-944c-32088be8df3c
  modified: 2026-11-10T13:24:59.778Z
---

`initAllLangCss` (`src/lang/langHelpers.ts`) runs at every screen window's
boot, before every song a previewer builds, and behind every font list. Since
the 2026-11-04 plugin move it loaded EVERY enabled language's whole plugin
for it (dictionary, Bible names, song plugin) and kept it for the window's
life — 1.4–2.1 MB of heap and ~10 ms a language on a fast machine, measured
on the dev profile's installed copies — to register about 2 KB of
`@font-face` CSS, none at all for a language with no `fonts.json`. Seen
live: the English Presenter held two plugins, one of whose CSS was empty.

**Why:** the screen window is the one that must stay light on an old laptop,
and the cost grew with every language a church turns on.

**How it works now:** the plugin build writes `<plugin>/langFacts.json`
(`genLangFacts` in `extra-work/build-lang-plugins.mjs`: the package's
`fonts.json` or null, each font file mapped to the asset the build wrote it
as, `hasLookupData`); it is one of `LANG_PLUGIN_INLINE_FILE_NAMES`, so it
rides in the plugin list; `src/lang/langFontDataHelpers.ts` turns it into
the font slice of `LanguageDataType` against
`appProvider.langUtils.getLangAssetBaseUrl` (the app's `owa://local/@lang/…`,
a browser viewer's own origin). Same CSS byte for byte (2 180 characters for
the one installed language with fonts, before and after) and the same song
font section — one generator, `online/langFontFaces.ts`
(`applyLangOpenLyricFontFaces` is shared with the factory).

**How to apply:**
- A caller that only needs fonts uses `initAllLangCss()`; its result is
  `LangFontDataType`, not the whole language — need a dictionary, a script
  test or book names, load the language (`getLangDataByCodeAsync`).
- A language this window already loaded for real is used as it is; a plugin
  with no (or an unreadable) facts file is loaded whole, as before, so an
  older install keeps working until it is updated.
- A change to the facts' shape is a plugin-format change: raise every
  language's version and `npm run lang:pack` (all 87), as for EN-59.
- Still loading every plugin for one small fact: the names-lookup language
  picker (`getLookupLangCodeListAsync`, needs only `hasLookupData`, already in
  the facts) and the Settings language picker. The Bible Note window loads
  them anyway for `checkIsThisLang`.

Related: [[language-plugins-runtime]], [[language-fonts-in-every-font-list]],
[[language-data-change-bumps-version]], [[renderer-entry-static-closure]].
