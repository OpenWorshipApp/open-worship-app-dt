/**
 * With no assistant to answer, a screen ask is OFFERED the press that does
 * it (2026-11-14, EC-627; the user's goal: _chatbot is very smart to help
 * user control screen_).
 *
 * EC-625 had the window answer a screen ask with no model by saying the
 * setting asked about, what each screen holds and that nothing was changed:
 * _make the Bible text on screen 1 bigger_ came back _The Bible text is 65
 * pixels high on every screen_ and "ask again when an assistant can
 * answer". With no key, the network down in a back room or the spend guard
 * paused, that is every ask. The screens' own read holds what a change
 * needs, so the answer carries the change itself as a button -- the
 * offered-then-pressed shape a verse asked for with no model takes
 * (`genVerseReadAnswer`), because a line typed at a help window is not the
 * consent a pressed button is.
 *
 * Each offer is ONE `owa_screen_edit` set, labelled with the words of the
 * control it stands for (the Mini Screen card's Lock and Clear Long Text,
 * the Bible text panel's Bold and Align center, the transition menu's own
 * effect names), so no language package needs a new label for most of
 * them. What is read: English in code; in any installed language, the
 * Bible text's size and style by the language's own `textSizeAsks` and
 * `noteStyleAsks`, the panel's labels as the window shows them, and what
 * needs no words -- a screen's number, a Bible's short name, a display's
 * name, a transition as its menu writes it -- with the state choosing the
 * way: a locked screen is offered Unlock. A change already so is not
 * offered, and a question that names no value is answered with no pick
 * list under it.
 *
 * Pure: the caller reads the state (`owa_screen_edit`'s quiet `read`) and
 * presses (`runBotAction`).
 */
import type { BotActionType } from './helpBotHelpers';
import {
    listAssistantLanguages,
    listTypedLanguages,
    toAsciiDigits,
} from './chatLangHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    readLanguageNoteStyleAsk,
    readLanguageSizeAsk,
} from './languageEditAskHelpers';
import type { ScreenAskKindType } from './screenChatHelpers';
import type { ScreenAskReadType } from './typedScreenAskHelpers';
import { MAX_AGENT_SCREEN_COUNT } from '../helper/agentScreenLimitHelpers';

/** The press: one `owa_screen_edit` set (`runBotAction`). Registered nowhere. */
export const SCREEN_CHANGE_TOOL_NAME = 'owa_screen_change';

export type ScreenChangeArgsType = {
    kind: ScreenAskKindType;
    set: Record<string, unknown>;
};

// Under one answer, beside **Hide every screen**: the window draws seven
// buttons in all.
const MAX_OFFER_COUNT = 4;
const TRANSITION_EFFECT_LIST = ['none', 'fade', 'move', 'zoom'] as const;
type TransitionEffectType = (typeof TRANSITION_EFFECT_LIST)[number];
const TRANSITION_LAYER_LIST = ['slide', 'background', 'foreground'] as const;
type TransitionLayerType = (typeof TRANSITION_LAYER_LIST)[number];
const CLEAR_LAYER_LIST = [
    'bible',
    'slide',
    'background',
    'foreground',
] as const;
type ClearLayerType = (typeof CLEAR_LAYER_LIST)[number] | 'all';

// Each label written out, so the key check reads every one (EN-20).
function genTransitionLabel(layer: TransitionLayerType) {
    return layer === 'background'
        ? tran('Background transition')
        : layer === 'foreground'
          ? tran('Foreground transition')
          : tran('Slide transition');
}

function genTransitionLayerWord(layer: TransitionLayerType) {
    return layer === 'background'
        ? tran('Background')
        : layer === 'foreground'
          ? tran('Foreground')
          : tran('Slide');
}

function genClearLabel(layer: ClearLayerType) {
    return layer === 'bible'
        ? tran('Clear Long Text')
        : layer === 'slide'
          ? tran('Clear Slide')
          : layer === 'background'
            ? tran('Clear Background')
            : layer === 'foreground'
              ? tran('Clear Foreground')
              : tran('Clear All');
}

type ReadScreenType = {
    id: number;
    on?: boolean;
    ticked?: boolean;
    locked?: boolean;
    group?: string | null;
    groupWith?: number[];
    stage?: number;
    display?: string | null;
    transition?: Partial<Record<TransitionLayerType, string>>;
    lineSync?: boolean;
    bible?: { reference?: string; versions?: string[] } | null;
    slide?: string;
    background?: string;
    foreground?: unknown[];
};

type ReadDisplayType = { id: number; name: string };
type ReadBibleType = { key: string; title: string; language: string };

type OfferStateType = {
    screens: ReadScreenType[];
    displays: ReadDisplayType[];
    bibles: ReadBibleType[];
    style: string;
};

// --- the state ---------------------------------------------------------------

function toOfferState(editState: any): OfferStateType | null {
    if (editState === null || typeof editState !== 'object') {
        return null;
    }
    const screens = (Array.isArray(editState.screens) ? editState.screens : [])
        .filter((screen: any) => {
            return Number.isInteger(screen?.id) && screen.id >= 0;
        })
        .sort((one: ReadScreenType, other: ReadScreenType) => {
            return one.id - other.id;
        });
    if (screens.length === 0) {
        return null;
    }
    const displays = (
        Array.isArray(editState.displays) ? editState.displays : []
    ).filter((display: any) => {
        return (
            Number.isInteger(display?.id) &&
            typeof display.name === 'string' &&
            display.name.trim() !== ''
        );
    });
    // `KJV: King James Version (English)`, as the read writes each one.
    const bibles = (Array.isArray(editState.bibles) ? editState.bibles : [])
        .map((line: unknown) => {
            const matched = /^([^:]+):\s*(.*?)\s*(?:\(([^()]*)\))?$/.exec(
                String(line ?? ''),
            );
            return matched === null
                ? null
                : {
                      key: matched[1].trim(),
                      title: matched[2].trim(),
                      language: (matched[3] ?? '').trim(),
                  };
        })
        .filter((bible: ReadBibleType | null): bible is ReadBibleType => {
            return bible !== null && bible.key !== '';
        });
    return {
        screens,
        displays,
        bibles,
        style:
            typeof editState.bibleStyle === 'string'
                ? editState.bibleStyle
                : '',
    };
}

