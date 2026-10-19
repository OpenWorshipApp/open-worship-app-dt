/**
 * Finding a verse somebody half-remembers, in the chat: which Bible, then
 * what they remember, then the verses -- each one a button that opens it in
 * the Bible Lookup.
 *
 * Asked for with a picture of the Reader's **Find** panel (2026-10-16): _as a
 * user I want to consult with assistant in chatbot to find verses I forgot.
 * add robot icon somewhere in `Find` when I click it open tab in chatbot by
 * ask for bible key (list to choose) then follow up with whatever that user
 * can remember about the verse, user can provide list of words or similar
 * behavior of verse_, and the same evening _when found verse then it should
 * allow user to click to open in bible lookup_.
 *
 * - **The two first steps are buttons, with no model**, like the Bible import
 *   (`bibleImportChatHelpers.ts`): each one is `VERSE_FIND_STEP_TOOL_NAME`, a
 *   pseudo tool no model can press, carrying the whole step in its args.
 * - **What they remember goes to the assistant under a prompt of its own**
 *   (`AskExtraType.verseFind` in `llmBotHelpers.ts`): a few lines instead of
 *   the app's ~5 000-token prompt, and `owa_find_verse` as its only tool --
 *   offered to no other question (`MODEL_ON_ASK_TOOL_MAP`). The tab STAYS
 *   finding: every answer of it carries `verseFind`, so "no, it was about
 *   sheep" under one is more of the same search (`readVerseFindThread`).
 * - **With no assistant the window searches the words itself**
 *   (`answerVerseFindOffline`): a verse remembered by its words is found by
 *   the tool alone; one remembered by what it means needs an assistant, and
 *   the answer says so.
 * - **A verse is opened by the person's press**: the buttons under an answer
 *   are the tool's own `open`, for the verses the answer NAMES (a verse the
 *   search returned and the model set aside gets no button).
 * - **The Bible can be changed under any answer** (`genVerseChangeBibleAction`):
 *   the other Bibles to pick from, with what they remember and the verses
 *   found carried along, so nothing has to be said again.
 */
import type { BotActionType, BotAnswerType } from './helpBotHelpers';
import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
} from './bibleImportChatHelpers';
import { callTool, parseToolJson } from './mcpClient';
import { fillWords, tran } from './chatTranHelpers';
import { TRANSLATION_MODEL_PATTERN } from './chatTranslateHelpers';
import {
    checkIsAppWorkAsk,
    checkIsClosingLine,
} from './verseAskLanguageHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    getAppLangCode,
    toAsciiDigits,
} from './chatLangHelpers';
import { NOT_IN_LANGUAGE_REASON } from '../helper/bibleVerseFindHelpers';
import {
    genVerseFindAsk,
    readVerseFindAsk,
} from '../helper/ai/verseFindAskHelpers';

export const VERSE_FIND_TOOL_NAME = 'owa_find_verse';
// The kind of ask `MODEL_ON_ASK_TOOL_MAP` offers the tool to.
export const VERSE_FIND_ASK_KIND = 'verse-find';
export const VERSE_FIND_STEP_TOOL_NAME = 'owa-verse-find-step';
// **Search the internet for it**: a pseudo tool the window presses, never a
// model -- the address is built at the press from the words alone
// (`toVerseWebSearchUrl`), so nothing a model writes can be one.
export const VERSE_WEB_SEARCH_TOOL_NAME = 'owa-verse-web-search';
const MAX_WEB_SEARCH_WORDS_LENGTH = 200;
// More buttons than this is a list nobody reads in a 412px window: the rest
// are named in a sentence, and their short name can be typed.
const MAX_BIBLE_BUTTONS = 10;
const MAX_OPEN_BUTTONS = 5;
const MAX_TITLE_LENGTH = 48;
// The longest key and reference a carried verse may have: `1CO 13:4-7`,
// `1 Thessalonians 5:16-18`.
const MAX_VERSE_KEY_LENGTH = 20;
const MAX_VERSE_REF_LENGTH = 40;
// Stored English and drawn translated (`toShownLabel`).
export const SEARCH_ANOTHER_BIBLE_LABEL = 'Search another Bible';
export const SHOW_IN_ANOTHER_BIBLE_LABEL = 'Show in another Bible';

// What a change of Bible takes along, so nothing has to be said again:
// what they remember, and the verses already found.
export type VerseFindCarryType = {
    words?: string;
    verses?: { key: string; ref: string }[];
};

export type VerseFindStateType =
    | ({
          step: 'bible';
          // `isFromFind`: the Find panel's 🤖 asked, and `preferred` is the
          // Bible that panel is searching.
          preferred?: string | null;
          isFromFind?: boolean;
          // The Bible searched so far, when another one is asked for: it is
          // left out of the list.
          current?: string;
      } & VerseFindCarryType)
    | ({
          step: 'remember';
          bible: string;
          title?: string;
      } & VerseFindCarryType);

export type VerseFindAnswerType = BotAnswerType & {
    // The Bible the tab is finding in, stamped on the answer so the next
    // plain line typed under it is more of the same search.
    verseFind?: string;
};

type BibleRowType = { key: string; title: string };

export type FoundVerseType = {
    key: string;
    ref: string;
    bible: string;
    // The reference as the Bible itself writes it -- its book's own name and
    // digits, `ម៉ាថាយ ៥:៤៤` -- which `owa_find_verse` adds for a Bible not
    // in English.
    title?: string;
};

