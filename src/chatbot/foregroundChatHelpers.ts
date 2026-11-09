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
import type { EditedLyricType } from './lyricChatHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    type ForegroundAskType,
    checkIsSameForegroundAsk,
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
 * question that had one attached, unless the tab put them away since
 * (`closedAt`, the id of the message they were put away at). A picture
 * attached after them does not close them: "make it look like this" is asked
 * with the session and the picture together.
 */
export function findOpenForegroundAttachments(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAt?: number,
): ChatAttachmentType[] {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAt !== undefined && message.id <= closedAt) {
            return [];
        }
        if (message.author !== 'you') {
            continue;
        }
        const sessions = (message.attachments ?? []).filter(
            checkIsForegroundAttachment,
        );
        if (sessions.length > 0) {
            return sessions.slice(0, MAX_FOREGROUND_ASK_SESSIONS);
        }
    }
    return [];
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
    'quick-text': ['quick text', 'quick-text', 'quicktext', 'lower third'],
    'long-text': ['long text show'],
    countdown: ['countdown', 'count down', 'timer'],
    stopwatch: ['stopwatch', 'stop watch'],
    time: ['clock on the screen', 'clock on screen', 'a clock', 'the clock'],
    video: ['video show'],
    image: ['image show'],
    camera: ['camera show'],
    screen: ['screen show'],
    web: ['web show'],
};

// Read by a phrase alone (see above).
const PHRASE_ONLY_KEY_SET = new Set<ForegroundComponentKeyType>([
    'message',
    'time',
]);

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
 * The component a typed line names, by its label in the window's language
 * or English, or by a word people use for it -- the longest name first, so
 * "marquee top" is not read as "marquee". Null when it names none.
 */
export function readForegroundComponentAsk(
    text: string,
    translate: (key: string) => string = tran,
): ForegroundComponentKeyType | null {
    const line = String(text ?? '').trim();
    if (line === '' || line.startsWith('/')) {
        return null;
    }
    const candidates: { key: ForegroundComponentKeyType; word: string }[] = [];
    for (const component of FOREGROUND_COMPONENT_LIST) {
        const words = new Set([
            ...(PHRASE_ONLY_KEY_SET.has(component.key)
                ? []
                : [component.labelKey, translate(component.labelKey)]),
            ...COMPONENT_WORD_MAP[component.key],
        ]);
        for (const word of words) {
            if (word.trim().length >= 3) {
                candidates.push({ key: component.key, word });
            }
        }
    }
    candidates.sort((one, other) => {
        return other.word.length - one.word.length;
    });
    for (const { key, word } of candidates) {
        if (toWordPattern(word).test(line)) {
            return key;
        }
    }
    return null;
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
        return {
            name: sessionName ?? result.component,
            undoId: result.undoId,
            listName: result.component,
        };
    } catch (_error) {
        return null;
    }
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
    'words yourself. "show" puts it up on the screens the person ticked, ' +
    '"hide" takes it off, "timer" starts, pauses, resumes or resets a ' +
    'countdown or stopwatch that is up. Putting something UP changes what ' +
    'the congregation sees: do it when they asked for it to go up, offer ' +
    'it when they only asked to change it. When the tool refuses, read its ' +
    'reason, fix the call and try once more; then say plainly what went ' +
    'wrong. A screen that is OFF holds it unseen: offer its show button, ' +
    'never press it unasked. After a change, say in a sentence or two what ' +
    'changed (only what the answer says changed) and that Undo this change ' +
    'puts it back. Never write JSON in your answer. End with ONE line ' +
    "'OPTIONS: a | b | c' -- two or three short next changes they might " +
    'want, on that one line, never as a list.';
