# The second read

What a first reader changed, and what it set aside, checked by a reader told
nothing about why. `SKILL.md` §3c says when; this says how, and is what a
second reader is handed.

The first full pass (2026-10-11) applied 559 corrections on their own evidence
quotes. Checked this way afterwards, 555 held and 4 did not; of 80 statements
set aside for the running app, 45 were settled from files the first reader had
not followed to the end, and 18 of those were wrong.

## Preparing it

```bash
node .claude/skills/owa-enhance-agent-docs/scripts/second-read.mjs inputs \
    --out=<scratch>/second <the edit files the first readers wrote>
```

writes `V<n>.input.json` (corrections: the document, the entry, the passage
before and the passage now — **no reason, no evidence**) and `L<n>.input.json`
(statements a first reader left for the running app, with its reason as a lead).
One reader per file. A reader writes `<same name>.json` beside its input and
runs `second-read.mjs check` on it until it prints `0 problem(s)`.

The edits that only made a control's name a template are not handed out.
`second-read.mjs templates <the edit files>` checks each changed nothing but
the wrapper and prints the ones whose words moved too; read those by hand
(13 of 431 on 2026-10-11, every one a label the code does carry).

Then: every `wrong` and `false` is read by the session itself before a
document is changed — a second reader can be wrong too — and applied by
exact, minimal edits; every `live` whose `needs` is `one machine` is tried on
a scratch dev instance; the rest stay in `live-checks.md` with their `watch`.

## What a reader of corrections is told (`V`)

> A set of corrections was applied to documents in this repository. Each
> replaced one passage with another, on the word of a first reader. You are an
> independent checker. For each, decide FROM THE SOURCE CODE whether what the
> document says now is true. You are deliberately not told why a correction
> was made: find the proof yourself, and try to REFUTE each one before you
> accept it.
>
> For each item: find `now` in its document and read around it; work out what
> CHANGED between `was` and `now` — a name, a label, a number, where a control
> is, what a press does, which file holds something — and check that changed
> claim against the code. A count is counted, not accepted.
>
> - `confirmed` — you found code that supports it. Quote it: file and an exact
>   fragment of a line.
> - `wrong` — the code contradicts what the document says now (whether or not
>   `was` was right). Say what the code does (`says`), quote it, and give the
>   text the passage should carry (`fix`): minimal, in the document's voice.
> - `unsure` — the code cannot settle it. Say why in `note`. Sparingly: if any
>   part of the changed claim can be checked, check that part.
>
> A correction that only fixes a cross-reference inside the document is
> checked against the document's own numbering.
>
> Read-only: nothing in the repo is edited, no `npm` script is run, the app is
> neither started nor driven. Judge the facts, not the wording.

```json
{ "group": "V1", "results": [
  { "n": 1, "verdict": "confirmed",
    "evidence": [{ "file": "src/x/File.tsx", "quote": "an exact fragment" }], "note": "" },
  { "n": 2, "verdict": "wrong", "says": "what the code does",
    "evidence": [{ "file": "src/x/File.tsx", "quote": "…" }],
    "fix": "the text the passage should carry instead" },
  { "n": 3, "verdict": "unsure", "evidence": [], "note": "why the code cannot settle it" }
] }
```

## What a reader of set-aside statements is told (`L`)

> A first reader set each statement aside as "only the running app can settle
> this". Take a second, deeper look: many were set aside because the code was
> a stylesheet, a library under `node_modules`, a data file, or arithmetic the
> first reader did not follow to the end. Settle every one the files on disk
> CAN decide, and for the rest say exactly what has to be watched.
>
> Look further than the first reader went: **stylesheets** (an opacity, a
> `:hover` rule, a `z-index`, a media or container query, an animation's count
> and duration decide a great many "how it looks" statements outright);
> **libraries on disk** (their built bundles under `dist/`); **data files**
> and the **arithmetic** in a handler, followed with the numbers the recipe
> gives; the **handler** itself; and, for a list fetched at run time from a
> public page, that page.
>
> - `true` — the files decide it and the document is right. Quote the line.
> - `false` — the files decide it and the document is wrong. Quote the line;
>   give `old` (the passage exactly as it stands, occurring once) and `fix`
>   (in the manual a control is `[en:tran:…]` around its English key, and no file,
>   component or other internal name may appear).
> - `live` — the files cannot decide it. `watch`: one sentence, exactly what a
>   person or a tool would have to observe, in which window. `needs`: `one
>   machine`, `a second device`, `a TV`, `a real account`, `PowerPoint`, `a
>   person's press`, or `a model`. A part that IS decidable goes in `note`.
>
> Be strict about `true`: a rule that produces the effect outright settles
> it; a layout that is the sum of many rules does not, and a timing claim
> stays `live` unless a constant states it. The first reader's reason is a
> lead, not a fact.

```json
{ "group": "L1", "results": [
  { "n": 1, "verdict": "true",
    "evidence": [{ "file": "src/x/file.scss", "quote": "an exact fragment" }], "note": "" },
  { "n": 2, "verdict": "false", "says": "what the files show",
    "evidence": [{ "file": "src/x/File.tsx", "quote": "…" }],
    "old": "the passage exactly as it stands", "fix": "what should replace it" },
  { "n": 3, "verdict": "live", "evidence": [],
    "watch": "what has to be observed, and where", "needs": "one machine", "note": "" }
] }
```

An evidence entry for a public page is `{ "url": "https://…", "quote": "…" }`.
