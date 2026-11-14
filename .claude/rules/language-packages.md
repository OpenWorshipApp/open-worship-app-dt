---
paths:
  - 'src/lang/**'
  - 'extra-work/language-confinement.mjs'
  - 'extra-work/language-packages.mjs'
  - 'extra-work/build-lang-plugins.mjs'
  - 'extra-work/install-lang-deps.mjs'
  - 'electron/langPlugin*.ts'
  - 'electron/client/langUtils.ts'
---

# Language packages: English in `src/lang/data/en/`, every other language in `src/lang/data/online/<code>/`

(2026-11-03, the user: _move all language related … completely to
src\lang\data. all non-english is modular (installable). make sure no
non-english data tied to the code base beside src\lang\data_, then _in the
future all non-english is modular_.) Installing a language later is
dropping its folder in; nothing outside `src/lang/data` may have to change.
Then (2026-11-04, the user: _move Khmer and French to online lang data_,
_everything related to a language should be stored in the lang data_,
_everything related to a language have to be loaded from the language data
(from language installation catalog), must not ship in the app, except
english_): Khmer and French moved to `online/` with the rest, the app ships
English alone, and a language's dictionary, corpus, manual and Bible names
reach the app and the assistant only through its INSTALLED plugin.
Then (2026-11-05, the user: _make all non-english languages be treated
equally base on language data_, _khmer and french will be the template to
others, make sure the structure is easy to follow_): every language is a
folder of DATA, made by one factory, and the layout is written down in
`src/lang/data/online/README.md` — read it before adding or changing a
language.
Then (2026-11-09, the user: _French and Khmer should not be special than any
other online languages … everything related to khmer should be located in
lang online km folder, french too_, and _all languages development, except
english, should be treated the same way_): no code, test, script, dev
procedure or doc instruction outside a package gives one language a role the
others lack — no template language, no default pass language. The gate
(below) holds every language alike and names none. Code finds a language by
name through English's tables (`en/language-names.json`, `en/locales.json`);
a language's own facts — its Bible catalog code (`catalogLanguageCodes`), a
script-mark rule (`scriptMarkLocales`) — live in its own `world.json`.