/**
 * A verse's reference as the PERSON reads it: the Bible's own `title` in a
 * window shown in a language other than English, the English `ref`
 * otherwise (2026-10-17, the user: _when app is in Khmer we don't expect
 * user can understand english at all_ -- and every found verse was drawn as
 * `Hebrews 5:14`, on its button too).
 */
export function toShownVerseRef(verse: { ref: string; title?: string }) {
    return verse.title !== undefined &&
        getAppLangCode() !== DEFAULT_CHAT_LANG_CODE
        ? verse.title
        : verse.ref;
}

// A result's `title`, when it is one a button can carry.
function readVerseTitle(verse: any): { title?: string } {
    return typeof verse?.title === 'string' &&
        verse.title.trim().length > 0 &&
        verse.title.length <= MAX_VERSE_REF_LENGTH
        ? { title: verse.title.trim() }
        : {};
}

function toBibleLabel(bible: BibleRowType) {
    const title = bible.title.trim();
    if (title.length === 0 || title.toLowerCase() === bible.key.toLowerCase()) {
        return bible.key;
    }
    const shortTitle =
        title.length > MAX_TITLE_LENGTH
            ? `${title.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
            : title;
    return `${bible.key} — ${shortTitle}`;
}

function toBibleRows(listed: any): BibleRowType[] {
    return (Array.isArray(listed?.bibles) ? listed.bibles : [])
        .filter((one: any) => {
            return typeof one?.key === 'string' && one.key.length > 0;
        })
        .map((one: any) => {
            return {
                key: String(one.key),
                title: typeof one.title === 'string' ? one.title : '',
            };
        });
}

/**
 * What a button carries for the next Bible, read as a hand-edited session
 * file could have left it: words cut to the length a search takes, verses
 * with a key and a reference each, once, five at most.
 */
function toVerseFindCarry(raw: any): {
    words: string | null;
    verses: { key: string; ref: string }[];
} {
    const words =
        typeof raw?.words === 'string'
            ? raw.words.trim().slice(0, MAX_WEB_SEARCH_WORDS_LENGTH)
            : '';
    const seen = new Set<string>();
    const verses = (Array.isArray(raw?.verses) ? raw.verses : [])
        .filter((verse: any) => {
            if (
                typeof verse?.key !== 'string' ||
                typeof verse?.ref !== 'string' ||
                verse.key.length === 0 ||
                verse.key.length > MAX_VERSE_KEY_LENGTH ||
                verse.ref.length === 0 ||
                verse.ref.length > MAX_VERSE_REF_LENGTH ||
                seen.has(verse.key)
            ) {
                return false;
            }
            seen.add(verse.key);
            return true;
        })
        .slice(0, MAX_OPEN_BUTTONS)
        .map((verse: any) => {
            return {
                key: String(verse.key),
                ref: String(verse.ref),
                ...readVerseTitle(verse),
            };
        });
    return { words: words.length > 0 ? words : null, verses };
}

function toCarryArgs(carry: ReturnType<typeof toVerseFindCarry>) {
    return {
        ...(carry.words === null ? {} : { words: carry.words }),
        ...(carry.verses.length === 0 ? {} : { verses: carry.verses }),
    };
}

/**
 * The button that changes the Bible, under any answer of the search (the
 * user's ask, 2026-10-17: _I'm looking in khmer then I should be able to
 * change to english_). It lists the other Bibles, the one searched now left
 * out, and carries what they remember and the verses found: picked, a Bible
 * shows those verses (**Show in another Bible**), or is searched for the
 * same words when none was found (**Search another Bible**).
 */
export function genVerseChangeBibleAction(
    bible: string,
    remembered: string | null = null,
    verses: { key: string; ref: string }[] = [],
): BotActionType {
    const carry = toVerseFindCarry({ words: remembered, verses });
    return {
        label:
            carry.verses.length > 0
                ? SHOW_IN_ANOTHER_BIBLE_LABEL
                : SEARCH_ANOTHER_BIBLE_LABEL,
        toolName: VERSE_FIND_STEP_TOOL_NAME,
        args: { step: 'bible', current: bible, ...toCarryArgs(carry) },
    };
}

/**
 * The one line a Bible picked to search AGAIN stands for -- `Help me find a
 * Bible verse in "KJV": love your enemies` -- asked as though typed, so the
 * search runs the whole way (the head start, the assistant, the window's
 * own search). Null when there is nothing to search again, when the verses
 * found are to be shown instead, or for a short name the line cannot carry.
 */
export function toVerseFindSearchAgainAsk(
    state: VerseFindStateType,
): string | null {
    if (state.step !== 'remember') {
        return null;
    }
    const carry = toVerseFindCarry(state);
    if (carry.verses.length > 0 || carry.words === null) {
        return null;
    }
    const ask = `${genVerseFindAsk(state.bible)}: ${carry.words}`;
    const read = readVerseFindAsk(ask);
    return read?.bibleKey === state.bible && read.remembered !== null
        ? ask
        : null;
}

/**
 * Bible Find's request as the transcript shows it: the person's own words,
 * so in the app's language, where the sentence the panel leaves
 * (`genVerseFindAsk`) stays English for `readVerseFindAsk` to read.
 */
export function genShownVerseFindAsk(bibleKey: string | null) {
    return bibleKey === null
        ? tran('Help me find a Bible verse')
        : fillWords(tran('Help me find a Bible verse in "{bible}"'), {
              bible: bibleKey,
          });
}

/** The answer that asks what they remember, once the Bible is known. */
export function genVerseFindMemoryQuestion(
    bible: string,
    title = '',
    lead = '',
): VerseFindAnswerType {
    return {
        text:
            (lead.length > 0 ? `${lead}\n\n` : '') +
            fillWords(tran('I will search **{bible}**.'), {
                bible: toBibleLabel({ key: bible, title }),
            }) +
            '\n\n' +
            tran(
                '**What do you remember about the verse?** Type it in the ' +
                    'box below, the way it comes to you:',
            ) +
            '\n\n- ' +
            tran('a few of its words, in any order — _love, enemies, pray_') +
            '\n- ' +
            tran(
                'or what it is about — _a verse about not worrying about ' +
                    'tomorrow_',
            ) +
            '\n\n' +
            tran(
                'If you remember the book, or roughly where it is, say that ' +
                    'too.',
            ),
        actions: [genVerseChangeBibleAction(bible)],
        verseFind: bible,
    };
}

function genImportBibleActions(): BotActionType[] {
    const importState = findBibleImportState([], 'Import bible');
    return importState === null
        ? []
        : [
              {
                  label: 'Import a Bible for me',
                  toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                  args: importState,
              },
          ];
}

function genNoBibleAnswer(): VerseFindAnswerType {
    return {
        text: tran(
            'There is no Bible on this computer to search yet. Install one ' +
                'first — I can do that with you, one question at a time.',
        ),
        actions: genImportBibleActions(),
    };
}

// Another Bible asked for, and the one searched is all there is. The tab
// keeps searching it.
function genNoOtherBibleAnswer(current: string): VerseFindAnswerType {
    return {
        text: fillWords(
            tran(
                '{bible} is the only Bible on this computer. To read or ' +
                    'search in another language, install a Bible in it ' +
                    'first — I can do that with you, one question at a time.',
            ),
            { bible: current },
        ),
        actions: genImportBibleActions(),
        verseFind: current,
    };
}

/**
 * The verses found, read again from the Bible picked -- a key reads in any
 * Bible -- each with its button, and the button to change again. Their
 * memory question when none of them can be read there.
 */
async function genVersesInBibleAnswer(
    bible: string,
    title: string,
    carry: ReturnType<typeof toVerseFindCarry>,
    call: (name: string, args: any) => Promise<string>,
): Promise<VerseFindAnswerType> {
    let result: any;
    try {
        result = parseToolJson(
            await call(VERSE_FIND_TOOL_NAME, {
                bible,
                refs: carry.verses
                    .map((verse) => {
                        return verse.ref;
                    })
                    .join('; '),
            }),
        );
    } catch (_error) {
        result = null;
    }
    const verses: { key: string; ref: string; text: string; title?: string }[] =
        (Array.isArray(result?.verses) ? result.verses : [])
            .filter((verse: any) => {
                return (
                    typeof verse?.key === 'string' &&
                    typeof verse?.ref === 'string' &&
                    typeof verse?.text === 'string'
                );
            })
            .map((verse: any) => {
                return {
                    key: verse.key,
                    ref: verse.ref,
                    text: verse.text,
                    ...readVerseTitle(verse),
                };
            });
    if (verses.length === 0) {
        return genVerseFindMemoryQuestion(
            bible,
            title,
            fillWords(tran('I could not read those verses in {bible}.'), {
                bible,
            }),
        );
    }
    const unread = (Array.isArray(result?.unread) ? result.unread : []).filter(
        (ref: any) => {
            return typeof ref === 'string';
        },
    );
    const lines = verses.map((verse) => {
        return `- **${toShownVerseRef(verse)}** — ${verse.text}`;
    });
    return {
        text:
            fillWords(tran('From **{bible}**:'), {
                bible: toBibleLabel({ key: bible, title }),
            }) +
            `\n\n${lines.join('\n')}\n\n` +
            (unread.length > 0
                ? fillWords(tran('{bible} does not have {refs}.'), {
                      bible,
                      refs: unread.join(', '),
                  }) + ' '
                : '') +
            fillWords(
                tran(
                    'If it is not here, say more of what you remember, and ' +
                        'I will search {bible}.',
                ),
                { bible },
            ),
        actions: [
            ...verses.slice(0, MAX_OPEN_BUTTONS).map((verse) => {
                return genVerseOpenAction({
                    key: verse.key,
                    ref: verse.ref,
                    bible,
                    ...readVerseTitle(verse),
                });
            }),
            genVerseChangeBibleAction(bible, carry.words, verses),
        ],
        verseFind: bible,
    };
}

/**
 * One step, answered with no model: the Bibles to choose from (with one
 * Bible, straight to the next question), what to tell about the verse, or
 * -- a Bible picked to change to -- the verses found, read from it. A Bible
 * picked to search their words again is the caller's to ask
 * (`toVerseFindSearchAgainAsk`).
 */
export async function runVerseFindStep(
    state: VerseFindStateType,
    call: (name: string, args: any) => Promise<string> = callTool,
): Promise<VerseFindAnswerType> {
    const carry = toVerseFindCarry(state);
    if (state.step === 'remember') {
        if (carry.verses.length > 0) {
            return await genVersesInBibleAnswer(
                state.bible,
                state.title ?? '',
                carry,
                call,
            );
        }
        return genVerseFindMemoryQuestion(state.bible, state.title ?? '');
    }
    let listed: any;
    try {
        listed = parseToolJson(await call(VERSE_FIND_TOOL_NAME, {}));
    } catch (error: any) {
        if (/No Bible is installed/i.test(String(error?.message))) {
            return genNoBibleAnswer();
        }
        return {
            text: fillWords(
                tran(
                    'I could not read the Bibles in the app just now. Make ' +
                        'sure the main window is open, then press the 🤖 in ' +
                        '**{find}** again.',
                ),
                { find: tran('Find') },
            ),
        };
    }
    const bibles = toBibleRows(listed);
    if (bibles.length === 0) {
        return genNoBibleAnswer();
    }
    const current =
        typeof state.current === 'string' && state.current.length > 0
            ? state.current
            : null;
    // Changing Bible: every one but the one searched so far.
    const choices =
        current === null
            ? bibles
            : bibles.filter((bible) => {
                  return bible.key.toLowerCase() !== current.toLowerCase();
              });
    if (current !== null && choices.length === 0) {
        return genNoOtherBibleAnswer(current);
    }
    const preferred =
        choices.find((bible) => {
            return (
                bible.key.toLowerCase() ===
                String(state.preferred ?? listed?.bible ?? '').toLowerCase()
            );
        }) ?? null;
    if (current === null && bibles.length === 1) {
        return genVerseFindMemoryQuestion(
            bibles[0].key,
            bibles[0].title,
            tran('There is one Bible on this computer, so that is the one.'),
        );
    }
    const ordered = [
        ...(preferred === null ? [] : [preferred]),
        ...choices.filter((bible) => bible !== preferred),
    ];
    const shown = ordered.slice(0, MAX_BIBLE_BUTTONS);
    const rest = ordered.slice(MAX_BIBLE_BUTTONS);
    const question =
        carry.verses.length === 0
            ? tran('**Which Bible should I search?** Pick one below.')
            : carry.verses.length === 1
              ? tran(
                    '**Which Bible should I show the verse in?** Pick one below.',
                )
              : tran(
                    '**Which Bible should I show the verses in?** Pick one below.',
                );
    return {
        text:
            question +
            (rest.length > 0
                ? ' ' +
                  fillWords(
                      tran('Or type the short name of another one: {names}.'),
                      {
                          names: rest
                              .map((bible) => {
                                  return bible.key;
                              })
                              .join(', '),
                      },
                  )
                : ''),
        actions: shown.map((bible): BotActionType => {
            return {
                label:
                    toBibleLabel(bible) +
                    (bible === preferred && state.isFromFind === true
                        ? ' (the one in Find)'
                        : ''),
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'remember',
                    bible: bible.key,
                    title: bible.title,
                    ...toCarryArgs(carry),
                },
            };
        }),
        // Words typed instead of a pick go on searching the Bible they
        // were searching.
        ...(current === null ? {} : { verseFind: current }),
    };
}

function findLastAnswer<
    T extends {
        author: 'you' | 'bot';
        isFollowUp?: true;
    },
>(messages: T[]) {
    return [...messages].reverse().find((message) => {
        return message.author === 'bot' && message.isFollowUp !== true;
    });
}

/**
 * The Bible a typed line picks, read against the LAST answer only, while it
 * is the question "which Bible": its short name, its number in the list, or
 * a word of its title only one of them has. Null for anything else.
 */
export function readVerseFindTypedPick(
    messages: {
        author: 'you' | 'bot';
        isFollowUp?: true;
        actions?: BotActionType[];
    }[],
    text: string,
): VerseFindStateType | null {
    const said = text.trim().toLowerCase();
    const choices = (findLastAnswer(messages)?.actions ?? []).filter(
        (action) => {
            return (
                action.toolName === VERSE_FIND_STEP_TOOL_NAME &&
                action.args?.step === 'remember' &&
                typeof action.args?.bible === 'string'
            );
        },
    );
    if (said.length === 0 || said.startsWith('/') || choices.length === 0) {
        return null;
    }
    const byKey = choices.find((action) => {
        return String(action.args.bible).toLowerCase() === said;
    });
    const digits = toAsciiDigits(
        said.normalize('NFKC').replace(/\p{Cf}/gu, ''),
    );
    const number = /^\d{1,2}[?？]?$/.test(digits)
        ? Number.parseInt(digits, 10)
        : NaN;
    const byNumber = Number.isInteger(number) ? choices[number - 1] : undefined;
    const byTitle = choices.filter((action) => {
        return (
            said.length >= 3 &&
            String(action.args?.title ?? '')
                .toLowerCase()
                .includes(said)
        );
    });
    const picked =
        byKey ?? byNumber ?? (byTitle.length === 1 ? byTitle[0] : undefined);
    return picked === undefined ? null : (picked.args as VerseFindStateType);
}

/** Original choices for a natural-language answer to "which Bible?". */
export function getVerseFindInputChoices(actions: BotActionType[] | undefined) {
    return (actions ?? []).flatMap((action, index) => {
        return action.toolName === VERSE_FIND_STEP_TOOL_NAME &&
            action.args?.step === 'remember' &&
            typeof action.args.bible === 'string'
            ? [{ id: index + 1, label: action.label }]
            : [];
    });
}

// What ends a finding tab's run: the app's own work, which the ordinary
// assistant answers -- "put it on the screen", "how do I save it". A verse
// word does not: "it is a verse about sheep" is more of the search.
const VERSE_FIND_EXIT_PATTERN =
    /\b(?:screens?|projector|present\w*|slides?|songs?|lyrics?|countdown|settings?|buttons?|menu|windows?|save|copy|how\s+(?:do|can)\s+i|where\s+is)\b/i;

/**
 * The Bible a typed line goes on searching in: the last answer of the tab
 * was one of this search (it carries `verseFind`), and the line is not a
 * command or the app's own work. Null otherwise.
 */
export function readVerseFindThread(
    messages: {
        author: 'you' | 'bot';
        isFollowUp?: true;
        verseFind?: string;
    }[],
    text: string,
): string | null {
    const said = text.trim();
    if (
        said.length === 0 ||
        said.startsWith('/') ||
        VERSE_FIND_EXIT_PATTERN.test(said) ||
        checkIsAppWorkAsk(said) ||
        checkIsClosingLine(said)
    ) {
        return null;
    }
    const bible = findLastAnswer(messages)?.verseFind;
    return typeof bible === 'string' && bible.length > 0 ? bible : null;
}

/**
 * The answer to a thank-you under a found verse, with no model (2026-10-17,
 * EC-300): a short line in the app's language, where a model handed it --
 * a local one, the full app prompt -- took three minutes to say the guide
 * covers the app only. Null when the line is not one, or the last answer was
 * not the verse search's.
 */
export function genVerseFindThanksAnswer(
    messages: {
        author: 'you' | 'bot';
        isFollowUp?: true;
        verseFind?: string;
    }[],
    text: string,
): string | null {
    const bible = findLastAnswer(messages)?.verseFind;
    if (typeof bible !== 'string' || !checkIsClosingLine(text)) {
        return null;
    }
    return tran(
        'You are welcome. When you want to find another verse, just tell me ' +
            'what you remember of it.',
    );
}

/**
 * Gemma 4, for any putting of words into English (the user's word,
 * 2026-10-16: _for any translation attempt please prefer Gemma 4 models_):
 * Auto asks one first for a verse that has to be translated, and the head
 * start below asks one for the English when one can answer.
 */
export const VERSE_TRANSLATION_MODEL_PATTERN = TRANSLATION_MODEL_PATTERN;

// A letter of any script but Latin: Khmer, Thai, Chinese… words that have to
// be put into English before the KJV can be searched for them.
const NON_LATIN_LETTER_PATTERN = /(?!\p{Script=Latin})\p{L}/u;

/** Whether what they remember has to be translated to be found in the KJV. */
export function checkVerseFindNeedsTranslation(remembered: string) {
    return NON_LATIN_LETTER_PATTERN.test(remembered);
}

// The longest English the head start searches for: a verse, not a sermon.
const MAX_TRANSLATION_LENGTH = 200;

/** What the translating model is asked: their words, then the frame. */
export function toVerseTranslationAsk(remembered: string) {
    return (
        `${remembered.trim()}\n\n(Put the words above into English, worded ` +
        'the way the King James Bible says it -- thee, thou, saith, lovest. ' +
        'Answer with the English words alone, on one line, nothing else.)'
    );
}

/**
 * The English a translating model answered, or null for an answer that is
 * not one: its first line with words in it, quotes and a label taken off,
 * and Latin letters in it -- a model that answered in the words it was given
 * translated nothing.
 */
export function readVerseTranslation(answerText: string): string | null {
    const line =
        answerText
            .split('\n')
            .map((one) => {
                return one
                    .replace(/^\s*(?:english|translation)\s*:\s*/i, '')
                    .replaceAll(/["“”*_`]/g, '')
                    .trim();
            })
            .find((one) => {
                return one.length > 0;
            }) ?? '';
    if (line.length === 0 || !/\p{Script=Latin}/u.test(line)) {
        return null;
    }
    return line.slice(0, MAX_TRANSLATION_LENGTH);
}

