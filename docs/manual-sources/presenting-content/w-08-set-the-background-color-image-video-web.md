---
id: W-08
title: "Set the background (color / image / video / web)"
section: "Presenting content"
verify: [PM-26, PM-27, PM-28, PM-29, PM-30, PM-31, PM-32, PM-33, PM-101, PM-114, PM-144, PM-145, PM-181, PM-182, PM-183, PM-184, PM-185, PM-186, PM-187, PM-188, PM-189, PM-190, PM-191, PM-192, PM-195, KB-04]
screenshots: 5
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-15"
---
# W-08 — Set the background (color / image / video / web)

**Goal:** put something behind your content.

1. Find the **[en:tran:Background]** panel at the bottom of the middle column,
   open with its tabs showing. If it has been folded to a thin bar, click the
   bar and the panel opens again. 📸
2. Pick a tab: **[en:tran:Fills] / [en:tran:Animations] / [en:tran:Images] / [en:tran:Videos] / [en:tran:Cameras] / [en:tran:Webs]**.
   - **[en:tran:Fills]:** a plain color, a gradient or a pattern. Click a color swatch, or a tile
     under **[en:tran:Gradients]** or **[en:tran:Patterns]**. **[en:tran:Dark]** /
     **[en:tran:Light]** at the top swaps the rows below between deep and pale ones. A tile with
     a small wind mark moves on the screen; the tile itself and the Mini Screen stay still. If a
     color could clash with the Bible text, the app changes the text color so it stays visible
     and says so in a message with its own **[en:tran:Undo]** — it asks nothing. 📸
   - Once a screen holds a fill, the tab has a section for each such screen. The arrow at the
     left of its line, in that screen's color, folds the section to that line, which then shows
     the screen's number and what it holds; press the arrow again to open it.
   - **[en:tran:Customize]**, beside the tiles while a screen holds a gradient or a pattern,
     changes its colors, **[en:tran:Type]**, **[en:tran:Angle]**, **[en:tran:Size]** and
     **[en:tran:Speed]**; the screen follows half a second after you stop. Each color has its own
     **[en:tran:Opacity]** slider beside it (0 lets what is behind the screen show through, 255
     is solid), and its well is drawn that faint over a checkerboard. The sliders button at the
     end of the **[en:tran:Gradients]** line opens and closes it.
   - **[en:tran:Save as Preset]**, under the patterns, keeps what is up as a button of its own
     under **[en:tran:Presets]**.
   - Right-click a gradient or pattern tile, or a saved button, → **[en:tran:Copy CSS]** to
     take its CSS somewhere else, at a screen's size. A still one copies as its lines of CSS; a
     moving one as a short stylesheet that moves it as the screen does — put the class
     `owa-fill` on what it is to fill.
   - **[en:tran:Animations]:** a moving background made for worship — snow, light rays, a
     sunrise, flames, a cross in glory — in two kinds: **[en:tran:CSS Animations]**, light
     enough for any computer, and **[en:tran:GLSL Shaders]**, drawn by the graphics card.
     Every tile is still; rest the pointer on one to see it move, and click it to put it on
     the screen. Only the screen moves: the Mini Screen and every preview show one still
     frame. 📸
   - **[en:tran:Customize]**, beside the tiles while a screen holds an animation, changes its
     **[en:tran:Effect]**, its colors (the first is the **[en:tran:Background Color]**, each
     with its own **[en:tran:Opacity]**), **[en:tran:Speed]**, **[en:tran:Density]** (CSS)
     or **[en:tran:Quality]** (a shader: lower is lighter on an old computer), the whole
     animation's **[en:tran:Opacity]** and its **[en:tran:Blend Mode]** with what is behind
     the screen; the screen follows half a second after you stop. **[en:tran:Save as Preset]**
     keeps it as a button under **[en:tran:Presets]**.
   - A shader's **[en:tran:Edit Code]** opens **[en:tran:Shader Code]**: its code beside a
     moving preview. A mistake shows under the preview with its line, and
     **[en:tran:Apply]** waits until there is none; **[en:tran:Reset]** puts the code back
     as it was. Short shaders written for Shadertoy (a `mainImage`, no textures) can be
     pasted in.
   - Right-click a tile → **[en:tran:Copy Code]** to take the animation somewhere else: a
     CSS one as a whole web page (paste it into a page file of your own in the Web Editor,
     W-15, and the **[en:tran:Webs]** tab shows it), a shader as its code.
   - **[en:tran:Images] / [en:tran:Videos]:** **click** an item to make it the live background;
     click the same item again to take it off. 📸
   - **[en:tran:Cameras]:** pick a connected camera device.
   - **[en:tran:Webs]:** click a saved page, or use the **⋮** next to the folder path (or
     right-click the empty list) → **[en:tran:Add URL]** to add one (a small box asks for the
     web address; the Web Editor, W-15, is for a page file of your own).
     **A saved address cannot be edited.** To change it, right-click its tile →
     **[en:tran:Remove URL]** (it asks first, and is not offered while that page is on a
     screen), then **[en:tran:Add URL]** with the new address — on the tab's **⋮** at the
     right of the folder path, or a right-click on an empty part of the list.
