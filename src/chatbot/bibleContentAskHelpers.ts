/**
 * A question about what the Bible SAYS, read off the words typed (EC-199,
 * 2026-10-16).
 *
 * The guide -- what answers when no assistant can -- searches the manual, and
 * the manual is about a Bible app: any Bible question shares its nouns with
 * it, so a question with nothing to do with the app found a page anyway, far
 * above the score floor that removes garbage. Found in the user's own tabs
 * with the local server down: _what bible verse talk about lover your enemy?_
 * was answered with the page about keeping files beside a verse (score 27),
 * and _what are names of 7 churches mentioned in the book of revelation_ with
 * the one about adding a Bible from the internet (44), each under **Show me
 * step by step**. Measured over ten such questions the same day, eight were
 * handed a page that does not answer them. No floor separates them; reading
 * the QUESTION does.
 *
 * Two kinds, because the app can answer one of them:
 *
 * - **A verse asked for by what it says** (_which verse says do not worry_,
 *   _what does the Bible say about forgiveness_, _verses about hope_): the
 *   guide holds none of the Bible's words, but the Bibles in the app do, and
 *   **Bible Find** searches them -- the page that answers, which the search
 *   had not put in its first three. An assistant answers it too, from memory,
 *   with `/btw`, and says nothing of Bible Find: the line under its answer
 *   (`genBibleFindAdvice`) does.
 * - **Knowledge about the Bible** (_who wrote the book of Psalms_, _how many
 *   books are in the Bible_): nothing in the app answers it, and the honest
 *   answer is that an assistant does, through `/btw`.
 *
 * What is left alone, on purpose: _who was Moses_ and _where is Bethlehem_
 * (the Reader's people and places lookup answers those, and the search
 * already finds it); anything naming a part of the app, a reference with a
 * chapter (the verse readers have those), or what the person has open
 * (_the passage I am reading_). A test holds every supported question out of
 * both kinds, because the same reading must never turn a how-do-I that
 * passes today into a refusal.
 *
 * Pure. The questions are read in English; the sentences are written in
 * the app's language (`chatTranHelpers`).
 */

import { fillWords, tran } from './chatTranHelpers';

export type BibleContentAskType =
    // `words`: what to search the Bible for, as they wrote it.
    { kind: 'verse'; words: string } | { kind: 'knowledge' };

// The verse asked for by its subject. Each opens on the subject's frame, so
// the words after it are what to search for. A bare "is" or "are" is NOT a
// frame -- _What verse is this?_ and _what verses are in my list_ ask about
// the app -- only "is about" / "are about" is.
const VERSE_ASK_PATTERN_LIST = [
    // "what bible verse talk about lover your enemy", "which verse says ..."
    /^(?:what|which)\s+(?:(?:holy\s+)?(?:bible|scripture)\s+)?(?:verses?|scriptures?|passages?)\s+(?:in\s+the\s+bible\s+)?(?:talks?|speaks?|says?|said|tells?|mentions?|teach(?:es)?|(?:is|are)\s+about)\s+(?:about\s+|of\s+|on\s+|that\s+)?(.+)$/i,
    // "where in the bible does it say god is love"
    /^where\s+(?:in\s+the\s+(?:holy\s+)?(?:bible|scriptures?)\s+)?(?:does|do|did|is)\s+(?:the\s+(?:holy\s+)?(?:bible|scriptures?)|it|god|jesus)\s+(?:says?|talks?\s+about|mentions?|teach(?:es)?|tells?\s+us|written)\s+(?:about\s+|that\s+)?(.+)$/i,
    // "what does the bible say about forgiveness"
    /^what\s+(?:does|do|did)\s+(?:the\s+(?:holy\s+)?(?:bible|scriptures?)|scripture|god|jesus)\s+(?:say|teach|tell\s+us)\s+(?:about\s+|on\s+)?(.+)$/i,
    // "find me a verse about hope", "give me verses on patience"
    /^(?:find|show|give|tell)\s+me\s+(?:(?:a|an|the|some|any)\s+)?(?:(?:holy\s+)?(?:bible|scripture)\s+)?(?:verses?|scriptures?|passages?)\s+(?:about|on|for|that\s+(?:says?|talks?\s+about))\s+(.+)$/i,
    // "is there a verse about anger"
    /^(?:is|are)\s+there\s+(?:a|an|any)\s+(?:(?:holy\s+)?(?:bible|scripture)\s+)?(?:verses?|scriptures?|passages?)\s+(?:about|on|that\s+says?)\s+(.+)$/i,
    // "verses about hope", "bible verse on patience"
    /^(?:(?:holy\s+)?(?:bible|scripture)\s+)?(?:verses?|scriptures?|passages?)\s+(?:about|on|for)\s+(.+)$/i,
    // A STORY by its name (2026-10-22, EC-389): "where in the bible is the
    // story of the flood", "where can I find the parable of the sower",
    // "show me the story of Jonah". It went to the general assistant,
    // whose Khmer answer named a book the Bible does not have. The words
    // keep "story of", which tells the search it is a story.
    /^where\s+(?:in\s+the\s+(?:holy\s+)?(?:bible|scriptures?)\s+)?(?:is|are|can\s+i\s+find|do\s+i\s+find|does\s+it\s+tell)\s+(?:the\s+)?((?:story|stories|account|parable)\s+(?:of|about)\s+.+?)(?:\s+in\s+the\s+(?:holy\s+)?(?:bible|scriptures?))?$/i,
    /^(?:find|show|give)\s+(?:me\s+)?(?:the\s+)?((?:story|account|parable)\s+(?:of|about)\s+.+)$/i,
];