export type VerseHeadStartPartType = {
    // What was searched, in words, for the MODEL: "ពគប, for their own words".
    what: string;
    // The same said to the PERSON, in the app's language, when the answer
    // is the head start itself: "In ពគប, for your words".
    shown?: string;
    verses: { key: string; ref: string; text: string; title?: string }[];
};

// Verses each search hands over: the model reads them on every round.
const MAX_HEAD_START_VERSES = 5;
const MAX_HEAD_START_TEXT = 160;

function toHeadStartPart(
    what: string,
    shown: string,
    text: string,
    bible: string,
) {
    const result = parseToolJson(text);
    const verses = (Array.isArray(result?.verses) ? result.verses : [])
        .filter((verse: any) => {
            return (
                typeof verse?.key === 'string' &&
                typeof verse?.ref === 'string' &&
                typeof verse?.text === 'string'
            );
        })
        .slice(0, MAX_HEAD_START_VERSES)
        .map((verse: any) => {
            return {
                key: verse.key,
                ref: verse.ref,
                text: verse.text.slice(0, MAX_HEAD_START_TEXT),
                ...readVerseTitle(verse),
            };
        });
    const isSearchedElsewhere =
        typeof result?.searchedIn === 'string' && result.searchedIn !== bible;
    const searchedIn = isSearchedElsewhere
        ? ` (searched in ${result.searchedIn}, quoted from ${bible})`
        : '';
    const shownSearchedIn = isSearchedElsewhere
        ? ' ' +
          fillWords(tran('(searched in {other}, quoted from {bible})'), {
              other: result.searchedIn,
              bible,
          })
        : '';
    return {
        what: `${what}${searchedIn}`,
        shown: `${shown}${shownSearchedIn}`,
        verses,
    };
}

