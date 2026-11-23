---
id: W-56
title: "Change a song with the assistant (translate it, add a part, chords, its key)"
section: "Creating & editing content"
verify: [PL-107, CB-166, PM-168, CB-179, CB-182]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-22"
---
# W-56 — Change a song with the assistant (translate it, add a part, chords, its key)

**Goal:** have the help window change one of your songs for you — put it into another
language, add a verse or a note for the band, change its words, add chords or move it to
another key — without writing the song's own notation.

1. In **[en:tran:Documents]**, right-click a song (a row with the 🎵 note), or click the
   faint **⋮** at its right-hand end (W-01b), and choose **[en:tran:Open in Chatbot]**. 📸
   In the **Lyric Editor**, the robot button left of **Reset** and **Save** does the same
   for the song it shows.
2. The help window opens a chat of its own with the song attached under the box, and a
   card that says what it can change: add a verse or another part, change its words,
   translate it, add chords, change its key, or reorder or remove its parts. 📸
3. Press a button under the card, or type what you want:
   - **Replace the words with …** puts the song into that language in place of its words,
     its title and subtitle too. Do this on a copy (**[en:tran:Duplicate]** in the row's
     menu) when you want both languages: the copy keeps the same parts in the same order,
     which is what **[en:tran:Long Text Show]** needs to show them side by side (W-53).
   - **Add … under each line** keeps the words and writes the translation under each line:
     one song in two languages.
   - The language offered is the one the song's name says, if not English (`Still khmer`);
     else, for a name written in a language other than English, English when the app is
     shown in that language and the app's when it is not; else the one the app is shown in,
     unless that is English: then the buttons say _another language_ and the assistant asks
     which; asked to translate without saying which way, it asks that first.
   - **[en:tran:Add a section]**, **[en:tran:Add chords]**, **[en:tran:Change the key]**:
     the assistant asks for the words or the key when it needs them. A note for the band is
     a part of its own, kept out of the play order and so off the screen -- unless the assistant places it after a part (asked for _after verse 1_, say): placed, it is played there, a slide like any other part.
   - Typed, in your own words: _translate it into Khmer_, _add a verse after verse 2: …_,
     _move it to G_, _take out the bridge_.
   - A word fixed or changed — _fix the typo in verse 1: "grase" should be "grace"_,
     _change "grace" to "mercy" everywhere_, _check the spelling_ — changes those words
     and nothing else: every chord stays on its word and a translation line stays under
     its line. A spelling check leaves an old form such as _'Twas_ alone, and a title that
     holds the word is named in the answer, not changed. _Change the line under the first
     line of verse 1 to …_ changes that translation line alone; _take out the translation
     lines_ takes them all out, the chords kept.
   - Parts and chords — _rename the chorus to Refrain_ renames that part where it stands,
     its chords and lines kept, and every place it plays in the order with it. _Take the
     chords out of the chorus_ (or _remove all the chords from the song_) leaves the words;
     an Instrumental keeps its chords, and the answer says so. _Change every F chord to
     Fmaj7_ changes that chord wherever it is played and leaves F# and F/A alone.
4. The answer says what changed. The change is **not saved yet**: the song shows a red
   **\*** beside its name in **[en:tran:Documents]**. **[en:tran:Undo this change]** under
   the answer puts it back; **[en:tran:Show it in the list]** finds its row.
5. To keep it, press **[en:tran:Save]** in the row under the song's
   **[en:tran:Stage Previewer]** header in the Presenter (**[en:tran:Undo]** there steps it back
   too), or open the song with **[en:tran:Edit]** in its menu and press **Save**. A
   Lyric Editor already open on the song shows the change by itself; if you were typing in
   it at that moment, your typing is kept and the line
   **[en:tran:The assistant changed this song.]** offers **[en:tran:Load the change]**.

**Not there?** **[en:tran:Open in Chatbot]** is in a song's menu only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). When no
assistant can answer, the chat says so and offers **[en:tran:Open AI settings]**: changing a song
needs one.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-107` · `CB-166` · `PM-168` · `CB-179` · `CB-182`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-22).
:::