// A verse for the people in the room is the Presenter's work -- "show me a
// verse about love on the screen" -- and its own pages answer it. A word
// the Bible uses too counts only as presenting (2026-10-29, `EC-445`):
// _Which verse says present your bodies a living sacrifice?_ is Romans 12:1,
// and _the congregation of Israel_ the Bible's own words.
const PRESENTING_PATTERN =
    /\b(?:screens?|projector|presenter|presenting|presentation|slides?)\b|\b(?:to|for)\s+the\s+(?:congregation|audience)\b|\bpresent\s+(?:it|this|that|them)\b/i;

// A part of the app named: the question is about the app, whatever else it
// says.
const APP_WORD_PATTERN =
    /\b(?:app|screens?|projector|present(?:ing|ation)?|slides?|congregation|audience|display|buttons?|windows?|click|press|menu|tabs?|panels?|keys?|keyboard|shortcuts?|settings?|versions?|translations?|import|install|download|xml|notes?|lists?|fonts?|copy|paste|highlight\w*|marks?|colou?rs?|audio|sound|play|show(?:ing)?|open|lookup|look\s+up|reader|presenter|files?|folders?|resources?|graph|search|find|type|typing|references?|history|split|zoom|bigger|smaller|print|export|share|save|undo|delete|chatbot|assistant|help|tool|view|scroll|line|page|code|link|url|online|offline|computer|data|backup|sync)\b/i;

