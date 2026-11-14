/**
 * Bible passages SAVED to a Bibles list, or a new list made, asked for in
 * an ordinary chat (2026-11-12, EC-515; the user's goal: _chatbot will be
 * very smart to help user create … bible item_). _Make a new Bible list
 * called Easter with John 20:1-18 and 1 Corinthians 15:3-8_ had been
 * answered, on Auto, that the app has no way to make a named list -- it has
 * -- and _Save John 3:16 to my Bible list_ with the five steps of the Bible
 * Lookup.
 *
 * The window does it with no model: `owa_bible_item` reads each reference
 * with the app's own parser (every installed Bible's book names), so what
 * the window has to read is only WHICH references and which list -- the
 * shapes below, in English. A line it cannot read whole goes on as before.
 * Every change keeps a backup, and **Undo this change** under the answer
 * puts them all back (the list, when this made it, last).
 *
 * English in code; another language's words are filed as EC-516. Pure,
 * every rule a test: no store, no tool call, no model.
 */
import {
    readAskedDayName,
    readAskedName,
    toDocumentDayText,
} from './documentCreateHelpers';
import { LYRIC_UNDO_LABEL } from './lyricChatHelpers';

export const BIBLE_ITEM_TOOL_NAME = 'owa_bible_item';
/** The list a passage goes to when none is named, as the panel names it. */
export const DEFAULT_BIBLE_LIST_NAME = 'Default';

export type BibleListAskType = {
    /** The list named; null is the Bibles list's own "Default". */
    listName: string | null;
    /** Whether a NEW list was asked for. */
    isNewList: boolean;
    /** The passages to save, as written: the tool reads each. */
    references: string[];
};

const MAX_ASK_LENGTH = 600;
const MAX_REFERENCE_COUNT = 20;
const MAX_LIST_NAME_LENGTH = 60;

const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|who|is there|are there|is it|does|do i|can i|could i|should i|may i)\b/i;
const POLITE_LEAD_PATTERN =
    /^\s*(?:(?:please|pls|kindly)\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?)+/i;
// One reference as people write it: a book (a number before it, up to three
// words, "of" between), a chapter, and a verse or a range.
const REFERENCE_PATTERN =
    /^(?:[1-3]\s*)?\p{L}[\p{L}.'’]*(?:\s+(?:of\s+)?\p{L}[\p{L}.'’]*){0,2}\s+\d{1,3}(?:\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3}(?:\s*:\s*\d{1,3})?)?)?$/u;
const LIST_NOUN = String.raw`(?:bibles?|verses?|passages?|scriptures?|saved\s+verses?)\s+list|list\s+of\s+(?:bible\s+)?(?:verses|passages|scriptures)`;
const NEW_LIST_PATTERN = new RegExp(
    String.raw`^(?:make|create|start|build|set\s+up|add|give\s+me)\s+(?:me\s+|us\s+)?(?:a|an|one)\s+(?:new\s+)?(?:${LIST_NOUN})\b`,
    'iu',
);
// "Save John 3:16 to my Bible list", "Add Romans 8:28 and Psalm 23 to the
// Easter list", "Put John 3:16 in my Bibles".
const SAVE_PATTERN =
    /^(?:save|add|put|keep|store|bookmark)\s+(.+?)\s+(?:to|in|into|on)\s+(?:my|the|our)\s+(.+?)\s*[.!]*$/iu;
const SAVE_TO_NAMED_LIST_PATTERN =
    /^(?:save|add|put|keep|store|bookmark)\s+(.+?)\s+(?:to|in|into|on)\s+(?:the\s+)?list\s+(?:called|named)\s+["“'‘]?(.+?)["”'’]?\s*[.!]*$/iu;
// What the list after "to my" is called when it means the Bibles list itself.
const DEFAULT_LIST_PATTERN =
    /^(?:bibles?(?:\s+list)?|bible\s+items?|verses?\s+list|saved\s+(?:verses|passages)(?:\s+list)?|list|default(?:\s+list)?)$/iu;
const NAMED_LIST_PATTERN = /^(.+?)\s+(?:bibles?\s+)?list$/iu;

function toAskLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʼ]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * The references in words like "John 20:1-18 and 1 Corinthians 15:3-8",
 * each as written -- or null when any part is not one: a line that is not
 * all references is a question for the assistant.
 */