/**
 * The searches the window makes BEFORE any model round, so the assistant
 * starts from results instead of spending its first rounds finding them --
 * which a small model may never manage: their words in their Bible, and,
 * when an English rendering was had (`english`, from a Gemma 4 model), that
 * English too -- searched in the KJV when their Bible cannot read it, every
 * verse quoted from their Bible. A search that fails is left out: the
 * assistant can still search for itself.
 */
export async function genVerseHeadStart(
    remembered: string,
    bible: string,
    english: string | null,
    call: (name: string, args: any) => Promise<string> = callTool,
): Promise<VerseHeadStartPartType[]> {
    const parts: VerseHeadStartPartType[] = [];
    try {
        parts.push(
            toHeadStartPart(
                `${bible}, for their own words`,
                fillWords(tran('In {bible}, for your words'), { bible }),
                await call(VERSE_FIND_TOOL_NAME, { bible, words: remembered }),
                bible,
            ),
        );
    } catch (_error) {
        // Words not in this Bible's language, or none it holds.
    }
    if (english !== null) {
        try {
            parts.push(
                toHeadStartPart(
                    `${bible}, for their words put into English: “${english}”`,
                    fillWords(
                        tran(
                            'In {bible}, for your words in English: “{english}”',
                        ),
                        { bible, english },
                    ),
                    await call(VERSE_FIND_TOOL_NAME, { bible, words: english }),
                    bible,
                ),
            );
        } catch (_error) {
            // The same: the assistant searches for itself.
        }
    }
    return parts;
}