- **A package is a folder** — `src/lang/data/en/` (the default, always
  there, built in, the one package with an `index.ts`; since 2026-11-06 it
  also has a `fonts.json` over `Google_Sans/static/`, six faces, drawn by
  the factory's own `online/langFontFaces.ts` -- Google Sans is the app's
  default face on every page, a language's own face in FRONT of it, memory
  `app-default-font-google-sans`) and
  `src/lang/data/online/<code>/` for every other language, ALL made the
  same way (below). Required: `meta.json`, `dictionary.json` (what MARKS
  a folder as a package), `flag.svg`; the rest optional, each changing one
  thing when present (`ls src/lang/data/online/*/<file>` shows which
  packages carry one):
  - `meta.json` — the manifest, `{locale, order, name, nativeName,
version, description}` plus `direction: "rtl"` and `editorLink` where
    they apply: the little the app needs BEFORE the package loads
    (`supportedLangCodes` / `supportedLocales`, the picker's order, which
    way it is written). `order` also decides which of the languages that
    share a script claims a line of it (`findScriptLocale`, a PowerPoint
    run's language): the language file store lists packages by CODE, so
    that list sorts by `order` itself -- until 2026-11-05 it did not, and
    Belarusian (order 53) took every Cyrillic line from Bulgarian (7).
  - `assistant.json` — how the help window is asked and answers in it
    (`src/chatbot/chatLangHelpers.ts`; every field defaulted, so a package
    without one loads).
  - `questions.json` — the question corpus in the language (until
    2026-11-03 an `i18n` folder beside the MCP server's corpus); `manual/` —
    the translated manual, block for block (until then a tree of its own
    under `docs/`), not prettier-formatted.
  - `script.json` — how it is written: its script's letters (and the
    letters that make text ANOTHER language's: Chinese and Japanese kana),
    no spaces, its digits, marks to ignore, the letters a Bible search
    keeps, the OS faces that draw it (`onlineLangPackage.ts`,
    `src/others/langScriptHelpers.ts`); `words.json` — the little words a
    Bible search uses (stop words, book markers, asking words);
    `bibleReference.json`, `bibleBooks.json`, `bibleKeyMap.json`,
    `fonts.json` + `fonts/`, `appMenus.json` (items it adds to the app's menus), the
    cross-ref bundle and the names datasets; `openLyricPlugin.ts` +
    `package.json`, its song plugin, the ONE file of code (below).
  - `chatbot-asks/` — the language's eval sets for the skill scripts;
    `cross-ref-title-fixes*.json` / `cross-ref-title-rules.json` — what
    `extra-work/fix-cross-ref-titles.mjs --lang=<code>` reads and writes.
  - `tests/<path below the repo, without src/>/` — the language's own tests
    (`tests/chatbot/…`, `tests/tools/owa-devtools-mcp/….test.mjs`); vitest
    includes `src/lang/data/online/*/tests/**/*.test.mjs` for the `.mjs`
    ones. A package's tests go with it; `src/lang/data/tests/` holds the
    ones that compare languages (the typed languages) and their eval data
    (`tests/chatbot/any-language-asks.json`).
  - `typed.json` — how a question TYPED in the language is told apart
    (name, Unicode script, little words, letters, a family, yes/no; read by
    `src/chatbot/chatLangHelpers.ts` -- its little words must hold the
    language's COMMONEST ones, shared or not: a list without them names a
    short line in it another installed language, BN-33), and since
    2026-11-08 (BN-31) how it
    says the work the help window does with no model -- `textSizeAsks`
    (larger, smaller) and `noteStyleAsks` (bold for the whole note), the
    fields an `assistant.json` carries, read by `languageEditAskHelpers.ts`
    and held one sample a language by `src/lang/data/tests/chatbot/
    typedEditAsks.json` -- a bold never said with a word that also means a
    colour or a size (BN-34), a size never said with a phrase that also asks
    for more or fewer WORDS, a summary or capitals (name the size: BN-40, an
    independent read of all 87 that found 31 such), the okina read as the
    apostrophe (BN-39); a language no reader can confirm keeps only the phrases a BLIND reading gives back as their job, a size said in so many words (BN-41: nine trimmed, Oromo left with none); its little words hold what an ASK is made of -- add, at the end, make -- and a word two neighbours share goes into both lists (BN-42: Finnish's _tee_ named Estonian's lines Finnish until Estonian had it);
    since 2026-11-12 (EC-465) `studyFileAsks` -- ONE pattern for a study
    file asked for (`readStudyFileAsk`): a making word and a study word, and
    none of its how-to, folder or note words nor its neighbours', never an
    English line (held by `tests/chatbot/typedStudyFileAsks.json`, which
    also holds each such ask to be named its own language in an English
    app: a study is written, and its passage quoted, in the language its
    ask is named); and the same day (EC-508) `studyKeepAsks` -- ONE pair
    for _save that as a study file_ under an answer (`readKeepAnswerAsk`,
    `checkIsStudyKeepAsk`): `keep`, its keep words, read first, and
    `pattern`, compiled only for a line they read -- a word pointing at the
    answer above and a study word, and none of the words asking for more,
    nor its how-to, folder or note words nor its neighbours' (held by
    `tests/chatbot/typedStudyKeepAsks.json`; a typed.json entry's last key,
    or after `studyFileAsks` in an assistant.json). A keep verb that also
    means _protect_ is read in a prayer only where the word for _this_ also
    stands before a noun, so such a language says its word for God among
    the words asking for more;
    and `changeClaims` (EC-508 too) -- `claim`, `unsaved`, `save` and
    `file`, the patterns an ANSWER in it claims a change with
    (`changeClaimHelpers.ts`, compiled for an answer in it alone): the
    assistant's own report of a change it made (a change word in a
    finished, first-person form) -- never an offer, a step for the person
    or what a person of the Bible did --, its "not saved yet" (`unsaved`,
    apart since 2026-11-14, EC-700: no more than the truth of a new study a
    card holds, so the reader of a change claimed of one reads `claim`
    alone), the study card's Save changes as its dictionary words it, and
    words pointing at the file itself (held by
    `tests/chatbot/typedChangeClaims.json`; a typed.json entry's last key,
    or after `studyKeepAsks` in an assistant.json) -- and, since 2026-11-13
    (EC-607), `foreground`: an answer's report of a change to an overlay on
    the screens (a countdown started or paused, the clock taken off,
    everything cleared, a message put up, the screen turned on), first
    person and finished, never an offer, a step, a denial or _I sent you a
    message_, read in a foreground ask alone (held by
    `tests/chatbot/typedForegroundClaims.json`, six claims a language at
    its floor; optional, the last key of `changeClaims`);
    and since 2026-11-12 (EC-516) `createAsks` -- word LISTS, not patterns,
    for a request to MAKE something (`typedCreateAskHelpers.ts`, groups in
    `CREATE_ASK_WORD_GROUP_LIST`): a running order or slide document,
    passages to a Bibles list or a new one, a background web page, a video
    or a track from a link, read into the English readers' shapes and sent
    to the same routes. The request forms of make, save and fetch, with the
    language's _I want_ / _give me_ / _get me_ (English's readers take them
    too), never a past form; `howTo` and `done` (yesterday, already, a past
    marker) make a line no ask; `*` at an entry's end or start reads a stem
    or a compound, an ellipsis between parts a noun an adjective splits
    (_a new order of service_ said _order new of service_). Held by
    `tests/chatbot/typedCreateAsks.json` -- samples written BLIND by readers
    never shown the words, each read as its job in an English app and in its
    own, and the English corpus read as nothing in every language's app
    (after `changeClaims`);
    and, in either file, `foregroundAsks` (2026-11-13, EC-563) -- a
    foreground component named in the language's own words, by its key
    (`time`, `message`, `stopwatch` …) to a list of entries written as
    `createAsks` writes them (a word, `stem*`, `*end`, `a … b`) and read
    with its matcher in the language's own spacing, beside English's, by
    `readForegroundComponentAsk` for every installed language: the
    component a typed line is about, which makes it a foreground ask. Name
    the Time and Message components only by a phrase or a word for a
    CLOCK, never by an everyday word for "time" or "message"; where the
    clock word is also the hour or "o'clock" (_jam_, _saat_, _Uhr_,
    _kello_), only near the screen (`jam … layar`) or with what tells it
    apart (`die uhr`). An entry weighs its longest part, so a stopwatch
    whose name holds the clock word needs that name under `stopwatch`.
    Every package has `time` since 2026-11-13 (EC-564), held to its own
    dictionary's clock lines and a blind set by
    `tests/chatbot/foregroundAsks.test.ts`, and `message`, `countdown` and
    `stopwatch` since EC-605 the same day: its word for a message or an
    announcement with its word for the screen, a projector or its canvas,
    both orders (`boodskap* … skerm*`, `*sikrini*` where a prefix or a
    linker joins it), and its dictionary's two labels with their last word
    a stem, held to a second blind set at each language's floor
    (`tests/chatbot/foregroundMessageAsksHeldOut.json`) -- and, where an ask
    says _count down_ and not the label (EC-620, 23 languages), words
    written blind and held to a THIRD set written blind after them and
    never tuned on (`tests/chatbot/foregroundTimerAsksHeldOut.json`: three
    countdowns, two stopwatches, two messages and three lines asking for
    none, a floor each), the three sets' lines held to being READ as the
    language they are typed in, one of its family or a script nobody here
    names, at a floor each (`tests/chatbot/foregroundAsksLanguage.test.ts`,
    EC-621: a Yoruba ask was answered in Portuguese, its `letters` lacking
    the low-tone vowels it writes on nearly every word); `optionalMarks` (EC-640), the marks its writers
    put in or leave out as they like (a vowel sign over a consonant, a
    doubling sign, a stretching stroke), left out of a foreground ask's
    line and of the language's own `foregroundAsks` before they are
    matched (an Arabic countdown typed with its doubling sign had read as
    nothing); a stopwatch or a countdown DESCRIBED with the language's word
    for a clock -- "a clock that counts up from zero" -- said by phrases
    whose longest part outweighs that word (EC-642: an Irish one had put a
    clock on the screen), held to a fourth set written blind and never
    tuned on (`tests/chatbot/foregroundTimerDescribedHeldOut.json`, a floor
    each); the everyday ways of asking for a countdown, a stopwatch and a
    message (EC-643: the second set had read most of its asks as nothing),
    held to a fifth set (`tests/chatbot/foregroundEverydayAsksHeldOut.json`,
    a floor each); and, in either
    file, `screenAsks` (2026-11-14, EC-614) -- the screens' own controls
    asked for in the language's words, as word lists written the way
    `createAsks` are, one list a group (`SCREEN_ASK_WORD_GROUP_LIST`,
    `typedScreenAskHelpers.ts`): `howTo` (every how-to the English reader
    takes, in the language's own grammar: how do I, how to, where do I
    click, press, find or turn it off, which button, show me or tell me
    the steps, what are the steps -- a word for _steps_ tied to its show,
    tell or what word as parts; never a bare _where_, _how many_ or
    _which_, since _which monitor is screen 1 on?_ is the screens' tool's
    to answer, nor a _can I_ that _I can't read the verse_ holds too; and
    any line is a how-to when ANY installed language's `howTo` reads it,
    whichever language it is taken for, so none may stop another
    language's ask, nor an English one: the blind
    second set sent 46 how-tos to the screens, 45 read as a transition,
    before the third round gave every language the whole inventory),
    `screen` (the screen, a
    projector, a TV, a monitor, the app's own Screen and Mini Screen; with
    no control's words, one or two digits right after an entry -- or an
    entry that holds its own number, where the bare word is an everyday
    one, `lau 1` -- read the screens, `checkHasScreenNumber`, EC-623),
    `bible` (the Bible text, a verse, a passage, and the short names of
    the Bibles the language reads, also under `versions` -- where one, by
    itself beside a chapter's or a verse's number with no screen named, is
    the passage put up in that Bible and reads nothing, `checkIsPassageInBible`:
    _present Psalm 23 NIV_ had read as versions in 71 languages), one list a
    control (`style`, `versions`, `lineSync`, `transition`, `display`,
    `group`, `lock`, `stage`, `select`, `clear`) and `exclude` (a song's
    words, a note, a foreground extra, the app, a phone, music, a group
    of PEOPLE, and a countdown, a timer and a chorus: _a 5-minute
    countdown on the screen_ is a screen's word and a number, and a
    numbered reading of a line named no language is stopped by ANY
    installed language's `exclude`). A control reads when its words are in the line with a
    screen named or, on the Presenter, the Bible; there a transition and
    Line Sync read alone, so those two lists hold nothing that is also an
    everyday word: a word for _crossing_ or _change_ (the Red Sea, a
    passage) or for _fade_ only beside a slide, background or change word,
    as parts (`x* … y*`). No bare colour (_the Red Sea_), shadow (Psalm 23)
    or _bigger_ under `style` (a Belarusian _больш*_ read Russian's
    _большом экране_), and no Bible short name that is also a word
    of the language. No _empty_ or _blank_ as a STATE under `clear` (_is
    the projector showing anything, or is it empty?_), only its verbs, and
    no word there or under `style` that also says a verse goes UP (a verb
    for both _take off_ and _bring out_; the _big_ of _the big screen_).
    An `exclude` word that is also part of a Bible book's name (a word for
    _hymn_ inside _Psalms_) is narrowed to its other forms. A comma or
    another mark between two parts counts as one of the three words their
    gap may hold. An entry is in the language's own forms: a stem
    another language shares (`transici*` took Spanish and Galician lines,
    `displej*` a Slovak one) is not, because every installed language's
    lists are tried on every line. Read by `readScreenAsk` for every
    installed language, the language typed first: a how-to or an excluded
    subject in the language typed reads nothing, English's reading too (a
    French how-to naming _la transition_ had gone to the screens). In a
    script that does not space its words, an entry of the language's own
    letters matches anywhere and one of other letters (`tv`, `kjv`) as a
    whole word (`checkHasListWords`: matched anywhere, `niv` was read
    inside _university_). Every package has it, held by
    `tests/chatbot/screenAsks.test.ts` to four sets written BLIND by
    readers never shown the words, each read once before anything was
    fitted to it (`screenAsksHeldOut.json`, `screenAsksHeldOut2.json`,
    `screenAsksHeldOut3.json`, `screenAsksHeldOut4.json`): ten
    asks a language at its floor, in its own app and an English one, and
    seven lines that only look like them read as none, every language
    installed; and in an `assistant.json`,
    `buttonWords` (EC-562) -- the word for a button, after which a quoted
    English word is a button's name, written in the language;
    and, in either file, `lookAlikes` -- pairs of letters drawn the same
    that keyboards and models swap, two sequences of one length, the first
    kept (two subscripts a script draws alike, say), by which words a model
    writes into a note are put back to the typed ones (BN-37); `bibleSource.json` — what studying a
    Bible in it needs (Hebrew's chant and joiner marks, a grammar hint, which
    letters say a word is in it; `wordStudyHelpers.ts`); `churchWords.json` —
    its Bible's own words for what a Bible study names (_Son of Man_,
    _eternal life_, Moses), each read off the verses of the Bible its
    `source` names, never from memory, and `wordsChangeForm` (a sentence
    changes its words, so the help window's study translator looks for one
    by its stems; 2026-11-11, EC-491) -- the script its words are written
    in is the one a study is translated into (EC-493: Serbian's Bible is
    Cyrillic); `world.json` —
    what the Bible import and the lyric tools know of it in its own words
    (its own name, the word for "language", stop words, letters, marks;
    `tools/owa-devtools-mcp/worldLanguages.mjs`). Each carries `order` where
    the first match wins. A folder with no `dictionary.json` is DATA-ONLY:
    nothing reads it until it has one. None is left since 2026-11-05, when
    the 36 that were (Catalan, Yoruba, Serbian …) became packages.
