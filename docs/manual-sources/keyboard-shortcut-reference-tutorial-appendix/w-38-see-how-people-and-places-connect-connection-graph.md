---
id: W-38
title: "See how people and places connect (Connection Graph)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [RD-92, RD-93, RD-94, RD-95, RD-96, RD-97, RD-98, RD-99, RD-100, RD-101, RD-102, RD-103, RD-104, RD-105, RD-106, RD-121]
screenshots: 7
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-21"
---
# W-38 — See how people and places connect (Connection Graph)

The record window tells you _who_ someone is. The graph shows you _how they connect_ —
parents, spouses, children, cousins and places, all on one canvas you can explore.

1. Open the **Names and locations lookup** (`👤📍`) from the Bible Lookup header and find
   a person — try **Jacob** (យ៉ាកុប). 📸
2. Click the **⋮** at the right end of the row — or **right-click** the row — and
   choose **[en:tran:Open Graph Preview]**. A floating window opens with
   that person in the middle.
   > You can right-click a name anywhere it is already clickable — in the list, in the
   > **names and locations in your reading** panel, underlined inside a verse, or in the
   > related-names list of a record window. The **⋮** is on the rows of the first two,
   > which is where you would go looking for it; a record window also has a `⛶`-style
   > graph icon beside its title.
3. Each box shows a number next to a small diagram icon — that is how many related
   records it has. **Click the number.** A menu opens listing **All (44)** first, then
   only the kinds this record actually has: _Parents (2)_, _Spouses (4)_, _Siblings (2)_,
   _Children (13)_, _Cousins (22)_, _Locations (1)_. 📸
4. Pick one kind — say **Children** — and just those boxes appear, ringed around the
   person and joined by curved lines. Each line is labelled with the relationship as you
   would say it: _son_, _daughter_, _wife_, _father_, _located at_.
   > Choosing **All** on a record with many relations asks you to confirm first, because
   > forty-odd boxes at once is a lot to read.
5. Explore: **drag** any box to move it (it stays where you put it), **drag the empty
   canvas** to pan, and **scroll** to zoom in and out around your pointer.
   **Double-click** a box to make it the new centre.
   > **Right-click a box** for a menu of everything that box can do: **Open detail**,
   > **Verses (8)**, **Open all Related (23)**, **Collapse**, **Set as centre**,
   > **Use as root** and **Remove**. _Set as centre_ re-arranges the whole graph around
   > that box; _Use as root_ clears everything else away and leaves just it, so you can
   > start exploring again from a record already in front of you. It is the same set as the small buttons along the bottom of the box, but
   > it also works on a box you have collapsed, which shows no buttons at all. Rows you
   > could not use are simply absent — the centre box offers no _Remove_, and a record
   > with no relations offers no _Open all Related_.
   > The **Verses** list names each verse the way YOUR Bible names it —
   > _លោកុប្បត្តិ ២៤:២៩-៣០_, not `GEN 24:29-30` — and picking one opens it.
6. Too busy? The coloured chips along the top switch each kind of connection on and off —
   turning **Cousins** off is usually the difference between a tangle and a family tree.
   **Right-click a chip** to show _only_ that kind, and right-click it again to bring
   everything back. 📸
7. Bottom-right: **↺ Undo** and **↻ Redo** step through everything you have done to the
   graph — a box you dragged, a zoom, an expansion, a filter — and **Ctrl+Z** / **Ctrl+Y**
   do the same. One wheel gesture is one step, however many notches it took.
   **Fit to view** (`⛶`) brings every box back on screen, **Re-layout** (✨) tidies the
   whole arrangement — a family fan back into rings, a found path back into its chain —
   and the `^` button collapses every box to a single line so a big graph fits.
   > Nothing here is one-way: if a tidy-up is not what you wanted, Undo puts every box
   > back where it was.