function toScreenDisplayId(screen: ReadScreenType) {
    const matched = /\(id (\d+)/.exec(String(screen.display ?? ''));
    return matched === null ? null : Number(matched[1]);
}

// --- reading the line --------------------------------------------------------

function toLowerLine(line: string) {
    return toAsciiDigits(String(line ?? '').normalize('NFC'))
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function escapeForPattern(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether the lowered line holds these words: as a whole word when they
 * are letters and digits of the Latin alphabet (`niv` is no part of
 * _university_), anywhere when they are not (a script that does not space
 * its words).
 */
function checkHasWords(lower: string, words: string) {
    const wanted = words.trim().toLowerCase();
    if (wanted === '') {
        return false;
    }
    if (/^[\x20-\x7e]+$/.test(wanted)) {
        return new RegExp(
            `(?<![\\p{L}\\p{N}])${escapeForPattern(wanted)}(?![\\p{L}\\p{N}])`,
            'u',
        ).test(lower);
    }
    return lower.includes(wanted);
}

/**
 * A label of the app as the window shows it, read in the line -- in a
 * window shown in another language, the word a person reads on the panel
 * is the word they type. Never in English: the English words are read by
 * their own patterns.
 */
function checkHasShownLabel(lower: string, key: string, shown: string) {
    return shown !== key && checkHasWords(lower, shown);
}

// A question that names no value is a read: _which monitor is screen 1
// on?_ is answered with the monitor and no list of monitors under it.
const QUESTION_START_PATTERN =
    /^(?:what|which|where|who|whose|is|are|does|do|did|has|have|was|were|how\s+(?:many|much))\b/;

function checkIsQuestionLine(lower: string) {
    return (
        /[?？؟;]\s*$/.test(lower) ||
        lower.startsWith('¿') ||
        QUESTION_START_PATTERN.test(lower)
    );
}

// A how-to typed under a screen answer is the guide's: _how do I centre
// it?_ is no ask to centre it.
const THREAD_HOW_TO_PATTERN =
    /^(?:how|where|can\s+i|could\s+i|is\s+(?:it|there)\s+(?:possible|a\s+way))\b/;

// A verse (3:16), a size (60px) or an ordinal is no screen's number.
function toNumberLine(lower: string) {
    return lower
        .replace(/\d+\s*[:.]\s*\d+(?:\s*[-–]\s*\d+)?/g, ' ')
        .replace(/\d+\s*(?:px|pixels?|%|pt)\b/g, ' ');
}

function listLineNumbers(lower: string) {
    const numbers: number[] = [];
    for (const matched of toNumberLine(lower).matchAll(
        /(?<![\p{N}a-z])(\d{1,2})(?![\p{N}a-z])/gu,
    )) {
        numbers.push(Number(matched[1]));
    }
    return numbers;
}

/** The screens the line names by their number, in the order it names them. */
export function readNamedScreenIds(line: string, screenIdList: number[]) {
    const idList: number[] = [];
    for (const number of listLineNumbers(toLowerLine(line))) {
        if (screenIdList.includes(number) && !idList.includes(number)) {
            idList.push(number);
        }
    }
    return idList;
}

function listTargetIds(namedIdList: number[], state: OfferStateType) {
    if (namedIdList.length > 0) {
        return namedIdList;
    }
    const ticked = state.screens.filter((screen) => {
        return screen.ticked === true;
    });
    return (ticked.length > 0 ? ticked : state.screens).map((screen) => {
        return screen.id;
    });
}

function findScreen(state: OfferStateType, id: number) {
    return state.screens.find((screen) => {
        return screen.id === id;
    });
}

// --- the offers ---------------------------------------------------------------

/**
 * A button's words: the control's own, after the screens it changes when
 * there is more than one screen to tell apart.
 */
function genScreenLabel(
    state: OfferStateType,
    idList: number[],
    label: string,
) {
    if (state.screens.length < 2 || idList.length === 0) {
        return label;
    }
    const names = idList
        .map((id) => {
            return `${tran('Screen')} ${id}`;
        })
        .join(', ');
    return `${names} · ${label}`;
}

function genOffer(
    kind: ScreenAskKindType,
    set: Record<string, unknown>,
    label: string,
    title?: string,
): BotActionType {
    const args: ScreenChangeArgsType = { kind, set };
    return {
        label,
        ...(title === undefined ? {} : { title }),
        toolName: SCREEN_CHANGE_TOOL_NAME,
        args,
    };
}

// --- the Bible text's look -----------------------------------------------------

// The colour words the screens' tool knows (`toForegroundHexColor`), two
// words first.
const ENGLISH_COLOR_LIST = [
    'light blue',
    'sky blue',
    'dark blue',
    'dark red',
    'dark green',
    'white',
    'black',
    'red',
    'yellow',
    'gold',
    'orange',
    'green',
    'blue',
    'navy',
    'purple',
    'pink',
    'grey',
    'gray',
    'silver',
    'brown',
    'cyan',
    'teal',
    'magenta',
    'maroon',
    'lime',
];

const LARGER_PATTERN =
    /\b(?:bigger|larger|enlarge|increase|grow|too\s+small|tiny|can'?t\s+(?:see|read)|cannot\s+(?:see|read)|hard\s+to\s+(?:see|read))\b/;
const SMALLER_PATTERN =
    /\b(?:smaller|shrink|reduce|decrease|too\s+(?:big|large))\b/;
const SIZE_SET_PATTERN =
    /\b(\d{2,3})\s*(?:px|pixels?)\b|\bsize\s+(?:to\s+|of\s+)?(\d{2,3})\b/;
const RESET_PATTERN =
    /\b(?:back\s+to\s+(?:normal|the\s+default|default|plain|how\s+it\s+was)|normal\s+again|plain\s+again|reset|default\s+(?:style|look)|original\s+(?:style|look))\b/;
const NEGATION_PATTERN = /\b(?:not|no|without|un-?|remove|take\s+off|off)\s*$/;

/** Whether `word` is in the line and not right after a word saying no. */
function checkIsWanted(lower: string, pattern: RegExp) {
    const matched = new RegExp(pattern.source, 'g').exec(lower);
    if (matched === null) {
        return false;
    }
    const before = lower.slice(Math.max(0, matched.index - 14), matched.index);
    return !NEGATION_PATTERN.test(before);
}

function findEnglishColor(text: string) {
    for (const color of ENGLISH_COLOR_LIST) {
        if (checkHasWords(text, color)) {
            return color;
        }
    }
    return null;
}

// A colour a language names (an `assistant.json`'s `colorWords`), with the
// word as it was typed, for the button.
function findLanguageColor(lower: string) {
    for (const language of listAssistantLanguages()) {
        const wordList = Object.keys(language.colorWords ?? {}).sort(
            (one, other) => {
                return other.length - one.length;
            },
        );
        for (const word of wordList) {
            if (checkHasWords(lower, word.toLowerCase())) {
                return { word, color: language.colorWords[word] };
            }
        }
    }
    return null;
}

type StyleReadType = {
    set: Record<string, unknown>;
    labelList: string[];
    title?: string;
};

function addStyle(
    read: StyleReadType,
    field: string,
    value: unknown,
    label: string,
) {
    if (read.set[field] !== undefined) {
        return;
    }
    read.set[field] = value;
    read.labelList.push(label);
}

function readEnglishStyle(lower: string, read: StyleReadType) {
    const sizeSet = SIZE_SET_PATTERN.exec(lower);
    if (sizeSet !== null) {
        const size = Number(sizeSet[1] ?? sizeSet[2]);
        addStyle(read, 'size', size, `${tran('Font Size')}: ${size}`);
    } else if (/\bdefault\s+size\b/.test(lower)) {
        addStyle(
            read,
            'size',
            'default',
            `${tran('Font Size')}: ${tran('Default')}`,
        );
    } else if (SMALLER_PATTERN.test(lower)) {
        addStyle(read, 'size', 'smaller', tran('Make the words smaller'));
    } else if (LARGER_PATTERN.test(lower)) {
        addStyle(read, 'size', 'larger', tran('Make the words larger'));
    }
    if (checkIsWanted(lower, /\bbold\b/)) {
        addStyle(read, 'bold', true, tran('Bold'));
    }
    if (checkIsWanted(lower, /\bitalics?\b/)) {
        addStyle(read, 'italic', true, tran('Italic'));
    }
    if (checkIsWanted(lower, /\bshadow\b/)) {
        addStyle(read, 'shadow', true, tran('Shadow'));
    }
    if (checkIsWanted(lower, /\boutline[sd]?\b/)) {
        const width = /\bthick(?:er)?\b|\bheavy\b|\bbold\s+outline\b/.test(
            lower,
        )
            ? 'thick'
            : /\bthin(?:ner)?\b/.test(lower)
              ? 'thin'
              : true;
        addStyle(
            read,
            'outline',
            width,
            width === 'thick'
                ? tran('Heavy Outline')
                : width === 'thin'
                  ? tran('Thin Outline')
                  : tran('Outline'),
        );
        // _a thick black outline_, _an outline in red_.
        const outlineColor =
            findEnglishColor(
                /((?:[a-z]+\s+){0,2})outline/.exec(lower)?.[1] ?? '',
            ) ??
            findEnglishColor(
                /outline\s+(?:in|of)\s+([a-z]+(?:\s+[a-z]+)?)/.exec(
                    lower,
                )?.[1] ?? '',
            );
        if (outlineColor !== null) {
            addStyle(
                read,
                'outlineColor',
                outlineColor,
                `${tran('Outline Color')}: ${outlineColor}`,
            );
        }
    }
    if (checkIsWanted(lower, /\bglow(?:ing)?\b/)) {
        addStyle(read, 'glow', true, tran('Glow'));
    }
    if (/\bcent(?:re|er)(?:d|ed)?\b|\bin\s+the\s+middle\b/.test(lower)) {
        addStyle(read, 'align', 'center', tran('Align center'));
    } else if (
        /\b(?:align(?:ed)?\s+(?:it\s+|them\s+)?(?:to\s+the\s+)?left|left[-\s]align(?:ed)?|to\s+the\s+left)\b/.test(
            lower,
        )
    ) {
        addStyle(read, 'align', 'left', tran('Align left'));
    } else if (
        /\b(?:align(?:ed)?\s+(?:it\s+|them\s+)?(?:to\s+the\s+)?right|right[-\s]align(?:ed)?|to\s+the\s+right)\b/.test(
            lower,
        )
    ) {
        addStyle(read, 'align', 'right', tran('Align right'));
    } else if (/\bjustif(?:y|ied)\b/.test(lower)) {
        addStyle(read, 'align', 'justify', tran('Justify'));
    }
    if (
        /\b(?:closer\s+together|tighter|less\s+space\s+between|squeeze)\b/.test(
            lower,
        )
    ) {
        addStyle(read, 'lineHeight', 'tighter', `${tran('Line Height')} −`);
    } else if (
        /\b(?:further\s+apart|farther\s+apart|more\s+space\s+between|spread\s+(?:out|apart)|looser)\b/.test(
            lower,
        )
    ) {
        addStyle(read, 'lineHeight', 'looser', `${tran('Line Height')} +`);
    }
    if (RESET_PATTERN.test(lower)) {
        addStyle(read, 'reset', true, tran('Reset'));
        read.title = tran('Plain words again; the size stays');
    }
    // The words' colour: one not said of the outline or the glow.
    const colorLine = lower
        .replace(/((?:[a-z]+\s+){0,2})outline\b/g, ' ')
        .replace(/outline\s+(?:in|of)\s+[a-z]+(?:\s+[a-z]+)?/g, ' ')
        .replace(/((?:[a-z]+\s+){0,2})glow\b/g, ' ');
    const color = findEnglishColor(colorLine);
    if (color !== null) {
        addStyle(read, 'color', color, `${tran('Text Color')}: ${color}`);
    }
}

function genAlignLabel(align: string) {
    return align === 'center'
        ? tran('Align center')
        : align === 'right'
          ? tran('Align right')
          : align === 'justify'
            ? tran('Justify')
            : tran('Align left');
}

// In a window shown in another language: the panel's own labels, read as
// the window shows them -- [the English key, the label, the field, its
// value].
function listShownStyleLabels(): [string, string, string, unknown][] {
    return [
        ['Bold', tran('Bold'), 'bold', true],
        ['Italic', tran('Italic'), 'italic', true],
        ['Shadow', tran('Shadow'), 'shadow', true],
        ['Glow', tran('Glow'), 'glow', true],
        ['Outline', tran('Outline'), 'outline', true],
        ['Align left', tran('Align left'), 'align', 'left'],
        ['Align center', tran('Align center'), 'align', 'center'],
        ['Align right', tran('Align right'), 'align', 'right'],
        ['Justify', tran('Justify'), 'align', 'justify'],
        ['Reset', tran('Reset'), 'reset', true],
    ];
}

// A language's size phrase (`textSizeAsks`) read ANYWHERE in the line: the
// patterns are written for a whole line (_make the text larger_ and no
// more), and a screen ask says more -- _the verse is too small for the old
// people, make the text larger_ -- about a look already known to be asked.
function readLooseLanguageSize(line: string) {
    const text = toAsciiDigits(String(line ?? '').normalize('NFC'))
        .replace(/\p{Cf}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    const toLoose = (pattern: RegExp) => {
        return new RegExp(
            pattern.source.replace(/^\^/, '').replace(/\$$/, ''),
            pattern.flags.replace('g', ''),
        );
    };
    for (const language of [
        ...listAssistantLanguages(),
        ...listTypedLanguages(),
    ]) {
        const { larger, smaller } = language.textSizeAskPatterns;
        if (
            smaller.some((pattern) => {
                return toLoose(pattern).test(text);
            })
        ) {
            return 'smaller';
        }
        if (
            larger.some((pattern) => {
                return toLoose(pattern).test(text);
            })
        ) {
            return 'larger';
        }
    }
    return null;
}

function readLanguageStyle(line: string, lower: string, read: StyleReadType) {
    const size = readLanguageSizeAsk(line);
    const looseSize = size === null ? readLooseLanguageSize(line) : null;
    if (size?.kind === 'larger' || looseSize === 'larger') {
        addStyle(read, 'size', 'larger', tran('Make the words larger'));
    } else if (size?.kind === 'smaller' || looseSize === 'smaller') {
        addStyle(read, 'size', 'smaller', tran('Make the words smaller'));
    } else if (size?.kind === 'set') {
        addStyle(read, 'size', size.size, `${tran('Font Size')}: ${size.size}`);
    }
    const style = readLanguageNoteStyleAsk(line);
    for (const job of style?.styles ?? []) {
        if (job === 'bold') {
            addStyle(read, 'bold', true, tran('Bold'));
        } else if (job === 'italic') {
            addStyle(read, 'italic', true, tran('Italic'));
        }
    }
    if (style?.align !== undefined) {
        addStyle(read, 'align', style.align, genAlignLabel(style.align));
    }
    if (style?.clear === true) {
        addStyle(read, 'reset', true, tran('Reset'));
        read.title = tran('Plain words again; the size stays');
    }
    const color = findLanguageColor(lower);
    if (color !== null) {
        addStyle(
            read,
            'color',
            color.color,
            `${tran('Text Color')}: ${color.word}`,
        );
    }
    for (const [key, shown, field, value] of listShownStyleLabels()) {
        if (checkHasShownLabel(lower, key, shown)) {
            addStyle(read, field, value, shown);
            if (field === 'reset') {
                read.title = tran('Plain words again; the size stays');
            }
        }
    }
}

// What the read says the Bible text already has, so it is not offered.
function dropStyleAlreadySo(read: StyleReadType, style: string) {
    const parts = style.split(/,\s*/).map((part) => {
        return part.trim();
    });
    const isAlready: Record<string, boolean> = {
        bold: read.set.bold === true && parts.includes('bold'),
        italic: read.set.italic === true && parts.includes('italic'),
        align:
            (read.set.align === 'center' && parts.includes('centred')) ||
            (read.set.align === 'right' && parts.includes('right')) ||
            (read.set.align === 'justify' && parts.includes('justified')),
    };
    const labelByField = Object.keys(read.set);
    const kept: StyleReadType = { set: {}, labelList: [], title: read.title };
    labelByField.forEach((field, index) => {
        if (!isAlready[field]) {
            kept.set[field] = read.set[field];
            kept.labelList.push(read.labelList[index]);
        }
    });
    return kept;
}

/**
 * The Bible text's look asked for in the line: ONE change of everything
 * read in it, the one style every screen shares. Null when nothing is read.
 */
export function readScreenStyleChange(line: string, style = '') {
    const lower = toLowerLine(line);
    const read: StyleReadType = { set: {}, labelList: [] };
    readEnglishStyle(lower, read);
    readLanguageStyle(line, lower, read);
    const kept = dropStyleAlreadySo(read, style);
    return kept.labelList.length === 0 ? null : kept;
}

// A look asked for in words nothing here reads gets no button: the two
// size steps under _make it yellow_ would say "press a button below to
// change it" over buttons that change something else.
function genStyleOffers(line: string, state: OfferStateType) {
    const read = readScreenStyleChange(line, state.style);
    if (read === null) {
        return [];
    }
    return [
        genOffer(
            'style',
            { style: read.set },
            read.labelList.join(' · '),
            read.title,
        ),
    ];
}

// --- each control ----------------------------------------------------------------

function genLockOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const wanted = /\bun-?lock/.test(lower)
        ? false
        : /\block/.test(lower)
          ? true
          : null;
    const targetIdList =
        namedIdList.length > 0
            ? namedIdList
            : wanted === false
              ? state.screens
                    .filter((screen) => {
                        return screen.locked === true;
                    })
                    .map((screen) => {
                        return screen.id;
                    })
              : listTargetIds([], state);
    const byValue = new Map<boolean, number[]>();
    for (const id of targetIdList) {
        const screen = findScreen(state, id);
        if (screen === undefined) {
            continue;
        }
        const value = wanted ?? screen.locked !== true;
        if ((screen.locked === true) === value) {
            continue;
        }
        byValue.set(value, [...(byValue.get(value) ?? []), id]);
    }
    return [...byValue.entries()].map(([value, idList]) => {
        return genOffer(
            'lock',
            { screens: idList, lock: value },
            genScreenLabel(
                state,
                idList,
                value ? tran('Lock') : tran('Unlock'),
            ),
        );
    });
}

function genLineSyncOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const wanted =
        /\b(?:off|stop|unset|un-?sync|disable|no\s+longer|separate)\b/.test(
            lower,
        )
            ? false
            : /^[\x20-\x7e]*$/.test(lower)
              ? true
              : null;
    const showingIdList = state.screens
        .filter((screen) => {
            return screen.bible !== null && screen.bible !== undefined;
        })
        .map((screen) => {
            return screen.id;
        });
    const targetIdList =
        namedIdList.length > 0
            ? namedIdList
            : showingIdList.length > 0
              ? showingIdList
              : listTargetIds([], state);
    const byValue = new Map<boolean, number[]>();
    for (const id of targetIdList) {
        const screen = findScreen(state, id);
        if (screen === undefined || screen.locked === true) {
            continue;
        }
        const value = wanted ?? screen.lineSync !== true;
        if ((screen.lineSync === true) === value) {
            continue;
        }
        byValue.set(value, [...(byValue.get(value) ?? []), id]);
    }
    return [...byValue.entries()].map(([value, idList]) => {
        return genOffer(
            'lineSync',
            { screens: idList, lineSync: value },
            genScreenLabel(
                state,
                idList,
                value ? tran('Set Line Sync') : tran('Unset Line Sync'),
            ),
        );
    });
}

function readTransitionLayers(lower: string) {
    const layerList = TRANSITION_LAYER_LIST.filter((layer) => {
        return (
            checkHasWords(lower, layer) ||
            (layer === 'foreground' && checkHasWords(lower, 'overlay')) ||
            checkHasShownLabel(
                lower,
                layer === 'background'
                    ? 'Background'
                    : layer === 'foreground'
                      ? 'Foreground'
                      : 'Slide',
                genTransitionLayerWord(layer),
            )
        );
    });
    return layerList.length > 0 ? layerList : (['slide'] as const);
}

function readTransitionEffect(lower: string): TransitionEffectType | null {
    if (
        /\b(?:none|off|instant(?:ly)?|no\s+(?:transition|effect|animation)|without\s+(?:a\s+|any\s+)?(?:transition|effect|animation))\b/.test(
            lower,
        )
    ) {
        return 'none';
    }
    if (/\b(?:fade[sd]?|fading|dissolve)\b/.test(lower)) {
        return 'fade';
    }
    if (/\bzoom(?:s|ing)?\b/.test(lower)) {
        return 'zoom';
    }
    if (/\b(?:move[sd]?|moving|slide\s+in|push|swipe)\b/.test(lower)) {
        return 'move';
    }
    return null;
}

function genTransitionOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const layerList = readTransitionLayers(lower);
    const effect = readTransitionEffect(lower);
    if (effect === null && checkIsQuestionLine(lower)) {
        return [];
    }
    const targetIdList = listTargetIds(namedIdList, state);
    const firstScreen = findScreen(state, targetIdList[0]);
    const offers: BotActionType[] = [];
    for (const layer of layerList) {
        const effectList =
            effect === null
                ? TRANSITION_EFFECT_LIST.filter((one) => {
                      return (
                          one !== (firstScreen?.transition?.[layer] ?? 'fade')
                      );
                  })
                : [effect];
        for (const one of effectList) {
            const changingIdList = targetIdList.filter((id) => {
                return findScreen(state, id)?.transition?.[layer] !== one;
            });
            if (changingIdList.length === 0) {
                continue;
            }
            offers.push(
                genOffer(
                    'transition',
                    { screens: changingIdList, transition: { [layer]: one } },
                    genScreenLabel(
                        state,
                        namedIdList.length > 0 ? changingIdList : [],
                        `${genTransitionLabel(layer)}: ${one}`,
                    ),
                ),
            );
        }
    }
    return offers;
}

function findNamedDisplays(lower: string, state: OfferStateType) {
    return state.displays.filter((display) => {
        return checkHasWords(lower, display.name);
    });
}

function genDisplayOffers(line: string, lower: string, state: OfferStateType) {
    const namedDisplayList = findNamedDisplays(lower, state);
    // A display's name holds a number (_Virtual Display 1_) that is no
    // screen's.
    let screenLine = line;
    for (const display of namedDisplayList) {
        screenLine = screenLine.replace(
            new RegExp(escapeForPattern(display.name), 'gi'),
            ' ',
        );
    }
    const namedIdList = readNamedScreenIds(
        screenLine,
        state.screens.map((screen) => {
            return screen.id;
        }),
    );
    // A monitor no name in the line picks is a guess: a list of every one
    // under _which monitor is screen 1 on?_, or under a Line Sync ask read
    // as one for its word _monitor_, was a wrong press in front of them.
    if (namedDisplayList.length === 0) {
        return [];
    }
    const ticked = state.screens.filter((screen) => {
        return screen.ticked === true;
    });
    const screenId =
        namedIdList.length > 0
            ? namedIdList[0]
            : state.screens.length === 1
              ? state.screens[0].id
              : ticked.length === 1
                ? ticked[0].id
                : null;
    if (screenId === null) {
        return [];
    }
    const currentId = toScreenDisplayId(findScreen(state, screenId)!);
    const displayList = namedDisplayList.filter((display) => {
        return display.id !== currentId;
    });
    return displayList.map((display) => {
        return genOffer(
            'display',
            { screens: [screenId], display: display.id },
            genScreenLabel(
                state,
                [screenId],
                `${tran('Display')}: ${display.name}`,
            ),
        );
    });
}

function genGroupOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const isLeaving =
        /\b(?:out\s+of|ungroup|un-group|separate|split|leave|no\s+(?:group|colou?r)|remove\s+(?:\S+\s+){0,3}?from)\b/.test(
            lower,
        );
    const groupedIdList = state.screens
        .filter((screen) => {
            return screen.group !== null && screen.group !== undefined;
        })
        .map((screen) => {
            return screen.id;
        });
    const genLeaving = (idList: number[]) => {
        return idList
            .filter((id) => {
                return groupedIdList.includes(id);
            })
            .map((id) => {
                return genOffer(
                    'group',
                    { screens: [id], group: false },
                    genScreenLabel(state, [id], tran('No Color')),
                );
            });
    };
    if (isLeaving) {
        return genLeaving(namedIdList.length > 0 ? namedIdList : groupedIdList);
    }
    const joiningIdList =
        namedIdList.length >= 2
            ? namedIdList
            : namedIdList.length === 0 && state.screens.length >= 2
              ? state.screens.map((screen) => {
                    return screen.id;
                })
              : [];
    if (joiningIdList.length >= 2) {
        const firstGroup = findScreen(state, joiningIdList[0])?.group ?? null;
        const isTogether =
            firstGroup !== null &&
            joiningIdList.every((id) => {
                return findScreen(state, id)?.group === firstGroup;
            });
        if (!isTogether) {
            return [
                genOffer(
                    'group',
                    { screens: joiningIdList, group: true },
                    `${tran('Group')}: ${joiningIdList
                        .map((id) => {
                            return `${tran('Screen')} ${id}`;
                        })
                        .join(', ')}`,
                ),
            ];
        }
        // Already one group: the way out is the press asked for, in a
        // language whose words for it nothing here reads.
        return /^[\x20-\x7e]*$/.test(lower) ? [] : genLeaving(joiningIdList);
    }
    if (namedIdList.length !== 1) {
        return [];
    }
    // One screen named, in a group: taking it out is what is left to ask.
    // Not in one, beside screens that make ONE group: joining it.
    const [id] = namedIdList;
    if (groupedIdList.includes(id)) {
        return genLeaving(namedIdList);
    }
    const groupNameList = [
        ...new Set(
            state.screens
                .map((screen) => {
                    return screen.group;
                })
                .filter((group): group is string => {
                    return typeof group === 'string' && group !== '';
                }),
        ),
    ];
    if (groupNameList.length !== 1) {
        return [];
    }
    return [
        genOffer(
            'group',
            { screens: [id], group: groupNameList[0] },
            genScreenLabel(
                state,
                [id],
                `${tran('Group')}: ${groupNameList[0]}`,
            ),
        ),
    ];
}

function genStageOffers(lower: string, state: OfferStateType) {
    const screenIdList = state.screens.map((screen) => {
        return screen.id;
    });
    const englishStage =
        /\bstage\s*(?:number\s*|no\.?\s*|#\s*)?(\d{1,2})\b/.exec(lower);
    const englishScreen =
        /\bscreen\s*(?:number\s*|no\.?\s*|#\s*)?(\d{1,2})\b/.exec(lower);
    let stage: number;
    let idList: number[];
    if (englishStage !== null) {
        stage = Number(englishStage[1]);
        idList =
            englishScreen !== null &&
            screenIdList.includes(Number(englishScreen[1]))
                ? [Number(englishScreen[1])]
                : [];
    } else {
        // In other words: the one number that is no screen's is the stage.
        const numberList = listLineNumbers(lower);
        const stageList = numberList.filter((number) => {
            return !screenIdList.includes(number);
        });
        if (stageList.length !== 1) {
            return [];
        }
        stage = stageList[0];
        idList = numberList.filter((number) => {
            return screenIdList.includes(number);
        });
    }
    const targetIdList = listTargetIds(idList, state).filter((id) => {
        return findScreen(state, id)?.stage !== stage;
    });
    if (targetIdList.length === 0) {
        return [];
    }
    return [
        genOffer(
            'stage',
            { screens: targetIdList, stage },
            genScreenLabel(state, targetIdList, `${tran('Stage')}: ${stage}`),
        ),
    ];
}

function genSelectOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const tickedIdList = state.screens
        .filter((screen) => {
            return screen.ticked === true;
        })
        .map((screen) => {
            return screen.id;
        });
    const allIdList = state.screens.map((screen) => {
        return screen.id;
    });
    const isEnglish = /^[\x20-\x7e]*$/.test(lower);
    const genSolo = (id: number) => {
        return genOffer(
            'select',
            { screens: [id], select: 'only' },
            genScreenLabel(state, [id], tran('Solo')),
        );
    };
    const genAdd = (idList: number[]) => {
        return genOffer(
            'select',
            { screens: idList, select: 'add' },
            genScreenLabel(state, idList, tran('Select')),
        );
    };
    // Never the last ticked screen: a passage would go nowhere.
    const genRemove = (idList: number[]) => {
        return idList.length > 0 && idList.length < tickedIdList.length
            ? [
                  genOffer(
                      'select',
                      { screens: idList, select: 'remove' },
                      genScreenLabel(state, idList, tran('Deselect')),
                  ),
              ]
            : [];
    };
    const untickedIdList = namedIdList.filter((id) => {
        return !tickedIdList.includes(id);
    });
    const tickedNamedIdList = namedIdList.filter((id) => {
        return tickedIdList.includes(id);
    });
    const isSoloAlready = (id: number) => {
        return tickedIdList.length === 1 && tickedIdList[0] === id;
    };
    if (isEnglish) {
        if (/\b(?:both|all|every)\b/.test(lower) && namedIdList.length < 2) {
            return tickedIdList.length === allIdList.length
                ? []
                : [
                      genOffer(
                          'select',
                          { select: 'all' },
                          genScreenLabel(state, allIdList, tran('Select')),
                      ),
                  ];
        }
        if (/\b(?:un-?tick|de-?select|untick|leave\s+out|not)\b/.test(lower)) {
            return genRemove(tickedNamedIdList);
        }
        if (
            namedIdList.length === 1 &&
            /\b(?:only|just|solo|alone)\b/.test(lower)
        ) {
            return isSoloAlready(namedIdList[0])
                ? []
                : [genSolo(namedIdList[0])];
        }
        return untickedIdList.length > 0 ? [genAdd(untickedIdList)] : [];
    }
    // Which way is not read in another language: each screen named its own
    // Solo, and the tick it does not have.
    const offers = namedIdList
        .filter((id) => {
            return !isSoloAlready(id);
        })
        .map(genSolo);
    if (untickedIdList.length > 0) {
        offers.push(genAdd(untickedIdList));
    }
    offers.push(...genRemove(tickedNamedIdList));
    return offers;
}

function readClearLayers(lower: string): ClearLayerType[] {
    const layerList: ClearLayerType[] = [];
    if (/\b(?:bible|verses?|passages?|scriptures?|long\s+text)\b/.test(lower)) {
        layerList.push('bible');
    }
    if (/\b(?:slides?|songs?|lyrics?)\b/.test(lower)) {
        layerList.push('slide');
    }
    if (/\b(?:background|video|image|picture|photo)\b/.test(lower)) {
        layerList.push('background');
    }
    if (
        /\b(?:foreground|overlay|clock|timer|countdown|stopwatch|message|marquee)\b/.test(
            lower,
        )
    ) {
        layerList.push('foreground');
    }
    // _take the Bible off all screens_ names a layer; _clear everything_
    // none.
    if (layerList.length === 0 && /\b(?:everything|all|whole)\b/.test(lower)) {
        return ['all'];
    }
    return layerList;
}

function checkHasLayer(screen: ReadScreenType, layer: ClearLayerType): boolean {
    if (layer === 'all') {
        return CLEAR_LAYER_LIST.some((one): boolean => {
            return checkHasLayer(screen, one);
        });
    }
    if (layer === 'bible') {
        return screen.bible !== null && screen.bible !== undefined;
    }
    if (layer === 'foreground') {
        return Array.isArray(screen.foreground) && screen.foreground.length > 0;
    }
    return typeof screen[layer] === 'string' && screen[layer] !== '';
}

function genClearOffers(
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const targetIdList = (
        namedIdList.length > 0
            ? namedIdList
            : state.screens.map((screen) => {
                  return screen.id;
              })
    ).filter((id) => {
        // A locked screen refuses what goes off it too.
        return findScreen(state, id)?.locked !== true;
    });
    const askedLayerList = readClearLayers(lower);
    // None named: Clear All first, then each layer something is on.
    const layerList: ClearLayerType[] =
        askedLayerList.length > 0
            ? askedLayerList
            : ['all', ...CLEAR_LAYER_LIST];
    const offers: BotActionType[] = [];
    for (const layer of layerList) {
        const holdingIdList = targetIdList.filter((id) => {
            const screen = findScreen(state, id);
            return screen !== undefined && checkHasLayer(screen, layer);
        });
        if (holdingIdList.length === 0) {
            continue;
        }
        // Clear All beside one layer is that layer twice.
        if (
            layer === 'all' &&
            askedLayerList.length === 0 &&
            CLEAR_LAYER_LIST.filter((one) => {
                return holdingIdList.some((id) => {
                    return checkHasLayer(findScreen(state, id)!, one);
                });
            }).length < 2
        ) {
            continue;
        }
        offers.push(
            genOffer(
                'clear',
                { screens: holdingIdList, clear: layer },
                genScreenLabel(state, holdingIdList, genClearLabel(layer)),
            ),
        );
    }
    return offers;
}

// A Bible by its short name, its title, or its title without the word
// that ends it -- _the King James_ for the King James Version.
function findNamedBibles(lower: string, state: OfferStateType) {
    return state.bibles.filter((bible) => {
        const shortTitle = bible.title
            .replace(/\s+(?:version|bible|translation)$/i, '')
            .trim();
        return (
            checkHasWords(lower, bible.key) ||
            (bible.title.length >= 8 && checkHasWords(lower, bible.title)) ||
            (shortTitle !== bible.title &&
                shortTitle.split(/\s+/).length >= 2 &&
                checkHasWords(lower, shortTitle))
        );
    });
}

// Capitals that are no Bible's short name.
const OTHER_CAPITALS_SET = new Set([
    'AI',
    'CPU',
    'DVI',
    'HDMI',
    'ID',
    'LCD',
    'LED',
    'MP3',
    'MP4',
    'NDI',
    'OBS',
    'OK',
    'PC',
    'PDF',
    'TV',
    'USB',
    'VGA',
]);

// A short name in capitals that no installed Bible has -- _add the ESV_
// with no ESV here: the Bibles that are installed are not what was asked.
// Not read in a line written all in capitals.
function checkNamesOtherBible(line: string, state: OfferStateType) {
    if (!/\p{Ll}/u.test(line)) {
        return false;
    }
    const keySet = new Set(
        state.bibles.map((bible) => {
            return bible.key.toUpperCase();
        }),
    );
    for (const match of line.matchAll(
        /(?<![\p{L}\p{N}])(\p{Lu}[\p{Lu}\p{N}]{1,6})(?![\p{L}\p{N}])/gu,
    )) {
        const word = match[1];
        if (
            (word.match(/\p{Lu}/gu) ?? []).length >= 2 &&
            !keySet.has(word) &&
            !OTHER_CAPITALS_SET.has(word)
        ) {
            return true;
        }
    }
    return false;
}

function genVersionOffers(
    line: string,
    lower: string,
    namedIdList: number[],
    state: OfferStateType,
) {
    const showingList = state.screens.filter((screen) => {
        return (
            (namedIdList.length === 0 || namedIdList.includes(screen.id)) &&
            screen.bible !== null &&
            screen.bible !== undefined &&
            screen.locked !== true
        );
    });
    if (showingList.length === 0) {
        return [];
    }
    const isEnglish = /^[\x20-\x7e]*$/.test(lower);
    const isRemoving =
        isEnglish &&
        /\b(?:remove|drop|get\s+rid\s+of|delete|take\s+(?:\S+\s+){0,4}?off|hide)\b/.test(
            lower,
        );
    const isOnly = isEnglish && /\bonly\b/.test(lower);
    let namedBibleList = findNamedBibles(lower, state);
    // _another version beside the KJV_: the Bible named is the one up.
    if (
        isEnglish &&
        !isRemoving &&
        !isOnly &&
        /\b(?:another|second|other|extra)\b/.test(lower) &&
        namedBibleList.every((bible) => {
            return showingList.every((screen) => {
                return (screen.bible?.versions ?? []).includes(bible.key);
            });
        })
    ) {
        namedBibleList = [];
    }
    if (
        namedBibleList.length === 0 &&
        (checkIsQuestionLine(lower) || checkNamesOtherBible(line, state))
    ) {
        return [];
    }
    const offers: BotActionType[] = [];
    for (const screen of showingList) {
        const shownKeyList = screen.bible?.versions ?? [];
        const idList = [screen.id];
        if (namedBibleList.length === 0) {
            // _add another version_: the Bibles not up, those in a language
            // already shown first.
            if (isRemoving) {
                continue;
            }
            const shownLanguageList = state.bibles
                .filter((bible) => {
                    return shownKeyList.includes(bible.key);
                })
                .map((bible) => {
                    return bible.language;
                });
            const otherList = state.bibles
                .filter((bible) => {
                    return !shownKeyList.includes(bible.key);
                })
                .sort((one, other) => {
                    return (
                        Number(!shownLanguageList.includes(one.language)) -
                        Number(!shownLanguageList.includes(other.language))
                    );
                });
            for (const bible of otherList.slice(0, 3)) {
                offers.push(
                    genOffer(
                        'versions',
                        { screens: idList, versions: { add: [bible.key] } },
                        genScreenLabel(
                            state,
                            idList,
                            fillWords(tran('Add {name}'), { name: bible.key }),
                        ),
                        bible.title,
                    ),
                );
            }
            continue;
        }
        if (isOnly) {
            const keptKeyList = namedBibleList.map((bible) => {
                return bible.key;
            });
            const droppedKeyList = shownKeyList.filter((key) => {
                return !keptKeyList.includes(key);
            });
            const addedKeyList = keptKeyList.filter((key) => {
                return !shownKeyList.includes(key);
            });
            if (droppedKeyList.length > 0 && keptKeyList.length > 0) {
                offers.push(
                    genOffer(
                        'versions',
                        {
                            screens: idList,
                            versions: {
                                ...(addedKeyList.length > 0
                                    ? { add: addedKeyList }
                                    : {}),
                                remove: droppedKeyList,
                            },
                        },
                        genScreenLabel(
                            state,
                            idList,
                            droppedKeyList
                                .map((key) => {
                                    return fillWords(tran('Remove {name}'), {
                                        name: key,
                                    });
                                })
                                .join(' · '),
                        ),
                    ),
                );
            }
            continue;
        }
        for (const bible of namedBibleList) {
            const isShown = shownKeyList.includes(bible.key);
            if (isShown) {
                // The last version up is the passage itself: a clear takes
                // it off.
                if (shownKeyList.length < 2) {
                    continue;
                }
                offers.push(
                    genOffer(
                        'versions',
                        { screens: idList, versions: { remove: [bible.key] } },
                        genScreenLabel(
                            state,
                            idList,
                            fillWords(tran('Remove {name}'), {
                                name: bible.key,
                            }),
                        ),
                        bible.title,
                    ),
                );
            } else if (!isRemoving) {
                offers.push(
                    genOffer(
                        'versions',
                        { screens: idList, versions: { add: [bible.key] } },
                        genScreenLabel(
                            state,
                            idList,
                            fillWords(tran('Add {name}'), { name: bible.key }),
                        ),
                        bible.title,
                    ),
                );
            }
        }
    }
    return offers;
}

// --- a screen added ------------------------------------------------------------

/**
 * **Add New Screen** under an ask for a screen (EC-630): the Mini Screen
 * menu's own press, one `owa_screen_edit` set of `newScreen` alone. Off the
 * same quiet read as every other offer -- none read, none offered -- and
 * only under the most screens the assistant adds to: past it a person adds
 * one from the menu, and the tool would refuse the press.
 */
function genNewScreenOffers(editState: any): BotActionType[] {
    // Off the Presenter the read says which page it needs and holds no
    // screens: nothing is offered there.
    const screenList =
        editState !== null &&
        typeof editState === 'object' &&
        editState.needsPage === undefined
            ? editState.screens
            : null;
    if (
        !Array.isArray(screenList) ||
        screenList.length >= MAX_AGENT_SCREEN_COUNT
    ) {
        return [];
    }
    return [genOffer('newScreen', { newScreen: true }, tran('Add New Screen'))];
}

/**
 * The presses offered under a screen ask answered with no assistant: each
 * one `owa_screen_edit` set, labelled with the control's own words. `kind`
 * null is a plain line typed under a screen answer -- _centre it_, _unlock
 * it_ -- read for the Bible text's look and a lock alone. Empty when the
 * line asks for nothing the state can offer, or the state was not read.
 */
export function genScreenChangeOffers(
    line: string,
    kind: ScreenAskReadType | null,
    editState: any,
): BotActionType[] {
    // A screen added needs no screen there to be offered.
    if (kind === 'newScreen') {
        return genNewScreenOffers(editState);
    }
    const state = toOfferState(editState);
    if (state === null || kind === 'screen') {
        return [];
    }
    const lower = toLowerLine(line);
    const namedIdList = readNamedScreenIds(
        line,
        state.screens.map((screen) => {
            return screen.id;
        }),
    );
    let offers: BotActionType[] = [];
    if (kind === null && THREAD_HOW_TO_PATTERN.test(lower)) {
        return [];
    }
    if (kind === null) {
        offers = [
            ...genStyleOffers(line, state),
            ...(/\b(?:un-?lock|lock)\b/.test(lower)
                ? genLockOffers(lower, namedIdList, state)
                : []),
        ];
    } else if (kind === 'style') {
        offers = genStyleOffers(line, state);
    } else if (kind === 'lock') {
        offers = genLockOffers(lower, namedIdList, state);
    } else if (kind === 'lineSync') {
        offers = genLineSyncOffers(lower, namedIdList, state);
    } else if (kind === 'transition') {
        offers = genTransitionOffers(lower, namedIdList, state);
    } else if (kind === 'display') {
        offers = genDisplayOffers(line, lower, state);
    } else if (kind === 'group') {
        offers = genGroupOffers(lower, namedIdList, state);
    } else if (kind === 'stage') {
        offers = genStageOffers(lower, state);
    } else if (kind === 'select') {
        offers = genSelectOffers(lower, namedIdList, state);
    } else if (kind === 'clear') {
        offers = genClearOffers(lower, namedIdList, state);
    } else if (kind === 'versions') {
        offers = genVersionOffers(line, lower, namedIdList, state);
    }
    return offers.slice(0, MAX_OFFER_COUNT);
}

/** Whether an action is one of these offers, and the change it makes. */
export function readScreenChangeArgs(
    args: unknown,
): ScreenChangeArgsType | null {
    const value = args as ScreenChangeArgsType | null;
    if (
        value === null ||
        typeof value !== 'object' ||
        typeof value.kind !== 'string' ||
        value.set === null ||
        typeof value.set !== 'object' ||
        Array.isArray(value.set)
    ) {
        return null;
    }
    return { kind: value.kind, set: value.set };
}

/**
 * What is said under the offers in place of "ask again when an assistant
 * can answer": nothing changed yet, the press does it.
 */
export function genScreenOfferText() {
    return tran(
        'Nothing has been changed yet. Press a button below to change it ' +
            'now, or ask me how to do it yourself.',
    );
}