export function readReferenceList(words: string): string[] | null {
    const text = String(words ?? '')
        .trim()
        .replace(/[.!?]+$/, '')
        .trim();
    if (text === '') {
        return null;
    }
    const parts = text
        .split(/\s*(?:[,;&]|\band\b|\bplus\b)\s*/iu)
        .map((part) => {
            return part.trim();
        })
        .filter((part) => {
            return part.length > 0;
        });
    if (
        parts.length === 0 ||
        parts.length > MAX_REFERENCE_COUNT ||
        !parts.every((part) => {
            return REFERENCE_PATTERN.test(part);
        })
    ) {
        return null;
    }
    return parts;
}

function readNewListAsk(line: string): BibleListAskType | null {
    const match = NEW_LIST_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    const afterNoun = line.slice(match[0].length);
    const named = readAskedName(afterNoun);
    const listName =
        named.name !== null && named.name.length <= MAX_LIST_NAME_LENGTH
            ? named.name
            : readAskedDayName(afterNoun);
    // What is in it: after "with", "containing", "including" or a colon.
    const contentMatch =
        /(?:\bwith\b|\bcontaining\b|\bincluding\b|\bhaving\b|:)\s*(.*)$/iu.exec(
            named.start >= 0
                ? afterNoun.slice(0, named.start) +
                      ' ' +
                      afterNoun.slice(named.end)
                : afterNoun,
        );
    const rest = (
        named.start >= 0
            ? afterNoun.slice(0, named.start) + ' ' + afterNoun.slice(named.end)
            : afterNoun
    )
        .replace(
            /\bfor\s+(?:(?:this|next|the|our)\s+)?\S+(?:\s+sunday)?/iu,
            ' ',
        )
        .replace(/[\s.!]+/g, ' ')
        .trim();
    if (contentMatch === null) {
        // Nothing in it -- and nothing else said, or it is not this.
        return rest === ''
            ? { listName, isNewList: true, references: [] }
            : null;
    }
    const references = readReferenceList(contentMatch[1]);
    if (references === null) {
        return null;
    }
    return { listName, isNewList: true, references };
}

