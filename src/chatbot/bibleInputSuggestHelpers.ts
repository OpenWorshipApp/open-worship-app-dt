/**
 * When the chat box's input aid asks, and what it asks for (2026-10-18).
 *
 * Asked for with a picture of a lookup conversation whose box held `១` and
 * offered nothing: _assistant should help the input ... book auto complete ->
 * chapter -> verse_, then _if for location/name then should recommend the
 * auto-complete_. The rows come from `owa_bible_suggest` (the app's own
 * Bibles and names lookup); this decides the questions, and is pure so every
 * rule is a test.
 *
 * - A PASSAGE: in a tab asking about the Bible Reader, or under an answer
 *   that asked for another passage (`lookupAwaits`), the box is completing
 *   a reference -- book, then chapter, then verse.
 * - A NAME: `Who was Moses` / `Where is Bethlehem` (and every language's own
 *   way of asking, `bibleReaderWords.nameAsk`), or a bare name in a script
 *   that is not Latin (a Khmer name typed on its own). A bare Latin word is
 *   NOT loaded speculatively (`allowLoad` false): the names dataset is 34MB
 *   and is only searched when a lookup panel already holds it.
 */
import {
    checkIsInLanguageScript,
    listAssistantLanguages,
} from './chatLangHelpers';
import { checkHasWord, toPlainAsk } from './bibleReaderChatHelpers';

export type BibleInputSuggestAskType = {
    kind: 'reference' | 'name';
    /** What the tool searches or completes. */
    prefix: string;
    /** A NAME may load the dataset; a bare Latin word may not. */
    allowLoad?: boolean;
    /** Kept in front of the chosen name: `Who was ` + `Moses`. */
    fillPrefix?: string;
    /** The words being completed are Latin: fill the KJV name (`Moses`),
     *  not the lookup language's (`ម៉ូសេ`). */
    useLatinFill?: boolean;
};

export type BibleInputSuggestRowType = {
    id: string;
    /** Drawn as it is: a book, reference or name, never a tran() key. */
    text: string;
    where: string;
    fill: string;
    isImmediate: false;
    isData: true;
};

const MAX_REFERENCE_LENGTH = 40;
const MIN_NAME_LENGTH = 3;
const ENGLISH_NAME_ASK_PATTERN =
    /^(?:who|where)\s+(?:was|were|is|are)\s+(.+)$/i;

function checkIsNameCue(text: string) {
    return listAssistantLanguages().some((language) => {
        return (
            checkIsInLanguageScript(text, language) &&
            checkHasWord(text, language.bibleReaderWords.nameAsk)
        );
    });
}

// `តើម៉ូសេជានរណា` -- the name is what comes before the language's own
// "who is" words, once the sentence's leading function words are taken off
// (`តើ`). A whole sentence that asks something else gives a phrase no name
// lookup matches, and no suggestion is the honest answer.
function readLocalizedNameAsk(plain: string): BibleInputSuggestAskType | null {
    for (const language of listAssistantLanguages()) {
        if (!checkIsInLanguageScript(plain, language)) {
            continue;
        }
        for (const cue of language.bibleReaderWords.nameAsk) {
            const at = plain.indexOf(cue);
            if (at === -1) {
                continue;
            }
            let candidate =
                at === 0 ? plain.slice(cue.length) : plain.slice(0, at);
            let isChanged = true;
            while (isChanged) {
                isChanged = false;
                for (const lead of language.bibleReaderWords.nameAskLead) {
                    const trimmed = candidate.trimStart();
                    if (lead.length > 0 && trimmed.startsWith(lead)) {
                        candidate = trimmed.slice(lead.length);
                        isChanged = true;
                    }
                }
            }
            const name = candidate.replace(/[\s?!.។៕]+$/u, '').trim();
            if (name.length >= 2 && !/\p{Nd}/u.test(name)) {
                return {
                    kind: 'name',
                    prefix: name,
                    allowLoad: true,
                    fillPrefix: '',
                };
            }
        }
    }
    return null;
}

function checkIsNonLatinWord(word: string) {
    return listAssistantLanguages().some((language) => {
        return (
            !language.isLatinScript && checkIsInLanguageScript(word, language)
        );
    });
}

