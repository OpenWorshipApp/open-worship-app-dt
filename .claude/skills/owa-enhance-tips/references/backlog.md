# Tips backlog — `TP-xx`

## TP-18 · In Khmer an agent cannot press an All tips row by its title — `open` · S3 · every window

**Evidence (2026-11-09, live, the Presenter in Khmer).** Each row is a
`<button aria-label={title}>` (`DailyTipComp.tsx`), and `domMatch.mjs` names a
control by its aria-label AND its text run together — the number, the title,
the category and the whole detail. A Khmer row runs past the 120-character cap
`owa_list_ui` keeps and past the length ratio a title may match against, so
`owa_click` / `owa_find_ui` on _ស្វែងរកបទគម្ពីរ_ found nothing (no near miss
either), while the accessibility tree names the row by its title alone and
pressing it there opened the tip. English titles fit by luck of length. The
chatbot reaches a tip by id, so this is the stdio door's QA path. **Change.**
Let an `aria-label` stand as the control's whole name, the way the
accessibility tree does — `owa-enhance-mcp`'s. **Proof on apply.** `owa_click`
on a Khmer tip title opens it from All tips. Found in run `2026-11-09`.

## TP-17 · Tips translate a menu name the native menu draws in English — `open` · S3 · every window

**Evidence (2026-11-09, read from code and the dictionaries).** The native
menu's top-level names are plain English in `electron/electronMenu.ts`
(`File`, `Edit`, `View`, `Tools`, `Window`; `Help` by role), and so are its
role rows (Reload, Toggle Full Screen, Toggle Developer Tools); only the
renderer-contributed rows are `tran()`'d (`Widgets`,
`widgetAppMenuHelpers.ts`). Older tips in most languages translate the path
anyway: Khmer has 11 strings saying មើល > …, one of them
`មើល > Widgets` where the window shows `View > ផ្ទាំង`. The Presenter's new
_Use View > Widgets …_ detail was corrected in all 87 packages to `View >`
plus the language's own `Widgets` word. **Change.** Decide first — translate
the native menu's own names in the app (`owa-enhance`), or rewrite those tip
strings to the English names — because either makes the other wrong. **Proof
on apply.** A Khmer volunteer reading a tip's path finds those exact words in
the menu bar. Found in run `2026-11-09`.

## TP-16 · Two Presenter items still untaught, and ACTED is a fifth — `open` · S3 · presenter

**Evidence (2026-11-09).** After the run, `tip-coverage.mjs presenter
--uncovered` lists `slides-more` (**Slides > More Options**: what its menu
holds was not read this run) and `text-reset` (the Bible/LongText Properties
reset, titled _Plain words again; the size stays_: `presenter-bible-text-look`
says "Reset for plain words" in its step, which is not the title, and its
detail has no word a volunteer would type for it). ACTED is 41/221: 31 of
the 114 lessons are words only, most because they teach a row menu (a
document, a slide, a run sheet line), a removal, or a panel behind `TP-13` /
`TP-14`. **Next.** Read the Slides panel's menu and teach it in the lesson that
already names the panel; name the reset's title in `presenter-bible-text-look`
when its detail is next reworded; after `TP-13` / `TP-14` are fixed, give the
words-only lessons their openers back. **Also found by the translation
pass:** Latvian gives **Move up** and **Move to Top** the same words
(_Pārvietot uz augšu_), so the slide menu shows two identical rows there;
**Lookup** and **Bible Lookup** share their words in `fa`, `ur`, `sw` and
`id`, **Setting** and **Settings** in `he`, `so`, `rw`, `rn` and `vi`, and
**Remove** and **Delete** in `id` and `ms`. Dictionary fixes, each with its
package's version raised. Found in run `2026-11-09`.

## TP-15 · Seven floating panels on the Presenter have no panel name — `open` · S2 · presenter

