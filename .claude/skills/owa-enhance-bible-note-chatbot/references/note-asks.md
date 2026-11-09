# Note asks — the standing set

Asked in a note conversation (a note row's **Open in Chatbot**) on a scratch
profile, through `scripts/ask-note-chat.mjs`, on Auto. Grade each: tool calls
(one edit call is the bar), the fields sent, the note on a screenshot of the
note window, and the answer saying only what the tool's summary lists. Use a
note with a heading, a few paragraphs, a list and a passage; undo between
asks (**Undo this change** or _undo that_).

## Text and the toolbar

1. _Make the word grace red and bold_ — `{block, words: "grace", color, styles}`
2. _Make the text bigger_ — done by the window, no model
3. _Make only the heading bigger_ — `{block, size: "larger"}` on the heading
4. _Use Georgia for the whole note_ — `font` on every block with words
5. _Highlight the verse references_ — `styles: ["highlight"]` with `words`
6. _Put the second point in capitals_ — `styles: ["uppercase"]`
7. _Write 2 as a superscript in m2_ — `words: "2"`, `styles: ["superscript"]`
8. _Clear the formatting of the first paragraph_ — `clear: true`
9. _Centre the title_ — `align: "center"`
10. _Indent the second bullet under the first_ — `indent: "more"` on a list item

## Insert menu

11. _Add a table of the three readings with book and chapter_ — `table`
12. _Add a pink sticky note saying call Tom_ — `sticky`, `color: "pink"`
13. _Put today's date at the top_ — `date`, `after: 0`
14. _Add a poll: which hymn next, Amazing Grace or Be Thou My Vision_ — `poll`
15. _Add the equation 7 × 70 at the end_ — `equation` (`7 \times 70`)
16. _Add two columns: Law on the left, Gospels on the right_ — `columns`
17. _Embed this video https://www.youtube.com/watch?v=…_ — `video`
18. _Add a page break before the application section_ — `page-break`
19. _Put John 3:16 in as a passage under the heading_ — `passage`, `ref`
20. _Mention Moses in the first line_ — `[@Moses]`, a mention from the names lookup

## History and the person's own

21. _Undo that_ — action `undo`; _redo it_ — action `redo`
22. _How do I draw a diagram in this note?_ — the editor's guide (Excalidraw), no change

## Every language (2026-11-08, the goal _work great for all languages_)

On a scratch profile with each language installed (`npm run lang:pack --
--pack=<codes>`, then `owa_language install`) and a Bible of each (the Bible
import's `check` and `import` over a fresh stdio server, or a copy of the
person's own `bibles-data/<key>.xml`), the Lookup left on another Bible, one
note per language (`owa_bible_note add` with mark-up and a verse token naming
its Bible). Ask in the language; grade as above, plus: the answer in the
language typed, the button names as the window shows them.

23. Colour ONE word that also starts a longer word, in a script with no
    spaces -- Khmer _ព្រះ_ beside _ព្រះជាម្ចាស់_, Thai _พระ_ beside _พระเจ้า_:
    that word alone (`words`, BN-24)
24. _Make the text bigger_ in the language -- every block `size: "larger"`
25. _Add a line at the end: …_ with words in the language -- written as given
26. _Put John 1:1 under the first line_ in the language -- `passage`, read
    from that language's Bible (`bible` filled in by the window, BN-26), in
    its own digits
27. The note's card in a window of the note's own language -- the translate
    pair offers English (BN-25)
28. On an assistant that is not a Gemma 4 (Free's Nemotron): a word of the
    note named in the language -- `words` in the note's own letters (BN-23)
29. _Make the text bigger_ / _make all the letters bold_ typed in a language
    whose `assistant.json` says them (Khmer, French) -- done by the WINDOW,
    no model (point the tab at a stand-in model and count its requests: 0)
30. **Undo this change**, then at once another change -- one edit, the read
    carrying the restored note (BN-28)
31. _Make the text bigger_ and _make the first line bold_ in EVERY installed
    language at once (two scratch copies, 42 languages each; the lines in
    `src/lang/data/tests/chatbot/typedEditAsks.json`, the first-line one
    with the loanword "bold" where the language's own word is a colour) --
    the size done by the window, the bold in one edit, and the answer in the
    language TYPED, never a neighbour sharing its little words or its script
    (BN-31, BN-33, BN-34)
32. On Free: _add a line at the end saying …_ typed in Khmer, Arabic, Thai,
    Chinese, Russian and Spanish, twice each -- the words go in exactly as
    typed, the answer in the language (BN-23, BN-30)

## Messy notes and drawings (2026-11-09, BN-51, BN-58)

On notes written the way a person types -- parts as plain lines
(_points_, _prayer_), three questions on one line, a reference in words
(_luke 15 verse 4 to 7_), a note all in capitals, and one run-on paragraph
-- press the card's **Format it so it is neat and easy to read**: one edit,
the title h1, each part h2 in normal case, items split one a line, the
reference a verse mention, every word kept but the joining ones
(`scratchpad note-words` compare: lost and added words).

33. _Format it so it is neat and easy to read_ on each messy note -- one call
34. _my note is messy can you tidy it up_ -- the same
35. _make a drawing of my three points_, then _make the drawing bigger_,
    _colour the boxes green_, _draw it going across_, _add one more box
    saying …_ -- each one edit of the drawing block
36. _draw me a sheep_ -- no change, said it cannot draw a picture

The whole elder corpus (600 asks) is `elder-asks.json`, run by
`run-elder-asks.mjs` (SKILL.md §2).
