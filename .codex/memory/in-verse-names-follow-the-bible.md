---
name: in-verse-names-follow-the-bible
description: "A non-English bible's verses are underlined in ITS OWN language, by a matcher that runs the opposite way round from the English one - candidates come from the verse's or chapter's evidence and are looked FOR in the text, with no dataset-wide tier at all"
metadata: 
  node_type: memory
  type: project
  originSessionId: fe8584ac-adf8-47b6-b981-0e46a1cc069f
  modified: 2026-09-12T00:46:26.061Z
---

The in-verse name/location underlines used to be KJV-only. Reported 2026-09-11
with a picture of the reader on Genesis 4 in two columns — the KJV one marking
**Adam**, **Eve**, **Cain**, **Abel**, the Khmer one beside it marking nothing —
`getVerseTextLookupLangCode` (was `checkCanLookupVerseText`) now answers with a
LANGUAGE CODE per column: `en` for the KJV and only the KJV, the bible's own
language code when that language ships a lookup package, null otherwise.

**Why the English matcher cannot simply be pointed at Khmer.** It reads the
TEXT: cuts it into `[A-Za-z]` tokens, requires an initial capital, probes each
run of up to 4 words against a map of every surface form in the dataset, and
resolves by verse evidence OR by a form being borne by exactly one record in the
whole dataset. Khmer has no spaces between words and no capitals, so there is
nothing to cut on and — more to the point — the capital is where most of that
matcher's precision comes from. Measured over the whole shipped Khmer bible
(3 673 verses), running it that way the dataset-wide tier added 824 matches
including the Khmer for Jehudijah ("the Jews", 30×), Scythia ("wild", 21×),
Chemarims ("the priests", 14×), Mammon ("riches", 13×) and Baali ("lord", 9×) —
every one an ordinary word the dataset happens to translate a name into.

**So `verseTextTranslatedHelpers.ts` runs the opposite way round.** Candidates
are the handful of records the dataset attests for THIS verse, failing that for
this CHAPTER, and only those few names are looked FOR in the text. **There is no
dataset-wide tier at all** — a translated bible gets evidence or it gets
nothing. 3 216 matches over the same 3 673 verses at **0.017 ms a verse**, a
quarter of what the English scan costs, because ~11 needles are probed per
verse instead of a whole dataset being scanned for.

- The **chapter tier** is what covers the evidence map's own gaps (it lists
  Isaac for some verses of a chapter about Isaac and not others). +310 matches,
  all of them real names on inspection. It cannot admit a common word: a chapter
  that never mentions Scythia never puts Scythia among its candidates.
- A needle two attested records share is refused, exactly as the English
  matcher refuses the 24 Zechariahs.
- **Khmer marks word boundaries with U+200B and joins clusters with U+200C**,
  and 35 of the dataset's own names carry one. The builder strips them from the
  needle and `matchNeedleAt` SKIPS them in the text, so the reported offsets are
  still offsets into the ORIGINAL string — which is what keeps the rendered
  verse, and a copy of it, byte-for-byte what it was. That is also why there is
  no cleaned copy and no per-verse offset map.
- Longest-first at a shared start (`អ័ដាម` Adam beats `អ័ដា` Adah), then no two
  decorations may overlap.
- A translated needle is NOT lower-cased. There is no case to fold in Khmer, and
  folding would put the needle out of step with the text it is compared against
  character by character.
- `TRANSLATED_DISAMBIGUATOR_PATTERN` exists because a translated package leaves
  the disambiguator in English around a translated name (`ម៉ារា of បេថានី`), so
  it carries a BARE connective the English pattern — which expects
  `<relation> of` — never sees.

**Three derived files now, not two.** `verse-text-needles-<code>.json` (85KB for
`km`, one entry per interned id, `'\n'`-joined where a record has several forms)
is built ON ITS OWN rather than as a third output of the index+labels pass: it
follows the BIBLE on screen while the labels sidecar follows the lookup-language
SETTING, and the two are routinely different languages, so pairing them would
read a ~35MB package to write a file nobody asked for. It needs no English pass —
`ids` come from the index already on disk — so it reads exactly one package.
`genLookupLangFileStore` holds it one slot per language, released when the last
subscriber goes.

**What did NOT change, deliberately.** Another ENGLISH translation (NIV, ESV)
still underlines nothing: the index's surface forms are KJV spellings and its
dataset-wide tier has no evidence behind it, so matching it against a
differently-worded English verse would both miss names and attach KJV evidence
to text that does not say the same thing. The translated path is a different
bargain — evidence for the very verse or chapter in hand — which is what makes
it safe over a translation nobody extracted the dataset from.

**Cost owed honestly:** a Khmer-only reader now loads the 450KB English index
too, for its `ids` and its verse evidence (both language-independent); the
English needle maps inside it, ~250KB, ride along unread. Splitting them would
invalidate a file every KJV reader uses for a saving only a Khmer-only reader
sees, so it was left.

Related: [[lookup-language-selection]], [[onscreen-check-must-not-parse]],
[[knowledge-label-i18n-templates]].
