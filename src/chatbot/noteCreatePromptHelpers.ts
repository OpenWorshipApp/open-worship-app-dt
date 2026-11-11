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
//
// BN-66 (2026-11-10): 22 lessons made through the window, read by two
// readers against `lesson-rubric.md` (Robinson, Chapell, Stott). What most
// lessons missed is said here in so many words: a stock picture where a
// story was wanted (illustration the weakest criterion, 1.09 of 2), a
// background of one line with nothing that changes how the passage is
// heard, a verse restated where its word wanted explaining, a point
// citing a verse that does not say it, a phrase quoted from another
// translation than the one printed, Jesus added at the end, a response that
// lists without gathering, and a devotion or a children's lesson the length
// of a sermon.
//
// Then a blind before-and-after read of eight of them, shuffled: asked for
// "the one fact of that time" and "a concrete story (who, where, what
// happened)", the model invented both -- shepherds "looked down upon" in
// David's day, a "1944" prisoner exchange and "I remember a friend" told as
// true -- and accuracy fell from 1.88 to 1.38 of 2 while background,
// explanation and illustration rose. Told "TRUE above all" in so many words,
// a second blind read still found 11 errors in eight against 2: Hebrew word
// studies ("blot out" a debt struck off a ledger), a meaning the text does
// not give ("rocks of pride"), "unfailing love" where the KJV the app prints
// says "lovingkindness", and a point on the thorns anchored to Matthew
// 13:8-12 -- the model writes the lesson before the app prints the passage,
// so it quotes and numbers from memory. So the passage is READ first
// (`owa_find_verse`, offered to every ask a lesson is written in) and
// everything is built on the words it returns; a word is explained plainly
// from the words printed, never by a word study; the background is what the
// Bible itself says; a story is told AS an example; the points cover the
// whole passage, and so does a devotion's one point.
//
// BN-82 (2026-11-11): BN-81's thirteen pairs, read blind, missed the same
// things in both runs. Each point was ONE paragraph: its verse said again,
// then an example and a "this week" run on after it. The words a preacher
// reads aloud from the KJV ("moderation", "no more sea", "son of Abraham")
// went unexplained, and no hearer's question was met. The background had
// nothing of what happens just before the passage. Jesus was pointed to
// with a picture the passage does not have. The funeral sermon was
// skeletal. Told in one long sentence what a point holds, the model wrote
// one paragraph. So a point is now a template of lines, each starting with
// what it is, and the background reads the verses before the passage. On
// the first run of it, a hearer's question was asked and never answered at
// every point (told "the question, answered", it wrote the question), so
// the answer has a line of its own. The points also printed their parts of
// the passage end to end: all of it covered, all of it printed twice, which
// for David's 58 verses was a note too long to preach from. So a passage is
// about twenty verses, and a longer story preaches its part.
//
// BN-88 (2026-11-11): read blind with whole passages (BN-86), the errors
// left were the model's own priors, not words it had not read. A custom
// came from commentaries ("asking for his portion was wishing his father
// dead"). A motive the text does not give was put under "The passage
// answers". An example promised a reunion. Pointing to Jesus made the
// Samaritan an allegory of him. So each of those lines says what it may not
// add.
//
// BN-90 (the same read): 24 lessons of 26 opened "Have you ever…", the
// response said the big idea again word for word, and a funeral sent the
// mourners home with a task. The template says otherwise for each.
//
// BN-93 (2026-11-11, the BN-91 read): explanation fell to 1.25 of 2, the
// What it means lines defining one word ("A cubit is a measure of length")
// while the verse's hard phrase went unexplained ("'born of water and of
// the Spirit' never explained"). The hearer's question was one the
// passage leaves open ("'against thee, thee only' asked but never
// answered"), and answering it the model made up a motive. The need was
// shown in a scene and never named, and the introduction never turned to
// the passage. Pointing to Jesus went by a shared word ("He is the Word
// made flesh" from the sower's word, "the ultimate faint one" from
// Isaiah 40:31). So the hardest phrase is explained first, the question
// is one the verses answer in their own words, the need is named in one
// sentence, and Jesus is reached by what a phrase MEANS.
//
// BN-95 (the same read): Opus's first complaint, in two reads, was "all 26
// attach a weekday task to every point and add another in the Response, so
// a lesson asks 3 or 4 things -- most are duties rather than a response to
// grace"; Sonnet's, "Sarah, Mark, Elena" in example after example. So an
// example names a role and a place, never a name; a deed answers what God
// gives in its point at the moment of the week it belongs to, never at a
// weekday picked for no reason; and the Response takes its ONE step from
// the points' deeds instead of adding another. No example phrase is given:
// shown "a nurse after a night shift" and "at the meal table", the first
// four lessons opened their examples and deeds on those very words.