// What the person has OPEN: "who is named in the passage I am reading".
const OWN_STATE_PATTERN =
    /\b(?:my|mine|i\s+am|i'm|i\s+have|this|these|current(?:ly)?|here|now)\b/i;

const BIBLE_CUE_PATTERN =
    /\b(?:bible|scriptures?|verses?|psalms?|proverbs|gospels?|testament|apostles?|disciples?|prophets?|jesus|christ|god|lord|holy\s+spirit|genesis|exodus|revelation|book\s+of\s+\w+|church(?:es)?\s+(?:in|of)|commandments?|parables?|miracles?)\b/i;

const KNOWLEDGE_OPEN_PATTERN =
    /^(?:who|what|which|when|why|how\s+(?:many|old|long|much)|name|list|tell\s+me\s+about)\b/i;

// "who was Moses", "where is Bethlehem": the people and places lookup.
const NAME_LOOKUP_PATTERN = /^(?:who|where)\s+(?:was|were|is|are)\b/i;

// "What does John 3:16 say?" names its passage: the verse readers take it.
const REFERENCE_PATTERN = /\d+\s*:\s*\d+/;

/** What kind of Bible question the words are, or null for any other. */
export function readBibleContentAsk(asked: string): BibleContentAskType | null {
    const words = asked
        .trim()
        .replace(/[?.!]+$/, '')
        .trim();
    if (words.length === 0 || REFERENCE_PATTERN.test(words)) {
        return null;
    }
    for (const pattern of VERSE_ASK_PATTERN_LIST) {
        const match = pattern.exec(words);
        if (match === null) {
            continue;
        }
        if (PRESENTING_PATTERN.test(words)) {
            return null;
        }
        return { kind: 'verse', words: match[1].trim() };
    }
    if (
        KNOWLEDGE_OPEN_PATTERN.test(words) &&
        BIBLE_CUE_PATTERN.test(words) &&
        !NAME_LOOKUP_PATTERN.test(words) &&
        !APP_WORD_PATTERN.test(words) &&
        !OWN_STATE_PATTERN.test(words)
    ) {
        return { kind: 'knowledge' };
    }
    return null;
}

// Bible Find's page, and the control its walkthrough starts at -- the row
// _How do I search the Bible for a word?_ carries the same `find`.
export const BIBLE_FIND_MANUAL_ID = 'W-12';
export const BIBLE_FIND_CONTROL = 'Find';

// What the guide searches to reach Bible Find's own page, whatever was
// asked: the page's own goal line, so the excerpt is that line and the step
// that opens Find. Measured 2026-10-16: first on every window, 121 to 86 at
// the closest; "search the whole Bible for words" was first too, and its
// excerpt was step 5, about narrowing to one book.
export const BIBLE_FIND_QUERY = 'find verses by words, not reference';

/** The sentence above Bible Find's steps, naming what to search for. */
export function genBibleFindLead(words: string) {
    return fillWords(
        tran(
            'The guide covers using the app and holds none of the Bible’s ' +
                'words — but the Bibles in this app do, and **Bible Find** ' +
                'searches them. Search for “{words}”. If nothing comes back, ' +
                'try fewer words: it looks for them as they are typed.',
        ),
        { words },
    );
}

/**
 * The answer to knowledge about the Bible from the guide, which knows the app
 * and nothing else. It is the guide's answer with no assistant AND under
 * `/help`, so it does not say whether one is answering: it says how to ask
 * one, the question written out with `/btw` in front so it can be copied.
 */
export function genBibleKnowledgeText(asked: string) {
    return fillWords(
        tran(
            'That is a question about the Bible itself, and the guide only ' +
                'knows how to use this app. An assistant can answer it: ask ' +
                'with /btw in front — /btw {question} — and if none answers, ' +
                'pick one in the row above, or add a key in Settings → ' +
                'AI Providers.',
        ),
        { question: asked.trim() },
    );
}

export const BIBLE_FIND_ADVICE_LABEL = 'Show me Bible Find';

/**
 * The line under an assistant's answer to a verse asked for by what it says,
 * or null: the words are not such a question, or the answer already speaks
 * of Bible Find or carries its walkthrough. An assistant tells them to put
 * `/btw` in front and answers from memory -- seen on the free model, one
 * round, every time -- which is honest, and leaves out that the Bible in
 * front of them can be searched. In code and not in the prompt, as the way
 * back to the Reader is: it has to be under every such answer, whichever
 * assistant wrote it.
 */
export function genBibleFindAdvice(
    asked: string,
    answerText: string,
    manualIds: readonly string[],
): string | null {
    const ask = readBibleContentAsk(asked);
    if (
        ask?.kind !== 'verse' ||
        manualIds.includes(BIBLE_FIND_MANUAL_ID) ||
        /\bBible\s+Find\b/i.test(answerText)
    ) {
        return null;
    }
    // Their words as something to TRY: Bible Find matches what is typed as it
    // is typed, so "lover your enemy" finds nothing where the verse says
    // "Love your enemies" -- promising every verse with them would send them
    // to an empty list.
    return fillWords(
        tran(
            'The Bibles in this app can be searched too: **Bible Find** ' +
                'lists the verses that have the words you type — try ' +
                '“{words}”, and fewer words if nothing comes back. Press ' +
                '{button} below for where it is.',
        ),
        // The button stays English in the data and is translated where it
        // is drawn, as here.
        { words: ask.words, button: tran(BIBLE_FIND_ADVICE_LABEL) },
    );
}
