/**
 * Installing a Bible from a link, in the chat, one question at a time.
 *
 * Asked for in so many words: the assistant should download the file, read
 * it, suggest a short name, a language, the digits and the book names for the
 * person to PICK, and install it -- "for old and non-technical users, so it
 * should try its best to help". It used to open Settings with the link typed
 * in and leave the person a form with four fields they had never heard of.
 *
 * So this is a conversation of buttons, with no model: a link in a message
 * starts it (`readBibleImportLinkAsk`), every answer carries the next choices
 * with the recommended one first, and every button carries the whole state so
 * far in its args -- the window keeps nothing, a reopened tab can carry on,
 * and pressing an old button simply starts that step again. A typed answer
 * works where one makes sense (`readBibleImportTypedReply`): a short name of
 * their own, a language by name, a word to pick a file off a long list.
 * Nothing is installed until **Install it** is pressed, and that answer has
 * an **Undo**.
 *
 * The work is `owa_bible_xml`'s, the same tool a model calls -- so a model
 * that started an import itself hands over to these same buttons
 * (`genBibleImportCheckAnswer`), and the two can never disagree about what a
 * step does. English only, like the rest of this window.
 */
import { getBibleNumberChoices } from '../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import {
    BIBLE_XML_CATALOG_URL,
    toBibleSearchWords,
} from '../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { appError } from '../helper/loggerHelpers';
import type { BotActionType, BotAnswerType } from './helpBotHelpers';
import { callTool, parseToolJson } from './mcpClient';

// A pseudo tool, caught in the window's `handleActing`: no tool host ever
// registers it, so no model can press these buttons for the person.
export const BIBLE_IMPORT_STEP_TOOL_NAME = 'owa-bible-import-step';

type NameListType = {
    id: string;
    label: string;
    first: string[];
    // Names no other list on offer has: two editions often open alike.
    own?: string[];
    matches?: number;
};

type LocaleChoiceType = { locale: string; name: string; why?: string };

export type BibleImportStepType =
    | 'check'
    | 'key'
    | 'locale'
    | 'locale-typed'
    | 'digits'
    | 'names'
    | 'more-names'
    | 'confirm'
    | 'import'
    | 'cancel'
    | 'undo'
    | 'settings'
    | 'language'
    | 'local-file';

export type BibleImportStateType = {
    step: BibleImportStepType;
    // What a TYPED reply to the answer this state was drawn under means.
    awaits?: 'key' | 'locale' | 'find';
    url?: string;
    // The page a list of files came from: a typed word searches it again.
    pageUrl?: string;
    // ...and the words that page was searched with, which a typed word adds to.
    pageFind?: string;
    find?: string;
    typed?: string;
    draftId?: string;
    title?: string;
    summary?: string;
    keys?: string[];
    takenKeys?: string[];
    key?: string;
    locales?: LocaleChoiceType[];
    locale?: string;
    localeName?: string;
    digitChoices?: { local?: string; ascii: string };
    digits?: 'local' | 'ascii';
    nameLists?: NameListType[];
    fileList?: NameListType;
    bookNames?: string;
    undoId?: string;
    note?: string;
};

// A language rarely has more editions than this; a catalog search answers
// every one of them, not a sample.
const MAX_FILE_BUTTONS = 12;

function toAction(label: string, state: BibleImportStateType): BotActionType {
    return { label, toolName: BIBLE_IMPORT_STEP_TOOL_NAME, args: state };
}

/**
 * The state a step's buttons carry on to the next one: everything chosen so
 * far, minus what only that answer needed.
 */
function carry(
    state: BibleImportStateType,
    next: Partial<BibleImportStateType>,
) {
    const { awaits: _awaits, typed: _typed, note: _note, ...rest } = state;
    return { ...rest, ...next } as BibleImportStateType;
}

function toCount(value: unknown) {
    return Number(value ?? 0).toLocaleString('en-US');
}

// --- reading what the person said ----------------------------------------------

const IMPORT_WORD_PATTERN =
    /\b(?:import|install|add|get|download|load|put|use)\b/i;