- **No table is shared between languages; what the app keeps is
  ENGLISH's, in `src/lang/data/en/`**: `language-names.json` (every
  language's English name), `locales.json` (the app's table of the
  world's locales and which languages are written right to left, below),
  `open-lyric-locales.json` (open-lyric's closed SONG locale list, for the
  song checker alone) and `world.json` (English's own part of what
  `worldLanguages.mjs` merges: its stop words, the country names that mean
  English, the Latin script row) — the last two read by the MCP server as
  JSON modules, so they are in
  `package.json`'s `build.files` / `asarUnpack`
  (`packagedImports.test.mjs` holds that). Until 2026-11-04 a
  `world-languages.json` beside the packages held every language's script,
  locales and English names, and before that each one's own words (native
  names, little words, letters, marks), with `typed-languages.json`,
  `bible-source-languages.json` and `unspaced-languages.json` beside it;
  the user held all of it to _must not ship in the app, except english_, so
  every fact about a language — the script it is written in, its locales,
  its other names, its Cyrillic letters — went to ITS folder (`typed.json`,
  `bibleSource.json`, `world.json`, above), read only once it is
  installed, a first-match list kept as rows with `order` so it rebuilds in
  the order it was written whichever languages are there, and "written
  without spaces" became a property of the script (`checkIsSpacedLocale`:
  `Intl.Locale#maximize` and seven ISO 15924 codes). A test of the Bible
  import or the lyric tools installs the checkout's packages first
  (`configureWorldLanguageParts(readPackageWorldParts)`, or
  `readLangPackageWorldParts` from `src/test-setup/langPackageDirs.ts` in a
  `.ts` test); a data-only folder is never read.
  What that costs, on purpose: a language not installed is not NAMED when
  typed -- its question is `other`, answered in the language it was written
  in, when its script is not Latin or it writes Latin letters English never
  does (an accent, a cedilla) with no word English or an installed language
  claims (`detectTypedLanguage`, `englishOnlyTyped.test.ts`); a plain-ASCII
  line no installed language claims is a doubt and goes to the app's
  language. A Bible import in it gets no help from its own words, a Hebrew
  or Greek word study without that language installed is plain (Genesis
  1:7 in the Leningrad Codex: 12 buttons, `אֶת־הָרָקִיעַ` one of them, and
  no stems in the lesson; 14 and the stems with Hebrew installed -- seen
  live 2026-11-05), and a Bible's Cyrillic or Han text reads as no script
  until a language written in it is installed. Nothing of another language
  may come back into English's folder.