/**
 * The head start shown as the answer when no assistant answered: each search
 * with the verses it found, a button for each verse, the Google link. Null
 * when it found nothing, for the plain search's own answer to say why.
 */
export function genVerseHeadStartAnswer(
    parts: VerseHeadStartPartType[],
    remembered: string,
    bible: string,
): VerseFindAnswerType | null {
    const shown = parts.filter((part) => {
        return part.verses.length > 0;
    });
    if (shown.length === 0) {
        return null;
    }
    const seen = new Set<string>();
    const offered: { key: string; ref: string; title?: string }[] = [];
    const blocks = shown.map((part) => {
        const lines = part.verses.map((verse) => {
            if (!seen.has(verse.key) && offered.length < MAX_OPEN_BUTTONS) {
                seen.add(verse.key);
                offered.push({
                    key: verse.key,
                    ref: verse.ref,
                    ...readVerseTitle(verse),
                });
            }
            return `- **${toShownVerseRef(verse)}** — ${verse.text}`;
        });
        return `**${part.shown ?? part.what}:**\n\n${lines.join('\n')}`;
    });
    const webLine = genVerseWebSearchLine(remembered);
    return {
        text:
            `${blocks.join('\n\n')}\n\n` +
            tran(
                'If none of these is the one, say more of what you remember.',
            ) +
            '\n\n' +
            webLine.text,
        actions: [
            ...offered.map((verse) => {
                return genVerseOpenAction({ ...verse, bible });
            }),
            genVerseChangeBibleAction(bible, remembered, offered),
            genVerseWebSearchAction(remembered, bible),
        ],
        links: [webLine.url],
        verseFind: bible,
    };
}

