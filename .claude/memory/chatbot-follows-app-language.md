---
name: chatbot-follows-app-language
description: "The 🤖 answers in the app's language (any installed one) or in ANY language typed; every language is data in src/lang/data/online/<code>/assistant.json, a language only typed in its own src/lang/data/online/<code>/typed.json, read once it is installed; the prompt is per APP language, the question's language rides in the user turn"
metadata:
  node_type: memory
  type: project
  originSessionId: cceb2542-65df-4852-b7d7-51e364f85d02
  modified: 2026-11-08T12:00:00.000Z
---

Since 2026-10-16 the help window speaks the language the app is SHOWN in, at the
user's ask: _when user changed app language to non-english (e.g. Khmer) then
chatbot have to support selected language_, _this is for church elderly user_,
_chatbot have to be localization friendly_. It reverses the old "the answer
stays English-only" rule.

- **Every language is data**: `src/lang/data/online/<code>/assistant.json` beside the
  package (script pattern, native digits, words for yes/no, the yes/no chip
  words and how a yes-or-no question starts or ends, walkthrough-echo words,
  translated frame markers, a glossary of question words → English). Adding a
  language is adding that file (and its `tran()` dictionary); no code names
  Khmer. `src/lang/assistantLanguageFacts.test.ts` holds every package to one.
- **The app language** is `document.documentElement.lang` (`getAppLangCode`,
  `src/chatbot/chatLangHelpers.ts`), never the setting: the setting moves at the
  click in Settings, the windows at Apply's reload.
- **Prompt per APP language, question's language per ASK**: `genSystemPrompt`
  takes the language (English keeps one bullet; the others one template filled
  from the facts) — still one cached prefix per window, because the language
  changes only on reload. What a question is in goes at the END of the user
  turn (`genReplyLanguageLine`): nothing for English in an English app.