- **At runtime every language but English is a PLUGIN, and none ships**
  (2026-11-04, the user: _Khmer and French are modular, only English is built
  in_, then the same day _must not ship in the app, except english_; memory
  `language-plugins-runtime`). `extra-work/build-lang-plugins.mjs` builds a
  package into a folder (`meta.json` + a factory `<plugin>/index.js` + assets +
  the side JSON files + `tran.json`, the dictionary for the MCP server, +
  `langFacts.json`, its fonts and lookup flag for windows that only DRAW it
  (memory `language-fonts-without-loading`, EN-59) + `manual/` with its
  search index `manual/index.json`) and packs it for the
  catalog; the Languages tab installs it into `<data folder>/lang/<code>@<v>/`.
  `electron-build/lang/` — the read-only home a plugin could ship in — is
  still scanned and gets nothing (`electron:build` no longer runs the
  script). One format, scanned by `electron/langPluginHelpers.ts`, loaded by
  `electron/client/langUtils.ts` (`appProvider.langUtils`). Every language is
  in `src/lang/data/online/<code>/`: Khmer and French (moved there
  2026-11-04), Hebrew, then (the user: _add all well-known languages_) 47
  more, then Burmese and (the user: _add all missing translation language_)
  the 36 data-only folders, Azerbaijani to Zulu (2026-11-05) — 87 in all. **In dev nothing is there
  until installed**:
  `npm run lang:pack -- --pack=<code>[,<code>]` packs the named languages into the dev
  catalog `extra-work/lang/` (bare `npm run lang:pack` packs every one; the
  script is `node extra-work/build-lang-plugins.mjs --pack`, so its flags
  pass after `--`: `-- --bump=he`), then Settings → **Languages** →
  **Install** — a non-English pass of a live check starts there.
  A package's `meta.json` is its manifest:
  `{locale, order, name, nativeName, version, description}`.
