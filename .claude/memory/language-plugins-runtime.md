---
name: language-plugins-runtime
description: "Only English ships; every other language, Khmer and French included, is a runtime PLUGIN installed from the catalog into <data folder>/lang (electron-build/lang is still scanned, and empty), managed in Settings > Languages; the MCP reads a language only from its installed plugin; dev catalog in extra-work/lang"
metadata:
  node_type: memory
  type: project
  originSessionId: b50c561c-e7e6-4085-ac04-fe3c4e617f19
  modified: 2026-11-05T22:23:04.060Z
---

Decided 2026-11-04 by the user, in their words: _Khmer and French are modular,
only English is built in_; _electron-build\lang and <data-dir>/lang have to be
treated the same way_; _electron-build\lang is read only_; _data in
<data-dir>/lang writable, can delete and update. like `extra-bin` the
language can be searched and installed_; _when language plugin is deleted then
should fallback to english if the language selected_; the 4th language is a
right-to-left one (Hebrew), dev-mocked AND published online. Then, the same
day: _move Khmer and French to online lang data_, _everything related to a
language should be stored in the lang data_, _everything related to a
language have to be loaded from the language data (from language
installation catalog), must not ship in the app, except english_ -- and,
asked, the knowledge bundle English-only too (a language's manual and corpus
travel in its plugin).

**Why:** a language is installable without an app release, and the app's own
build (`dist/`) carries English only — one language's code, fonts and
datasets are tens of MB nobody else needs on a weak church machine.

**How to apply:**

- Every language but English lives in `src/lang/data/online/<code>/`
  (rule `language-packages.md`) as a folder of DATA made by one factory
  (`online/onlineLangPackage.ts`, layout in `online/README.md`; Khmer and
  French are the templates, 2026-11-05); `npm run lang:pack [-- --pack=<codes>]` (=
  `node extra-work/build-lang-plugins.mjs --pack`, cached in
  `node_modules/.cache/owa-lang`) builds each into a plugin and
  packs it for the catalog. NOTHING ships: `electron:build` no longer runs
  it, so a dev app starts English-only and a Khmer check starts with
  `npm run lang:pack -- --pack=km` and Settings > Languages > Install. A
  language whose source changed is packed again and updated (Refresh >
  Update to) before any live check ([[language-data-change-bumps-version]]). There are 87
  (Hebrew and 47 more since 2026-11-04 at the user's _add all well-known
  languages_, Burmese 2026-11-05, and the 36 data-only folders 2026-11-05 at
  _add all missing translation language_), each at least a `meta.json`, a
  `flag.svg` and a `dictionary.json` of EVERY key (the user: _all keys are
  translated, fail on dev for non traslated_ -- mostly machine-translated,
  no English fallback, so a missing key throws in dev); held by
  `tranKeyCoverage.test.ts` plus `online/onlineLanguages*.test.ts`. No
  language has an `index.ts` (2026-11-05, the user: _make all non-english
  languages be treated equally base on language data_): the plugin build
  writes the entry from the files the folder has. Changing one raises its
  `meta.json` version ([[language-data-change-bumps-version]]). Not
  offerable: a second Chinese (one `zh` code). A language brings its own
  `locale` and `direction` in `meta.json`; the app's generic table
  (`en/locales.json`: `allLocalesMap`, `rtlLangs`) is English's data for
  what no installed language says, so a new language edits nothing outside
  its folder. It is NOT open-lyric's song list (`en/open-lyric-locales.json`,
  the song checker's alone) -- the user: _it should be generic_.