/** The verses the head start found, for the buttons under the answer. */
export function toHeadStartFoundVerses(
    parts: VerseHeadStartPartType[],
    bible: string,
): FoundVerseType[] {
    return parts.flatMap((part) => {
        return part.verses.map((verse) => {
            return {
                key: verse.key,
                ref: verse.ref,
                bible,
                ...readVerseTitle(verse),
            };
        });
    });
}

/** The head start as the model is told it, after their words. */
export function toVerseHeadStartAsk(parts: VerseHeadStartPartType[]) {
    if (parts.length === 0) {
        return '';
    }
    const lines = parts.map((part) => {
        const verses =
            part.verses.length === 0
                ? '  (nothing)'
                : part.verses
                      .map((verse) => {
                          // No key: a small model copied "PSA 23:1 Psalm
                          // 23:1:" into its answer, and a reference reads
                          // in every Bible by its name. The Bible's own
                          // title beside it, for an answer not in English.
                          const title =
                              verse.title === undefined
                                  ? ''
                                  : ` (title: ${verse.title})`;
                          return `  ${verse.ref}${title} — ${verse.text}`;
                      })
                      .join('\n');
        return `- ${part.what}:\n${verses}`;
    });
    return (
        '\n\nThe app has already searched, and these need not be searched ' +
        'again (reference — the verse in their Bible):\n' +
        `${lines.join('\n')}\n` +
        'Answer from them when one fits; otherwise search other words, read ' +
        'verses you think of with refs, or look online.'
    );
}

/**
 * What the model is asked: their words, then the frame -- in the USER turn,
 * like `/btw`'s, because the system prompt is a cached prefix and the Bible
 * changes per tab.
 */
export function toVerseFindAsk(remembered: string, bible: string) {
    return (
        `${remembered.trim()}\n\n(That is what I remember of a Bible verse I ` +
        `am trying to find. Search the installed Bible "${bible}" for it ` +
        `with ${VERSE_FIND_TOOL_NAME}.)`
    );
}

/**
 * The verses one `owa_find_verse` result carried, read off the result the
 * way the tool watch reads every result: the key it opens by, the reference
 * an answer names it by, the Bible it is in.
 */
