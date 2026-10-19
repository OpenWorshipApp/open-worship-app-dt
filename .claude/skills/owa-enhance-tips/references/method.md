# Tips — the method

How `/owa-enhance-tips` measures a window, what goes in an inventory, how a
window is harvested, and what a useful tip is. `SKILL.md` is the procedure;
this file is the reasoning it points to.

## 1. What COVERED means

Per inventory item, `scripts/tip-coverage.mjs` reads every tip of the window
(the catalog `getDailyTips(page)` lists in **All tips**):

| Credit | When | Why it is not enough alone |
| --- | --- | --- |
| **acted** | a step's `find` / `finds` names the control (same panel scope when the item is scoped), or its `press` is one of the item's keys | a pressed control nobody can find the tip for is never learned |
| **taught** | the tip's title, detail or a step names the control as a whole phrase, case-sensitive (`Copy Title`, not "copy the title"); a scoped item needs its panel named too; `strict` items take no credit from words | the same |
| **credited** | the item's `tips` lists the tip — for a control a lesson teaches in other words (the verse buttons, a drag) | the triager's word, so it is listed in the report |
| **findable** | a tip with any credit above carries the control's words (or the item's `search` words) in its title, detail or category | — |

**COVERED = (acted or taught or credited) AND findable.** "Findable" is the
All tips box exactly: `DailyTipComp`'s `filteredTips` lower-cases the query
and runs `includes` over the translated title, detail and category — never
the steps. A lesson whose detail names the button is found by the button; one
that names it only in step 3 is not, and a volunteer who types the words on
the button gets _No tips found_.

**The same search in Khmer and French** repeats that with the window's
dictionary: the control's words as that window shows them (`tran()`'s lookup,
English when there is no entry) against the tip's title, detail and category
as that window shows them. Measured on the first run: _Make the words larger_
teaches **Font Size**, and its Khmer detail says ទំហំអក្សរ where the button
says ទំហំតួអក្សរ — found in English, not in Khmer. Translations are written to
read well, and the control's name inside one must still be the control's own
name.

**ACTED** is over the _actable_ items only: not excluded, not `personOnly`,
and not labelled with a word the firewall refuses (`destructiveLabel.mjs`) —
those can never be a **Do it**, so they are not counted as misses.

**Provisional** — the COVERED line says so while any lead is untriaged or no
harvest pass has run. Only `leads: 0 … 0` after a full state walk makes the
figure a claim.

## 2. The inventory file

`references/inventory/<page>.json` (JSON, so it is not part of the shipped
knowledge bundle, which takes `.md` only). `--init` writes the skeleton.

