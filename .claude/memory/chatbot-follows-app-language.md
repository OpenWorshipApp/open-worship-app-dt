---
name: chatbot-follows-app-language
description: "The 🤖 answers in the app's language (Khmer first); every language is data in src/lang/data/<code>/assistant.json; the prompt is per APP language, the question's language rides in the user turn"
metadata:
  type: project
---

Since 2026-10-16 the help window speaks the language the app is SHOWN in, at the
user's ask: _when user changed app language to non-english (e.g. Khmer) then
chatbot have to support selected language_, _this is for church elderly user_,
_chatbot have to be localization friendly_. It reverses the old "the answer
stays English-only" rule.

- **Every language is data**: `src/lang/data/<code>/assistant.json` beside the
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
  read only it ([[users-are-elderly-need-own-language]]).
- A line is written only for an ask that carries `askedText` or `replyLang`:
  a question the window composed itself (a verse put into English) is left
  alone.
- **Search**: the guide is English; a Khmer question is read as English
  search words through the app's own dictionary reversed plus the glossary
  (`tools/owa-devtools-mcp/queryLanguage.mjs`), longest phrase first, a phrase
  ending only where a letter ends. NOT `Intl.Segmenter` — Electron's ICU cuts
  Khmer words differently from Node's ([[electron-icu-has-no-khmer]]).
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
- **Corpus and manual**: `tools/owa-devtools-mcp/questions/i18n/<code>.json`
  (`{en, text}` overlays, applied in the renderer; a pressed chip asks the
  row's English, `textEn`) and `docs/manual-i18n/<code>/` pages with a
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
  `verseAskExcludeWords`, `removalWords`). Measure a language with the
  elder-persona run (`.claude/skills/owa-enhance-chatbot/scripts/elder-run.mjs`),
  counting every English word an answer SHOWS, not only the window's.

**Why:** an English sentence is a dead end for the person this app is for.

**How to apply:** a new user-facing string in the chatbot goes through `tran()`
with Khmer AND French; a new language-specific rule goes into `assistant.json`,
not into code; never put a per-question line into the system prompt.