/**
 * A message asking for a Bible from ONE address: "Import bible from xml url
 * https://…", "please add the Khmer bible from https://github.com/…". The
 * words around the address are kept: "Khmer" picks the file off a repository
 * page with a thousand on it. A song, a second address or a long paste is
 * left for everything else this window does.
 */
export function readBibleImportLinkAsk(
    text: string,
): { url: string; find: string } | null {
    if (text.length > 1200 || text.trimStart().startsWith('/')) {
        return null;
    }
    if (!/\bbibles?\b/i.test(text) || !IMPORT_WORD_PATTERN.test(text)) {
        return null;
    }
    const urlList = text.match(/https?:\/\/[^\s<>"`]+/g) ?? [];
    if (urlList.length !== 1) {
        return null;
    }
    try {
        const url = new URL(urlList[0].replace(/[),.;]+$/, ''));
        if (url.username || url.password) {
            return null;
        }
        return {
            url: url.href,
            find: text.replace(urlList[0], ' ').replace(/\s+/g, ' ').trim(),
        };
    } catch (_error) {
        return null;
    }
}

/**
 * The state the person's typed words continue, or null when what they typed
 * is not an answer to the step in front of them. Read off the LAST answer in
 * the tab: an import left three questions ago is not what "KJV2" is about.
 */
export function readBibleImportTypedReply(
    lastBotActions: BotActionType[] | undefined,
    text: string,
): BibleImportStateType | null {
    const typed = text.trim();
    if (
        typed === '' ||
        typed.length > 60 ||
        typed.startsWith('/') ||
        /https?:\/\//.test(typed)
    ) {
        return null;
    }
    const waiting = (lastBotActions ?? []).find((action) => {
        return (
            action.toolName === BIBLE_IMPORT_STEP_TOOL_NAME &&
            typeof action.args?.awaits === 'string'
        );
    });
    if (waiting === undefined) {
        return null;
    }
    const state = waiting.args as BibleImportStateType;
    // A question is not an answer: "what is a Bible key?" goes to whoever
    // answers questions.
    if (/\?$/.test(typed) || typed.split(/\s+/).length > 4) {
        return null;
    }
    if (state.awaits === 'key') {
        return carry(state, { step: 'key', typed });
    }
    if (state.awaits === 'locale') {
        return carry(state, { step: 'locale-typed', typed });
    }
    // Narrows the search already made: "2019" after "the Khmer bible"
    // means the Khmer one from 2019, not every Bible from 2019.
    return carry(state, {
        step: 'check',
        find: [state.pageFind ?? '', typed].join(' ').trim(),
    });
}

// --- the steps ----------------------------------------------------------------

function genKeyReason(key: string, takenKeys: string[]) {
    if (key.length < 2 || key.length > 24) {
        return 'A short name is 2 to 24 letters or numbers, like KJV.';
    }
    if (/\s/.test(key)) {
        return `"${key}" has a space in it. Use letters and numbers only, like KSV.`;
    }
    if (/[\\/:*?"<>|.]/.test(key)) {
        return `"${key}" has a sign in it that cannot be in a file name. Use letters and numbers only.`;
    }
    if (
        takenKeys.some((taken) => {
            return taken.toLowerCase() === key.toLowerCase();
        })
    ) {
        return `You already have a Bible called "${key}". Choose another name.`;
    }
    return null;
}

function countSteps(state: BibleImportStateType) {
    return state.digitChoices?.local ? 4 : 3;
}

function genKeyStep(
    state: BibleImportStateType,
    opening: string[] = [],
): BotAnswerType {
    const keyList = (state.keys ?? []).slice(0, 4);
    return {
        text: [
            ...opening,
            `**Step 1 of ${countSteps(state)} — a short name.** This is the ` +
                'name on the Bible button, like KJV. ' +
                (keyList.length > 0
                    ? 'Press one, or type your own (letters and numbers, no spaces).'
                    : 'Type one (letters and numbers, no spaces).'),
        ].join('\n\n'),
        actions: [
            ...keyList.map((key, index) => {
                return toAction(index === 0 ? `${key} (suggested)` : key, {
                    ...carry(state, { step: 'locale', key }),
                });
            }),
            toAction('Cancel', carry(state, { step: 'cancel' })),
        ].map((action, index) => {
            // Only the first carries `awaits`: one is enough for the typed
            // reply to find, and every button must still be pressable.
            return index === 0
                ? { ...action, args: { ...action.args, awaits: 'key' } }
                : action;
        }),
    };
}

function genLocaleStep(state: BibleImportStateType): BotAnswerType {
    const localeList = (state.locales ?? []).slice(0, 4);
    const [first] = localeList;
    const lines = [
        ...(state.note ? [state.note] : []),
        first === undefined
            ? `**Step 2 of ${countSteps(state)} — the language.** I could ` +
              'not tell which language this Bible is in. Type its name, for ' +
              'example Khmer, Thai or French.'
            : `**Step 2 of ${countSteps(state)} — the language.** It looks ` +
              `like **${first.name}**` +
              (first.why ? `: ${first.why}.` : '.') +
              ' If it is a different language, type its name.',
    ];
    const actions = localeList.map((choice, index) => {
        // The suggested language's digits and book names came with the
        // download; any other one's have to be looked up first.
        return toAction(
            index === 0 ? `${choice.name} (suggested)` : choice.name,
            index === 0
                ? carry(state, {
                      step: 'digits',
                      locale: choice.locale,
                      localeName: choice.name,
                  })
                : carry(state, { step: 'locale-typed', typed: choice.locale }),
        );
    });
    actions.push(toAction('Cancel', carry(state, { step: 'cancel' })));
    actions[0] = {
        ...actions[0],
        args: { ...actions[0].args, awaits: 'locale' },
    };
    return { text: lines.join('\n\n'), actions };
}

function genDigitChoices(locale: string) {
    const choiceList = getBibleNumberChoices(locale);
    return choiceList.length > 1
        ? { local: choiceList[0].join(' '), ascii: choiceList[1].join(' ') }
        : { ascii: choiceList[0].join(' ') };
}

function genDigitsStep(state: BibleImportStateType): BotAnswerType {
    const choices = state.digitChoices ?? genDigitChoices(state.locale ?? '');
    if (!choices.local) {
        // Nothing to choose: this language writes 0-9.
        return genNamesStep(
            carry(state, { digitChoices: choices, digits: 'ascii' }),
        );
    }
    return {
        text:
            `**Step 3 of 4 — numbers.** Should chapter and verse numbers ` +
            // "Khmer digits", not "Khmer (Cambodia)'s own digits".
            `show in ${(state.localeName ?? 'its own').replace(/\s*\(.*\)$/, '')} ` +
            'digits, or as 0 to 9?',
        actions: [
            toAction(
                `${choices.local} (suggested)`,
                carry(state, {
                    step: 'names',
                    digitChoices: choices,
                    digits: 'local',
                }),
            ),
            toAction(
                choices.ascii,
                carry(state, {
                    step: 'names',
                    digitChoices: choices,
                    digits: 'ascii',
                }),
            ),
            toAction('Cancel', carry(state, { step: 'cancel' })),
        ],
    };
}

function toListLine(list: NameListType, index: number) {
    // Its first names already show; only what they do not is worth adding.
    const ownList = (list.own ?? []).filter((name) => {
        return !list.first.includes(name);
    });
    return (
        `${index + 1}. ${list.label}: ${list.first.slice(0, 4).join(', ')}…` +
        (ownList.length > 0
            ? ` Only this list says: ${ownList.join(', ')}.`
            : '') +
        (list.matches
            ? ` (${list.matches} of its names are in this Bible)`
            : '')
    );
}

function genNamesStep(state: BibleImportStateType): BotAnswerType {
    const total = countSteps(state);
    const lists = [
        ...(state.nameLists ?? []).filter((list) => {
            return list.id !== state.fileList?.id;
        }),
        ...(state.fileList ? [state.fileList] : []),
    ].slice(0, 6);
    const best = lists[0];
    return {
        text: [
            ...(state.note ? [state.note] : []),
            `**Step ${total} of ${total} — book names.** These are the ` +
                'names shown for Genesis, Exodus and the rest. Pick the list ' +
                'that matches your printed Bible' +
                // Only said when it is TRUE: two lists tied on the count
                // are told apart by the names only each one has.
                (best?.matches && best.matches > (lists[1]?.matches ?? 0)
                    ? ' — list 1 matches the words of this Bible best.'
                    : '.'),
            lists.map(toListLine).join('\n'),
        ].join('\n\n'),
        actions: [
            ...lists.map((list, index) => {
                return toAction(
                    index === 0 && lists.length > 1
                        ? `List 1 (suggested)`
                        : `List ${index + 1}`,
                    carry(state, { step: 'confirm', bookNames: list.id }),
                );
            }),
            toAction(
                'Find more lists online',
                carry(state, { step: 'more-names' }),
            ),
            toAction('Cancel', carry(state, { step: 'cancel' })),
        ],
    };
}

function findChosenList(state: BibleImportStateType) {
    return (
        [
            ...(state.nameLists ?? []),
            ...(state.fileList ? [state.fileList] : []),
        ].find((list) => {
            return list.id === state.bookNames;
        }) ?? null
    );
}

function genConfirmStep(state: BibleImportStateType): BotAnswerType {
    const list = findChosenList(state);
    const digits =
        state.digits === 'local'
            ? state.digitChoices?.local
            : state.digitChoices?.ascii;
    return {
        text: [
            '**Ready to install.**',
            [
                `- Name: **${state.key}**`,
                `- Language: ${state.localeName ?? state.locale}`,
                `- Numbers: ${digits ?? '0 1 2 3 4 5 6 7 8 9'}`,
                `- Book names: ${list === null ? 'from the file' : `${list.first.slice(0, 3).join(', ')}…`}`,
            ].join('\n'),
            'Press **Install it**. You can undo it afterwards.',
        ].join('\n\n'),
        actions: [
            toAction('Install it', carry(state, { step: 'import' })),
            toAction('Start over', carry(state, { step: 'key' })),
            toAction('Cancel', carry(state, { step: 'cancel' })),
        ],
    };
}

// The words for a link that did not lead to a Bible. Never the tool's own
// sentence: it is written for a model, and names actions and fields.
const PROBLEM_TEXT_MAP: Record<string, string> = {
    'not-found':
        'That link does not lead to a file — the website answered "not ' +
        'found". The address may be mistyped, or the file has moved.',
    denied: 'That website would not give the file out. It may need a sign-in.',
    busy: 'That website is busy right now. Try again in a few minutes.',
    server: 'That website had a problem sending the file. Try again later.',
    blocked:
        'I can only download from a public web address that starts with ' +
        'https://.',
    unreachable:
        'I could not reach that website. Check the internet connection and ' +
        'the address.',
    timeout:
        'The download took too long and I stopped it. The website or the ' +
        'internet may be slow — try again.',
    'too-large': 'That file is far too large to be a Bible.',
    empty: 'That link gave back an empty file.',
    'not-xml':
        'That link leads to a file, but not a Bible file this app can ' +
        'install. A Bible file ends in .xml.',
    'not-bible':
        'I downloaded the file, but there is no Bible in it that this app ' +
        'can read — it may be a different Bible format.',
    'page-without-files':
        'That link opens a web page, and there is no Bible file on it.',
    'draft-gone':
        'That download is not here any more — downloads are kept for two ' +
        'hours.',
};

const FIND_RIGHT_LINK_TEXT =
    'To get the right link: open the page in your web browser, find the ' +
    'Bible file (its name ends in .xml), and copy the address of THAT file ' +
    '— on GitHub, open the file and press **Raw**, then copy the address ' +
    'bar. Paste it here.';

function genProblemAnswer(
    problem: string,
    state: BibleImportStateType,
): BotAnswerType {
    const text =
        PROBLEM_TEXT_MAP[problem] ?? 'That link did not lead to a Bible.';
    const canRetry = ['busy', 'server', 'unreachable', 'timeout', 'draft-gone'];
    return {
        text: [
            text,
            ...(canRetry.includes(problem) ? [] : [FIND_RIGHT_LINK_TEXT]),
        ].join('\n\n'),
        actions:
            canRetry.includes(problem) && state.url
                ? [
                      toAction(
                          'Try again',
                          carry(state, { step: 'check', draftId: undefined }),
                      ),
                  ]
                : [],
    };
}

/**
 * A file name as words: "Khmer2005Bible.xml" reads "Khmer 2005 Bible".
 * The address stays in the button's args; this is only what is pressed.
 */
export function toFileLabel(fileName: string) {
    return (
        fileName
            .replace(/\.xml$/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
            .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
            .replace(/(\p{L})(?=\p{N})|(\p{N})(?=\p{L})/gu, '$1$2 ')
            .trim() || fileName
    );
}

function toFileChoiceLabel(
    file: { name: string; title?: string },
    index: number,
) {
    const name = file.title ?? toFileLabel(file.name);
    return `${index + 1}. ${name.length > 48 ? `${name.slice(0, 46)}…` : name}`;
}

function genPageAnswer(
    result: any,
    state: BibleImportStateType,
): BotAnswerType {
    const files: { name: string; url: string; title?: string }[] = (
        result.files ?? []
    ).slice(0, MAX_FILE_BUTTONS);
    const words = (result.searchedFor ?? []).join(' ');
    const isCatalog = state.url === BIBLE_XML_CATALOG_URL;
    const matchedText =
        `**${toCount(result.matched)}** ${result.matched === 1 ? 'has' : 'have'} ` +
        `“${words}” in the name`;
    const lines = [
        isCatalog
            ? 'I looked in the free Bible collection on GitHub (Beblia). ' +
              (result.matched > 0 && words
                  ? `Of its **${toCount(result.total)}** Bibles, ${matchedText}.`
                  : `It has **${toCount(result.total)}** Bibles.`)
            : 'That link is a web page, not the Bible file itself. ' +
              (result.matched > 0 && words
                  ? `It has **${toCount(result.total)}** Bible files; ${matchedText}.`
                  : `It has **${toCount(result.total)}** Bible files.`),
    ];
    if (result.matched === 0 && words) {
        lines.push(
            `None of them has “${words}” in its name. Type the language in ` +
                'English or in its own words — for example Khmer, ខ្មែរ or Thai.',
        );
        return {
            text: lines.join('\n\n'),
            actions: [
                {
                    ...toAction('Cancel', carry(state, { step: 'cancel' })),
                    args: {
                        ...carry(state, { step: 'cancel' }),
                        awaits: 'find',
                    },
                },
            ],
        };
    }
    // Every one, with the title its own file gives -- a file name says
    // "Khmer2019Bible", the file says which Bible it is.
    lines.push(
        files
            .map((file, index) => {
                return (
                    `${index + 1}. ${file.title ?? toFileLabel(file.name)}` +
                    (file.title ? ` — ${toFileLabel(file.name)}` : '')
                );
            })
            .join('\n'),
    );
    lines.push(
        files.length < result.matched
            ? 'Press the one you want, or type a word from its name — a ' +
                  'year, for example — to see others.'
            : 'Press the one you want. Nothing is installed until you have ' +
                  'chosen its name and language.',
    );
    const actions = files.map((file, index) => {
        return toAction(
            toFileChoiceLabel(file, index),
            carry(state, { step: 'check', url: file.url, find: '' }),
        );
    });
    actions.push(toAction('Cancel', carry(state, { step: 'cancel' })));
    actions[0] = {
        ...actions[0],
        args: {
            ...actions[0].args,
            // A typed word searches the PAGE again, not the file.
            awaits: 'find',
            pageUrl: state.url,
            pageFind: words,
        },
    };
    return { text: lines.join('\n\n'), actions };
}

/**
 * The answer to a `check` result -- a downloaded Bible, a page of files, or
 * a link that leads nowhere. Exported for the model's answer: when a model
 * downloaded the file itself, these same buttons go under what it wrote.
 */
export function genBibleImportCheckAnswer(
    result: any,
    state: BibleImportStateType,
): BotAnswerType {
    if (result === null || typeof result !== 'object') {
        return genProblemAnswer('unreachable', state);
    }
    if (typeof result.problem === 'string') {
        return genProblemAnswer(result.problem, state);
    }
    if (result.kind === 'page') {
        return genPageAnswer(result, state);
    }
    const missingList: string[] = result.missingBooks ?? [];
    const summary =
        `${toCount(result.books)} books, ${toCount(result.chapters)} ` +
        `chapters, ${toCount(result.verses)} verses`;
    const lists: NameListType[] = result.nameLists ?? [];
    const next = carry(state, {
        step: 'key',
        draftId: result.draftId,
        title: result.title,
        summary,
        keys: result.keys ?? [],
        takenKeys: result.takenKeys ?? [],
        locales: result.locales ?? [],
        digitChoices: result.digits,
        nameLists: lists.slice(0, -1),
        fileList: lists[lists.length - 1],
    });
    return genKeyStep(next, [
        `I downloaded **${result.title}** — ${summary}.` +
            (result.fixed ? ` (${result.fixed})` : ''),
        ...(missingList.length === 0
            ? []
            : [
                  missingList.length === 39
                      ? 'It has the New Testament only.'
                      : missingList.length === 27
                        ? 'It has the Old Testament only.'
                        : `It is missing ${missingList.length} of the 66 books.`,
              ]),
        'Nothing is installed yet. A few quick choices, then I install it.',
    ]);
}

async function callBibleTool(args: Record<string, unknown>) {
    return parseToolJson(await callTool('owa_bible_xml', args));
}

async function runCheck(state: BibleImportStateType) {
    const url = state.find && state.pageUrl ? state.pageUrl : state.url;
    const result = await callBibleTool({
        action: 'check',
        url,
        ...(state.find ? { find: state.find } : {}),
    });
    return genBibleImportCheckAnswer(result, carry(state, { url }));
}

async function runTypedLocale(state: BibleImportStateType) {
    let result;
    try {
        result = await callBibleTool({
            action: 'names',
            locale: state.typed,
            draftId: state.draftId,
        });
    } catch (_error) {
        return genLocaleStep(
            carry(state, {
                note: `I do not know the language “${state.typed}”. Try its English name or its code, like km-KH.`,
            }),
        );
    }
    const name =
        new Intl.DisplayNames(['en'], { type: 'language' }).of(result.locale) ??
        result.locale;
    return genDigitsStep(
        carry(state, {
            locale: result.locale,
            localeName: name,
            digitChoices: genDigitChoices(result.locale),
            nameLists: result.nameLists ?? [],
        }),
    );
}

async function runMoreNames(state: BibleImportStateType) {
    const result = await callBibleTool({
        action: 'names',
        locale: state.locale,
        draftId: state.draftId,
    });
    const known = new Set(
        (state.nameLists ?? []).map((list) => {
            return list.id;
        }),
    );
    const added: NameListType[] = (result.nameLists ?? []).filter(
        (list: NameListType) => {
            return !known.has(list.id);
        },
    );
    const merged = [...(state.nameLists ?? []), ...added].sort((one, other) => {
        return (other.matches ?? 0) - (one.matches ?? 0);
    });
    return genNamesStep(
        carry(state, {
            nameLists: merged,
            note:
                added.length === 0
                    ? 'I looked online and found no other complete list.'
                    : `I found ${added.length} more online.`,
        }),
    );
}

async function runImport(state: BibleImportStateType): Promise<BotAnswerType> {
    const result = await callBibleTool({
        action: 'import',
        draftId: state.draftId,
        key: state.key,
        locale: state.locale,
        digits: state.digits,
        ...(state.bookNames ? { bookNames: state.bookNames } : {}),
    });
    if (result?.problem === 'key') {
        return genKeyStep(carry(state, { step: 'key' }), [
            `I could not use the name **${state.key}**: you already have a ` +
                'Bible by that name. Choose another.',
        ]);
    }
    if (typeof result?.problem === 'string') {
        return genProblemAnswer(result.problem, state);
    }
    if (typeof result?.installed !== 'string') {
        return {
            text: 'Something went wrong while installing it. Nothing was changed.',
        };
    }
    return {
        text:
            `**Done — ${result.installed} is installed.** Choose it from ` +
            'the Bible version button in the Bible Lookup or the Reader.\n\n' +
            'If it is not right, press **Undo** and it goes to the trash.',
        actions:
            typeof result.undoId === 'string'
                ? [
                      toAction(
                          'Undo',
                          carry(state, {
                              step: 'undo',
                              undoId: result.undoId,
                          }),
                      ),
                  ]
                : [],
    };
}

async function runUndo(state: BibleImportStateType): Promise<BotAnswerType> {
    const raw = await callTool('owa_undo', {
        action: 'undo',
        id: state.undoId,
    });
    const result = parseToolJson(raw);
    return {
        text:
            typeof result?.undone === 'string'
                ? `Undone: **${state.key}** is gone again (it is in the trash). ` +
                  'Nothing else was changed.'
                : 'That was already undone.',
    };
}

async function runCancel(state: BibleImportStateType): Promise<BotAnswerType> {
    if (state.draftId) {
        try {
            await callBibleTool({ action: 'cancel', draftId: state.draftId });
        } catch (error) {
            // Swept within two hours anyway.
            appError(error, 'bible import cancel');
        }
    }
    return { text: 'Stopped. Nothing was installed.' };
}

/**
 * The way round when the assistant's own tools are not answering: the
 * Settings import form, with the link already in its box. It downloads in
 * the app window itself, so it needs nothing this window could not reach.
 */
// Loaded at the press: Settings' own modules are nothing this window needs
// until somebody asks for the form.
async function openBibleSettingForm(url?: string) {
    if (url) {
        const { requestBibleImport } =
            await import('../setting/bible-setting/bibleImportRequestHelpers');
        requestBibleImport(url);
    }
    const { openBibleSetting } = await import('../setting/settingHelpers');
    openBibleSetting();
}

async function runSettings(
    state: BibleImportStateType,
): Promise<BotAnswerType> {
    await openBibleSettingForm(state.url);
    return {
        text:
            'I opened **Settings → Bible** with your link in the Import box. ' +
            'Press **Import** there, then choose the name, language, numbers ' +
            'and book names on the form.',
    };
}

/**
 * Run one step and answer with the next question. Never throws and never
 * shows a tool's own words: a failure is said as what to do next.
 */
export async function runBibleImportStep(
    state: BibleImportStateType,
): Promise<BotAnswerType> {
    try {
        switch (state.step) {
            case 'check':
                return await runCheck(state);
            case 'key': {
                if (state.typed === undefined) {
                    return genKeyStep(state);
                }
                const reason = genKeyReason(state.typed, state.takenKeys ?? []);
                if (reason !== null) {
                    return genKeyStep(carry(state, {}), [reason]);
                }
                return genLocaleStep(carry(state, { key: state.typed }));
            }
            case 'locale':
                return genLocaleStep(state);
            case 'locale-typed':
                return await runTypedLocale(state);
            case 'digits':
                return genDigitsStep(state);
            case 'names':
                return genNamesStep(state);
            case 'more-names':
                return await runMoreNames(state);
            case 'confirm':
                return genConfirmStep(state);
            case 'import':
                return await runImport(state);
            case 'undo':
                return await runUndo(state);
            case 'cancel':
                return await runCancel(state);
            case 'settings':
                return await runSettings(state);
            case 'language':
                return genLanguageStep();
            case 'local-file':
                return await runLocalFile();
            default:
                return { text: 'That step is not one I know.' };
        }
    } catch (error) {
        appError(error, `bible import ${state.step}`);
        return {
            text:
                'Something went wrong on my side. The app may still be ' +
                'starting — try again in a moment. Nothing was installed.',
            actions: [
                toAction('Try again', state),
                ...(state.url
                    ? [
                          toAction(
                              'Do it in Settings instead',
                              carry(state, { step: 'settings' }),
                          ),
                      ]
                    : []),
            ],
        };
    }
}

/**
 * What a button press or a typed word shows in the transcript as the
 * person's own words: the choice, not "(suggested)".
 */
export function toBibleImportEcho(label: string) {
    return label.replace(/\s*\(suggested\)$/, '');
}

/**
 * The import a message in this tab continues or starts: a typed answer to
 * the question the LAST answer asked, else a Bible link. Null for anything
 * else -- that goes to the commands, the model or the manual as before.
 */
export function findBibleImportState(
    messages: { author: string; actions?: BotActionType[] }[],
    text: string,
): BibleImportStateType | null {
    // A NEW request first: "import bible for khmer" typed while step 1 waits
    // for a short name is not a short name.
    const linkAsk = readBibleImportLinkAsk(text);
    if (linkAsk !== null) {
        return { step: 'check', url: linkAsk.url, find: linkAsk.find };
    }
    const languageAsk = readBibleImportLanguageAsk(text);
    if (languageAsk !== null) {
        return languageAsk;
    }
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.author === 'bot'
        ? readBibleImportTypedReply(lastMessage.actions, text)
        : null;
}

// How a question starts, as opposed to a request: "how do I import a Bible?"
// is asking to be TOLD, and is answered from the guide as it always was.
// "Can you install a Bible for me?" is a request with a question mark, and
// is the way an elderly person asks -- so it is not one of these.
const QUESTION_START_PATTERN =
    /^(?:how|what|where|why|when|which|who|is|are|does|do|should)\b/i;
const LOCAL_FILE_PATTERN =
    /\b(?:my computer|this computer|computer|pc|laptop|usb|flash drive|disk|folder|local file|downloads)\b/i;

/**
 * A Bible asked for with NO link -- "Import bible for khmer", "install a
 * Thai Bible", "Import bible": looked for in the catalog by its language,
 * or the language asked for first. One from this computer goes to the
 * Settings form, which is where a file is chosen.
 */
export function readBibleImportLanguageAsk(
    text: string,
): BibleImportStateType | null {
    const trimmed = text.trim();
    if (
        trimmed.length > 200 ||
        trimmed.startsWith('/') ||
        QUESTION_START_PATTERN.test(trimmed) ||
        /https?:\/\//i.test(trimmed) ||
        !/\bbibles?\b/i.test(trimmed) ||
        !IMPORT_WORD_PATTERN.test(trimmed)
    ) {
        return null;
    }
    if (LOCAL_FILE_PATTERN.test(trimmed)) {
        return { step: 'local-file' };
    }
    const words = toBibleSearchWords(trimmed);
    return words.length === 0
        ? { step: 'language' }
        : { step: 'check', url: BIBLE_XML_CATALOG_URL, find: words.join(' ') };
}

function genLanguageStep(): BotAnswerType {
    const toCatalog = (language: string) => {
        return toAction(language, {
            step: 'check',
            url: BIBLE_XML_CATALOG_URL,
            find: language,
        });
    };
    const actions = [
        toCatalog('Khmer'),
        toCatalog('English'),
        toCatalog('French'),
        toAction('A file on this computer', { step: 'local-file' }),
    ];
    // A typed language searches the catalog, the way a pressed one does.
    actions[0] = {
        ...actions[0],
        args: {
            ...actions[0].args,
            awaits: 'find',
            pageUrl: BIBLE_XML_CATALOG_URL,
            pageFind: '',
        },
    };
    return {
        text:
            '**Which language do you want the Bible in?** Press one, or type ' +
            'its name — in English or in its own words, for example Thai, ' +
            'ខ្មែរ or Español. I will look in a free collection of about a ' +
            'thousand Bibles and show you every one in that language.',
        actions,
    };
}

async function runLocalFile(): Promise<BotAnswerType> {
    await openBibleSettingForm();
    return {
        text:
            'I opened **Settings → Bible**. Press **Choose File**, pick the ' +
            'Bible file (its name ends in .xml), then press **Import** below ' +
            'it.',
    };
}

/**
 * The waiting line for the steps that take long enough to look stuck; null
 * for the ones that answer at once.
 */
export function describeBibleImportStep(state: BibleImportStateType) {
    switch (state.step) {
        case 'check':
            return 'Downloading the Bible file and reading it';
        case 'locale-typed':
        case 'more-names':
            return 'Looking online for Bible book names — this can take a minute';
        case 'import':
            return 'Installing the Bible';
        case 'undo':
            return 'Putting it back';
        default:
            return null;
    }
}
