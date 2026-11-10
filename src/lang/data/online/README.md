# A language is a folder of data

Every language but English lives here, one folder per language:
`src/lang/data/online/<code>/`, where `<code>` is its language code (two
letters, or three where there is no two-letter one). English is built into
the app (`../en/`); every other language is a **plugin**, built from its
folder by `extra-work/build-lang-plugins.mjs`
and installed from Settings → **Languages**. Nothing in the app names a
language: the app reads what a folder holds, and a language without a file
gets the plain behaviour that file would change.

All languages are made the same way. The folder is turned into the app's
language package by ONE factory, `onlineLangPackage.ts` (its types document
every field), and the only code a folder may hold is its song plugin
(`openLyricPlugin.ts`, below).

**No language is a template or a default.** Every language but English is
made and developed the same way (2026-11-09, the user: _all languages
development, except english, should be treated the same way_): no code,
test, script or procedure outside a folder gives one language a role the
others lack, and everything about a language lives in its folder. Each file
below is described on its own; `ls src/lang/data/online/*/<file>` shows
which packages carry one, for an example to read.

## Required: a language is these three files

| File              | What it is                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta.json`       | The manifest: `locale` (`xx-YY`), `order` (its place in the language picker, unique), `name` (English), `nativeName`, `version`, `description`, and optionally `direction: "rtl"` and `editorLink`.                 |
| `dictionary.json` | Every label of the app, English key → translation. It carries EVERY key, with no English fallback: a missing key throws in dev (`src/lang/tranKeyCoverage.test.ts`). Placeholders such as `{count}` are kept as is. |
| `flag.svg`        | Its flag, a plain 640×480 drawing: no script, no handler, no link outside itself.                                                                                                                                   |

A folder without `dictionary.json` is not a language yet: data waiting for
its labels, read by nothing.

## Optional: the files that change how the language behaves

Each is read only when present.

| File                                  | What it changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script.json`                         | How it is written: `scriptPattern` (a letter of its script), `notScriptPattern` (letters that make text another language's), `isUnspaced`, `digits` (0–9), `ignoredPattern`, `previewIgnoresSpaces`, `findingLetterPattern` (what a Bible search keeps), `systemFonts`.                                                                                                                                                                                                                                          |
| `words.json`                          | Little words a Bible search uses: `stopWords`, `bookMarkerWords` ("in" Genesis), `findFrameWords` ("find", "the story of").                                                                                                                                                                                                                                                                                                                                                                                      |
| `bibleReference.json`                 | How a reference is written: `chapterVerseSeparators`, `bookOrdinalWord` (a numbered book written with an ordinal word).                                                                                                                                                                                                                                                                                                                                                                                          |
| `bibleBooks.json`                     | The Bible's book names in the language, with the keys that find each. Without it, English's.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `bibleKeyMap.json`                    | A Bible version's key → its full title in the language.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `bb-cr.gz.bundle`                     | Its own Bible cross-references (the Reader's **Cross References**).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `location-name-map-data/`             | `namesMap.json` and `locationsMap.json`: the people and places lookup in the language.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `fonts.json` + `fonts/`               | Fonts it ships: `uiFamily` (the app's own), `family` and its `faces` (each a `weight`, and `style: "italic"` for an italic one), `display` (its CSS `font-display`; absent is the browser's `block`, labels invisible until the face loads -- English sets `swap`), `lookAlikes` (designs a document may name), `stickyNote`, `songOrder`. Drawn in FRONT of English's Google Sans (`../en/fonts.json`, the app's default on every page); without it, Google Sans and then the computer's fonts draw the script. |
| `appMenus.json`                       | Items it adds to the app's menus (a menu of the language's own tools).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `openLyricPlugin.ts` + `package.json` | Its song editor plugin (keyboard, spellcheck, word breaks): the ONE part that is code, a dependency of the folder's own `package.json` (with its `package-lock.json` and an `.npmrc`), installed by `extra-work/install-lang-deps.mjs`. The app declares none of it.                                                                                                                                                                                                                                             |

## Optional: what the assistant and the help know of it

| File               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assistant.json`   | How the help window is asked and answers in it (`src/chatbot/chatLangHelpers.ts`). Without it, a question is read through English's.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `questions.json`   | The supported-question corpus in the language, row by row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `manual/`          | The translated manual, page for page and block for block; each page names the English it was made from (`translatedFrom`).                                                                                                                                                                                                                                                                                                                                                                                                           |
| `typed.json`       | How a question TYPED in the language is told apart, for a language without an `assistant.json`: `words` holds its COMMONEST little words, shared or not (a list without them names its short lines another language, BN-33); `textSizeAsks` / `noteStyleAsks` the asks the help window does with no model -- never a word that is also a colour or a size (BN-34), nor a phrase no reader can confirm (BN-41); `words` also holds what an ASK is made of (add, at the end, make), a word two neighbours share in both lists (BN-42). |
| `world.json`       | What the Bible import and the song tools know of it in its own words (its own name, the word for "language", stop words, letters).                                                                                                                                                                                                                                                                                                                                                                                                   |
| `bibleSource.json` | What studying a Bible in it needs (marks to strip, a grammar hint).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Not shipped: kept with the language for its developers

The build leaves these out of the plugin.

| Path                           | What it is                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `tests/<path below the repo>/` | The language's own tests (`tests/lang/…`, `tests/tools/owa-devtools-mcp/….test.mjs`): they go with the language when it goes. |
| `chatbot-asks/`                | The language's eval sets for the skill scripts.                                                                               |
| `cross-ref-title-*.json`       | What `extra-work/fix-cross-ref-titles.mjs --lang=<code>` reads and writes.                                                    |
| `experiment/`                  | Data a dev experiment reads.                                                                                                  |
| `node_modules/`                | The song plugin's installed dependency (gitignored; its lockfile stands for it).                                              |

## Adding a language

1. Make `src/lang/data/online/<code>/` with `meta.json` (the next free
   `order`, `version` `0.0.1`), `dictionary.json` with every key and
   `flag.svg`. Any package that carries a file is an example of it
   (`ls src/lang/data/online/*/<file>`).
2. Add the optional files it needs, `script.json` first when its script is
   not Latin (`scriptPattern`, and `isUnspaced` / `digits` when they apply).
   A right-to-left language says `"direction": "rtl"` in `meta.json`.
3. `npm run lang:pack -- --pack=<code>`, then Settings → **Languages** →
   **Install** in the dev app.

Nothing outside the folder changes. `onlineLanguages.test.ts` and
`src/lang/tranKeyCoverage.test.ts` hold a new folder to all of this.

## Changing a language

Any change to a language's files raises `version` in its `meta.json` in the
same change, and is packed again: `npm run lang:pack -- --pack=<code>`
(bare `npm run lang:pack` for a change touching every language, such as a new
label), then Settings → **Languages** → **Refresh** → **Update to**. The app
reads the INSTALLED plugin, never this folder, so an edit that was not packed
and updated is invisible to the running app.