- **Which language answers** (`pickReplyLanguage`): what they TYPED, else the
  app's — a "yes", a number, a command and anything PRESSED (chip, option,
  suggestion, card rescue: `isPressed` on `handleAsking`) are the app's words.
  The doubt always goes to the app language: the users are often elderly and
  read only it (the user's own words, above).
- **Any language a person TYPES** (2026-11-03, the user: _make chatbot generic
  for language … no matter what language I type it work seamlessly_; `EC-447`
  ..`EC-451`). Each language's own `typed.json`
  (`src/lang/data/online/<code>/`; 84, 37 of them in data-only folders until
  they have a package) gives a name, its Unicode script(s), little words and
  letters, a family, yes/no -- read only for an INSTALLED language since
  2026-11-04, when nothing but English was to ship -- and
  `getAssistantLanguage` returns one as a language with `isPackaged: false` and
  every list empty, so the reply line, the Gemma 4 translation, the cleaner and
  the chips work for it with no code naming it. Detection is script first
  (a Hangul or Han letter weighs three Latin ones), then little words and
  letters each weighed by 1/(languages sharing it); English and the language
  the app is SHOWN in need half the evidence (`SHOWN_LANGUAGE_PRIOR`; French
  lines of shared words read as nothing otherwise), a Latin tie inside a
  `family` goes to the first listed, any other Latin tie to the app language;
  languages sharing another script tie to the app's language, then one
  family, else `other` (answered in the language it was written in).
  **Until 2026-11-08 (BN-33)** the half went to every PACKAGED language --
  French in every app -- and a script tie to the first listed: with every
  language installed, Dutch, Italian, Haitian and Samoan lines in an English
  app were named French on one shared word ("de", "il", "la", "le"),
  Ukrainian and Bulgarian ones Russian, Nepali Hindi, Mongolian Kazakh; and
  thin word lists named Hausa Romanian ("mai"), Kinyarwanda Hausa ("wa",
  "mu"), Fijian Swedish -- answered in those. Each language's commonest words
  went into its list (13 packages), the okina (U+02BB) reads as the
  apostrophe, and `typedEditAsks.test.ts` holds 86 languages' four lines to
  their own language or nothing, in an English app and in their own: wrong
  48 of 351 before, 0 after. A language's list is the fix for a line it
  loses; never weigh a language by name. Before, Spanish read as FRENCH (`la`, `de`,
  `un`) and was answered in French; Portuguese in a Khmer app in Khmer.
  **The ratchet is the corpus**: all 469 questions in English and in every package with a
  `questions.json` must keep their language (`anyLanguage.test.ts`), and a language added to the file
  needs a sample line there. A page is translated only for a package
  (`findPageLanguage` checks `isPackaged`): a typed language reads the English
  page. **The cleaner reads the SCREEN's language** (`screenLangCode`, the
  app's): an English gloss stays on an English screen, the screen's own script
  is no third script, and a typed Latin language gets no capitalised-run label
  pass (every German noun). Chips are judged by SCRIPT, not by package.
- A line is written only for an ask that carries `askedText` or `replyLang`:
  a question the window composed itself (a verse put into English) is left
  alone.
- **Search**: the guide is English; a Khmer question is read as English
  search words through the app's own dictionary reversed plus the glossary
  (`tools/owa-devtools-mcp/queryLanguage.mjs`), longest phrase first, a phrase
  ending only where a letter ends. NOT `Intl.Segmenter` — Electron's ICU cuts
  Khmer words differently from Node's ([[electron-icu-trimmed-locales]]).
- **The walkthrough card** is built from the ENGLISH page (every step rule
  reads English) and put into the window's language at `prepareSteps`: the
  step text from the same page read with its templates intact, controls tried
  in the window's words first, its buttons from `GUIDE_CARD_LABEL_KEY_MAP`,
  every hint ONE whole template said through the runtime's `say()`.
- **Window words** go through the chatbot's own `tran` / `tranLabel` /
  `fillWords` (`src/chatbot/chatTranHelpers.ts`), plugged in by
  `plugChatWindowLanguage` (`chatWindowLanguage.ts`) from BOTH entries —
  `src/chatbot.tsx` and `src/aichat.tsx` — after `init`, pinned to the
  language the window loaded with. Words code reads back stay English in
  storage and are translated where drawn.
- **Fonts**: the pack's `fontFamily` rides `--chat-lang-font` after each
  window's own faces (`chatWindowShared.scss`); the walkthrough card, the ◎
  picker line and the action banner take the page body's face.
- **Corpus and manual**: `src/lang/data/online/<code>/questions.json`
  (`{en, text}` overlays, applied in the renderer; a pressed chip asks the
  row's English, `textEn`) and `src/lang/data/online/<code>/manual/` pages with a
  `translatedFrom` hash (`extra-work/manual-i18n-status.mjs`).
- **Behind the scenes in English** (2026-10-17, the user: _translate all
  khmer to english to work with llm or post directly to llm if it is gemma 4
  family_; _use gemma 4 as sub assistant_): `chatTranslateHelpers.ts`. A
  Gemma 4 answering model gets the language directly; any other model is
  asked in English and its answer translated back, both ways by a no-cost
  Gemma 4 sub-assistant (`findTranslationPick`, `isTranslation`). No Gemma 4
  → asked directly in the language, as before. Generic: no language named.
- **Coverage is measured**: `node extra-work/chatbot-language-coverage.mjs`
  on the running dev app (24 states of both AI windows, no assistant asked):
  Khmer 99.6% on 2026-10-17. Fill-in questions are translated too, their
  example kept as in English, and asked back in English once finished
  (`toEnglishTemplateAsk`). The ✨ window also hands sites the language's
  face as bytes (`aiChatGuestFontHelpers.ts`).
- **The reader may read NO English at all** (2026-10-17, the user: _when app
  is in Khmer we don't expect user can understand english at all_). Window
  words at 99.6% were not enough: the MODEL's answers carried English, so it
  is taken out in code too (`answerLanguageHelpers.ts`), a Khmer question
  quoting English is answered in Khmer, verse references are drawn as the
  Bible writes them, and a verse asked for in Khmer reaches the Bible search
  — the patterns DATA in `assistant.json` (`verseFindAsks`, `verseAsks`,
  `bibleKnowledgeWords`, `verseAskExcludeWords` — which only END a search —
  and `removalWords`; a search STARTS unless `bibleReaderWords` calls it the
  app's work, a word the Bibles use too only in a how-do-I,
  `excludeInHowTo`, 2026-10-29). Measure a language with the
  elder-persona run (`.claude/skills/owa-enhance-chatbot/scripts/elder-run.mjs`),
  counting every English word an answer SHOWS, not only the window's.
- **Auto ranks the language's models first when the app is not English**
  (2026-10-20, the user's order: `gemma4:cloud` from any assistant → Free's
  Nemotron Super VL → `gemma4:31b` → `gemma4:12b` → the rest of Free):
  `LANGUAGE_TIER_LIST` / `languageModelsFirst` in
  `src/chatbot/autoAssistantHelpers.ts`, defaulted from `getAppLangCode()`
  in `autoAssistantSourceHelpers.withLanguageRank`. Gemma 4 supports Khmer
  well; setbacks/busy/an unloaded LM Studio still outrank a tier.

2026-11-09 (BN-41, BN-42, BN-45): a language's `typed.json` holds what an
ASK is made of (add, at the end, make) and a word two neighbours share goes
into both lists; a language no reader can confirm keeps only the shortcut
phrases a blind read gives back as their job; and the help window reads
the languages' small files once, at load, so it loads again by itself when
the installed languages change while it is open (`chatLangReloadHelpers.ts`).

And (BN-47, BN-48): options under a marker word of the person's language are read by their shape; a translation that echoes the English is a failed one, and an English answer to another language is translated after the fact.

**Why:** an English sentence is a dead end for the person this app is for.

**How to apply:** a new user-facing string in the chatbot goes through `tran()`
with its key in every language's dictionary; a new language-specific rule goes into `assistant.json`,
not into code; never put a per-question line into the system prompt.
