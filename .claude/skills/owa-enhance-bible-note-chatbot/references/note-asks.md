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