- Plugin = `meta.json` + `<plugin>/index.js`, a FACTORY `(host) => LanguageDataType`
  loadable by `require()` (preload, `electron/client/langUtils.ts`) and as a
  `<script>` (a remote virtual-display browser, `webLangUtils.ts`). Never use
  `import.meta.url` in one: assets resolve through `host.assetUrl()`
  (`owa://local/@lang/<code>/`, served by `fsServe.ts`; `/@lang/` on the Screen
  Mirror server). `open-lyric/internal` is NOT bundled — live bindings the
  window fills via `initOpenLyricPlugins({openLyricInternal})`. A language's
  song plugin (Khmer's keyboard, spellcheck, fonts) is the LANGUAGE's own
  dependency since 2026-11-05: its own `package.json` + `node_modules`
  (`extra-work/install-lang-deps.mjs`), never the app's manifest.
- Main scans both roots (`electron/langPluginHelpers.ts`); highest version
  wins, a tie goes to the shipped copy; installs land in
  `<data folder>/lang/<code>@<version>/`. Off/on is the home setting
  `disabled-lang-codes`, never a file in a plugin folder.
- **A change in Settings applies itself** (2026-11-05, the user: _when there
  are any modification on language setting like installed removed updated
  selected new language it should apply the setting (reload the app)
  instancely_): the picker, the on/off switch, Install / Update to / Import /
  Delete in the Languages tab and the Bible line's Install / Enable
  (`BibleXMLLangPackageComp`) call `forceReloadAppWindows()` once the change
  succeeds, never `applyStore.pendingApply()`. Safe to call right after the
  write: `appHomeStorage.setItem` and the reload both go to main over
  `ipcRenderer.send` from the same window, in order, and main stores the
  setting in memory synchronously. Two exceptions on purpose: the language
  already in force reloads nothing, and a delete with files still in use
  lights Apply instead, or the reload would wipe the toast telling the person
  to close the app. The help window's `owa_language` install was left as it
  was, with no reload: a reload of every window would cut the conversation
  that offered it (not the user's decision yet -- ask before changing it).
- A window must `await ensureLangPlugins()` before reading the locale
  (`boot.ts` does); a missing or turned-off language then reads as English.
  The chatbot/aichat entries import their pages AFTER `ensureLangFiles(
  'assistant.json')`, because `chatLangHelpers` derives constants at load.
- Tests: there is no plugin in vitest — `langSourceFiles.ts` is aliased to
  `langSourceFiles.vitest.ts` (`vitest.config.ts`), which reads the checkout's
  packages (every `data/online/*/` with a `dictionary.json`, assembled by
  `loadSourceLangData` through the same factory). A test that reads `getSupportedLangCodes()` synchronously must
  `await ensureLangPlugins()` first.
- Dev catalog: `npm run lang:pack [-- --pack=km,fr --bump=he]`
  writes `extra-work/lang/info.json` + packs (gitignored; named languages
  alone when any are named); publishing is
  `npm run release:lang` (`extra-work/s3-push-lang.js`, cumulative catalog at
  `<homepage>/lang/info.json`) — outward-facing, ask first.
- A language travels as a FILE too (2026-11-04): a catalog row's **Download**
  saves its checked pack to Downloads, **Import** on Installed Languages
  installs one from disk; a file no catalog entry's checksum matches is asked
  about first. See [[pack-file-sharing]].
- The packages' duplicate-key check was O(n²) (~0.9 s per Khmer/French load);
  it is one pass now — keep it so.
- A right-to-left UI language does NOT mirror the window (the user, 2026-11-04:
  _right to left make it worse on UI_). `<html dir="rtl">` flipped every English
  Bible, verse bar, title and fallback label with it, and `direction` inherits
  into the slide previews' shadow roots. `boot.ts` → `applyUiTextDirection`
  (`src/lang/langTextDirectionHelpers.ts`) leaves `<html>` without `dir` and
  injects, for an RTL language only, a zero-specificity `unicode-bidi: plaintext`
  on every element (each text takes its own first strong letter's direction),
  sparing `[dir]` subtrees, `bdo`/`bdi`, `.app-ellipsis-left`, Monaco and SVG;
  and splits an icon's one-sided `me-1`/`ms-1` gap over both sides, width
  unchanged (the 132px settings column wraps at +2px). Never put `dir` back on
  `<html>`; give CONTENT its own `dir` instead (`BibleViewTextComp`).
- **The agent doors read a language from its INSTALLED plugin**
  (2026-11-04, `tools/owa-devtools-mcp/langPacks.mjs`): each plugin carries
  `tran.json` (its dictionary) and `manual/` + `manual/index.json` beside
  `assistant.json` / `questions.json` / `bibleBooks.json`; the in-app door
  gets main's lister of the installed, turned-on ones, the stdio door reads
  `langDirs` off the driven app's instance file (republished on every
  install, delete or toggle). The knowledge bundle is English only, with a
  `hash` per English manual page that a translation's `translatedFrom` must
  match. Seen live on a scratch profile: English alone until Khmer was
  installed, then `owa_tran` and a Khmer help search answering from the
  plugin, French answering English. Only with no app saying (a test, a
  script, an app started before this) are the checkout's sources read, and
  only those with an `assistant.json` (Khmer, French) -- the rule below over
  all fifty was ~98 KB a press and ~4 s to build.
- **The shared tables are English too** (2026-11-04, the stop-hook goal:
  _everything related to a language … must not ship in the app, except
  english_). `typed-languages.json`, `bible-source-languages.json` and the
  whole of `world-languages.json` were split into each language's
  folder -- `typed.json` (the help window, ensured by `chatbot.tsx` /
  `aichat.tsx`), `bibleSource.json` (the word study), `world.json`
  (inline; `tools/owa-devtools-mcp/worldLanguages.mjs`, a pure merge the MCP
  configures from `langPacks` and a window from `langFileStore`), 35
  languages with no package in data-only folders -- its script and
  locales too, as `order`ed rows; English's own part, `language-names.json`
  (English names) and `locales.json` (codes) moved into `src/lang/data/en/`,
  so no table beside the packages is left; `unspaced-languages.json` replaced by
  `Intl.Locale#maximize` script codes. Costs, accepted: a language not
  installed is not named when typed (answered as `other`, in its own
  words), and fewer languages weighed tied one French line with Indonesian
  on "IA" -- a word in capitals in a mixed-case line no longer counts
  (`detectTypedLanguage`). Found live 2026-11-05: a Latin-script line of a
  language not installed had read as NO language and gone out as English;
  it is `other` now when it writes letters English never does and no word
  English or an installed language claims (`englishOnlyTyped.test.ts`).
  How it was seen: a scratch dev profile, a node stand-in model named
  `gemma4:cloud` behind `OWA_LLM_REGISTRY_URL` logging each request body,
  the AI caution's Open pressed over raw CDP with the user's OK (the
  firewall refuses it, rightly) -- the language line in the logged ask is
  the proof, before and after Settings → Languages → Install.
- FIXED by that, found 2026-11-04: the MCP firewall's destructive-label rule
  knew only the knowledge bundle's languages, so an INSTALLED language's
  "Delete" was not refused; it is built from the installed languages now
  (one or two, so ~4 KB a press; all 51 sources would be ~42 KB). See
  [[mcp-interlock-reads-the-control]], [[extra-bin-on-demand]],
  [[language-is-a-computer-setting]].
- **The help window offers a missing language before it goes on**
  (2026-11-05, the user: _chatbot must ask user permission to install any
  language package that related to chatting session_). `owa_language`
  (`list` / `check` / `install`, the Languages tab's own install, run in the
  main window) is withheld from the model; the WINDOW asks `check` when a
  Bible import settles on a language or a person types _Install the Spanish
  language_, and offers **Install it** / **Not now** -- the press is the
  consent. A check that fails says nothing and the conversation goes on.
  Rules `chatbot-bible-import.md` and `agent-tools.md`. A new chat string
  is a key in all fifty packages (a script that takes each package's own
  `Settings` / `Languages` words for the path) and a version bump of each.