3. The live background's tab carries the on-screen dot before its name (e.g. `● Videos`).
4. Press **F7** ([en:tran:Clear Background]) to remove it.

**Thumbnail view vs list view (Images / Videos / Web).** By default each tab shows
picture previews. If you have a lot of files — or the app feels slow on an older
machine — switch to a plain name list: click the small **⋯** button at the bottom-left of the Background panel
(**[en:tran:Reveal Hidden Controls]**) to bring up the footer bar, then
click the **list** icon (`☰`, **[en:tran:List View]**) at its far right; the **grid** icon
beside it (**[en:tran:Thumbnail View]**) switches back. 📸 The list shows each file's full name (with its extension), which screens it is
showing on, and its colour dot — clicking a row still puts it on screen exactly like a
thumbnail. Each tab remembers its own choice, and it survives restarting the app. The
thumbnail-size slider only appears in thumbnail view.

**Folder sessions (Images / Videos / Webs / Audios).** Above each of those lists is a
row of small buttons: **[en:tran:Default]**, then any you add with **＋**. Each one is a folder of
its own — with its own view mode, sort and slide show — so you can flick between this
Sunday's pictures on a memory stick and your standing set of backgrounds without ever
re-pointing the folder the app was set up with. **[en:tran:Default]** IS that folder: it is the
one Path Settings names, and adding sessions never touches it. A new session starts with
no folder and offers to use the default one. To point a session at a folder of your own,
press the folder line above the list (the path it is reading): a box opens under it — type
the folder's path and press Enter, or press **[en:tran:Choose a folder]** (the folder icon)
and pick it. The **⋮** on the session you are on (or a
right-click on any of them) renames or removes it — **[en:tran:Default]** can be renamed,
never removed. Removing forgets that session's folder and slide show — never the files
themselves. **[en:tran:Documents]**, **[en:tran:Presenting Flows]**, **[en:tran:Bibles]**
and **[en:tran:Bible Notes]** carry the same row under their titles (W-58). On the Images, Videos and Webs tabs
the slide show sits on the same row, and a blue ▶ on a button means that session's show
is still running while you look at another one.

**Sessions and a slide show on Fills and Animations.** The **[en:tran:Fills]** and
**[en:tran:Animations]** tabs carry the same row of session buttons above their tiles:
**[en:tran:Default]**, then any you add with **＋**. A session there keeps its own saved fills or
animations under **[en:tran:Presets]**, so one can hold this season's colours and another the
youth service's; Default's are the ones **[en:tran:Fill Show]** and **[en:tran:Animation Show]**
offer too (W-09). Removing a session forgets its saved ones and its show. Once a screen holds the
tab's kind, the row also carries the slide show: press **[en:tran:Start Slide Show]** (▶) and,
every so many seconds — the number beside it — each screen holding one moves on to the next tile
of the row the one up is in: the next shader, the next CSS animation, the next gradient or
pattern on the side **[en:tran:Dark]** / **[en:tran:Light]** shows, or the session's next saved
one when the one up is among them. How the screen had it fitted and styled goes with it. A colour
from the palette, or a tile changed in **[en:tran:Customize]**, belongs to no row and stays where
it is. A screen has one background, so a tab runs one show: starting it in another session stops
the first, and the blue ▶ moves to that session's button. **[en:tran:Clear Background]**
(**F7**) ends the show, and putting a tile up afterwards does not start it again.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-26` · `PM-27` · `PM-28` · `PM-29` · `PM-30` · `PM-31` · `PM-32` · `PM-33` · `PM-101` · `PM-114` · `PM-144` · `PM-145` · `PM-181` · `PM-182` · `PM-183` · `PM-184` · `PM-185` · `PM-186` · `PM-187` · `PM-188` · `PM-189` · `PM-190` · `PM-191` · `PM-192` · `PM-195` · `KB-04`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-15).
:::
