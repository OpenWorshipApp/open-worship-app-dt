/**
 * A conversation about a FOREGROUND component -- a countdown, a marquee, a
 * quick text, messages, a clock, a picture or a clip on the projector --
 * one SESSION of it attached to the tab (2026-11-09, the user: _chatbot can
 * help modify any foreground component_, then, with a panel's sessions strip
 * circled: _sessions of opening foreground component should be able to
 * attached to the chatbot for the chat context_).
 *
 * The presenting flow's conversation (`flowChatHelpers.ts`) is the shape: a
 * question asked while a foreground session is attached is a `foreground`
 * ask, the window reads the session as it stands NOW through
 * `owa_foreground_edit read` and puts it under the question as plain lines,
 * and the ask goes out under its own prompt with that tool, offered to no
 * other question. A session is attached three ways -- a chip's **Open in
 * Chatbot**, a panel header's 🤖, the attach row's **Attach a foreground
 * session** -- and a typed question naming a component with none attached
 * asks about its panel's current session.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
import { genAttachmentId } from './attachmentHelpers';
import type {
    EditedLyricType,
    ForegroundUndoPartType,
} from './lyricChatHelpers';
import { fillWords, tran } from './chatTranHelpers';
import type { ForegroundAskWordType } from './chatLangHelpers';
import { listForegroundAskWords } from './chatLangHelpers';
import { findWordSpans, toLowerAskLine } from './typedCreateAskHelpers';
import {
    type ForegroundAskType,
    checkIsSameForegroundAsk,
    toScreenChoiceWords,
    toValidForegroundAsk,
} from '../helper/ai/foregroundAskHelpers';
import {
    FOREGROUND_COMPONENT_LIST,
    type ForegroundComponentKeyType,
    toForegroundComponentLabel,
} from '../presenter-foreground/foregroundComponentKeys';

export const FOREGROUND_ASK_KIND = 'foreground';
export const FOREGROUND_EDIT_TOOL_NAME = 'owa_foreground_edit';
export const FOREGROUND_ATTACHMENT_MIME_TYPE = 'application/x-owa-foreground';
// A read, a change or two, a retry after a refusal, a show, and the answer.
export const FOREGROUND_MAX_TOOL_ROUNDS = 8;
/** The most sessions one question reads and may change. */
export const MAX_FOREGROUND_ASK_SESSIONS = 3;
// What one session's read may cost the question it rides on.
const MAX_FOREGROUND_READ_TEXT_CHARS = 4000;

/** The name a panel's first session is stored under. */
const DEFAULT_SESSION_NAME = 'Default';

/** `Quick Text › Session 2`: the chip's words, in English as stored. */
export function toForegroundChipName(ask: ForegroundAskType) {
    const label = toForegroundComponentLabel(ask.widget);
    const part =
        ask.itemLabel ??
        ask.itemId ??
        (ask.sessionName === '' ? DEFAULT_SESSION_NAME : ask.sessionName);
    return `${label} › ${part}`;
}

/** The chip as the person sees it: the component's label in their language. */
export function toShownForegroundChipName(ask: ForegroundAskType) {
    const label = tran(toForegroundComponentLabel(ask.widget));
    const part =
        ask.itemLabel ??
        ask.itemId ??
        (ask.sessionName === '' || ask.sessionName === DEFAULT_SESSION_NAME
            ? tran('Default')
            : ask.sessionName);
    return `${label} › ${part}`;
}

/** A session attached to a question: a chip like a file's, no bytes. */
export function genForegroundAttachment(
    ask: ForegroundAskType,
): ChatAttachmentType {
    return {
        id: genAttachmentId(),
        kind: 'foreground',
        name: toForegroundChipName(ask),
        mimeType: FOREGROUND_ATTACHMENT_MIME_TYPE,
        byteSize: 0,
        foreground: ask,
    };
}

export function checkIsForegroundAttachment(attachment: ChatAttachmentType) {
    return (
        attachment.kind === 'foreground' &&
        toValidForegroundAsk(attachment.foreground) !== null
    );
}

/**
 * The sessions a tab's next question is still about: those of the LAST
 * question that had one attached, and every session an answer since put up
 * or changed (`readHeldForeground`, held on the answer as a chip) -- newest
 * first, each once -- unless the tab put them away since (`closedAt`, the
 * id of the message they were put away at). A picture attached after them
 * does not close them: "make it look like this" is asked with the session
 * and the picture together. And "pause it" under "Start a 5 minute
 * countdown" is about that countdown (2026-11-12, EC-520: typed with nothing
 * attached, every follow-up had gone to the guide and the countdown was
 * forgotten).
 */
export function findOpenForegroundAttachments(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAt?: number,
): ChatAttachmentType[] {
    const found: ChatAttachmentType[] = [];
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAt !== undefined && message.id <= closedAt) {
            break;
        }
        const sessions = (message.attachments ?? []).filter(
            checkIsForegroundAttachment,
        );
        for (const session of sessions) {
            const isKnown = found.some((one) => {
                return checkIsSameForegroundAsk(
                    one.foreground as ForegroundAskType,
                    session.foreground as ForegroundAskType,
                );
            });
            if (!isKnown) {
                found.push(session);
            }
        }
        // The person's own pick ends the look back: what was held before it
        // was put away by it.
        if (message.author === 'you' && sessions.length > 0) {
            break;
        }
    }
    return found.slice(0, MAX_FOREGROUND_ASK_SESSIONS);
}