- **Every language is made by ONE factory, `online/onlineLangPackage.ts`**
  (2026-11-05; until then Khmer and French were whole packages of their own
  code and the other 49 a few-line `index.ts` each over a factory). It turns
  the folder's files into the `LanguageDataType` (`genLangData`), and a
  language WITHOUT a file gets the plain behaviour — English's Bible books,
  Western digits, the OS fonts, words split on spaces. No `index.ts`: the
  plugin build writes a virtual entry inside the folder that imports
  whichever files are there (`genLangEntrySource`, `__owa_lang_entry__.js`),
  and vitest assembles the same object by glob (`loadSourceLangData` in
  `langSourceFiles.vitest.ts`). The dictionary carries EVERY key (the user,
  2026-11-04: _all keys are translated, fail on dev for non traslated_):
  `tranKeyCoverage.test.ts` holds each `online/<code>/dictionary.json` to
  the app's keys and to the other packages' key set, and there is NO
  English fallback — a key it lacks is `undefined` and `tran()` throws in
  dev (`online/onlineLanguagesTran.test.ts` proves it through the real
  `tran`); `onlineLanguages.test.ts` holds the manifest, the flag, the
  script and the direction. The build lets a language bundle the files
  lying directly in `online/` and keys its cache on them
  (`build-lang-plugins.mjs`). Most labels were machine-translated (a
  glossary of core terms per language first, then the keys in chunks), and
  a native speaker should review them. Measured 2026-11-04: one plugin is 0.37–0.61
  MB (packed ~0.2 MB), loaded only when that language is chosen; under
  vitest each `dictionary.json` costs ~150 ms to load (`json.stringify`
  does not help), so a test that loads EVERY package takes ~10 s and needs
  a longer timeout than the 10 s default.
