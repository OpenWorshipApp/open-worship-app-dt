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

/**
 * How a study file is written (2026-11-09, EC-464): shared by the study
 * ask's own prompt (`studyFileChatHelpers.ts`) and `STUDY_FILE_PROMPT`.
 * Diagram rules are what `lintStudyContent` and the help window's mermaid
 * parse refuse, said first.
 */
export const STUDY_CONTENT_RULES =
    'Write it in the language of their question. Sections with ## ' +
    'headings: the setting, the passage verse by verse, its people and ' +
    'places, 2 to 4 diagrams, cross references, key themes, how to live it, ' +
    'questions for discussion. Each diagram in a ```mermaid block and of a ' +
    'different kind -- a flowchart of how the passage moves, a timeline, a ' +
    'mindmap of its themes, a graph of its people and places, a ' +
    'sequenceDiagram of a dialogue; in a flowchart or graph every node ' +
    'label in double quotes; no HTML, no %%{init}%%, no click. Never quote ' +
    'a verse: [^Isaiah 40:3] alone on a line has the app quote it from ' +
    'their Bible, and inside a sentence names it.';

/**
 * What a Resources, Bible Reader or lookup conversation tells its model
 * about a study FILE, beside `NOTE_CREATE_PROMPT` (EC-464): those asks are
 * offered `owa_resource_file`, whose `draft` writes nothing -- the person
 * presses Create under the answer.
 */
export const STUDY_FILE_PROMPT =
    'Asked for a study FILE -- a resource, a study file, study content or ' +
    'a Markdown file, not a note -- call owa_resource_file action "draft" ' +
    'at once with `ref` (the passage), a 2-6 word `title` and the whole ' +
    'study as Markdown `content`; never ask what to write. ' +
    `${STUDY_CONTENT_RULES} ` +
    'It saves NOTHING: tell them to press Create under your answer, or ' +
    'Preview to see it with its diagrams; never paste it. To change a ' +
    'study file in Resources → Default, `read` it, then `draft` with ' +
    '`file` and the WHOLE new text.';
