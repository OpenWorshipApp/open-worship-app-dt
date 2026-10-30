---
id: W-19
title: "Draw and spotlight on the app itself (Presenting Control)"
section: "Configuration"
verify: []
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-29"
---
# W-19 — Draw and spotlight on the app itself (Presenting Control)

**Goal:** annotate **the app window** — not the audience screen — while showing the app
to other people (a training session, a screen share, a projector mirroring your laptop).
The audience screen has its own Draw and Focus tools on the mini-screen card (W-10);
this is the same pair of tools pointed at the app.

1. Open the **Tools** menu → **[en:tran:Start Controlling]**, or press **Ctrl+Shift+P**
   instead (**⌘+Shift+P** on Mac) — one or the other. **Every window of the app answers it** — the Presenter, the Bible Reader, the
   Slide Editor, a Bible Note, Settings, the Web Editor, the Lyric Editor, Local Web
   Share and Screen Mirror — and the one you are looking at is the one that gets the panel. (The projector
   output, the About box, the Find bar and the help window deliberately do not: an overlay on what the
   congregation sees is the one place this must never appear. AI Chat and the Markdown
   preview have none either.) The menu bar is hidden on
   the smaller windows, so the shortcut is the way in there.
   A floating **[en:tran:Presenting Control]** panel appears — drag it by its title bar,
   resize it from any edge or corner, double-click the title bar to fill the window (and
   again to put it back), and collapse it with the chevron once a tool with settings is
   showing; it reopens where and how you last left it. 📸
2. The **title bar** carries everything you reach for mid-presentation: the four tools on
   the left, then the **keyboard screencast** switch (W-20) and **[en:tran:Undo]** / **[en:tran:Redo]** /
   **[en:tran:Clear drawing]** on the right. Only the settings live in the body, so collapsing the panel
   with the chevron leaves every group one click away — roll it up to get the sliders out
   of the way and keep drawing.
3. The panel opens on the **arrow** tool — the app stays completely usable and
   anything already drawn stays visible on top of it. The arrow has no settings of its
   own, so on it the panel is **just its title bar**: no empty body sitting over the app
   you have just asked to have back, and no chevron either, because there is nothing to
   roll up. Pick the brush, eraser or spotlight and the body opens again at the size you
   last left it.
4. Click the **brush** to draw. A thin teal frame around the window shows the app is no
   longer taking clicks; drag anywhere to draw. Pick **[en:tran:Color]**, **[en:tran:Size]** (`[` / `]`) and
   **[en:tran:Opacity]** (`-` / `=`), and switch the stroke style with **[en:tran:Straight]** (`S`), **[en:tran:3D]**
   (`3`) or **[en:tran:Dots]** (`D`). **[en:tran:HQ]** (`Q`) trades smoothness for speed on weak machines. 📸
5. Click the **eraser** to rub parts of the drawing out, and use the title bar's
   **[en:tran:Undo]** / **[en:tran:Redo]** (`Ctrl+Z` / `Ctrl+Shift+Z`) to step back or the red **[en:tran:Clear drawing]** (`C`)
   to wipe it — one Undo brings a mis-hit Clear back. All three grey out when there is
   nothing to undo, redo or clear, and all three keys work from any **armed** tool (brush, eraser or
   spotlight) and with the panel **collapsed**. On the arrow tool those keys go to the app
   instead, and only the buttons act on the drawing.
6. Click the **spotlight** to dim the whole app except a circle. In **[en:tran:Follow]** (the
   default) the circle simply tracks your pointer; press the **[en:tran:Follow]** button itself (`H`) and it reads
   **[en:tran:Hold]**, which dims only while the mouse button is down. **[en:tran:Contrast]** (`X`) inverts it — the
   circle becomes the blocked area instead. Size, dim amount and **edge
   blur** (`,` / `.`) have sliders, and **[en:tran:Dim color]** picks the colour of the dimming. 📸
7. The **camera** at the end of the title bar takes a picture of the app **as it looks
   right now** — your drawing, your spotlight and all — and asks what to do with it:
   **[en:tran:Ask the assistant about this]** opens the help window with the picture already
   attached, so "what is this?" is one press and one sentence; **[en:tran:Copy]** puts it on the
   clipboard; **[en:tran:Save into your images]** puts it in the Background Images folder, where
   it can then be presented like any other picture. The help window itself never appears
   in the shot, even when it is sitting on top of the app. 📸
8. Press **Escape** (or click the arrow) to hand the app back while keeping the
   drawing on screen. Move the panel if it covers what you are pointing at.
9. Click **✕** in the panel header to finish. The drawing is discarded; it is not saved
   between sessions. **Ctrl+Shift+P** and **Tools → [en:tran:Start Controlling]** are a toggle:
   pressed again while the panel is open, they close it — and the drawing goes with it,
   exactly as **✕** does. While a drawing tool is armed the shortcut does nothing — the
   keyboard belongs to the drawing then: press **Escape** first, or use the menu entry,
   which closes the panel either way.

> Note: the panel owns the keyboard only while a tool is **armed** — the same moment it
> owns the pointer. On the **arrow** tool the app keeps every key it normally has (the
> Bible Lookup's Enter and Escape, `F5`–`F10`, `Ctrl+B`, `Ctrl+Z`, slide navigation)
> while `V` `B` `E` `F` `K` still reach in to pick a tool; whatever holds the keyboard
> still wins, as the tool letters defer while you are typing in a field and while a
> screen preview's own draw/spotlight overlay is focused. Arm a tool and the picture
> flips: the overlay covers the **whole** window and the app takes **nothing** — not a
> click, not a key. Every keystroke is swallowed before the app sees it, down to the
> plain ones nothing is bound to: typing goes nowhere, `Space` and the arrows stop
> scrolling, `Tab` stops walking the focus ring, and a dialog behind the overlay stays
> deaf. Only the panel's own keys stay live (`V` `B` `E` `F`, `Escape`, `Ctrl+Z` /
> `Ctrl+Shift+Z` / `C`, which now act on the **drawing**), along with anything typed into
> the panel's own sliders and color box. Escape or the arrow tool hands everything
> straight back. The Undo / Redo / Clear **buttons** work in every tool regardless.
