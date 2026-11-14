// A word or two typed alone -- "lyric", "background" -- names a TOPIC, not
// a job: a song can be made, turned out of a PowerPoint, put up or edited,
// and an answer that picks one of those guesses (2026-11-13, EC-583: the
// user typed "lyric" and was answered with an apology; the job they had in
// mind was a lyric file made from a PowerPoint). The user's words:
// _when user type only few word, chatbot should follow up, before provide
// result should confirm_, and _make chatbot try to follow up with user
// intention before making any assumption. keep providing user with maximum
// amount of options_.
//
// Pure: which lines are such a topic, and what the model is told when one
// comes mid-conversation. The choices themselves are the corpus's
// (`genTopicChoices` in `questionHelpers.ts`).

import {
    checkIsLanguageWord,
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAppLangCode,
    getAssistantLanguage,
} from './chatLangHelpers';
import { checkIsDisputingAnswer } from './disputeHelpers';
import { checkIsClosingLine } from './verseAskLanguageHelpers';

/** At most this many words that are not a language's little words. */
export const MAX_TOPIC_WORD_COUNT = 2;
// ...and this many words in all, little ones included: "lyric from
// powerpoint" is two words of a topic, "how do I make a new song" is a
// question.
const MAX_TOPIC_ALL_WORD_COUNT = 4;
// English's instruction verbs. A line that opens on one and goes on to
// what it acts on -- "fix the cross-references", "clear the screen" --
// already says the job, and asking "What would you like to do with Fix the
// cross-references?" would turn an instruction into a riddle (the gate's
// own test of a claimed change caught exactly that). One alone -- "clear"
// -- says no more than "lyric" does, and is still asked about. English
// only: the other languages' words live in their packages, and none lists
// its verbs, so a line in one is held to its word count alone.
const INSTRUCTION_VERB_PATTERN =
    /^(?:add|attach|cancel|change|check|choose|clear|close|compare|convert|copy|create|cut|delete|disable|display|download|drag|drop|duplicate|edit|enable|explain|export|find|fix|give|go|hide|import|insert|install|list|load|lock|make|merge|move|mute|open|paste|pause|pick|play|present|print|put|read|record|redo|reload|remove|rename|replace|reset|resize|restart|run|save|search|select|send|set|share|show|sort|split|start|stop|summarize|switch|teach|tell|translate|turn|type|undo|unlock|unmute|update|upload|use|write|zoom)$/u;
