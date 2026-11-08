# A language is a folder of data

Every language but English lives here, one folder per language:
`src/lang/data/online/<code>/`, where `<code>` is its language code (`km`,
`fr`, `zh`). English is built into the app (`../en/`); every other language
is a **plugin**, built from its folder by `extra-work/build-lang-plugins.mjs`
and installed from Settings → **Languages**. Nothing in the app names a
language: the app reads what a folder holds, and a language without a file
gets the plain behaviour that file would change.

All languages are made the same way. The folder is turned into the app's
language package by ONE factory, `onlineLangPackage.ts` (its types document
every field), and the only code a folder may hold is its song plugin
(`openLyricPlugin.ts`, below).

**Khmer (`km/`) and French (`fr/`) are the templates.** Khmer uses every
file there is (its own script, digits, fonts, Bible names, song plugin);
French is a language written in Latin letters with its own Bible names and
assistant. Most of the others are the smallest shape: the three required
files. To add a language, copy the one whose shape is closest.

## Required: a language is these three files

| File              | What it is                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta.json`       | The manifest: `locale` (`km-KH`), `order` (its place in the language picker, unique), `name` (English), `nativeName`, `version`, `description`, and optionally `direction: "rtl"` and `editorLink`.                 |
| `dictionary.json` | Every label of the app, English key → translation. It carries EVERY key, with no English fallback: a missing key throws in dev (`src/lang/tranKeyCoverage.test.ts`). Placeholders such as `{count}` are kept as is. |
| `flag.svg`        | Its flag, a plain 640×480 drawing: no script, no handler, no link outside itself.                                                                                                                                   |

A folder without `dictionary.json` is not a language yet: data waiting for
its labels, read by nothing.

## Optional: the files that change how the language behaves

Each is read only when present. Example values are Khmer's unless said.

| File                                  | What it changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Example    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `script.json`                         | How it is written: `scriptPattern` (a letter of its script), `notScriptPattern` (letters that make text another language's), `isUnspaced`, `digits` (0–9), `ignoredPattern`, `previewIgnoresSpaces`, `findingLetterPattern` (what a Bible search keeps), `systemFonts`.                                                                                                                                                                                                                                          | `km`, `fr` |
| `words.json`                          | Little words a Bible search uses: `stopWords`, `bookMarkerWords` ("in" Genesis), `findFrameWords` ("find", "the story of").                                                                                                                                                                                                                                                                                                                                                                                      | `km`, `fr` |
| `bibleReference.json`                 | How a reference is written: `chapterVerseSeparators`, `bookOrdinalWord` (a numbered book written with an ordinal word).                                                                                                                                                                                                                                                                                                                                                                                          | `km`       |
| `bibleBooks.json`                     | The Bible's book names in the language, with the keys that find each. Without it, English's.                                                                                                                                                                                                                                                                                                                                                                                                                     | `km`, `fr` |
| `bibleKeyMap.json`                    | A Bible version's key → its full title in the language.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `km`, `fr` |
| `bb-cr.gz.bundle`                     | Its own Bible cross-references (the Reader's **Cross References**).                                                                                                                                                                                                                                                                                                                                                                                                                                              | `km`, `fr` |
| `location-name-map-data/`             | `namesMap.json` and `locationsMap.json`: the people and places lookup in the language.                                                                                                                                                                                                                                                                                                                                                                                                                           | `km`, `fr` |
| `fonts.json` + `fonts/`               | Fonts it ships: `uiFamily` (the app's own), `family` and its `faces` (each a `weight`, and `style: "italic"` for an italic one), `display` (its CSS `font-display`; absent is the browser's `block`, labels invisible until the face loads -- English sets `swap`), `lookAlikes` (designs a document may name), `stickyNote`, `songOrder`. Drawn in FRONT of English's Google Sans (`../en/fonts.json`, the app's default on every page); without it, Google Sans and then the computer's fonts draw the script. | `km`       |
| `appMenus.json`                       | Items it adds to the app's menus (Khmer's **Khmer Tools**).                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `km`       |
| `openLyricPlugin.ts` + `package.json` | Its song editor plugin (keyboard, spellcheck, word breaks): the ONE part that is code, a dependency of the folder's own `package.json` (with its `package-lock.json` and an `.npmrc`), installed by `extra-work/install-lang-deps.mjs`. The app declares none of it.                                                                                                                                                                                                                                             | `km`       |

## Optional: what the assistant and the help know of it

| File               | What it is                                                                                                                           | Example    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `assistant.json`   | How the help window is asked and answers in it (`src/chatbot/chatLangHelpers.ts`). Without it, a question is read through English's. | `km`, `fr` |
| `questions.json`   | The supported-question corpus in the language, row by row.                                                                           | `km`, `fr` |
| `manual/`          | The translated manual, page for page and block for block; each page names the English it was made from (`translatedFrom`).           | `km`, `fr` |
| `typed.json`       | How a question TYPED in the language is told apart, for a language without an `assistant.json`.                                      | `es`       |
| `world.json`       | What the Bible import and the song tools know of it in its own words (its own name, the word for "language", stop words, letters).   | `km`, `fr` |
| `bibleSource.json` | What studying a Bible in it needs (marks to strip, a grammar hint).                                                                  | `km`, `he` |

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
   `flag.svg`. Copy `fr/` for a language in Latin letters, `km/` for one
   with a script of its own.
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