/** The subjects of a set of chips, each once. */
export function toForegroundAskList(
    attachments: readonly ChatAttachmentType[],
) {
    const askList: ForegroundAskType[] = [];
    for (const attachment of attachments) {
        const ask = toValidForegroundAsk(attachment.foreground);
        if (
            ask !== null &&
            !askList.some((one) => {
                return checkIsSameForegroundAsk(one, ask);
            })
        ) {
            askList.push(ask);
        }
    }
    return askList.slice(0, MAX_FOREGROUND_ASK_SESSIONS);
}

// --- a typed question that names a component ---------------------------------

// The words people use for a component, beside its label. English: the
// label in the window's own language is read through `tran` as well --
// except the two whose label is an everyday word (`Time`, `Messages`): "what
// time is it?" and "the error messages" are no foreground questions, so
// those two are read by a phrase alone.
const COMPONENT_WORD_MAP: Record<ForegroundComponentKeyType, string[]> = {
    message: [
        'message on the screen',
        'messages on the screen',
        'message on screen',
        'announcement on the screen',
    ],
    'marquee-top': ['marquee top', 'top marquee', 'scrolling text at the top'],
    'marquee-bottom': [
        'marquee bottom',
        'bottom marquee',
        'marquee',
        'ticker',
        'scrolling text',
        'scrolling message',
    ],
    // A one-off notice at an edge of the screen is a Quick Text with that
    // place (2026-11-12, EC-532: "Show a message at the bottom of the screen
    // for 15 seconds: …" named no component, went to the ordinary tool, which
    // takes no look, and came up in the middle).
    'quick-text': [
        'quick text',
        'quick-text',
        'quicktext',
        'lower third',
        'message at the bottom',
        'message at the top',
        'notice at the bottom',
        'notice at the top',
        'announcement at the bottom',
        'announcement at the top',
    ],
    'long-text': ['long text show'],
    // A countdown or a stopwatch DESCRIBED -- "a clock that counts up from
    // zero", "a clock counting down 5 minutes" -- had been read as the clock
    // ("a clock") or as a countdown ("timer"), and the window handed the
    // model the wrong panel (2026-11-14, EC-642). Phrases written blind, each
    // at least ten letters so it outweighs "the clock"; none that adds things
    // up ("counting up the offering") or goes down a list.
    countdown: [
        'countdown',
        'count down',
        'timer',
        'clock that counts down',
        'timer that counts down',
        'clock counting down',
        'timer counting down',
        'counting down to zero',
        'counts down to zero',
        'that counts down from',
        'counting back to zero',
        'clock counting back',
        'time running down',
        'counting down the minutes',
        'counting backwards',
        'counts backwards',
        'counts down from',
        'counting down from',
        'counts down to',
        'counting down to',
        'that counts down',
        'which counts down',
        'clock counts down',
        'timer counts down',
        'time counts down',
        'time counting down',
        'counting down clock',
        'counting down timer',
        'count down clock',
        'count down timer',
        'countdown clock',
        'countdown timer',
        'count-down clock',
        'count-down timer',
        'ticking down',
        'time ticking down',
        'clock ticking down',
        'timer ticking down',
        'clock running down',
        'timer running down',
        'count backwards',
        'count backward',
        'counting backward',
        'counts backward',
    ],
    stopwatch: [
        'stopwatch',
        'stop watch',
        'clock that counts up',
        'timer that counts up',
        'that counts up from zero',
        'counting up from zero',
        'counts up from zero',
        'count up from zero',
        'count up timer',
        'count-up timer',
        'elapsed time',
        'time elapsed',
        'clock counting up',
        'timer counting up',
        'time going up from zero',
        'counting the time up',
        'that counts upward',
        'counts up from',
        'counting up from',
        'count up from',
        'that counts up',
        'which counts up',
        'clock counts up',
        'timer counts up',
        'time counts up',
        'time counting up',
        'counting up clock',
        'counting up timer',
        'count up clock',
        'count-up clock',
        'countup timer',
        'countup clock',
        'ticking up',
        'time ticking up',
        'clock ticking up',
        'elapsed timer',
        'elapsed clock',
        'elapsed minutes',
        'minutes elapsed',
        'counting upwards',
        'counts upward',
        'counts upwards',
    ],
    // "Put the time on the screen" -- the time ON the screen, never "what
    // time" (EC-521).
    time: [
        'clock on the screen',
        'clock on screen',
        'a clock',
        'the clock',
        'the time on the screen',
        'time on the screen',
        'time on screen',
        'current time',
    ],
    video: ['video show'],
    image: ['image show'],
    fill: ['fill show'],
    animation: ['animation show'],
    camera: ['camera show'],
    screen: ['screen show'],
    web: ['web show'],
};

// Read by a phrase alone (see above).
const PHRASE_ONLY_KEY_SET = new Set<ForegroundComponentKeyType>([
    'message',
    'time',
]);

// A line about the RUNNING ORDER names a countdown or a message as one of
// its lines, never the panel (2026-11-10, EC-467: "Make a new running order
// for Sunday: a welcome countdown, Doxology, Psalm 23 …" was handed the
// Countdown panel, put its countdown up unasked and said running orders were
// beyond it). English words, and the app's own name for one through the
// window's dictionary.
const RUNNING_ORDER_WORD_LIST = [
    'running order',
    'presenting flow',
    'run sheet',
    'order of service',
    'service order',
    'service plan',
];

// How much a language entry names: its longest part's letters. "clock …
// screen" names the clock by its word, not by the words between, so a
// stopwatch said in full ("the stopping clock") is not lost to a clock found
// with the screen after it (EC-564).
function toEntryWeight(entry: string) {
    return Math.max(
        ...entry.split(/\u2026|\.\.\./u).map((part) => {
            return part.replace(/\*/g, '').trim().length;
        }),
    );
}