8. **Find the line from this person to another.** Click the signpost icon at the top
   right. The graph's own centre is already the starting point — it sits there as a chip —
   so you only say where you want to get TO: type **jesus**, pick **យេស៊ូវ (Jesus)** from
   the list (every name is offered with its English name beside it), and press
   **[en:tran:Find Connection]**. The canvas fills with the generations from David
   down to Jesus, the connecting line highlighted, and every box on it still expandable. 📸
   > The panel takes the name of the person the chain STARTS from, and that first box
   > becomes the graph's new centre.
   > Paths run through people only. A place like Jerusalem touches almost everyone, so
   > allowing places as stepping stones would "connect" any two people meaninglessly.
   > If there is genuinely no link you will see **No connection found** — that is an
   > answer, not an error.
9. Keep it: the `⋯` menu at the top right offers **Save as image** (a PNG saved to your
   Downloads folder and revealed for you), **Print** (which prints on white paper
   whatever theme the app is using), and **Save preset** to name an arrangement and come
   back to it later.
10. **Take it away as words.** The clipboard button (📋) left of the signpost opens six
    ways to copy the graph: **[en:tran:Copy as Markdown]** on its own, then five diagram
    languages — **[en:tran:Copy as Mermaid (across)]**, **[en:tran:Copy as Mermaid (down)]**,
    **[en:tran:Copy as Mermaid Mindmap]**, **[en:tran:Copy as Graphviz DOT]** and
    **[en:tran:Copy as PlantUML]**. Hover a row for its full name; the message that
    follows the copy says which one landed. 📸
    > **Markdown** is the graph written out for a note or a document — **the diagram
    > included**. It opens with the drawing itself in a `mermaid` block, so a wiki, a
    > repository, a notes app or this app's own markdown preview draws the same boxes
    > and lines; under it come every record with its kind and one-line description in a
    > table (the one in the middle marked _(centre)_), the connections grouped by kind
    > — _son_, _wife_, _located at_ — and the verses each record cites. Names, kinds
    > and relationship words come out in the same language the records are in.
    > **Which diagram language?** Whichever the thing you are pasting into reads.
    > **Mermaid** is drawn by most places that show markdown, and comes three ways: the
    > usual one runs **across** the page, **down** suits a line of generations, and the
    > **mindmap** turns the graph into a branching tree around the middle record —
    > easiest to read at a glance, but a tree cannot show a second link between two
    > people, and it carries no relationship words. **Graphviz DOT** and **PlantUML**
    > are for tools and wikis that draw those instead. Every one of them describes
    > exactly the boxes on the canvas, so switching a kind of connection off first is
    > how you copy only part of a graph.
11. **See it drawn, without leaving anything behind.** The last row on that same 📋 menu,
    under a divider, is **[en:tran:Open in Mermaid Live]**. It opens a second little menu
    — **[en:tran:Mermaid (across)]**, **[en:tran:Mermaid (down)]**,
    **[en:tran:Mermaid Mindmap]** — and picking one opens the Mermaid Live Editor in your
    web browser with this graph already in it, drawn. 📸
    > **Nothing is uploaded.** The diagram travels inside the address, after the `#`, and
    > a browser never sends that part to anybody's server — it is the same thing the
    > editor's own Share box does, which is why that site says the diagrams you make
    > never leave your browser. Your names, places and notes stay on this machine.
    > Only the three Mermaid rows are offered, because that editor draws Mermaid and not
    > Graphviz DOT or PlantUML.
    > It is the quickest way to get a **picture** of a graph out of the app for a slide or
    > a handout — the editor can zoom it, recolour it and save it as a PNG or an SVG.
    > A very large graph makes an address too long for the browser to be handed. If that
    > happens the app says so and puts the link on your clipboard instead: open your
    > browser and paste it into the address bar.
12. Opening a record always starts you at that record, with one box — every time, however
    you left the window last time. 📸
    > If an arrangement is worth coming back to, say so: `⋯` → **Save preset**, name it,
    > and it is waiting in that same menu next time.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`RD-92` · `RD-93` · `RD-94` · `RD-95` · `RD-96` · `RD-97` · `RD-98` · `RD-99` · `RD-100` · `RD-101` · `RD-102` · `RD-103` · `RD-104` · `RD-105` · `RD-106` · `RD-121`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-21).
:::