const MAX_TOPIC_LENGTH = 32;
// A script written with no spaces between its words: the whole line is one
// "word", so it is held to its letters instead.
const MAX_UNSPACED_TOPIC_LENGTH = 16;
// A Latin word of one or two letters is no topic: "hi" is the start of
// "hide", "ok" the end of "book".
const MIN_LATIN_WORD_LENGTH = 3;
const NON_LATIN_LETTER_PATTERN = /(?=\p{L})\P{Script=Latin}/u;
// A number is a verse, a time, a slide or a count: something specific,
// which the readers that know what to do with one are for.
const DIGIT_PATTERN = /\p{N}/u;
// An address, an e-mail, a command, a quoted name: what they ARE is said.
const SPECIFIC_PATTERN = /[/@\\:"“”«»]|www\.|\.\w{2,4}\b/iu;
// Hello and its English kin, which no corpus row is about, and English's
// own short answers -- its `assistant.json` lists no yes or no words, the
// English ones being read by pattern wherever they are read.
const GREETING_PATTERN =
    /^(?:hi+|hello+|hey+|hiya|howdy|yo|good (?:morning|afternoon|evening|night|day)|morning|evening|test(?:ing)?)$/iu;
const SHORT_ANSWER_PATTERN =
    /^(?:y(?:es|eah|ep|up)|no(?:pe)?|nah|sure|ok(?:ay)?|please|right|correct|exactly|done|sorry|great|good|cool|nice|fine|got it|of course|no thanks|not now|never mind|go on|go ahead|continue)$/iu;
const EDGE_PUNCTUATION_PATTERN = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/** The line without the marks round it: "lyric?" is "lyric". */
export function toTopicWords(text: string) {
    return text.normalize('NFC').trim().replace(EDGE_PUNCTUATION_PATTERN, '');
}

function listLittleWords(text: string) {
    const appLangCode = getAppLangCode();
    const typedLangCode = detectTypedLanguage(text, appLangCode);
    const codeSet = new Set([DEFAULT_CHAT_LANG_CODE, appLangCode]);
    if (typedLangCode !== null) {
        codeSet.add(typedLangCode);
    }
    return [...codeSet].map((code) => {
        return getAssistantLanguage(code).functionWordSet;
    });
}

/**
 * Whether a typed line is a word or two that names a subject and no job:
 * "lyric", "background", "new song", "clear" -- never a yes or a no, a
 * thank-you, a complaint, a greeting, a number, an address, a command, an
 * instruction ("clear the screen"), or only the little words a question is
 * made of ("why", "how").
 */
export function checkIsShortTopicAsk(text: string): boolean {
    const plain = toTopicWords(text);
    if (
        plain.length === 0 ||
        plain.length > MAX_TOPIC_LENGTH ||
        /[\r\n]/.test(text.trim()) ||
        text.trim().startsWith('/') ||
        DIGIT_PATTERN.test(plain) ||
        SPECIFIC_PATTERN.test(text) ||
        GREETING_PATTERN.test(plain) ||
        SHORT_ANSWER_PATTERN.test(plain)
    ) {
        return false;
    }
    if (
        checkIsLanguageWord(plain, 'yes') ||
        checkIsLanguageWord(plain, 'no') ||
        checkIsClosingLine(plain) ||
        checkIsDisputingAnswer(plain)
    ) {
        return false;
    }
    const wordList = plain.toLowerCase().split(/\s+/u).filter(Boolean);
    if (wordList.length > MAX_TOPIC_ALL_WORD_COUNT) {
        return false;
    }
    if (
        wordList.length === 1 &&
        NON_LATIN_LETTER_PATTERN.test(plain) &&
        [...plain].length > MAX_UNSPACED_TOPIC_LENGTH
    ) {
        return false;
    }
    const littleWordSetList = listLittleWords(plain);
    const topicWordList = wordList.filter((word) => {
        return !littleWordSetList.some((wordSet) => {
            return wordSet.has(word);
        });
    });
    if (
        topicWordList.length === 0 ||
        topicWordList.length > MAX_TOPIC_WORD_COUNT
    ) {
        return false;
    }
    if (wordList.length > 1 && INSTRUCTION_VERB_PATTERN.test(wordList[0])) {
        return false;
    }
    return topicWordList.every((word) => {
        return (
            NON_LATIN_LETTER_PATTERN.test(word) ||
            word.length >= MIN_LATIN_WORD_LENGTH
        );
    });
}

/**
 * Said to the model, on the ask alone, when such a line comes in the middle
 * of a conversation (the first line of a tab is asked by the window itself,
 * with no model): it may continue what was being said, or start something
 * new that could be several jobs. Either way, nothing is assumed: the
 * likely jobs are offered to press.
 */
export function genTopicAskHint(asked: string, choices: readonly string[]) {
    if (choices.length === 0) {
        return null;
    }
    return [
        `Their message is only a word or two ("${toTopicWords(asked)}"),`,
        'and it could mean several different jobs. When the conversation',
        'above makes plain which one they mean, answer that one. Otherwise do',
        'not guess and do not answer any of them yet: ask, in one short',
        'sentence, which one they want, and offer the likely jobs as OPTIONS',
        '(up to five, at most six words each, in their own voice). The app',
        `lists these for those words: ${choices.join(' | ')}`,
    ].join(' ');
}