- **Changed language data raises its version** (the user, 2026-11-04:
  _everytime language data got modified it have to increase meta version_):
  any change in a language's folder raises `version` in its `meta.json` in
  the same change. The
  scanner keeps the highest version, a tie goes to the shipped copy, and a
  release keeps a version already published (`s3-push-lang.js` skips it,
  2026-11-11), so a change under the old number reaches no one. **And it is packed
  again in the same change** (the user, 2026-11-05: _make sure run the pack
  everyting language got updated_): `npm run lang:pack -- --pack=<code>[,…]`
  for the languages touched, bare `npm run lang:pack` when a change touches
  many (a new key: all 87), then
  Settings → **Languages** → **Refresh** → **Update to** in the dev app
  (`checkIsLangUpdateAvailable` offers only a strictly higher version, so
  the raise comes first; a second edit packed under the same raised number
  is reached by deleting the installed copy and installing again). A
  window loads the INSTALLED plugin, not the source folder: an unpacked edit
  is invisible to a live check, and a key the installed copy lacks throws in
  dev as if it were missing. The help window reads a language's small files once, at load, and loads again by itself when the installed languages change while it is open (BN-45). Memory `language-data-change-bumps-version`.
- **A language brings its own locale and direction**: `meta.json`'s
  `locale` and `direction`. The app's table of the world's locales is
  English's DATA, `en/locales.json` (`locales`, tag -> language code, and
  `rightToLeft`; `allLocalesMap` / `rtlLangs` in `langHelpers.ts`), there
  for what no installed language says — a Bible's locale, the Bible
  import's picker — and an INSTALLED language's own meta fills a tag the
  table lacks (`getLangCode`, `checkIsValidLocale`) and a direction it does
  not list (`checkIsRtl`). So adding a language edits nothing outside its
  folder; where the table HAS its tag, the row must be its code
  (`onlineLanguages.test.ts`). The catalog holds a NOT-installed language to
  the same rule (`checkIsLocaleOfLang`, `langPluginInstallHelpers.ts`: the
  tag's language part is the code, and a row, if any, agrees) -- until
  2026-11-05 it asked the table alone, so 13 packs of that day whose tags
  it had no row for (Hausa, Samoan, Oromo …) were left out of Settings →
  Languages without a word, and a test's prefix-splitting `getLangCode` mock
  hid it. Chinese is ONE code (`zh-CN` and `zh-TW`
  both map to `zh`; the online one is Simplified). A right-to-left script
  says `"direction": "rtl"` in its manifest; the test fails otherwise. The
  table is generic and owes nothing to the song format (the user,
  2026-11-05: _why open-lyric supply locale, it should be generic_):
  `en/open-lyric-locales.json` is open-lyric's closed song list, read only
  by the song checker (`openLyric.mjs`, held entry for entry to
  open-lyric's `schema.md`), and no test or code ties the two. Until then
  they were one list, so Burmese `my-MM`, a tag open-lyric lacks, could be
  neither a language nor a Bible's locale. Nothing in the app writes the
  app's locale into a song.
- **Code finds packages; it never names one.** Renderer: English through a
  static import, every other language through `langPluginRegistry.ts`
  (`ensureLangPlugins()`, awaited by every window's boot) and its small files
  through `langFileStore.ts` — no `import.meta.glob` over `data/*/` in app
  code, because a glob would build the language back into `dist/` (the
  `lint:build` check fails on it). Under vitest the store and registry read
  the checkout's packages (`langSourceFiles.vitest.ts`, aliased in
  `vitest.config.ts`). Node scripts: `extra-work/language-packages.mjs`
  (`listPackageCodes`, `toPackageDir`); a test, `src/test-setup/langPackageDirs.ts`.
  **The MCP server reads a language from its INSTALLED plugin folder**
  (`tools/owa-devtools-mcp/langPacks.mjs`): `tran.json`, `assistant.json`,
  `questions.json`, `bibleBooks.json`, `manual/` + `manual/index.json`. The
  in-app door is handed main's lister of the installed, turned-on plugins
  (`startOwaMcpHost({listLangDirs})`); the stdio door reads the same folders
  off the instance file of the app it drives (`langDirs`, written by
  `publishAiEndpoints` and again by `republishAiLangDirs` whenever a language
  is installed, deleted or turned on or off). Only where no app says — a unit
  test, a script, an app too old to publish `langDirs` — are the checkout's
  source packages read, and only those the assistant is written for (the
  ones with an `assistant.json`): over all fifty the destructive-label
  rule was ~98 KB on every press and ~4 s to build, against ~4 KB and 0.1 s. The knowledge bundle (`build-knowledge.mjs`) is
  ENGLISH ONLY: `tran.json` with English's facts, English Bible names, and a
  `hash` on each English manual page, which a translation's `translatedFrom`
  must equal to be shown (`help.mjs` `listTranslatedEntries`, judged at run
  time because an installed language outlives the release it was built
  beside). A script property that belongs to no language
  stays generic code: Unicode's invisible stackers
  (`src/helper/scriptClusterHelpers.ts`), `\p{Nd}` with a package's
  `nativeDigits`, `\p{Script=…}`.
- **The gate**: `src/lang/languageConfinement.test.ts` over
  `extra-work/language-confinement.mjs` fails on (1) any letter, mark, digit
  or sign of a script but Latin/Common/Inherited/Braille, or a Latin letter
  past ASCII, outside `src/lang/data` — in code, data, tests and comments,
  and a non-Latin SCRIPT written as a `\u` escape too; (2) non-test code
  (comments excluded) naming ANY non-English language, every one alike and
  none named by the rule (2026-11-09; until then it held `km` / `fr` alone):
  a quoted non-English locale tag (`'xx-YY'`), a path into a package folder
  (`data/online/xx/`, or the old `data/xx/`), or a code compared with a
  lang/locale/code variable (`lang === 'xx'`). `*.md`, `.claude` notes and
  `docs/` are prose and exempt; the skills' scripts and JSON data sets are
  not. `node extra-work/language-confinement.mjs <path>` lists what is left.
  It cannot see ASCII words of another language (`chapitre`) or a font
  name: those are the reviewer's.
- **Writing a test**: a case about a language's behaviour goes in that
  package's `tests/`; a case that compares languages loops over the
  packages found on disk and stays put; a Unicode case that is not about a
  language uses symbols (a cross, a note, an emoji) and a made-up code
  `'xx'`. Never transliterate a language into ASCII to get past the gate.
  Measured when it was built: an English-only copy of the repo (both
  packages deleted) typechecked and ran the suite green apart from tests of
  the copy itself (no `.git`, no `dist`); keep it so. **It had drifted**
  (2026-11-04, all fifty deleted: 33 src tests failed) -- tests read
  `online/km/index.ts` directly or expected Spanish, Khmer or Hebrew
  behaviour with no package there. `src/test-setup/langPackageDirs.ts` is
  how a test stays honest: `readLangPackageDictionaries()` (or one
  language's, `readLangPackageDictionary`) for the dictionaries a label
  check holds to (none when only English is there),
  `findOtherLangPackage()` / `listAssistantLangPackages()` for "a language
  the app knows", and `test.runIf(checkHasLangPackage('es'))` for a case
  about one language (inside `src/lang/data/tests/`, the file's own
  installed-language set). The agent-docs audit counts a path inside the
  package of a language not in the checkout as not installed, not gone.
  How to re-measure: copy the non-ignored files, delete every
  `online/<code>/` folder, `git init` + commit the copy (the audit and the
  confinement test read `git ls-files`), copy `dist/`, link `node_modules`,
  then both `tsc`s and both vitest projects; a junction to `node_modules`
  breaks `electron/electronHelpers.env.test.ts`'s mock resolution
  (`C:\C:\…`), a property of the copy.
- **Adding a language** is a folder in `src/lang/data/online/` with its
  `meta.json` (the next free `order`), `dictionary.json` carrying every key
  (`tranKeyCoverage.test.ts` holds every package to the others) and
  `flag.svg` — `README.md` there lists every file, and
  `ls src/lang/data/online/*/<file>` shows which packages carry one to
  start from — then `script.json` when its script is not Latin, and
  `assistant.json`, `questions.json` and `manual/` as it grows. Nothing
  outside the folder changes; an Open Lyric plugin is the one dependency,
  bundled into the language's plugin with `open-lyric/internal` left to the
  window (live bindings). **That dependency is the LANGUAGE's** (2026-11-05,
  the user: _for khmer plugin it have to ship with khmer language bundle_):
  declared in the package's own `package.json` (a locale-named
  `open-lyric-plugin-<code>-<region>`;
  `ls src/lang/data/online/*/package.json` lists the packages with one), with its `package-lock.json` and an `.npmrc`
  of `legacy-peer-deps=true` (the plugin's peer `open-lyric` is the app's
  copy and on no registry), installed into the package's own `node_modules`
  (gitignored) by `extra-work/install-lang-deps.mjs` -- run by the app's
  `npm i` (`extra-work/build.sh`, non-fatal) and by the plugin build before
  it builds the package (fatal). The app's `package.json` names none, and
  the plugin build bundles nothing from the app's `node_modules`
  (`moduleContainmentPlugin`); `src/lang/langDependencyOwnership.test.ts`
  holds both. To move a song plugin to a new tag, change it in the
  language's `package.json`, `npm install --allow-git=all` in that folder,
  and raise the language's version. The song plugin's
  `openLyricPlugin.ts` re-exports that dependency and nothing else; the
  factory imports only TYPES from the app, never an app VALUE: the plugin
  build refuses a stray module. `--release` packs a language with the
  others for `npm run release:lang`. A new key goes into every
  `dictionary.json` together, each language's `meta.json` version raised
  and all of them packed again (`npm run lang:pack`).
