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
 * A leaf with no imports: three prompt modules read it at load, and the
 * note conversation and `askLlmBot` its lesson rules.
 */
/**
 * What a lesson holds, short enough to ride in a prompt (BN-65, 2026-11-10):
 * a lesson asked for in ANY language gets its shape, where the hints below
 * are put on by readers of English (and a language's own `lessonAsks`). The
 * long form, `PREACHING_LESSON_SHAPE`, still rides on a lesson ask read.
 */
export const LESSON_OUTLINE =
    'A lesson or sermon you write runs, in order: the main passage alone ' +
    'on a line as its token (the app prints it), then "## " Big idea, ' +
    'Background, Introduction, three numbered points (each: its verse ' +
    'token, what it means, an example from life, how to live it), Pointing ' +
    'to Jesus, Response, Closing prayer, Questions for discussion, Memory ' +
    'verse.';

export const NOTE_CREATE_PROMPT =
    'Asked to make, write or keep a NOTE -- or to put an answer or a lesson ' +
    'of this conversation into one -- make it at once in their Bible Notes ' +
    'with owa_bible_note action "add": the `title` and `text` written by ' +
    'you, a lesson given whole in its own words, about what this ' +
    'conversation is on unless they name something else, with # headings, ' +
    '- lists, **bold**, and a verse as [^Genesis 2:7], which the app fills ' +
    'in from their Bible. Never ask what to write in it, never say you ' +
    'cannot, never hand them words to copy; the app opens the note for them. ' +
    LESSON_OUTLINE;

// --- a lesson to preach --------------------------------------------------------
//
// 2026-11-10, the user's goal: _chatbot completely smart enough to help
// prepare a best preaching lesson_. What a model was told of a lesson was
// "a lesson given whole in its own words", and what it wrote was a title,
// three bullets and a verse -- notes for a lesson, not one a volunteer can
// stand up and preach. `PREACHING_LESSON_SHAPE` is what one holds, in the
// order it is preached: the passage READ first (a token alone on its line
// is the passage printed whole, `agentNoteMarkupHelpers.ts`), one big idea,
// the background, a way in, points that each say, mean, show and apply,
// the gospel in it, a response, a prayer, questions for a group and a verse
// to keep. It rides only on an ask for a lesson (the hints below and
// `noteChatHelpers.ts`'), never in a system prompt: it would be paid on
// every round of every question.

/** What a preaching lesson holds, in the order it is preached. */
export const PREACHING_LESSON_SHAPE =
    'WHAT A LESSON HOLDS, ready to preach in plain warm words (a devotion ' +
    "or a children's lesson shorter and simpler, in the same order): the " +
    'main passage alone on a line as its token -- [^John 10:11-18] -- which ' +
    'the app prints whole from their Bible; then "## " headings: Big idea ' +
    '(the one sentence the lesson teaches), Background (who, to whom, what ' +
    'was happening, in two or three sentences), Introduction (a question ' +
    'or a short story from everyday life that leads in), three points -- ' +
    'each "## 1. " and a sentence that states it, then what its verses say ' +
    'with a [^ref] token, what it means, an example from life, and how to ' +
    'live it this week --, Pointing to Jesus, Response (what to believe, ' +
    'decide or do), Closing prayer (written out), Questions for discussion ' +
    '("- " items) and Memory verse ([^ref]). A verse is a token, never ' +
    'typed out.';

const LESSON_NOUN =
    '(?:lesson|devotion(?:al)?|outline|sermon|homily|bible study)(?!\\s+plan)\\b';
// One to three describing words between "a" and the noun, never a word
// that ties it to something else ("a picture of a shepherd in my lesson").
const LESSON_WORDS =
    "(?:(?!(?:in|my|of|for|to|the|this|on|about|with)\\b)[\\w'-]+\\s+){0,3}?";