function toWordPattern(word: string) {
    const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // A Latin word is matched whole; a script with no spaces, anywhere.
    return /^[\p{Script=Latin}\d\s'-]+$/u.test(word)
        ? new RegExp(
              `(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
              'iu',
          )
        : new RegExp(escaped, 'iu');
}

/**
 * Whether a typed line is about the running order -- a presenting flow by
 * any of its names, English or the window's. Such a line names its items,
 * never a thing to put on the screen now: it is no foreground ask, and the
 * assistant puts nothing up while answering it (EC-475).
 */
export function checkIsRunningOrderLine(
    text: string,
    translate: (key: string) => string = tran,
) {
    const line = String(text ?? '').trim();
    if (line === '') {
        return false;
    }
    return [...RUNNING_ORDER_WORD_LIST, translate('Presenting Flow')].some(
        (word) => {
            return word.trim().length >= 3 && toWordPattern(word).test(line);
        },
    );
}

// Words in quotes are what goes on the screen, never what names it
// (2026-11-14, EC-645: "put the message 'Welcome' on the screen", typed in
// eight languages, named nothing, the quoted words standing between the
// word for a message and the word for the screen). Marks, not words, so
// every language alike: a pair of opening and closing quotes, straight
// double quotes, straight single quotes that no letter touches from outside
// (an apostrophe inside a word opens nothing), and a pair of brackets other
// than the round, square and curly ones a line writes in.
const QUOTED_SPAN_PATTERN = new RegExp(
    [
        '\\p{Pi}[^\\p{Pi}\\p{Pf}]+\\p{Pf}',
        '"[^"]+"',
        "(?<![\\p{L}\\p{M}\\p{N}])'[^']+'(?![\\p{L}\\p{M}\\p{N}])",
        '(?![(\\[{])\\p{Ps}[^\\p{Ps}\\p{Pe}]+\\p{Pe}',
    ].join('|'),
    'gu',
);

/** A line with its quoted words left out, or null when it quotes none. */
export function toUnquotedAskLine(line: string) {
    const unquoted = line.replace(QUOTED_SPAN_PATTERN, ' ');
    return unquoted === line ? null : unquoted.replace(/\s+/g, ' ').trim();
}

// A line that asks to TIME something is the stopwatch, when it names no
// component (2026-11-14, EC-654): "time the worship set" went the general
// way, read three guide pages and answered with the Stopwatch panel's
// steps. Only a line that STARTS by asking to time something: "what time
// the service starts" and "time for the offering" ask nothing of the kind.
// And "the time" put in a PLACE is the clock (2026-11-14, EC-655): "put
// the time in the corner" went the general way, whose tool takes no
// place, and the clock came up in the middle; the Foreground route sets
// its position. Not a line asking a question ("is the time on the left
// right?"); "can you put the time in the corner?" asks for it.
const TIME_PLACE_PATTERN =
    /\bthe time\b(?=.*\b(?:corner|top|bottom|upper|lower|left|right)\b)/i;
const TIME_QUESTION_PATTERN =
    /^(?:what|when|where|why|how|is|are|was|does|do|did)\b/i;
const TIMING_ASK_PATTERN =
    /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?time\s+(?:how\s+long\b|the\s|our\s|my\s|this\s|that\s|it\b)/i;

/**
 * The component a typed line names, by its label in the window's language
 * or English, or by a word people use for it -- English's here, every
 * installed language's in its own data (`foregroundAsks`, EC-563: "put the
 * time on the screen" in Khmer named nothing, a Time label being an everyday
 * word read by a phrase only) -- the longest name found first, so "marquee
 * top" is not read as "marquee". A language's words are read as its
 * `createAsks` are (EC-564): where its word for a clock is also its word
 * for an hour, the clock is named only near its word for the screen
 * ("clock … screen"). Words in quotes are read past first (EC-645). Null
 * when it names none.
 */
export function readForegroundComponentAsk(
    text: string,
    translate: (key: string) => string = tran,
    languageWords: ForegroundAskWordType[] = listForegroundAskWords(),
): ForegroundComponentKeyType | null {
    const line = String(text ?? '')
        .normalize('NFC')
        .trim();
    if (line === '' || line.startsWith('/')) {
        return null;
    }
    if (checkIsRunningOrderLine(line, translate)) {
        return null;
    }
    const unquoted = toUnquotedAskLine(line);
    const unquotedKey =
        unquoted === null || unquoted === ''
            ? null
            : readNamedComponent(unquoted, translate, languageWords);
    const read = unquoted || line;
    return (
        unquotedKey ??
        readNamedComponent(line, translate, languageWords) ??
        (TIMING_ASK_PATTERN.test(read) ? 'stopwatch' : null) ??
        (TIME_PLACE_PATTERN.test(read) && !TIME_QUESTION_PATTERN.test(read)
            ? 'time'
            : null)
    );
}

function readNamedComponent(
    line: string,
    translate: (key: string) => string,
    languageWords: ForegroundAskWordType[],
): ForegroundComponentKeyType | null {
    // The longest name found -- a word by its letters, a language entry by
    // its longest part's -- and on a tie the component listed first.
    let foundKey: ForegroundComponentKeyType | null = null;
    let foundLength = 0;
    const lower = languageWords.length > 0 ? toLowerAskLine(line) : '';
    // The line without a language's optional marks, once per language
    // (EC-640: an Arabic countdown typed with its doubling sign and its
    // tanween read as nothing, and went the general way).
    const foldedLineMap = new Map<RegExp, string>();
    const toReadLine = (pattern: RegExp | undefined) => {
        if (pattern === undefined) {
            return lower;
        }
        let folded = foldedLineMap.get(pattern);
        if (folded === undefined) {
            folded = lower.replace(pattern, '');
            foldedLineMap.set(pattern, folded);
        }
        return folded;
    };
    for (const component of FOREGROUND_COMPONENT_LIST) {
        const words = new Set([
            ...(PHRASE_ONLY_KEY_SET.has(component.key)
                ? []
                : [component.labelKey, translate(component.labelKey)]),
            ...COMPONENT_WORD_MAP[component.key],
        ]);
        const lengthList: number[] = [];
        for (const word of words) {
            if (word.trim().length >= 3 && toWordPattern(word).test(line)) {
                lengthList.push(word.trim().length);
            }
        }
        for (const word of languageWords) {
            if (word.key !== component.key) {
                continue;
            }
            const readLine = toReadLine(word.optionalMarkPattern);
            if (
                findWordSpans(readLine, [word.entry], word.isSpaced).length > 0
            ) {
                lengthList.push(toEntryWeight(word.entry));
            }
        }
        const length = Math.max(0, ...lengthList);
        if (length > foundLength) {
            foundKey = component.key;
            foundLength = length;
        }
    }
    return foundKey;
}

// --- the card --------------------------------------------------------------

/** The card's buttons, as stored and asked: the English the window reads. */
export const FOREGROUND_SHOW_ASK = 'Show it on the screen';
export const FOREGROUND_LARGER_ASK = 'Make the words larger';
export const FOREGROUND_TOP_ASK = 'Move it to the top';
export const FOREGROUND_HIDE_ASK = 'Take it off the screen';

// Said to the model under a pressed button, so the job is never its guess.
const FOREGROUND_BUTTON_HINT_MAP: Record<string, string> = {
    [FOREGROUND_SHOW_ASK]:
        '(Put the attached session up: owa_foreground_edit action "show" ' +
        'with its widget and session. Then say which screens hold it and ' +
        'whether each is on.)',
    [FOREGROUND_LARGER_ASK]:
        '(Make it larger: action "set" with look {"size": "larger"} on the ' +
        'attached session. What of it is on a screen changes at once.)',
    [FOREGROUND_TOP_ASK]:
        '(Move it to the top of the screen: action "set" with look ' +
        '{"position": "top"}. A marquee has no place to move: say the top ' +
        'one is Marquee Top, and offer that instead.)',
    [FOREGROUND_HIDE_ASK]:
        '(Take the attached session off the screens: action "hide" with its ' +
        'widget and session.)',
};

/** The hint of a pressed (or typed) card button -- English or translated. */
export function readForegroundButtonHint(asked: string) {
    const text = String(asked ?? '').trim();
    for (const [label, hint] of Object.entries(FOREGROUND_BUTTON_HINT_MAP)) {
        if (text === label || text === tran(label)) {
            return hint;
        }
    }
    return null;
}

/**
 * The card a session opens under in the help window, written with no model:
 * that it is attached, what can be done to it, and the jobs asked for most
 * as buttons, each answered by the assistant with `owa_foreground_edit`.
 */
export function genForegroundOpeningAnswer(ask: ForegroundAskType) {
    return {
        text: fillWords(
            tran(
                '“{name}” is attached below. I can change it for you: its ' +
                    'words or its time, a Bible verse in it, its size, ' +
                    'colours and place on the screen, its border and its ' +
                    'layer. I can also put it up or take it off. What is on ' +
                    'a screen changes at once. Press one, or say what you ' +
                    'want.',
            ),
            { name: toShownForegroundChipName(ask) },
        ),
        // Written out, not the constants above: the key coverage test reads
        // only a literal (`tranKeyCoverage.test.ts`).
        replies: [
            tran('Show it on the screen'),
            tran('Make the words larger'),
            tran('Move it to the top'),
            tran('Take it off the screen'),
        ],
    };
}

// --- the question as the model is asked it -----------------------------------

/**
 * Every screen by its number, ticked and on or not, so none is guessed
 * (2026-11-12, EC-522: told nothing of them, a model counting from one put
 * a stopwatch on "screen 1" of screens 0..1 and was refused as though none
 * were ticked).
 */
function toScreensLine(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }
    const screens = value
        .filter((one): one is Record<string, unknown> => {
            return (
                one !== null &&
                typeof one === 'object' &&
                typeof (one as Record<string, unknown>).screenId === 'number'
            );
        })
        .map((one) => {
            return {
                screenId: one.screenId as number,
                isTicked: one.isTicked === true,
                isShowing: one.isShowing === true,
                isLocked: one.isLocked === true,
            };
        });
    return screens.length === 0
        ? 'screens: none set up'
        : `screens: ${toScreenChoiceWords(screens)}`;
}

/** A read answer as plain lines: what the session holds and looks like. */
export function toForegroundReadText(result: unknown) {
    if (result === null || typeof result !== 'object') {
        return null;
    }
    const data = result as Record<string, unknown>;
    const lines: string[] = [];
    const add = (label: string, value: unknown) => {
        if (value === undefined || value === null || value === '') {
            return;
        }
        lines.push(
            `${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
        );
    };
    add('component', data.component);
    const session = data.session as { name?: string } | undefined;
    add('session', session?.name);
    add('holds', data.content);
    add('looks', data.look);
    const onScreens = Array.isArray(data.onScreens) ? data.onScreens : [];
    lines.push(
        onScreens.length === 0
            ? 'on screen: no'
            : `on screen: screen ${onScreens.join(' and ')}`,
    );
    const screenLine = toScreensLine(data.screens);
    if (screenLine !== null) {
        lines.push(screenLine);
    }
    add('files in its folder', data.files);
    add('cameras', data.cameras);
    const text = lines.join('\n');
    return text.length > MAX_FOREGROUND_READ_TEXT_CHARS
        ? `${text.slice(0, MAX_FOREGROUND_READ_TEXT_CHARS)}…`
        : text;
}

// Sent with nothing typed -- a picture of the look they want dropped on the
// box and Send pressed.
export const FOREGROUND_WORDLESS_HINT =
    '(They sent this with no words of their own. A picture attached here ' +
    'is the look they want: change the session to look like it, in one ' +
    '"set" call. With nothing attached, say in a sentence what you can ' +
    'change and end with OPTIONS.)';

/**
 * The question as the model is asked it: the hint of a pressed button, what
 * they typed, then each attached session as it reads now, named as the tool
 * takes it.
 */
export function toForegroundAsk(
    asked: string,
    sessions: readonly { ask: ForegroundAskType; text: string | null }[],
    isWordless = false,
) {
    const hint = readForegroundButtonHint(asked);
    const shown = sessions.map(({ ask, text }) => {
        const target =
            ask.itemId === undefined
                ? `widget "${ask.widget === 'time' ? 'clock' : ask.widget}", ` +
                  `session "${ask.sessionId === '' ? ask.sessionName || DEFAULT_SESSION_NAME : ask.sessionId}"`
                : ask.widget === 'camera'
                  ? `widget "camera", camera "${ask.itemLabel ?? ask.itemId}"`
                  : `widget "screen", source ${ask.itemId}`;
        return (
            `(The foreground session "${toForegroundChipName(ask)}" is ` +
            `attached. Change it with ${FOREGROUND_EDIT_TOOL_NAME}: ${target}. ` +
            `It reads now:\n` +
            `${text ?? `(it could not be read just now; call ${FOREGROUND_EDIT_TOOL_NAME} with action "read")`})`
        );
    });
    return [
        ...(isWordless ? [FOREGROUND_WORDLESS_HINT] : []),
        asked,
        ...(hint === null ? [] : [hint]),
        ...shown,
    ].join('\n\n');
}

/**
 * A change either foreground door made, off its RESULT -- a read, a check
 * or a refusal changed nothing. The name is the session as its strip shows
 * it, and the "list" is its own panel, so **Show it in the list** rings the
 * session's chip there (`Quick Text > John 3:16`).
 */
export function readEditedForeground(text: string): EditedLyricType | null {
    try {
        const result = JSON.parse(text);
        if (
            result?.isChanged !== true ||
            typeof result.undoId !== 'string' ||
            result.undoId === '' ||
            typeof result.component !== 'string'
        ) {
            return null;
        }
        const sessionName =
            typeof result.session?.name === 'string' &&
            result.session.name !== ''
                ? result.session.name
                : null;
        const name = sessionName ?? result.component;
        // The strip's words, as `toShownForegroundChipName` writes them: the
        // panel's label and the session, both in the person's language.
        const label = FOREGROUND_LABEL_SET.has(result.component)
            ? tran(result.component)
            : result.component;
        const shownName =
            sessionName === null
                ? label
                : `${label} › ${
                      sessionName === DEFAULT_SESSION_NAME
                          ? tran(DEFAULT_SESSION_NAME)
                          : sessionName
                  }`;
        // Put up with every screen off, or any screen on (EC-599); a result
        // that says neither leaves what the answer knew.
        const isPutUp = result.did === 'started' || result.did === 'shown';
        const isScreenOff =
            result.isAnyShowing === true
                ? false
                : isPutUp && result.isAnyShowing === false
                  ? true
                  : undefined;
        return {
            name,
            undoId: result.undoId,
            listName: result.component,
            // A session this change MADE is taken away by its undo (EC-545).
            undoParts: [{ name, isMade: result.session?.isNew === true }],
            ...(isScreenOff === undefined ? {} : { isScreenOff }),
            shownName,
        };
    } catch (_error) {
        return null;
    }
}

const FOREGROUND_LABEL_SET = new Set<string>(
    FOREGROUND_COMPONENT_LIST.map((component) => {
        return component.labelKey;
    }),
);

/**
 * Every foreground change ONE answer made, whatever session it is in: a
 * countdown started and a marquee beside it are two sessions, and the one
 * **Undo this change** under the answer puts back both (2026-11-12,
 * EC-539: the edits merged by name only, so it took back the marquee and
 * left the countdown up, under an answer saying both would go). The newest
 * session is the one **Show it in the list** rings.
 */
export function mergeEditedForeground(
    previous: EditedLyricType | null,
    next: EditedLyricType,
): EditedLyricType {
    const isOneAnswer =
        previous !== null &&
        (previous.name === next.name ||
            FOREGROUND_LABEL_SET.has(previous.listName ?? ''));
    if (!isOneAnswer) {
        return next;
    }
    const undoIdList = [
        ...(previous.undoIdList ??
            (previous.undoId === null ? [] : [previous.undoId])),
        ...(next.undoId === null ? [] : [next.undoId]),
    ];
    const undoParts = mergeUndoParts([
        ...(previous.undoParts ?? []),
        ...(next.undoParts ?? []),
    ]);
    const isScreenOff = next.isScreenOff ?? previous.isScreenOff;
    return {
        ...next,
        undoId: next.undoId ?? previous.undoId,
        ...(undoIdList.length > 1 ? { undoIdList } : {}),
        ...(undoParts.length > 0 ? { undoParts } : {}),
        ...(isScreenOff === undefined ? {} : { isScreenOff }),
    };
}

/**
 * One part a session, in the order the answer first changed it: a session
 * an answer started and then set is MADE by that answer, and its undo
 * takes it away whatever came after.
 */
function mergeUndoParts(partList: readonly ForegroundUndoPartType[]) {
    const partMap = new Map<string, ForegroundUndoPartType>();
    for (const part of partList) {
        const found = partMap.get(part.name);
        partMap.set(part.name, {
            name: part.name,
            isMade: part.isMade || found?.isMade === true,
        });
    }
    return [...partMap.values()];
}

/**
 * The parts an **Undo this change** press carries, as saved with the
 * message; null when there are none (a song, a slide document, an answer
 * saved before EC-545).
 */
export function readForegroundUndoParts(
    raw: unknown,
): ForegroundUndoPartType[] | null {
    if (!Array.isArray(raw)) {
        return null;
    }
    const partList = raw.filter((part): part is ForegroundUndoPartType => {
        return (
            typeof part?.name === 'string' &&
            part.name !== '' &&
            typeof part.isMade === 'boolean'
        );
    });
    return partList.length === 0 ? null : partList;
}

/**
 * What the window says once an answer's foreground changes are undone
 * (2026-11-13, EC-545): one sentence a session, each in words every
 * language already has. A session the answer made is taken away again --
 * off the panel and off the screens (EC-540) -- and one it only changed is
 * back as it was. Under _Start a 3 minute countdown and put a marquee at
 * the bottom that says Welcome, friends_ the press had written _"Welcome,
 * friends" is back as it was before that change_, the marquee gone and the
 * countdown not named.
 */
export function genForegroundUndoneText(
    partList: readonly ForegroundUndoPartType[],
) {
    return partList
        .map((part) => {
            return fillWords(
                part.isMade
                    ? tran(
                          '“{name}” is taken away again: ' +
                              'the change that made it is ' +
                              'undone.',
                      )
                    : tran(
                          '“{name}” is back as it was ' + 'before that change.',
                      ),
                { name: part.name },
            );
        })
        .join('\n\n');
}

/**
 * What a model's `session` turns into: the attached session's id when the
 * name is one of theirs (the strip's name, the chip's, or `Default`), else
 * what it wrote -- a NEW session asked for by name is the worker's to make.
 */
export function resolveForegroundSession(
    widget: unknown,
    session: unknown,
    askList: readonly ForegroundAskType[],
) {
    if (typeof session !== 'string') {
        return session;
    }
    const wanted = session.trim().toLowerCase();
    const found = askList.find((ask) => {
        if (typeof widget === 'string') {
            const key = widget === 'clock' ? 'time' : widget;
            if (key !== ask.widget) {
                return false;
            }
        }
        const names = [
            ask.sessionId,
            ask.sessionName,
            toForegroundChipName(ask),
            ...(ask.sessionId === '' ? [DEFAULT_SESSION_NAME] : []),
        ].map((one) => {
            return one.trim().toLowerCase();
        });
        return names.includes(wanted);
    });
    if (found === undefined) {
        return session;
    }
    // The Default session's id is the empty string, which the worker reads
    // as "none named": it is named by its name on the strip instead.
    return found.sessionId === ''
        ? found.sessionName || DEFAULT_SESSION_NAME
        : found.sessionId;
}

// What an answer did that leaves a session to talk about next: put it up,
// changed it, made it, or ran its timer. A read, a check, a stop or a hide
// leaves nothing new.
const HELD_DID_SET = new Set([
    'started',
    'shown',
    'changed',
    'created',
    'timer',
]);

/**
 * The session a foreground door's RESULT put up or changed, to be held on
 * the answer as a chip -- so the next question is about it (EC-520). Null
 * for anything else, and for a component with no sessions.
 */
export function readHeldForeground(text: string): ForegroundAskType | null {
    try {
        const result = JSON.parse(text);
        if (
            result === null ||
            typeof result !== 'object' ||
            result.isError === true ||
            !HELD_DID_SET.has(result.did) ||
            result.session === null ||
            typeof result.session !== 'object'
        ) {
            return null;
        }
        return toValidForegroundAsk({
            widget: result.widget === 'clock' ? 'time' : result.widget,
            sessionId: result.session.id,
            sessionName: result.session.name,
        });
    } catch (_error) {
        return null;
    }
}

const TIME_FIELD_LIST = ['minutes', 'seconds'] as const;

/**
 * The time fields a model wrote as 0 beside a time it did give: no time at
 * all, which the schema refuses (a time is above 0). On Free, "a 5 minute
 * countdown" in Russian came as `{minutes: 5, seconds: 0}`, was refused and
 * cost a round (2026-11-13, EC-616). A 0 with no other time is left for the
 * schema to refuse -- dropped, the worker would start its own default.
 */
function listZeroTimeFields(args: Record<string, unknown>): string[] {
    const isTimed =
        TIME_FIELD_LIST.some((field) => {
            const value = args[field];
            return typeof value === 'number' && value > 0;
        }) ||
        (typeof args.at === 'string' && args.at.trim() !== '');
    if (!isTimed) {
        return [];
    }
    return TIME_FIELD_LIST.filter((field) => {
        return args[field] === 0;
    });
}

// A blank left for somebody to fill in: words in square brackets, curly
// braces or angle brackets -- "[Insert Password Here]", "{name}",
// "<time>" (2026-11-14, EC-652).
const FOREGROUND_BLANK_PATTERN =
    /\[[^\[\]\n]*\p{L}[^\[\]\n]*\]|\{[^{}\n]*\p{L}[^{}\n]*\}|<\p{L}[^<>\n]*>/gu;

/**
 * The first blank to fill in that words about to go up hold and the person
 * did not type themselves (2026-11-14, EC-652): asked to "show the church
 * wifi password on the screen", a model put up "Church WiFi Password:
 * [Insert Password Here]" and said the password was up, three times of
 * three. A `text` or `texts` of `owa_foreground` or `owa_foreground_edit`;
 * null when there is none, or when the brackets are the person's own.
 */
export function findForegroundBlank(
    args: Record<string, unknown> | undefined,
    typed: string,
): string | null {
    if (args === undefined || args === null || typeof args !== 'object') {
        return null;
    }
    const wordList = [
        args.text,
        ...(Array.isArray(args.texts) ? args.texts : []),
    ].filter((words): words is string => {
        return typeof words === 'string';
    });
    const typedLower = String(typed ?? '').toLowerCase();
    for (const words of wordList) {
        for (const match of words.matchAll(FOREGROUND_BLANK_PATTERN)) {
            if (!typedLower.includes(match[0].toLowerCase())) {
                return match[0];
            }
        }
    }
    return null;
}

/** What the model is told when its words hold a blank (EC-652). */
export function genForegroundBlankRefusal(blank: string) {
    return (
        `Not put up: the words hold a blank to fill in (${JSON.stringify(blank)}). ` +
        'Nothing changed on the screens. Ask them for the words that go ' +
        'there, and put them up once they give them -- never a placeholder, ' +
        'and never say it is up.'
    );
}

// A line that marks the words to show itself: in quotes of any kind, or
// after a colon ("... on the screen: Grace2024"); the colon inside a time
// is not one, nor an apostrophe inside a word ("the pastor\u2019s").
const FOREGROUND_MARKED_WORDS_PATTERN =
    /["\p{Pi}\p{Pf}\u300C-\u300F]|[:\uFF1A](?!\d)/u;
const IN_WORD_APOSTROPHE_PATTERN = /(?<=\p{L})[\u2018\u2019](?=\p{L})/gu;

function toWordTokenList(words: string) {
    return words.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function checkIsWordRun(wordList: string[], runList: string[]) {
    for (let start = 0; start + runList.length <= wordList.length; start++) {
        if (
            runList.every((word, index) => {
                return wordList[start + index] === word;
            })
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Words about to go up that are only a run of the person's own words, the
 * line marking none as the words to show (2026-11-14, EC-652): "show the
 * church wifi password on the screen" put up "Church WiFi Password" -- the
 * name of what to show, not it -- three times of three, while "show
 * welcome to our church on the screen" is the words themselves. The window
 * cannot tell the two apart, so such words go back once with the question.
 */
export function findForegroundEchoedWords(
    args: Record<string, unknown> | undefined,
    typed: string,
): string | null {
    if (args === undefined || args === null || typeof args !== 'object') {
        return null;
    }
    const typedText = String(typed ?? '');
    if (
        FOREGROUND_MARKED_WORDS_PATTERN.test(
            typedText.replace(IN_WORD_APOSTROPHE_PATTERN, ''),
        )
    ) {
        return null;
    }
    const typedList = toWordTokenList(typedText);
    const wordsList = [
        args.text,
        ...(Array.isArray(args.texts) ? args.texts : []),
    ].filter((words): words is string => {
        return typeof words === 'string';
    });
    for (const words of wordsList) {
        const runList = toWordTokenList(words);
        if (
            runList.length > 0 &&
            runList.length < typedList.length &&
            checkIsWordRun(typedList, runList)
        ) {
            return words;
        }
    }
    return null;
}

/** What the model is told when its words are only the person's (EC-652). */
export function genForegroundEchoQuestion(words: string) {
    return (
        `Not put up yet: ${JSON.stringify(words)} is only words of their own ` +
        'line, and the line marks none as the words to show. If those words ' +
        'NAME something they did not give -- a code, a number, a name, an ' +
        'address -- put nothing up: ask them for it. If they are themselves ' +
        'what goes on the screen, send the same call again.'
    );
}

/**
 * A model's `owa_foreground_edit` arguments as the worker gets them: a
 * session name turned into the attached one's id -- and a `start` naming a
 * session nobody attached loses it, so NEW words go into a session of their
 * own and never over one a person typed (2026-11-12, EC-523: "Count down to
 * 11:45" was written over the panel's Default, the model naming it off its
 * read).
 */
export function toForegroundEditArgs(
    args: Record<string, unknown> | undefined,
    askList: readonly ForegroundAskType[],
    isAttached = true,
): Record<string, unknown> {
    if (args === undefined || args === null || typeof args !== 'object') {
        return {};
    }
    // A `timer` press written with no `action` is that press: the model
    // sent `{timer: "add", minutes: 2}` twice and the schema refused both
    // (EC-526's re-ask). Only `timer` says its action this plainly.
    if (args.action === undefined && typeof args.timer === 'string') {
        return toForegroundEditArgs(
            { ...args, action: 'timer' },
            askList,
            isAttached,
        );
    }
    const zeroList = listZeroTimeFields(args);
    if (zeroList.length > 0) {
        return toForegroundEditArgs(
            Object.fromEntries(
                Object.entries(args).filter(([key]) => {
                    return !zeroList.includes(key);
                }),
            ),
            askList,
            isAttached,
        );
    }
    if (typeof args.session !== 'string') {
        return { ...args };
    }
    const resolved = resolveForegroundSession(
        args.widget,
        args.session,
        askList,
    );
    if (args.action === 'start') {
        const widget = args.widget === 'clock' ? 'time' : args.widget;
        const isNamedAttached =
            isAttached &&
            askList.some((ask) => {
                return (
                    (typeof widget !== 'string' || ask.widget === widget) &&
                    (ask.sessionId === ''
                        ? resolved === (ask.sessionName || DEFAULT_SESSION_NAME)
                        : ask.sessionId === resolved)
                );
            });
        if (!isNamedAttached) {
            const { session: _session, ...rest } = args;
            return rest;
        }
    }
    return { ...args, session: resolved };
}

/**
 * The system prompt of such a conversation: what the tool takes, the look
 * in words, and that going up changes what the room sees.
 */
export const FOREGROUND_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer with the FOREGROUND -- the ' +
    'extras laid over the projector: a countdown, a stopwatch, a clock, a ' +
    'scrolling marquee along the top or bottom, a quick text, messages, a ' +
    'long text, a video, a picture, a web page, a camera, another screen. ' +
    'Each has a panel with SESSIONS: a session is one saved set-up of it -- ' +
    'its words or numbers AND its look. Every attached session is given ' +
    'under their message as it reads now. Change it with ' +
    `${FOREGROUND_EDIT_TOOL_NAME}, naming its widget and session exactly ` +
    'as given; a question that names a component with none attached is ' +
    'about its panel\'s current session (leave session out). "set" changes ' +
    'words (text, texts, minutes or at, seconds, delay, interval, ' +
    'utcOffset/title/is24Hour, sound/volume, preset) and the look in ' +
    'words (look: size "larger"/"smaller"/px, color, background, ' +
    'position "top"/"bottom left"/"center", width, scale, opacity, round, ' +
    'border, shadow, textAlign, italic, bold, font, behind, onTop, blend, ' +
    'transition, speed for a marquee) -- ALL of one change in ONE call; ' +
    'what of it is on a screen changes at once. A verse goes in by `ref` ' +
    '("John 3:16"), read from the installed Bible: NEVER write a verse\'s ' +
    'words yourself. When they ask to START something or to put NEW words ' +
    'or a time UP ("start a 5 minute countdown", "put John 3:16 on the ' +
    'screen", "show the time"), use "start" with the words in ONE call, ' +
    'and the look they named in it ("at the bottom" is look position ' +
    '"bottom"; words that go off by themselves "for 15 seconds" are a ' +
    'quick-text with seconds -- a message stays until hidden): it ' +
    'puts them in a session of their own, never over one they typed, and ' +
    'up on the screens they ticked, a countdown or stopwatch running. ' +
    // EC-652, EC-653: a thing asked for by what it is went up as a blank
    // to fill in, then as its own name; a countdown to a moment nobody
    // timed went up as 5 minutes. The examples are not the lines measured.
    'What they did not give is asked for, never made up. Asked to show a ' +
    'thing by what it is and not the thing itself ("show the door code", ' +
    '"put up who is preaching"), ask them for it: its name alone on the ' +
    'screen shows nothing. A countdown TO something they gave no time for ' +
    '("count down to the wedding") asks what time it is. Never a blank to ' +
    'fill in, or a length they did not say. ' +
    '"show" puts a session up as it is, "hide" takes it off -- widget ' +
    '"all" with no session takes EVERY extra off every screen ("clear ' +
    'everything", "take it all down"), "timer" ' +
    'starts, pauses, resumes or resets a countdown or stopwatch that is ' +
    'up; timer "add" with minutes or seconds puts MORE time on a ' +
    'countdown that is up ("add 2 minutes" -- never "set", which starts ' +
    'it over). ' +
    'Leave `screens` out: the ticked screens are the ones they chose ' +
    '(the read names every screen by its number). Putting something UP ' +
    'changes what the congregation sees: do it when they asked for it to ' +
    'go up, offer it when they only asked to change it. A question about ' +
    'something else is answered from the guide (owa_help_search), nothing ' +
    'changed. When the tool refuses, read its ' +
    'reason, fix the call and try once more; then say plainly what went ' +
    // "OFF" came back as "(OFF)" after the Arabic, Hindi and Thai words
    // for it (2026-11-14, EC-620).
    'wrong. A screen that is turned off holds it unseen -- asked what is ' +
    'on a screen, name what it holds and that it is off, never "nothing": ' +
    // Named by what it does: "its show button" came back in English inside
    // Indonesian answers, "tombol show" (2026-11-13, EC-617).
    'offer to turn that screen on for them -- you can, on a yes -- and ' +
    'never turn it on unasked. After a change, say in a sentence or two what ' +
    'changed (only what the answer says changed); ONLY when its answer ' +
    // In their words: given as a phrase, a Gemma 4 answering in Khmer wrote
    // it out in English under the Khmer and only the button's name was put
    // into Khmer (2026-11-13, EC-557).
    // Never the field's name: "this change has an undo id" reached an
    // Indonesian answer (EC-617).
    'carries an undoId, say in your own words, in the language you answer ' +
    'in (never the words undo id), that the button under the answer puts ' +
    'it back -- a show, ' +
    'hide or timer press keeps none, so say instead that they can ask you ' +
    'to reverse it (put it up again, resume it, take it off) -- ' +
    // An action name given as the way back was written as a button: "press
    // the button 'show'" in a Khmer answer (2026-11-13, EC-562).
    "this tool's action names are not buttons: never tell them to press " +
    'one. Never write JSON in your ' +
    'answer. End with ONE line ' +
    "'OPTIONS: a | b | c' -- two or three short next changes they might " +
    'want, on that one line, never as a list.';