function toTrailingNameFragment(text: string) {
    const tail = text
        .replace(/[\s?!.។៕]+$/u, '')
        .replace(/^\s+/, '')
        .trim();
    return tail.length >= MIN_NAME_LENGTH && !/\p{Nd}/u.test(tail)
        ? tail
        : null;
}

function readNameAsk(plain: string): BibleInputSuggestAskType | null {
    const english = ENGLISH_NAME_ASK_PATTERN.exec(plain);
    if (english !== null) {
        const tail = toTrailingNameFragment(english[1]);
        if (tail !== null) {
            return {
                kind: 'name',
                prefix: tail,
                allowLoad: true,
                fillPrefix: plain.slice(0, plain.length - tail.length),
                useLatinFill: true,
            };
        }
    }
    const localized = readLocalizedNameAsk(plain);
    if (localized !== null) {
        return localized;
    }
    // A bare name typed on its own. A Khmer (or other non-Latin) one is worth
    // loading the lookup for; a Latin word is not (`hello` is not a person).
    const words = plain.split(/\s+/).filter(Boolean);
    if (
        words.length === 1 &&
        words[0].length >= MIN_NAME_LENGTH &&
        !/\p{Nd}/u.test(words[0]) &&
        !checkIsNameCue(plain)
    ) {
        return {
            kind: 'name',
            prefix: words[0],
            allowLoad: checkIsNonLatinWord(words[0]),
            useLatinFill: !checkIsNonLatinWord(words[0]),
        };
    }
    return null;
}

/**
 * What the input aid should ask for the draft in front of the person, in the
 * order the rows are shown: a passage first, then a name. Empty when the box
 * is a command, is empty, or is a question the aid has nothing to add to.
 */
export function readBibleInputSuggestAskList(
    question: string,
    focus: string,
    isLookupAwaitedPassage: boolean,
): BibleInputSuggestAskType[] {
    const plain = toPlainAsk(question);
    if (plain.length === 0 || plain.startsWith('/')) {
        return [];
    }
    const askList: BibleInputSuggestAskType[] = [];
    const isPassageBox =
        isLookupAwaitedPassage ||
        (focus === 'reader' &&
            plain.length <= MAX_REFERENCE_LENGTH &&
            !plain.includes('?'));
    if (isPassageBox) {
        askList.push({ kind: 'reference', prefix: plain });
    }
    if (!isLookupAwaitedPassage) {
        // A name may be typed in any window with the Reader in front of it;
        // under an awaited passage the box is writing that passage.
        const nameAsk = readNameAsk(plain);
        if (
            nameAsk !== null &&
            (nameAsk.allowLoad === true || focus === 'reader')
        ) {
            askList.push(nameAsk);
        }
    }
    return askList;
}

/** One tool answer as the rows under the box. */
export function toBibleInputSuggestRows(
    result: unknown,
    fillPrefix = '',
    useLatinFill = false,
): BibleInputSuggestRowType[] {
    const suggestionList = (result as { suggestions?: unknown } | null)
        ?.suggestions;
    if (!Array.isArray(suggestionList)) {
        return [];
    }
    const rowList: BibleInputSuggestRowType[] = [];
    for (const [index, suggestion] of suggestionList.entries()) {
        const label = (suggestion as { label?: unknown })?.label;
        const fill = (suggestion as { fill?: unknown })?.fill;
        const detail = (suggestion as { detail?: unknown })?.detail;
        if (typeof label !== 'string' || typeof fill !== 'string') {
            continue;
        }
        // A Latin question names the person in Latin (`Moses`), not in the
        // lookup language's script (`ម៉ូសេ`); the KJV name is the one.
        const fillText =
            useLatinFill &&
            typeof detail === 'string' &&
            /^[\x20-\x7E]+$/.test(detail)
                ? detail
                : fill;
        const rowFill = `${fillPrefix}${fillText}`;
        rowList.push({
            id: `input.${index}.${rowFill}`,
            text: label,
            where: typeof detail === 'string' ? detail : '',
            fill: rowFill,
            isImmediate: false,
            isData: true,
        });
    }
    return rowList;
}
