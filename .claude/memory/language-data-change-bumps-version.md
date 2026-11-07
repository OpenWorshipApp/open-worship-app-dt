---
name: language-data-change-bumps-version
description: "Every change to a language's data (dictionary, assistant, corpus, manual, script, fonts, Bible data) raises the version in its meta.json AND is packed again (npm run lang:pack) in the same change, or installed copies -- the dev app's included -- never update"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c87960ba-6340-4fb6-9ed7-286177f7d5d1
  modified: 2026-11-05T16:22:16.737Z
---

The user, 2026-11-04: _add to agent documents everytime language data got
modified it have to increase meta version_.

**Why:** a language is a plugin found in two homes (`electron-build/lang`,
shipped, and `<data folder>/lang`, installed) and the scanner
(`electron/langPluginHelpers.ts`) keeps the HIGHEST version, a tie going to
the shipped copy. The catalog (`build-lang-plugins.mjs`,
`mergeCatalogEntry`) keeps one entry per version, so a release under an
unchanged version silently REPLACES the old pack: the Languages tab offers no
update, and every installed copy keeps the old data.

**How to apply:**

- Touching anything in `src/lang/data/online/<code>/` -- a label,
  `dictionary.json`, `assistant.json`, `questions.json`, `manual/`,
  `script.json`, `words.json`, fonts, Bible books or references -- raises
  `version` in that language's `meta.json` in the SAME change (patch for a
  fix, minor for new content). `meta.json` is the only place a version is
  written (no language has an `index.ts` since 2026-11-05).
- One raise per change (a commit), not per file saved in it.
- **Then pack it, in the same change** (the user, 2026-11-05: _update agent
  documents to make sure run the pack everyting language got updated_):
  `npm run lang:pack -- --pack=<code>[,<code>]` for the languages touched,
  bare `npm run lang:pack` when a change touches many (a new `tran` key
  touches all 87), then in the dev app Settings > Languages > **Refresh** >
  **Update to**. Why: every window loads the INSTALLED plugin
  (`<data folder>/lang/<code>@<v>/`), never `src/lang/data/online/`, so an
  edit nobody packed is invisible to a live check -- and a key added to the
  source but not to the installed copy throws in dev exactly like a missing
  one, a false failure in the Khmer pass. Order matters: **Update to** is
  offered only for a strictly higher version (`checkIsLangUpdateAvailable`),
  so raise, THEN pack; a second edit in the same change, packed under the
  number already installed, is reached by deleting the installed copy (its
  trash icon) and pressing **Install** again.
- The dev catalog's `--bump=<code>` (`npm run lang:pack -- --bump=<code>`)
  only packs a higher number for a
  test; it does not change `meta.json` and is no substitute. But a number it
  packed is taken: raise past the highest version EVER packed for the
  language, the dev catalog's included (`extra-work/lang/info.json`). Hebrew,
  2026-11-04: an old `--bump=he` had packed a partial 0.0.2 that a dev app
  installed, so the full dictionary had to be 0.0.3 to reach it.
- English's own tables (`src/lang/data/en/`: `locales.json`,
  `language-names.json`, `world.json`) ship with the app, not in a plugin:
  no version to raise. A fact about another language goes in ITS folder, and
  raises ITS version.

See [[language-plugins-runtime]].
