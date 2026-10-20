---
id: W-53
title: "Show a song in several languages for everyone to sing (Long Text Show)"
section: "Presenting content"
verify: [PM-163, PM-164, PM-165, PM-166]
screenshots: 1
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-19"
---
# W-53 — Show a song in several languages for everyone to sing (Long Text Show)

**Goal:** put one text — usually a song — on the screen in two or more
languages side by side, each part beside its translation, and let it scroll
while the room sings.

**Quickest for one song:** right-click it in the **Documents** list and choose
**[en:tran:Long Text Show]**. The panel opens on a new session named after the
song, holding it as an **EN** card read from its **[en:tran:Lyric File]**, and
**[en:tran:Show Long Text]** is on as soon as the card has read the song — go
on at step 5, or at step 2 to put a translation beside it. Each press makes
another session; the ones you no longer need are removed from their tab's
menu.

1. Open the **[en:tran:Foreground]** tab and choose **[en:tran:Long Text Show]**
   in the menu. Its panel opens.
2. **Add the languages.** Press **[en:tran:Add Language]** and pick one; press it
   again for the next. Each language gets a card of its own, named by its code
   (KM, EN), and a language can be in the list only once. The top card is the
   left column on the screen; the arrows on a card move it, and its ✕ takes
   that language out.
3. **Give each language its words**, one of two ways, chosen on its card:
   - **[en:tran:Raw Text]** — type a **[en:tran:Title]**, then one box per
     section (a verse, a chorus). **[en:tran:Add Section]** adds the next box;
     the ✕ beside a box removes it and the arrows move it. A line break in a
     box is a line break on the screen.
   - **[en:tran:Lyric File]** — press **[en:tran:Choose Lyric]** and pick one of
     the songs in your Documents list. The card then says the song's title and
     how many parts it sings. The words come from the song in the order it is
     SUNG, so a chorus sung three times is there three times. Chords are left
     out, and so is a part that has chords and no words (an intro, an
     instrumental).
4. **The languages have to line up.** Until they do,
   **[en:tran:Show Long Text]** stays off and the panel says the first thing
   that does not match: typed languages need the same number of sections, none
   of them empty, and two songs need the same parts in the same order. It
   reads like this: _The songs do not have the same structure: 1. KM Verse 1 ≠
   EN Intro_.
5. Tick the screen in the Mini Screen panel and press
   **[en:tran:Show Long Text]**. Each language is a column under its title and
   each section is a numbered row, so a verse sits beside its translation. 📸
   It takes the place of a Bible passage or a slide on that screen.
6. **Let it scroll.** On the Mini Screen card, press the double arrow at the
   bottom right of the picture: the text starts moving up by itself, on the
   screen too.
7. **Jump to a part.** Every card lists its parts as buttons — `1 Verse 1`,
   `2 Chorus` … on a song, the section's own number on typed text. While the
   text is on a screen, press one and that row is marked, faintly, and
   brought to the middle of the screen in every language. The button you
   pressed stays lit, on every language's card, so the panel shows where the
   song has got to. A chorus sung twice
   has two buttons, and each goes to its own row. On a song's card each
   part starts as a card holding that part's words, run on in one line with
   a slash between its lines, for following the song by its words — press
   anywhere on a card to bring it to the middle. The first button of that
   row, **[en:tran:View as Text Cards]**, turns them into small buttons
   with only the part's name, and back; the card remembers which.

   **Step with the keys.** Once you have pressed a part, its button has the
   keys, the way the slides do: **Space**, **→**, **↓** or **Page Down**
   presses the next part's button, and **Shift+Space**, **←**, **↑** or
   **Page Up** the one before. The light and the keys move along with it, on
   the card you pressed, so you can follow the song from the keyboard or a
   presenter remote. It stops at the last part, and at the first: it never
   goes round to the beginning. A part that is not lit keeps its own keys —
   **Space** presses that one.
8. **Give a language its own look.** Open **[en:tran:Properties]** on its card:
   **[en:tran:Font Family]**, **[en:tran:Text Color]**,
   **[en:tran:Text Size (%)]** (its size beside the other languages — 80 makes
   it a little smaller) and **[en:tran:Text Align]**. A change reaches a
   showing text about half a second after you stop. Whatever you leave alone
   follows the screen's own Bible text style.
9. **Change the words.** Edit a card and press **[en:tran:Show Long Text]**
   again: what is on the screen is the text as it was when you last pressed it.
10. **Take it down.** **[en:tran:Hide Long Text]** beside the show button, or
    **[en:tran:Clear Long Text]** (the **LT** button) or
    **[en:tran:Clear Foreground]** (**FG**) on the Mini Screen card.
11. The tabs at the top of the panel keep several texts — a song a tab — each
    with its own languages and looks.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-163` · `PM-164` · `PM-165` · `PM-166`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-19).
:::
