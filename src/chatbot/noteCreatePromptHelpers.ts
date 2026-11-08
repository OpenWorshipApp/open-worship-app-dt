/**
 * What a conversation that TEACHES -- a passage in the Bible Reader, a
 * person, place or word study from a lookup panel, a Resources file -- tells
 * its model about Bible notes (2026-11-08, the user, with a Reader chat that
 * answered "make a bible note for me" with words to copy and paste:
 * _chatbot should be able to create new bible note (not allow delete),
 * after create should open the note and attach to the chatbot session_,
 * then the goal _chatbot can put a lesson to a new bible note for user_).
 *
 * Each of those asks is offered `owa_bible_note` (`MODEL_ASK_SHARED_TOOL_MAP`
 * in `tools/owa-devtools-mcp/modelTools.mjs`); the window opens the note it
 * made and attaches it to the tab (`readCreatedNote`). Seen live the same
 * day: told only that it could, gemma4:cloud asked "what would you like the
 * title and the text to be?" -- hence "never ask what to write".
 *
 * A leaf with no imports: three prompt modules read it at load.
 */
export const NOTE_CREATE_PROMPT =
    'Asked to make, write or keep a NOTE -- or to put an answer or a lesson ' +
    'of this conversation into one -- make it at once in their Bible Notes ' +
    'with owa_bible_note action "add": the `title` and `text` written by ' +
    'you, a lesson given whole in its own words, about what this ' +
    'conversation is on unless they name something else, with # headings, ' +
    '- lists, **bold**, and a verse as [^Genesis 2:7], which the app fills ' +
    'in from their Bible. Never ask what to write in it, never say you ' +
    'cannot, never hand them words to copy; the app opens the note for them.';
