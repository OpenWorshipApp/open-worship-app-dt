# Tips backlog — `TP-xx`

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
figure. Found in run `2026-10-16`.

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
verb the firewall must refuse. Found in run `2026-10-16`.
