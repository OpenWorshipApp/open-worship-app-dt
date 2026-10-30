---
name: knowledge-label-i18n-templates
description: Docs name app controls as `[en:tran:Clear Long Text]`, resolved to the app's live UI language when a tool serves them — never write an English label with a Khmer twin beside it
metadata:
  type: project
---

Every document the chatbot can read — `docs/manual-sources/**` and the allowlisted
`.claude/**` — names an app control with a template, not a label:

```
Press **F9** ([en:tran:Clear Long Text]) to take the verse off screen.
```

`tools/owa-devtools-mcp/tran.mjs` fills it in on the way out with what that key
reads as in the language the app is DISPLAYING right now (`document.documentElement.lang`,
cached 10s in `owaTools.mjs`): `Clear Long Text` in an English window,
`លុបអត្ថបទវែង` in a Khmer one. Since 2026-10-16 the chatbot's own words follow
the app's language too ([[chatbot-follows-app-language]]); a passage quoted from
the English manual stays English, and only its button names move.

**Why:** the docs used to carry both halves by hand — a bold English label with
its Khmer twin in brackets right after it — which meant (a) the English-only help
window had to strip Khmer back out with a stack of regexes in `toEnglishOnly`,
(b) a guide card's `find` was an English label that matches nothing in the DOM of
a Khmer window, and (c) the copies went stale:
the manual still said `គ្រប់កណ្ឌគម្ពីរ` for **All Books** long after the app moved
to `សៀវភៅទាំងអស់`, and six labels were wrong when this landed.

**How to apply:**

- Writing a doc: the token holds the exact `tran()` key and nothing else, the way
  `[en:tran:Clear Long Text]` does. Never a hand-written twin — a reviewer cannot see
  the drift, and neither can a test that only reads English.
- The key must EXIST. An unknown key falls back to its own English text, so it
  looks perfect in English and silently hands a Khmer volunteer a label they
  cannot find. `tools/owa-devtools-mcp/tran.test.mjs` walks the manual,
  `.claude/memory`, `.claude/skills`, `.claude/rules` and `CLAUDE.md` and fails
  on that, and on a twin coming back.
- Khmer that is CONTENT — a bible's name, a Khmer book title, a translation key
  like `ពគប`, or a name to type into the lookup — stays verbatim. Only labels
  are templated.
- The dictionary ships as `electron-build/knowledge/tran.json`, lifted out of
  `src/lang/data/<code>/index.ts` by `extra-work/build-knowledge.mjs`, so a doc
  change needs the same rebuild as any other knowledge edit
  ([[claude-dir-edits-need-knowledge-rebuild]]).
- `owa_tran` answers the same question for a label the model wrote itself, and
  `owa_click` / `owa_type` hand the matcher each English label with its
  translation beside it (`withTranslations`), in the same pass; `owa_find_ui`
  retries with the translation only when the English label matches nothing
  (`foundAs`).

Related: [[tran-missing-key-throws-in-dev]] — the app's own `tran()` THROWS on a
missing key in dev; this one deliberately does not, because a mistyped label in a
document must cost one word, not the whole answer.