// BN-55 (2026-11-09, the elder run): a writing word before a lesson,
// devotion or outline that is "a" or "new" -- "help me with my lesson",
// "make the lesson bigger" and "is this a good lesson?" are not it.
const NEW_LESSON_ASK_PATTERN = new RegExp(
    [
        `\\b(?:write|make|create|prepare|plan|draft|give|need|want|like|start)\\b[^.?!]{0,40}?\\b(?:a|an|another|new|one more)\\s+${LESSON_WORDS}(?:${LESSON_NOUN}|version of this)`,
        `\\b(?:make|write|create|need|want|start)\\s+(?:me\\s+)?(?:a\\s+)?${LESSON_NOUN}`,
        `\\bwrite\\s+the\\s+${LESSON_NOUN}\\s+(?:about|on)\\b`,
        `^\\s*(?:please\\s+)?(?:(?:a|an)\\s+)?${LESSON_WORDS}${LESSON_NOUN}\\s+(?:(?:about|on)\\b|for\\b[^.?!]{0,40}\\bplease\\b)`,
    ].join('|'),
    'i',
);
// Wider, where no lesson is attached to be meant instead: "help me prepare
// my sermon on John 10", "I'm preaching from Psalm 23 on Sunday".
const LESSON_WRITE_ASK_PATTERN = new RegExp(
    [
        `\\b(?:write|make|create|prepare|plan|draft|give|need|want|start|build|help)\\b[^.?!]{0,40}?\\b${LESSON_NOUN}`,
        '\\bpreach(?:ing)?\\b[^.?!]{0,40}?\\b(?:on|about|from)\\b',
        `^\\s*(?:please\\s+)?(?:(?:a|an|my)\\s+)?${LESSON_WORDS}${LESSON_NOUN}\\s+(?:about|on|from)\\b`,
    ].join('|'),
    'i',
);
// Asking how, where or what is a question, not an ask to write one:
// "how do I write a sermon in a note?", "what should I preach on?".
const LESSON_QUESTION_PATTERN =
    /^\s*(?:how|where|what|which|why|who|when)\b|\bhow (?:do|can|should) i\b/i;
// Their OWN lesson made whole: "finish my sermon", "fill in the rest of
// this lesson", "make this outline a full sermon". The lesson is named and
// is theirs: "improve it" under a drawing is about the drawing, and "write
// a complete lesson about Joseph" is a new one.
const LESSON_FINISH_ASK_PATTERN = new RegExp(
    [
        `\\b(?:finish|complete|fill (?:in|out)|flesh out|develop|improve|strengthen|expand|polish)\\s+(?:(?:in|out|up)\\s+)?(?:the rest of\\s+)?(?:the|my|this|our)\\s+(?:[\\w'-]+\\s+){0,2}?(?:${LESSON_NOUN}|notes\\b)`,
        `\\b(?:make|turn)\\s+(?:it|this|my\\s+\\w+)\\s+(?:into\\s+)?(?:a\\s+)?(?:full|whole|complete|proper|real)\\s+${LESSON_NOUN}`,
    ].join('|'),
    'i',
);
// "finish it please", "can you complete this?" -- a lesson named by "it",
// read so only beside a note that IS a lesson (BN-67, 2026-11-10: a sermon
// short of its background and its points' words, asked so, got no finish
// hint at all, and the model added the closing parts and stopped).
const BARE_FINISH_ASK_PATTERN =
    /^\s*(?:(?:please|can you|could you|would you|will you|help me)\s+)*(?:finish|complete|fill in|flesh out)\s+(?:it|this|the rest(?:\s+of it)?)(?:\s+(?:off|up|for me|now|please))*\s*[.!?]*\s*$/i;

/** Whether a short ask is to finish "it": a lesson only beside one. */
export function checkIsBareFinishAsk(text: string) {
    return BARE_FINISH_ASK_PATTERN.test(String(text ?? ''));
}