export function readFoundVerses(text: string): FoundVerseType[] {
    const result = parseToolJson(text);
    const bible = typeof result?.bible === 'string' ? result.bible : '';
    if (bible.length === 0 || !Array.isArray(result?.verses)) {
        return [];
    }
    return result.verses
        .filter((verse: any) => {
            return (
                typeof verse?.key === 'string' && typeof verse?.ref === 'string'
            );
        })
        .map((verse: any) => {
            return {
                key: verse.key,
                ref: verse.ref,
                bible,
                ...readVerseTitle(verse),
            };
        });
}

function escapeRegExp(text: string) {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Where in an answer a found verse is NAMED, or -1: its book (the last
 * letter left off, so "Psalm" names "Psalms 23:1"), chapter and first verse,
 * or the key it opens by.
 */
function findNamedAt(answerText: string, verse: FoundVerseType) {
    const match = /^(.+?)\s+(\d+):(\d+)/.exec(verse.ref);
    // Named the way their Bible writes it (`title`), as the prompt asks of
    // an answer not in English -- in its digits or in 0-9 alike.
    const titleAt =
        verse.title === undefined
            ? -1
            : toAsciiDigits(answerText).indexOf(toAsciiDigits(verse.title));
    const keyAt = [answerText.indexOf(verse.key), titleAt]
        .filter((at) => {
            return at !== -1;
        })
        .reduce((first, at) => {
            return first === -1 ? at : Math.min(first, at);
        }, -1);
    if (match === null) {
        return keyAt;
    }
    const book = match[1];
    const stem = book.length > 3 ? book.slice(0, -1) : book;
    const pattern = new RegExp(
        `${escapeRegExp(stem)}\\w*\\.?\\s+${match[2]}\\s*:\\s*${match[3]}(?!\\d)`,
        'i',
    );
    const named = pattern.exec(answerText);
    if (named === null) {
        return keyAt;
    }
    return keyAt === -1 ? named.index : Math.min(keyAt, named.index);
}

/**
 * The found verses an answer NAMES, once each, in the order it names them,
 * in the Bible the conversation searches -- a verse the search returned and
 * the answer set aside is not one to offer.
 */
export function pickNamedVerses(
    found: FoundVerseType[],
    answerText: string,
    // A verse found in the KJV for a Khmer search is the Khmer one's -- a
    // key reads in any Bible -- and once, where a verse found in both had
    // drawn two buttons of one label (seen live 2026-10-16).
    bible: string,
): FoundVerseType[] {
    const seen = new Set<string>();
    return found
        .map((verse) => {
            return { verse, at: findNamedAt(answerText, verse) };
        })
        .filter(({ verse, at }) => {
            if (at === -1 || seen.has(verse.key)) {
                return false;
            }
            seen.add(verse.key);
            return true;
        })
        .sort((one, other) => {
            return one.at - other.at;
        })
        .slice(0, MAX_OPEN_BUTTONS)
        .map(({ verse }) => {
            return { ...verse, bible };
        });
}

/** **Open … in Bible Lookup** for each found verse the answer names. */
export function genVerseOpenActions(
    found: FoundVerseType[],
    answerText: string,
    bible: string,
): BotActionType[] {
    return pickNamedVerses(found, answerText, bible).map(genVerseOpenAction);
}

/**
 * **Open … in Bible Lookup**. The label stays English -- code reads it back
 * -- and the Bible's own `title` rides in the args for the button to be
 * drawn with in a window not in English (`toShownVerseRef`).
 */
export function genVerseOpenAction(verse: FoundVerseType): BotActionType {
    return {
        label: `Open ${verse.ref} in Bible Lookup`,
        toolName: VERSE_FIND_TOOL_NAME,
        args: {
            bible: verse.bible,
            open: verse.key,
            ...(verse.title === undefined ? {} : { title: verse.title }),
        },
    };
}

/**
 * The Google search a press or a link opens -- "bible verse" and their own
 * words, `https://www.google.com/search?q=bible+verse+jesus+ask+peter` (the
 * user's ask, 2026-10-16: _build a google link for user … to let user click
 * open_).
 */
export function toVerseWebSearchUrl(remembered: unknown) {
    const words =
        typeof remembered === 'string'
            ? remembered
                  .replaceAll(/\s+/g, ' ')
                  .trim()
                  .slice(0, MAX_WEB_SEARCH_WORDS_LENGTH)
            : '';
    const query = new URLSearchParams({ q: `bible verse ${words}`.trim() });
    return `https://www.google.com/search?${query.toString()}`;
}

/**
 * The verse could not be found: the line that says so with the Google link
 * written out, and the address to draw as a link (`links` on the answer --
 * an address the APP wrote, `chatLinkHelpers.ts`).
 */
export function genVerseWebSearchLine(remembered: string) {
    const url = toVerseWebSearchUrl(remembered);
    return {
        text:
            tran('If it is still not here, search Google for it:') +
            ` \`${url}\``,
        url,
    };
}

/**
 * The verse could not be placed in the Bible here: one press opens the
 * person's browser on a search for it (2026-10-16, the user's ask: _if
 * something over what assistant can answer then try lookup on internet_).
 */
export function genVerseWebSearchAction(
    remembered: string,
    bible: string,
): BotActionType {
    return {
        label: 'Search Google for it',
        toolName: VERSE_WEB_SEARCH_TOOL_NAME,
        // The Bible goes on, so a reference found online and typed under the
        // press is read from it.
        args: {
            words: remembered.trim().slice(0, MAX_WEB_SEARCH_WORDS_LENGTH),
            bible,
        },
    };
}

/**
 * The search with no assistant: the words as they were typed, the verses
 * that hold most of them, and a button for each. What it cannot do -- find a
 * verse by what it means -- it says.
 */
export async function answerVerseFindOffline(
    remembered: string,
    bible: string,
    call: (name: string, args: any) => Promise<string> = callTool,
): Promise<VerseFindAnswerType> {
    let text: string;
    try {
        text = await call(VERSE_FIND_TOOL_NAME, { bible, words: remembered });
    } catch (error: any) {
        // Seen live 2026-10-16: English words typed under the Khmer Bible
        // were answered "make sure the main window is open".
        if (String(error?.message).startsWith(NOT_IN_LANGUAGE_REASON)) {
            const webLine = genVerseWebSearchLine(remembered);
            return {
                text:
                    fillWords(
                        tran(
                            'Those words are not written in the language of ' +
                                '{bible}, so there is nothing in it to match ' +
                                'them. Type them the way that Bible writes ' +
                                'them, or press **{another}** below to search ' +
                                'one in your language for them.',
                        ),
                        { bible, another: tran('Search another Bible') },
                    ) +
                    '\n\n' +
                    tran(
                        'An assistant can also take words in your language ' +
                            'and find the verse: pick one in the row above, ' +
                            'or add a key in Settings → Others → AI Providers.',
                    ) +
                    '\n\n' +
                    webLine.text,
                actions: [
                    genVerseChangeBibleAction(bible, remembered),
                    genVerseWebSearchAction(remembered, bible),
                ],
                links: [webLine.url],
                verseFind: bible,
            };
        }
        return {
            text: tran(
                'I could not search the Bible just now. Make sure the main ' +
                    'window is open, then type the words again.',
            ),
            verseFind: bible,
        };
    }
    const result = parseToolJson(text);
    const verses = (Array.isArray(result?.verses) ? result.verses : []).filter(
        (verse: any) => {
            return (
                typeof verse?.ref === 'string' &&
                typeof verse?.text === 'string'
            );
        },
    );
    const meaningNote = tran(
        'If you remember what it is ABOUT rather than its words, an ' +
            'assistant can search by meaning: pick one in the row above, or ' +
            'add a key in Settings → Others → AI Providers.',
    );
    if (verses.length === 0) {
        const webLine = genVerseWebSearchLine(remembered);
        const missing = Array.isArray(result?.notInBible)
            ? result.notInBible.filter((word: any) => {
                  return typeof word === 'string';
              })
            : [];
        return {
            text:
                fillWords(
                    tran('No verse in {bible} has those words together.'),
                    {
                        bible,
                    },
                ) +
                (missing.length > 0
                    ? ' ' +
                      fillWords(tran('These are not in it at all: {words}.'), {
                          words: missing.join(', '),
                      })
                    : '') +
                ' ' +
                tran(
                    'Try fewer words, or other forms of them (forgive / forgave).',
                ) +
                `\n\n${meaningNote}\n\n${webLine.text}`,
            actions: [
                genVerseChangeBibleAction(bible, remembered),
                genVerseWebSearchAction(remembered, bible),
            ],
            links: [webLine.url],
            verseFind: bible,
        };
    }
    const of = Number(result?.of);
    const lines = verses.map((verse: any) => {
        const hits =
            Number.isInteger(of) && of > 1 && Number.isInteger(verse.hits)
                ? ` _(${fillWords(tran('{hits} of {of} words'), {
                      hits: verse.hits,
                      of,
                  })})_`
                : '';
        return `- **${toShownVerseRef({ ref: verse.ref, ...readVerseTitle(verse) })}**${hits} — ${verse.text}`;
    });
    const total = Number(result?.total);
    return {
        text:
            fillWords(
                tran('These verses in {bible} have the most of your words:'),
                { bible },
            ) +
            `\n\n${lines.join('\n')}\n\n` +
            (Number.isInteger(total) && total > verses.length
                ? fillWords(
                      tran(
                          '{total} verses have some of them; add a word you ' +
                              'remember to narrow it down.',
                      ),
                      { total },
                  ) + ' '
                : '') +
            meaningNote,
        actions: [
            ...verses.slice(0, MAX_OPEN_BUTTONS).map((verse: any) => {
                return genVerseOpenAction({
                    key: verse.key,
                    ref: verse.ref,
                    bible,
                    ...readVerseTitle(verse),
                });
            }),
            genVerseChangeBibleAction(bible, remembered, verses),
            genVerseWebSearchAction(remembered, bible),
        ],
        verseFind: bible,
    };
}

/**
 * Said over the window's own search when the assistant could not answer: the
 * list under it is the words looked up, not an assistant's reading of them.
 * English here and translated where it is drawn (`tranLabel`).
 */
export const VERSE_FIND_OFFLINE_NOTE =
    'I searched the Bible for your words myself instead.';

/** What a press of **Open … in Bible Lookup** says it did. */
export function describeVerseOpened(text: string) {
    const result = parseToolJson(text);
    if (typeof result?.opened !== 'string') {
        return tran('I could not open that verse just now.');
    }
    const bible = typeof result.bible === 'string' ? ` (${result.bible})` : '';
    const verse = toShownVerseRef({
        ref: result.opened,
        ...readVerseTitle(result),
    });
    return fillWords(
        tran(
            '**Look at the app window.** {verse} is open in the Bible ' +
                'Lookup. Nothing went on a screen.',
        ),
        { verse: `${verse}${bible}` },
    );
}