/** What a preaching lesson holds, in the order it is preached. */
export const PREACHING_LESSON_SHAPE =
    'WHAT A LESSON HOLDS, ready to preach in plain warm words and TRUE ' +
    'above all. First read the main passage with owa_find_verse (`refs`) ' +
    'when you have it -- and the verses just before it, for its setting -- ' +
    'and build every point, quote and verse number on the words it ' +
    'returns: say nothing of a verse, its words or its history you are not ' +
    'sure of, read into it nothing it does not say -- a retelling tells the ' +
    "events in the passage's own order and adds no feeling, motive, place, " +
    "tool or detail it does not give, and a person's reason or message is " +
    'the one the passage states, so read the WHOLE story before telling any ' +
    'of it -- and tell no story as if it really happened. The main passage ' +
    'alone on a line as its token -- [^John 10:11-18] -- which the app ' +
    'prints whole from their Bible, no more than about twenty verses (of a ' +
    'longer story, the part the lesson preaches, the rest told in its ' +
    'background); then "## " headings: Big idea (ONE full ' +
    'sentence: what the passage says about God, and what that asks of us), ' +
    "Background (three or four sentences from the Bible's own pages: who " +
    'wrote it and to whom where the Bible names them, and what happens just ' +
    'before it that changes how it is heard -- for a psalm, its own words ' +
    'and where the Bible tells its story, never the psalm before it), ' +
    'Introduction (an everyday scene, or a question of the ' +
    'passage\'s own -- never "Have you ever" -- its picture agreeing with ' +
    'the passage; then ONE plain sentence that names the need in us the ' +
    'passage answers, and a last one that turns them to the passage), three ' +
    'points that follow the passage in its own order and ' +
    'together cover ALL of it, the last ending where the passage ends, each ' +
    'written as:\n' +
    '## 1. <a sentence that states it>\n' +
    '[^<the verses whose words say it>]\n' +
    '**What it means:** <first the phrase of these verses a hearer would ' +
    'find hardest -- "be still", "against thee, thee only" -- and what it ' +
    'means HERE, from the passage and from where else Scripture says it ' +
    '(read with owa_find_verse); then any word they would stumble on read ' +
    'aloud -- "moderation", a publican; a custom only as the Bible itself ' +
    'tells it, never what a people is said to have thought; never the verse ' +
    'said again, no Hebrew or Greek word study>\n' +
    "**A hearer asks:** <an honest question of a hearer's that these verses " +
    'themselves answer -- never one they leave open, as why someone did ' +
    'what the passage gives no reason for>\n' +
    '**The passage answers:** <that answer in two or three sentences, with ' +
    'the words of the verse that gives it: a reason, motive or promise only ' +
    'where it states one>\n' +
    "**For example:** <a scene from the hearers' own week, three or four " +
    'sentences -- someone named by role and place, never by name, a person ' +
    'these hearers would know; what was said or done -- ' +
    'showing what THIS point says God does or asks, not mere courage or ' +
    'effort, and promising nothing the passage does not; never a memory of ' +
    'your own or a date, never a stock picture: a lifeboat, a garden, a ' +
    'rescue>\n' +
    '**This week:** <one deed that answers what God gives in THIS point, ' +
    'with whom, at the moment of their week where this point meets them -- ' +
    'never a weekday or hour picked for no reason, never only "trust", ' +
    '"remember" or "pray about it">\n' +
    'then Pointing to Jesus (a phrase of THIS passage, quoted, and where its ' +
    'MEANING leads: what Jesus did for us in his death and rising -- never a ' +
    'word it only shares with a name of his ("the word", "the way"), never ' +
    'only his example, never the story turned into an allegory of him, never ' +
    'a picture the passage does not have), Response (the ' +
    'big idea said again in new words, then the ONE step the whole passage ' +
    "asks most, taken from the points' deeds, never a new one; where the " +
    'passage calls us to believe, a plain invitation to), ' +
    'Closing prayer (written out), Questions for discussion ("- " items, on ' +
    'the passage and their lives) and Memory verse ([^ref], one short verse ' +
    'that says the big idea plainly). A devotion keeps every part, each in ' +
    'a sentence or two, with ONE point that walks its whole passage from ' +
    'its first verse to its last, naming them in its sentences, about 300 ' +
    'words. A funeral message ' +
    "comforts: its points the passage's own promises made plain for the " +
    'grieving and why they can be trusted, its examples gentle scenes of ' +
    "loss and hope, its This week a comfort to hold and never a task, Christ's " +
    'gift of life offered freely, and no questions for discussion. A ' +
    "children's lesson keeps every part too, in words a " +
    'child knows: at the top only the verse or two its story turns on, ' +
    'never a whole chapter (name the rest in Background); after the ' +
    'Introduction the story TOLD in short sentences under its own heading, ' +
    'from its start to where the passage ends; two points a child can hold; ' +
    'something to show; and a memory verse of one short line that says the ' +
    'big idea. A verse is a token, never typed out -- a passage printed ' +
    'once, after that its token in a sentence -- and a phrase quoted is ' +
    'word for word the passage as read.';

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
// A preaching MESSAGE is a lesson too, and so is a funeral's talk (BN-85,
// 2026-11-11). _a message of hope for a funeral, from Revelation 21:1-7_
// had carried no lesson hint in any run since BN-66, because "message" was
// no lesson word. It was written from the short outline alone, and was the
// thinnest lesson of every set the readers scored. "A message" alone is
// not one: _paste the message from my pastor_, _write a message to my wife_.
const MESSAGE_TOPIC_SOURCE =
    'message\\s+(?:of\\s+(?:hope|comfort|encouragement|grace|peace|joy|' +
    'love|faith|salvation|forgiveness)|on|about|from)\\b';