function readSaveAsk(line: string): BibleListAskType | null {
    const named = SAVE_TO_NAMED_LIST_PATTERN.exec(line);
    if (named !== null) {
        const references = readReferenceList(named[1]);
        const listName = named[2].trim();
        return references === null ||
            listName === '' ||
            listName.length > MAX_LIST_NAME_LENGTH
            ? null
            : { listName, isNewList: false, references };
    }
    const match = SAVE_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    const references = readReferenceList(match[1]);
    if (references === null) {
        return null;
    }
    const listWords = match[2].trim();
    if (DEFAULT_LIST_PATTERN.test(listWords)) {
        return { listName: null, isNewList: false, references };
    }
    const namedList = NAMED_LIST_PATTERN.exec(listWords);
    if (namedList === null) {
        return null;
    }
    const listName = namedList[1].replace(/^["“'‘]|["”'’]$/g, '').trim();
    return listName === '' || listName.length > MAX_LIST_NAME_LENGTH
        ? null
        : { listName, isNewList: false, references };
}

/**
 * Whether a line asks to save passages to a Bibles list or to make one, and
 * which. Null for anything else, a how-to above all: "How do I save a verse
 * to my list?" is the guide's.
 */
export function readBibleListAsk(text: string): BibleListAskType | null {
    const line = toAskLine(text);
    if (
        line === '' ||
        line.startsWith('/') ||
        line.length > MAX_ASK_LENGTH ||
        HOW_TO_PATTERN.test(line)
    ) {
        return null;
    }
    const asked = line.replace(POLITE_LEAD_PATTERN, '');
    return readNewListAsk(asked) ?? readSaveAsk(asked);
}

/**
 * What stands for a passage in a sentence read by `readBibleListRequest`:
 * the passages are found by every installed Bible's book names
 * (`bibleListPasteHelpers.ts`), so the sentence's words are read apart.
 */
export const REFERENCE_MARK = '§';

export type BibleListRequestType = {
    listName: string | null;
    isNewList: boolean;
    /**
     * A list, the Bibles list or a Bible item is named. _Add John 3:16_
     * names none: with a song or a document open in the tab it is that
     * file's.
     */
    isListNamed: boolean;
};

const REQUEST_VERB = String.raw`(?:add|save|put|keep|store|bookmark|insert|include|append|pin)`;
// What is added, when the words say it and not the passages themselves:
// _these_, _the verses below_, _the references in this paragraph_.
const REQUEST_THING = String.raw`(?:bible\s+)?(?:verses?|passages?|references?|refs|scriptures?|readings?|items?|ones?)`;
const REQUEST_WHERE = String.raw`(?:below|above|here|too|as\s+well|(?:in|from|of)\s+(?:this|the|that|my)\s+(?:paragraph|text|message|note|passage|sermon|page|list))`;
const REQUEST_OBJECT = String.raw`(?:(?:all\s+(?:of\s+)?)?(?:these|those|this|them|it|that|both|the\s+following)(?:\s+${REQUEST_THING})?|(?:all\s+(?:of\s+)?)?(?:(?:the|a|an|my)\s+)?(?:new\s+)?${REQUEST_THING})(?:\s+${REQUEST_WHERE})?`;
// Who it is done for, and a `for` the passages finish (2026-11-14, EC-703:
// _add bible items for me for: john 3:16 gen 1_ was read as no request).
const REQUEST_FOR_ME = String.raw`(?:\s+for\s+(?:me|us))?`;
const REQUEST_PATTERN = new RegExp(
    String.raw`^(?:§\s*[-–—:,]?\s*)?(?:(?:and|then|now|also|so)\s+)?${REQUEST_VERB}${REQUEST_FOR_ME}(?:\s+(${REQUEST_OBJECT}))?${REQUEST_FOR_ME}(?:\s+for(?=\s*[-–—:]?\s*§))?(?:\s*§)?${REQUEST_FOR_ME}(?:\s+(?:to|in|into|on|onto)\s+(.+?))?${REQUEST_FOR_ME}(?:\s*[-–—:]?\s*§)?$`,
    'iu',
);
const BIBLE_ITEM_OBJECT_PATTERN = /\bbible\s+items?\b/iu;
const LIST_CALLED_PATTERN =
    /^(?:the\s+)?list\s+(?:called|named)\s+["“'‘]?(.+?)["”'’]?$/iu;
const LIST_OWNER_PATTERN = /^(?:my|the|our)\s+(.+)$/iu;
// A new list's content said with no passage left in it: _with_, _with
// these_, _containing the following_.
const NEW_LIST_CONTENT_PATTERN =
    /(?:\bwith\b|\bcontaining\b|\bincluding\b|\bhaving\b|:)(?:\s+(?:these|this|them|those|the\s+following)(?:\s+(?:verses?|passages?|references?))?)?/giu;

function readListTarget(words: string): {
    listName: string | null;
} | null {
    const target = words.trim();
    if (/^default(?:\s+list)?$/iu.test(target)) {
        return { listName: null };
    }
    const called = LIST_CALLED_PATTERN.exec(target);
    if (called !== null) {
        const listName = called[1].trim();
        return listName === '' || listName.length > MAX_LIST_NAME_LENGTH
            ? null
            : { listName };
    }
    const owned = LIST_OWNER_PATTERN.exec(target);
    if (owned === null) {
        return null;
    }
    const listWords = owned[1].trim();
    if (DEFAULT_LIST_PATTERN.test(listWords)) {
        return { listName: null };
    }
    const namedList = NAMED_LIST_PATTERN.exec(listWords);
    if (namedList === null) {
        return null;
    }
    const listName = namedList[1].replace(/^["“'‘]|["”'’]$/g, '').trim();
    return listName === '' || listName.length > MAX_LIST_NAME_LENGTH
        ? null
        : { listName };
}

function readNewListRequest(line: string): BibleListRequestType | null {
    const match = NEW_LIST_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    const afterNoun = line
        .slice(match[0].length)
        .replace(NEW_LIST_CONTENT_PATTERN, ' ')
        .replaceAll(REFERENCE_MARK, ' ');
    const named = readAskedName(afterNoun);
    const listName =
        named.name !== null && named.name.length <= MAX_LIST_NAME_LENGTH
            ? named.name
            : readAskedDayName(afterNoun);
    const rest = (
        named.start >= 0
            ? afterNoun.slice(0, named.start) + ' ' + afterNoun.slice(named.end)
            : afterNoun
    )
        .replace(
            /\bfor\s+(?:(?:this|next|the|our)\s+)?\S+(?:\s+sunday)?/iu,
            ' ',
        )
        .replace(/[\s.!,]+/g, ' ')
        .trim();
    return rest === ''
        ? { listName, isNewList: true, isListNamed: true }
        : null;
}

/**
 * One sentence of an ask whose passages stand as `REFERENCE_MARK`: _Add
 * these to my Bibles list_, _Save § to the Easter list_, _add bible item
 * §_, _Add §_, _Make a new Bible list called Easter with §_. Null for any
 * other sentence -- a how-to above all, and a passage put anywhere that is
 * not a list (_Put § on the screen_, _Add § to my running order_).
 */
export function readBibleListRequest(
    sentence: string,
): BibleListRequestType | null {
    const line = toAskLine(sentence)
        .replace(/\s*§(?:\s*(?:[,;&]|\band\b|\bplus\b)?\s*§)+/gu, ' §')
        .replace(/[\s.!?:]+$/u, '')
        .trim();
    if (
        line === '' ||
        line.length > MAX_ASK_LENGTH ||
        HOW_TO_PATTERN.test(line)
    ) {
        return null;
    }
    const asked = line.replace(POLITE_LEAD_PATTERN, '');
    const newList = readNewListRequest(asked);
    if (newList !== null) {
        return newList;
    }
    const match = REQUEST_PATTERN.exec(asked);
    if (match === null) {
        return null;
    }
    const object = match[1] ?? '';
    const hasPassage = asked.includes(REFERENCE_MARK) || object !== '';
    if (!hasPassage) {
        return null;
    }
    if (match[2] === undefined) {
        return {
            listName: null,
            isNewList: false,
            isListNamed: BIBLE_ITEM_OBJECT_PATTERN.test(object),
        };
    }
    const target = readListTarget(match[2]);
    return target === null
        ? null
        : { listName: target.listName, isNewList: false, isListNamed: true };
}

/** Whether a sentence asks HOW: _How do I add § to my list?_ */
export function checkIsBibleListHowTo(sentence: string) {
    return HOW_TO_PATTERN.test(toAskLine(sentence));
}

/** The name a new list gets when the ask names none. */
export function genDefaultBibleListName(date: Date) {
    return `Verses ${toDocumentDayText(date)}`;
}

const SAVE_VERB_PATTERN = new RegExp(String.raw`\b${REQUEST_VERB}\b`, 'iu');
const BIBLE_LIST_WORD_PATTERN =
    /\bbibles?\s+(?:items?|lists?)\b|\bbibles\s+(?:panel|tab)\b/iu;
const SCREEN_WORD_PATTERN =
    /\b(?:screens?|projector|present(?:ing)?|display|show(?:ing)?|live)\b/iu;

/**
 * Whether the words typed ask to SAVE passages as Bible items -- an add or
 * save verb and a Bible item or the Bibles list named, with no screen or
 * show beside it (2026-11-14, EC-703: _add bible items for me for: john
 * 3:16 gen 1_ reached a model, which put Genesis 1 on the screen and said
 * the projector was off). Such an ask puts nothing up.
 */
export function checkIsBibleListSaveLine(text: string) {
    const line = toAskLine(text);
    return (
        line !== '' &&
        SAVE_VERB_PATTERN.test(line) &&
        BIBLE_LIST_WORD_PATTERN.test(line) &&
        !SCREEN_WORD_PATTERN.test(line)
    );
}

/**
 * What a model is told under an ask to save Bible items the window could
 * not read a passage in (EC-703: _add a bible item for me: the verse that
 * says the Lord is my shepherd_ was answered with Psalm 23:1 and **Yes, put
 * it up** -- Auto's shared server is sent no `owa_bible_item`). A reference
 * pressed under it is saved by the window (`findCarriedBibleListRequest`).
 */
export const BIBLE_LIST_SAVE_HINT =
    'They asked to SAVE a passage as a Bible item (the Bibles list), not to ' +
    'show it: put nothing on the screen and never offer to. With ' +
    'owa_bible_item, save it (action "add"). Without it, name the passage ' +
    'you take them to mean and put its reference alone FIRST in OPTIONS ' +
    '(OPTIONS: Psalm 23:1 | ...): pressing it saves it.';

/** The hint for an ask to save Bible items, or null for any other. */
export function genBibleListSaveHint(asked: string) {
    return checkIsBibleListSaveLine(asked) ? BIBLE_LIST_SAVE_HINT : null;
}

// A reply that asks for the screen after all: _put it up_, _project it_.
const FOLLOW_UP_SCREEN_PATTERN = /\b(?:up|project|projected)\b/iu;

/**
 * Whether an ask goes on with a save of Bible items: it asks for one itself,
 * or it is a reply under a question that did and names no screen
 * (2026-11-14, EC-703: under _add a bible item for me: the verse where God
 * so loved the world_, the model's own option **John 3:16** was pressed and
 * the verse put on the screen).
 */
export function checkIsBibleListSaveFollowUp(
    text: string,
    previousQuestion: string | null,
) {
    if (checkIsBibleListSaveLine(text)) {
        return true;
    }
    const line = toAskLine(text);
    return (
        previousQuestion !== null &&
        checkIsBibleListSaveLine(previousQuestion) &&
        !SCREEN_WORD_PATTERN.test(line) &&
        !FOLLOW_UP_SCREEN_PATTERN.test(line)
    );
}

/**
 * The request a question that asked to save Bible items makes of the
 * passages a reply under it names: its list, never a new one again.
 */
export function readCarriedBibleListRequest(
    question: string,
): BibleListRequestType | null {
    if (!checkIsBibleListSaveLine(question)) {
        return null;
    }
    for (const piece of toAskLine(question).split(/[.!?;]\s|:\s/u)) {
        const request = readBibleListRequest(`${piece} ${REFERENCE_MARK}`);
        if (request !== null) {
            return {
                listName: request.listName,
                isNewList: false,
                isListNamed: true,
            };
        }
    }
    return { listName: null, isNewList: false, isListNamed: true };
}

/**
 * The request a reply carries on from the question above it in a tab: the
 * newest question asked to save Bible items, and no answer since saved
 * anything (one that did carries its Undo). Null otherwise.
 */
export function findCarriedBibleListRequest(
    messages: readonly {
        author: string;
        text: string;
        actions?: readonly { label?: string }[] | null;
    }[],
): BibleListRequestType | null {
    let index = messages.length - 1;
    let hasAnswer = false;
    while (index >= 0 && messages[index].author !== 'you') {
        if (
            (messages[index].actions ?? []).some((action) => {
                return action?.label === LYRIC_UNDO_LABEL;
            })
        ) {
            return null;
        }
        hasAnswer = true;
        index--;
    }
    return hasAnswer && index >= 0
        ? readCarriedBibleListRequest(messages[index].text)
        : null;
}

/** Whether a refusal of `add` is about the reference, not the list. */
export function checkIsUnreadableReference(message: string) {
    return /could not be read as a passage/i.test(message);
}

/**
 * Whether the supported question a line is asked as (or none) leaves it to
 * this route: a row whose own tool is `owa_bible_item` -- the fill-in
 * _Save John 3:16 to my Bibles list_ -- asks for exactly what the window
 * does, so it is done; any other row is the guide's.
 */
export function checkIsBibleListRowFree(
    row: { resources?: { tools?: string[] } } | null,
) {
    return (
        row === null ||
        (row.resources?.tools ?? []).includes(BIBLE_ITEM_TOOL_NAME)
    );
}

function toTitleKey(title: string) {
    return String(title ?? '')
        .normalize('NFC')
        .replace(/[\s\u00a0]+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Each passage's title in an `owa_bible_item list` answer, "(KJV) John 3:16". */
export function readBibleListTitles(listed: any): string[] {
    const lists = Array.isArray(listed?.lists) ? listed.lists : [];
    return lists.flatMap((one: any) => {
        return Array.isArray(one?.items)
            ? one.items.map((item: any) => {
                  return String(item?.title ?? '');
              })
            : [];
    });
}

/**
 * Whether a passage just saved is one the list held already -- the same
 * title, the Bible it is read in included: John 3:16 in the KJV and in
 * another Bible are two passages.
 */
export function checkIsSavedAlready(addedTitle: string, titles: string[]) {
    const key = toTitleKey(addedTitle);
    return (
        key !== '' &&
        titles.some((title) => {
            return toTitleKey(title) === key;
        })
    );
}