```json
{
  "page": "reader",
  "window": "reader.html",
  "updated": "2026-10-16",
  "scope": "What this inventory counts, and which windows' controls it leaves out.",
  "sourceDirs": ["src/bible-reader", "src/bible-list"],
  "sourceFiles": [],
  "ignore": [
    { "pattern": "^\\([^)]+\\)\\s?\\S", "reason": "a passage reference: the person's own data" },
    { "label": "Loading", "reason": "a state, not a control" },
    { "file": "src/bible-list/bibleArchiveHelpers.ts", "reason": "import errors, never a control" }
  ],
  "items": [
    { "id": "copy-title", "surface": "Passage copying", "labels": ["Copy Title"] },
    { "id": "notes-more", "surface": "Bible Notes", "labels": ["Bible Notes > More Options"] },
    { "id": "font-size", "surface": "Reading layout", "labels": ["Font Size"], "search": ["text size", "bigger"] },
    { "id": "next-passage", "surface": "Passage history", "labels": ["Next"], "strict": true },
    { "id": "switch-pane", "surface": "Reading layout", "labels": ["Ctrl+Shift+Arrow"], "press": ["Ctrl+Shift+Left", "Ctrl+Shift+Right"] },
    { "id": "history-remove", "surface": "Passage history", "labels": ["Remove"] },
    { "id": "export-word", "surface": "Passage export", "labels": ["Export to MS Word"], "personOnly": "chooses a file" },
    { "id": "devtools", "surface": "Native menus", "labels": ["Toggle Developer Tools"], "exclude": "a developer tool, not a volunteer task" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | stable, kebab-case, unique in the file |
| `surface` | the panel or area a volunteer would name; the report groups by it |
| `labels` | the exact English words ON the control (`[Shift+Escape]` shortcut suffixes are dropped), `Panel > Control` when the same words sit in several panels |
| `aliases` | other words the same control shows (a toggle's two states, a title and its aria-label) |
| `press` | the shortcut keys that ARE this item, as a step's `press` writes them (Windows form) |
| `search` | words a volunteer would type instead of the label — counted for findability |
| `strict` | a generic word (`Next`, `Open`, `Default`): prose cannot credit it, only a press or `tips` |
| `tips` | tip ids credited by hand; a credit to a missing tip is an error |
| `personOnly` | why only the person may press it (file choice, projector, native menu, a choice of their record) — leaves the ACTED denominator |
| `exclude` | a real control deliberately not taught, with why — leaves every denominator and is listed in every report |

**Ignore is "not a control"; exclude is "a control we will not teach".**
Data (references, file names, Bible keys the person installed), statuses and
error sentences are ignored; developer-only rows are excluded. A label that is
a control in one place and a sentence in another stays an item.

**One item per thing a volunteer does.** Forty saved rows each with **More
Options** are one item scoped to its panel; the book, chapter and verse
buttons of the picker are one item each kind (`labels` of a representative,
`tips` credit), not 1 189 chapters. Two controls with the same job in two
panels are two items — a volunteer meets them separately.

**Source leads** come from `tran()` literals in a control position —
`title`, `aria-label`, `label`, `placeholder`, `tooltip`, `menuElement`,
`contextMenuTitle`, `undoLabel` / `redoLabel`, and a JSX text child
(`>{tran('Reset Search Data')}<`) — in `sourceDirs`, `sourceFiles` and every
file a harvest saw rendered (`data-react-comp-fp`, dev only). `message` and
`description` are sentences and are not read. A label that is not passed
through `tran()` (`PathSelectorComp`'s `'Show path editor'`) is invisible to
the source sweep and to every translation — the live harvest is what finds
it, and it is also an app bug to file.

## 3. The state walk

A window is harvested when a pass over every state below adds no new label
(`harvest pass: … 0 new labels`). Open each state with safe presses, run
`--harvest`, close it. The native menus are not in the page:
`owa_menu { action: 'list' }` names their rows, and they become items with
`personOnly: "native menu"`.

**Reader (`reader.html`)**

1. As it opens: header (versions, reference box, Previous / Next, names
   lookup, Export to MS Word, Wiki Dictionary, Advance Bible Lookup, Go Back
   to Presenter, Setting, App Assistant, AI Chat, Help), passage history chips,
   the Bibles and Bible Notes panels.
2. The reference box cleared (**Clear input**): book buttons, then a book's
   chapter buttons, then verse buttons; type ahead (**Tab to complete**).
3. One passage view: its header icons (painted on hover), its footer (Font
   Size and the rest behind the footer's reveal), a verse selected (the
   selection toolbar), a verse's right-click menu, a verse comment / mark.
4. Split side by side and stacked: the divider menu, each pane's controls.
5. The study sidebar (**Advance Bible Lookup**), each view of the **Bible
   Online Lookup** picker in turn — Find (with results and the book filter),
   cross references, names and locations, Resources — each with its own
   More Options.
6. Bibles panel: the panel's More Options, a file's More Options, a saved
   row's menu, the path editor shown.
7. Bible Notes panel: the same three menus, a note item's menu.
8. The floating panels: a name's details, the connection graph (its toolbar,
   filters, presets).
9. Help → All tips itself (search box, Show it, the card) — tips teach the
   tips.

**Presenter (`presenter.html`)** — the header tabs; each panel (documents,
lyrics, flows, Background tabs, Foreground launcher and every component's
floating panel, Mini Screen, screen controls, Messages); each panel's More
Options and a row's menu; a document open in the previewer; Bible Lookup open.
Never show a screen to harvest it.

**Settings and the editors** — every tab of the window; each editor with a
document open. Their catalog is one step a lesson (`pageDemos.mjs`); see §7.

## 4. What makes a tip useful

- **It is about one task, titled by its outcome** in a volunteer's words —
  _Copy only the passage reference_, not _Copy Title button_.
- **Its detail names the controls by their exact words**, because that is all
  the search reads, and its translations carry each control's translated name
  as the dictionary has it.
- **It starts where the control is hidden**: the opener first (the study
  sidebar, the footer's reveal, a panel's More Options) with `skipIfVisible`
  so an already-open panel is not toggled shut.
- **One visible change per Do it**; explanation after an action is a `look`
  step (**Next**), never a second silent press.
- **It teaches what no button shows**: a shortcut (`press`, with the Mac keys
  in the text), a drag, a right-click, shift-click to select several.
- **It is short**: title ≤ 60 characters, detail ≤ 200, a step ≤ 260, ≤ 6
  steps — the card covers the very controls the volunteer is reaching for.
- **It is right today**: every label checked against `owa_list_ui` on the
  live window before it is written, never remembered.
- **It is filed under the heading a volunteer looks in**: a Reader lesson's
  `category`, a Presenter lesson's id set in `getPresenterTips`.

## 5. Which steps may be a Do it

| A Do it may | It may not — words only |
| --- | --- |
| open a panel, a tab, a picker, a sidebar view, More Options, a context menu | present, show or hide a screen, clear what is on one |
| set a slider or a text box to a harmless value (`+8` on Font Size) | remove, delete, trash, discard, overwrite, clear all, reset all |
| choose a view in a picker (`translateValue`) | choose a file, a folder, a translation, a record, a note of the person's |
| press a navigation key the tip names (`press`) | reload, relaunch, reset widgets, open Developer Tools, a native menu |
| select a row to show its toolbar | import, export, share, start a server, download |

A lesson that changes something visible tells the person how to put it back
in its last step, and the verification puts it back itself.

## 6. Writing one

**Reader** — `readerExtraDemos.mjs`, through its helpers (this is the
shape of the existing `reader-bible-information`):

```js
lesson(
  'bible-information',           // id becomes reader-bible-information
  'Getting started',             // category: a tran() key, a heading in All tips
  'Read the installed Bible information',   // label = title, a tran() key
  'Clear the reference, then open Bible Information to check the translation and publisher.',
  [
    click('Clear input', 'Clear the reference to display the book picker.'),  // the opener
    click('Bible Information', 'Open Bible Information beside the book picker.'),
    'Read the information supplied by this Bible, then close the popup.',    // a look step
  ],
),
```

`click(find, text)` sets `translateFind: true`.

`study(view)` opens the sidebar and chooses a Bible Online Lookup view. A
scoped find is `'Bibles > More Options'`; the Reader translates each part.

**Presenter** — an object in `presenterDemos.mjs` (`translateFind: true` on
every find; the Presenter translates the whole string, so a scoped label must
be a key as a whole) and its id in the right set in `getPresenterTips`.

**Settings, editors, Bible Note, Local Web Share** — `pageDemos.mjs`: one
step, `find` optional.

**Strings** — every new `label`, `detail` and `category`, and every
`translateFind` / `translateValue` key, in `src/lang/data/km/index.ts` and
`src/lang/data/fr/index.ts`. Reuse the dictionary's existing translation of
each control name inside the translated detail. A reworded string's old entry
comes out of both files.

**Tests** — the totals and the featured counts in `readerDemos.test.mjs`,
`presenterDemos.test.mjs` and `src/toast/dailyTipHelpers.test.ts`; a new
behaviour (a lesson that presses a shortcut, a scoped find) gets its own
assertion beside the existing ones.

## 7. Decisions this skill does not take alone

File these as `TP-xx` and ask:

- **Small windows get one step a lesson** — `getPageDemo` builds a single
  step. A real Settings or Lyric Editor lesson needs that shape widened.
- **The catalogs load in every window** (`dailyTipHelpers.ts` imports all
  three). A per-page lazy import would take the other windows' lessons out of
  memory; it changes `getDailyTips` to async and every caller with it.
- **Step text stays English** — titles and details are translated, the card's
  step prose is not (a decision recorded in
  `tools/owa-devtools-mcp/reader-demo-coverage.md`). Translating it would
  double the strings each lesson costs in two dictionaries.
- **A control the app itself never translates** (a raw string title) is an
  app bug for `owa-enhance`; the tip waits for its key.