// Wider, where no lesson is attached to be meant instead: "help me prepare
// my sermon on John 10", "I'm preaching from Psalm 23 on Sunday".
const LESSON_WRITE_ASK_PATTERN = new RegExp(
    [
        `\\b(?:write|make|create|prepare|plan|draft|give|need|want|start|build|help)\\b[^.?!]{0,40}?\\b${LESSON_NOUN}`,
        '\\bpreach(?:ing)?\\b[^.?!]{0,40}?\\b(?:on|about|from)\\b',
        `^\\s*(?:please\\s+)?(?:(?:a|an|my)\\s+)?${LESSON_WORDS}${LESSON_NOUN}\\s+(?:about|on|from)\\b`,
        `\\b(?:write|make|create|prepare|plan|draft|give|need|want|start|build|help)\\b[^.?!]{0,40}?\\b${MESSAGE_TOPIC_SOURCE}`,
        `^\\s*(?:please\\s+)?(?:a|an|my)\\s+(?:[\\w'-]+\\s+){0,2}?${MESSAGE_TOPIC_SOURCE}`,
        '\\bfuneral\\b[^.?!]{0,40}?\\b(?:message|talk|homily|eulogy|sermon)\\b',
        '\\b(?:message|talk|homily|eulogy)\\b[^.?!]{0,40}?\\bfuneral\\b',
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

// A length they gave, in minutes (BN-73, 2026-11-10: "a 15 minute sermon
// on John 3:16" came back as 625-724 words, five or six minutes spoken, from
// a shape that said "about 120 spoken words a minute" -- a model follows a
// NUMBER of words, not a rate). Never for a shorten ask, which has its own.
const LESSON_MINUTES_PATTERN =
    /\b(\d{1,2})[ -]?(?:minutes?|mins?)\b(?![^.?!]{0,20}\b(?:shorter|less|fewer)\b)/i;
const SPOKEN_WORDS_A_MINUTE = 120;

/**
 * The words a lesson asked for at a length should hold, said as a number
 * -- or null when no length was given. Lessons of 3 to 60 minutes only.
 */
export function genLessonLengthLine(text: string) {
    const matched = LESSON_MINUTES_PATTERN.exec(String(text ?? ''));
    const minutes = matched === null ? NaN : Number(matched[1]);
    if (!(minutes >= 3 && minutes <= 60) || checkIsLessonShortenAsk(text)) {
        return null;
    }
    const words = Math.round((minutes * SPOKEN_WORDS_A_MINUTE) / 100) * 100;
    return (
        `(They asked for ${minutes} minutes: the lesson's own words come to ` +
        `about ${words} -- the passages printed are not counted. Fill it with ` +
        'explanation and examples, never with more points.)'
    );
}

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
    'headings: the setting, the passage verse by verse (a list, one ' +
    '`- **3:1-2** ...` a part), its people and places, 2 to 4 diagrams, ' +
    'cross references, key themes, how to live it, questions for ' +
    'discussion; a blank line between paragraphs. Each diagram in a ' +
    '```mermaid block and of a ' +
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
    '`file` and `section` (a heading as it reads) + `content` (its new ' +
    'words), or `append` (words added at its end, or at the end of ' +
    '`section`); ' +
    'the WHOLE new text in `content` only to rewrite it all. To ' +
    'translate one, call `translate` with `file`, `language` and ' +
    '`place`: "append" when they say add, after, under, new pages or ' +
    'both languages, "replace" when in place of it, "new" for a copy -- ' +
    'the window translates it; never write a translation yourself.';