// What they think of it: "review my sermon", "is this a good lesson?",
// "is it ready to preach?". The lesson is named here too: "what do you
// think of the colour?" is about the colour.
const LESSON_REVIEW_ASK_PATTERN = new RegExp(
    [
        `\\b(?:review|critique|look over|check over|go over)\\b[^.?!]{0,30}?\\b(?:${LESSON_NOUN}|it|this|my notes\\b)`,
        `\\b(?:feedback|what do you think|your opinion|suggestions?|how can i (?:make|improve))\\b[^.?!]{0,30}?\\b(?:${LESSON_NOUN}|my notes\\b)`,
        `\\bis\\s+(?:this|my|it|the)\\s+(?:${LESSON_NOUN}\\s+)?(?:a\\s+)?(?:good|ready|clear|ok|okay|strong)\\s+(?:${LESSON_NOUN}|enough|to preach)`,
        '\\bready to (?:preach|teach)\\b',
    ].join('|'),
    'i',
);
// Their lesson made to fit less time: "it is too long", "make it fit 15
// minutes", "shorten my sermon". A line made shorter ("make the title
// shorter") is not it.
const LESSON_SHORTEN_ASK_PATTERN = new RegExp(
    [
        `\\b(?:it|this|the (?:${LESSON_NOUN}|note)|my (?:${LESSON_NOUN}|note))\\s*(?:is|'s)\\s+(?:too|a bit too|way too)\\s+long\\b`,
        '\\b(?:fit|into|under|within|down to)\\s+(?:about\\s+|only\\s+)?(?:\\d{1,2}|ten|fifteen|twenty|twenty-five|thirty)\\s*(?:-|\\s)?min(?:ute)?s?\\b',
        `\\b(?:shorten|trim|condense|cut down)\\s+(?:it|this|the (?:${LESSON_NOUN}|note)|my (?:${LESSON_NOUN}|note))`,
        `\\bmake\\s+(?:it|this|the (?:${LESSON_NOUN})|my (?:${LESSON_NOUN}))\\s+shorter\\b`,
    ].join('|'),
    'i',
);

/** Whether they asked for their lesson made to fit less time. */
export function checkIsLessonShortenAsk(text: string) {
    return LESSON_SHORTEN_ASK_PATTERN.test(String(text ?? ''));
}

/** Whether they asked for a lesson, devotion or outline of its own. */
export function checkIsNewLessonAsk(text: string) {
    return NEW_LESSON_ASK_PATTERN.test(text);
}

/** Whether the words ask how, where or what -- a question, not a job. */
export function checkIsLessonQuestion(text: string) {
    return LESSON_QUESTION_PATTERN.test(String(text ?? ''));
}

/** Whether they asked for a lesson to be written, wherever it is to go. */
export function checkIsLessonWriteAsk(text: string) {
    const line = String(text ?? '');
    return (
        !checkIsLessonQuestion(line) &&
        (NEW_LESSON_ASK_PATTERN.test(line) ||
            LESSON_WRITE_ASK_PATTERN.test(line))
    );
}

/** Whether they asked for their own lesson to be made whole. */
export function checkIsLessonFinishAsk(text: string) {
    return LESSON_FINISH_ASK_PATTERN.test(String(text ?? ''));
}

/** Whether they asked what their lesson is worth, or how to better it. */
export function checkIsLessonReviewAsk(text: string) {
    return LESSON_REVIEW_ASK_PATTERN.test(String(text ?? ''));
}

/**
 * The line a lesson ask carries where no note is attached -- a Bible Reader,
 * a lookup, a Resources file or an ordinary tab -- beside a tool list that
 * holds `owa_bible_note` (`askLlmBot`).
 */
export const LESSON_MAKE_HINT =
    '(This asks for a lesson: make it at once as a new Bible note -- ' +
    'owa_bible_note action "add", its `title` the lesson\'s and its `text` ' +
    'the whole lesson -- about what they named, else what this conversation ' +
    'is on; never words to copy. When nothing names a passage or a ' +
    'subject, ask only which passage, with OPTIONS of three. ' +
    `${PREACHING_LESSON_SHAPE})`;

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