**Evidence (2026-11-09, read from code).** `FloatingWidgetComp` stamps
`data-widget-name` only when it is given `widgetName`, and the Presenting Flow
preview (`PresentingFlowPreviewFloatingComp`), the Slides preview
(`AppDocumentPreviewFloatingItemComp`), Presenting Control
(`ControllerToolbarComp`), Stage Style (`LyricStageStyleFloatingComp`), Import
From SongSelect, Import From Public Domain Songs and the note editor popup pass
none. Everything inside them reports the pane BEHIND as its `inPanel`, so a
scoped find (`Presenting Flow > Collapse All`) cannot land and a name they
share with the window twins (the 2026-09-24 note in CLAUDE.md, _Mapping DOM
elements_). **Change.** Pass each its English label key as `widgetName` — an
app change, `owa-enhance`'s to apply. **Proof on apply.** `owa_find_ui` inside
each reports its own panel; a run-sheet tip can press **Collapse All** by a
scoped find. Found in run `2026-11-09`.

## TP-14 · The Presenter's `Mini Screen` find presses a screen card — `open` · S2 · presenter

**Evidence (2026-11-09).** A lesson step `find: 'Mini Screen'` with
`skipIfVisible: 'Mini Screen Options'` was pressed live with the panel already
open: it did not skip, and **Do it** clicked the first screen card (its label
starts `BGSLLTFG0(0)`), with no visible change. The step was taken out of
`presenter-screen-drawing` and `presenter-bible-text-look`, which are words
now; `presenter-mini-screen`, `presenter-style-bible`,
`presenter-screen-controls`, `presenter-multi-screen` and
`presenter-foreground-clear` still use it. **Change.** Find out why
`skipIfVisible` did not hold (the walkthrough engine is `owa-enhance-mcp`'s),
and aim the opener at the panel's own toggle by a word only it carries.
**Proof on apply.** Show it → Do it on `presenter-screen-controls` with the
panel open goes straight to the next step; closed, it opens the panel and
nothing else. Found in run `2026-11-09`.

## TP-13 · The Presenter's `Documents` tab twins with its own region — `open` · S2 · presenter

**Evidence (2026-11-09).** A step `find: 'Documents'` was refused live as two
controls of that name in one panel: the tab and the `data-widget-name`
region it opens (a panel region counts as a control). The step was removed from
the three new row-menu lessons (`presenter-document-row-menu`,
`presenter-slide-menu`, `presenter-stage-style`), which are words now; the
older `presenter-present-slide`, `presenter-auto-play`,
`presenter-present-lyrics`, `presenter-songselect` and
`presenter-public-domain` still open with it. **Change.** Let the twin rule
skip a region whose name is the tab that owns it, or scope the step to the
tab strip — `owa-enhance-mcp`'s. **Proof on apply.** Those five lessons' first
Do it opens the Documents tab in English and Khmer. Found in run
`2026-11-09`.

## TP-12 · A list panel's header More Options shares its name with every list file's — `open` · S2 · reader, presenter

**Evidence (2026-11-09).** `reader-bibles-new-list`, `reader-bibles-share`,
`reader-notes-new-file` and `reader-notes-share` pressed `Bibles > More
Options` / `Bible Notes > More Options`; live, the card refused each with
_16 controls are called "More Options" (in Bibles) and the step does not say
which_ — every list file row's dots carry the same title. The header button is
`ListMenuButtonComp` in `src/others/FileListHandlerComp.tsx` (`aria-label` and
`title` `tran('More Options')`), shared by every file list, so the Presenter's
Documents, Lyrics and Background lists very likely refuse the same press (the
Mini Screen's dots got **Mini Screen Options** for this reason). The four steps
are words now, which cost ACTED two items (`bibles-more`, `notes-more`).
**Change.** Its own title, e.g. **List Options**, in every language — an app
change, so `owa-enhance`'s to apply; then the four openers press again.
Related: `TP-08` (Resources' header). **Proof on apply.** The four Do it
steps press the header's menu in English and Khmer; ACTED gains the two
items back. Found in run `2026-11-09`.

## TP-11 · The note window's Bible Lookup panel is taught only in the Reader — `idea` · S3 · bibleNote

**Evidence (2026-11-09).** The Bible Note inventory keeps the jobs the panel
is opened for there (Open Bible Lookup, Insert Bible Text, Insert Collapse
Bible Text, Change Bible Key — taught by `bibleNote-bible-lookup`) and lists
the rest as one exclusion, `bible-lookup-reader-tools`: the panel is the
Reader's own `RenderBibleLookupComp` (study sidebar, Resources, verse picking,
split, copy, the floating frame), measured in the Reader inventory. A
volunteer in the note window cannot find those lessons from its All tips.
**Change.** Let `getDailyTips('bibleNote')` also list the Reader lessons whose
controls sit in that panel, by id — no new strings, and the guide already
aims at the window it starts in; the user decides whether the note window's
list should grow by ~20 entries (`TP-03` weighs every catalog in every
window). **Proof on apply.** The exclusion becomes items, and `--leads` stays
0 · 0. Found in run `2026-11-09`.

## TP-10 · Fresh Reader harvest and localized search gaps remain — `open` · S2 · reader

**Evidence (2026-10-22).** Four new controls are inventoried and taught: the
passage, verse and resource-file assistant buttons and Create the provided KJV.
Source leads fell from seven to zero. The first live pass still reports four
passage-name data labels; do not copy those operator-specific labels into the
shipped inventory. The full state walk is outstanding, so 175/175 English
coverage remains provisional. Khmer search is 138/175 and French is 149/175;
ACTED stays 41/122, with 21 existing not-searchable warnings.
**Next.** Complete the state walk, account for dynamic name links without
recording the operator's passage, then improve localized search and safe actions
under TP-07. Both changed tips passed All tips search and Show it in English
and Khmer; they are self-guided.
**2026-11-09: the state walk is done** — 36 live passes over the panels,
menus, study views, names lookup, records, sessions and the tips card; the
inventory grew to 186 items (10 new, e.g. More…, Floating, the session strip,
the assistant doors), every name link and record row is ignored by pattern, not
by the operator's own words, and leads read 0 · 0, so the English figure is
final. Still open: the Khmer and French search gaps of details this run did not
reword.

What `/owa-enhance-tips` runs found and did not fix in the run, under stable
ids, so a later run starts from the truth. A finding owned by another skill is
filed there and linked here: `EN-xx` (`owa-enhance`, app bugs such as an
untranslated control), `EC-xx` (`owa-enhance-chatbot`, the practice shelf in
the 🤖), `MC-xx` (`owa-enhance-mcp`, `owa_guide_*`).

Status: `open` · `idea` (a proposal that needs the user's decision) · `doing`
· `done` (with before → after and the proof) · `wontfix` (with the reason).
The status stays the last status word on the heading line, because
`owa-enhance/scripts/triage.mjs` reads it from there. This file ships in
plaintext inside the installer: no one's own data.

```markdown
## TP-01 · <the finding, in one line> — `open` · S2 · <window>

**Evidence.** … **Change.** … **Proof on apply.** … Found in run `<date>`.
```

---

## TP-01 · "Show path editor" is no `tran()` key, and three tips translate it — `open` · S2 · reader, presenter

**Evidence.** `tip-coverage.mjs --quality` on 2026-10-16: `reader-bibles-folder`,
`reader-notes-folder` (`Bibles > Show path editor`, `Bible Notes > Show path
editor`, translated part by part) and `presenter-path-editor` carry
`translateFind` on a label with no Khmer or French entry. The control draws
it untranslated too — `src/others/PathSelectorComp.tsx:96` builds the title as
`(shouldShowingEditor ? 'Hide' : 'Show') + ' path editor'`, so a Khmer window
shows English there. `getDailyTipGuide` passes `tran` to `getReaderDemo` /
`getPresenterDemo`, and `tran()` throws on a missing key in a non-English dev
window, so **Show it** on those three tips fails there (read from code; not
yet run live). **Change.** Title through `tran('Show path editor')` /
`tran('Hide path editor')` with km and fr entries, which ends both the
untranslated control and the three findings. **Proof on apply.** The quality
line reads `find-untranslated 0`; the three tips run Show it → Do it in Khmer.
Found in run `2026-10-16`. **Workaround, same day:** the two Reader steps
dropped `translateFind` (the title is English in every language anyway), so
`reader-bibles-folder` ran Show it → Do it in a Khmer window, and
`readerDemos.test.mjs` holds them to it; `presenter-path-editor` still carries
it. The app key is still owed, and with it `translateFind` comes back.
**2026-11-09, the Presenter run:** `presenter-path-editor` and the third step
of `presenter-background-folder` (`Background > Show path editor`, whose whole
scoped label WAS a key, so a Khmer window looked only for a translated name
the control never draws) dropped `translateFind` too, and that key left all 87
packages. No tip translates the path editor's name now.

## TP-02 · A Khmer detail names the control in other words, so Khmer search misses it — `done` · S2 · reader

**Evidence.** `reader-font-larger` / `reader-font-smaller` teach **Font
Size** (ទំហំតួអក្សរ in the dictionary); their Khmer detail says ទំហំអក្សរ, so
typing the button's Khmer words into All tips finds neither. A 9-item trial
inventory on 2026-10-16 measured the same search at en 5/9, km 3/9, fr 4/9.
**Change.** Every covered item's tips carry the control's dictionary
translation in their km and fr details; the run that builds the Reader
inventory measures the whole gap first. **Proof on apply.** The `search in km`
line approaches the English COVERED figure. Found in run `2026-10-16`.
**Done 2026-10-16:** every reworded detail carries the control's dictionary
name; `search in km` 32.4% → 78.4%, `fr` 37% → 84.2% over the Reader
inventory, and ទំហំតួអក្សរ typed into All tips in a Khmer window finds both
Font Size tips. The remaining km/fr misses are details this run did not touch.

## TP-03 · Every tip catalog is held by every window that shows toasts — `idea` · S3 · all

**Evidence.** `src/toast/dailyTipHelpers.ts` imports the Reader, Presenter and
page catalogs statically, and `ToastComp` → `DailyTipComp` imports it, so the
Bible Note window holds 191 lessons it never lists. The script puts them at
≈74 KB (Reader) and ≈70 KB (Presenter) of lesson text plus their km/fr strings
— its JSON of each catalog, not a heap measurement. **Change.** A per-page
dynamic import inside `getDailyTips` (async, and every caller with it) —
structural, so the user decides. **Proof on apply.**
`owa-enhance/scripts/app-vitals.mjs` heap per page before and after, the
Reader and Presenter unchanged, the small windows lighter. Found in run
`2026-10-16`.

## TP-04 · The small windows have one-step lessons and one to three tips each — `idea` · S3 · setting, editors, bibleNote, lwShare

**Evidence.** `tip-coverage.mjs --all` on 2026-10-16: `setting` 3 tips,
`appDocumentEditor` 2, `bibleNote`, `webEditor`, `lyricEditor`, `lwShare` 1
each; `getPageDemo` builds a single step, so none can open a tab and then
teach what is in it. **Change.** Give `PAGE_DEMO_LIST` the Reader's lesson
shape (several steps, `translateFind`), then inventory those windows.
**Proof on apply.** `--all` shows each window with an inventory and a COVERED
figure. Found in run `2026-10-16`. **Bible Note, 2026-11-09:** inventoried
(106 items) and covered 106/106 with 19 one-step lessons, each opening the
menu or panel it names and listing the controls inside it — but ACTED is
8/93, because one step can press only the opener; a second step (the menu's
own row) is what several steps would buy.

## TP-05 · A scoped find never landed in a translated Reader window — `done` · S1 · reader

**Evidence.** `getReaderDemo` translated a scope part by part, so a Khmer
window got `ព្រះគម្ពីរ > ត្រងតាមឈ្មោះ`, while a panel answers only to its
`data-widget-name`, English in every language: the card reported _nothing on
screen to act on_ for `Bibles > Filter by name` (live, 2026-10-16). Every
scoped Reader tip had the same gap (`Lookup > Copy` ×6, `Bibles > More
Options` ×2, `Bible Notes > More Options` ×2, the new filter and sort steps).
The Presenter was never affected: its whole-string keys keep the English panel
name (`'Background > Images': 'Background > រូបភាព'`). **Change.** A third
variant, English scope with the translated control, last among the finds
because the renderer's inline fallback takes the last. **Proof.** In Khmer
`owa_find_ui "Bibles > ត្រងតាមឈ្មោះ"` finds the Bibles filter, and the lesson
pressed it there; `readerDemos.test.mjs` holds the order. The in-app MCP host
picks it up on its next start (TP-06).

## TP-06 · The in-app host runs its own, older copy of a built-in lesson — `idea` · S3 · all

**Evidence.** **Show it** sends only the `demoId` to the in-app MCP host,
which builds the lesson from the catalog and the dictionary it loaded when the
app started. After an edit to `getReaderDemo` the dev app was not relaunched
(nodemon did not restart it), and the Khmer card kept the old finds while the
renderer already held the new ones; new tip titles showed English on the card
for the same reason. A packaged build ships both at once, so this is dev-only.
**Change.** Send the renderer's own lesson inline whenever it differs from the
host's, not only when the host lacks the id or has a show-only form
(`startDailyTipGuide`). The walkthrough engine is `owa-enhance-mcp`'s, so it
is filed there before it is built. Found in run `2026-10-16`.

## TP-07 · ACTED is a third of the Reader: whole panels are taught in words only — `open` · S2 · reader

**Evidence.** `tip-coverage.mjs reader` on 2026-10-16: ACTED 41/122 (33.6%);
Names and places 0/10, Connection graph 0/9, List files 0/7, Study sidebar
3/12, Verse marks 0/2. Most need a record, a file or a text selection first,
which no Do it may pick; but the names panel's tabs, Search names and Filter by
name type, the study views and Refresh are safe presses. **Change.** Add Do it
openers to the lessons that already name those controls, a press each, never
a record. **Proof on apply.** ACTED rises with COVERED held at 100%.

## TP-08 · The Resources header's More Options shares its name with every folder's — `open` · S3 · reader

**Evidence.** `reader-resources-refresh` pressed `Bible Online Lookup >
More Options`, which matches nothing (the panel is `Advance Lookup`), and
`Advance Lookup > More Options` names 40 buttons once Resources is shown, so
the card refuses it as a twin. The step is words now. **Change.** Its own
title, as the Mini Screen's **Mini Screen Options** got — an app change, so
`owa-enhance`'s to apply. **Proof on apply.** The step presses again.

## TP-09 · An agent cannot open a tip whose title starts with "Remove" — `idea` · S3 · reader

**Evidence.** Opening _Remove the last part of a reference_ from All tips by
`owa_click` was refused by the firewall's destructive-word check, on the
row's own words; a person can press it, and the chatbot starts lessons by id.
_Remove an extra Bible version_ reads the same. **Change.** Titles that say
what the volunteer gets (_Correct the last part of a reference_) instead of a
verb the firewall must refuse. Found in run `2026-10-16`. **2026-11-09, the
Presenter run:** only the row's TITLE is read that way — `owa_click` on
_Remove what you no longer use_ was refused, while _Take a line out of a run
sheet_, whose detail opens with "Remove from Presenting Flow", opened and ran
**Show it**. That title is still owed the rewording above; its detail carries
the four `Remove …` controls, so search finds it either way.
