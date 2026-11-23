/**
 * A conversation about an ANIMATION in Customize (2026-11-19, the user, the
 * shader's Edit Code panel open: _add chatbot icon to open in chatbot and
 * let chatbot control editor_, the goal _chatbot can help handle css and
 * glsl code editing_).
 *
 * The 🤖 in Customize or in the Shader Code or CSS Code panel opens a tab
 * on that editor (`chatbotHandoffStoreHelpers.ts`), under a card saying what
 * can be changed. Every line typed under it is an `animation` ask: the
 * window reads the animation as it stands NOW through `owa_animation_edit
 * read` and puts it under the question -- its code with it, and what is
 * wrong with that -- and the ask goes out under its own prompt with that
 * tool, offered to no other question. Its answer is marked
 * (`isAnimationAnswer`), so the next plain line -- _slower_, _fix the
 * error_, _undo that_ -- is more of the same conversation, in any language.
 *
 * Both kinds have the same settings and their code (2026-11-19, the goal's
 * CSS half): a shader's GLSL, typed into Shader Code, and a CSS animation's
 * own style sheet, typed into CSS Code -- where Ctrl+Z takes it back. A
 * built-in's code is what its panel opens on: a shader's source, a CSS
 * effect written as CSS; code sent for it makes it custom.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatSessionType } from './chatSessionHelpers';
import { fillWords, tran } from './chatTranHelpers';
import type { EditedLyricType } from './lyricChatHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';

export const ANIMATION_ASK_KIND = 'animation';
export const ANIMATION_EDIT_TOOL_NAME = 'owa_animation_edit';
// A shader that does not compile is fixed by a code call, read back, fixed
// again: rounds the settings alone never need.
export const ANIMATION_MAX_TOOL_ROUNDS = 8;
/** The Undo press's `kind`, so its handler calls this tool's own undo. */
export const ANIMATION_UNDO_KIND = 'animation';

const ANIMATION_EDITED_NAME = 'animation';
const ANIMATION_EDITED_LIST_NAME = 'Animation';

// The read under a question: the code of one shader at most, and the
// settings of a few editors.
const MAX_READ_EDITORS = 6;
const MAX_READ_CODE_CHARS = 12000;

// --- the card the 🤖 opens the tab with ----------------------------------------

/** What the 🤖 names: the editor and the animation as the panel shows it. */
export type AnimationOpeningType = {
    name: string;
    engine: 'css' | 'glsl';
};

/**
 * The tab the 🤖 hands an animation to, made ready for the card. With the
 * strip full the hand-off lands in the tab in front, and what that tab still
 * held -- a file (a Resources study, a song), a passage's record, a
 * foreground session -- takes every line typed under the card for itself:
 * seen live, the card landed under an Exodus study and _make it slower_
 * would have gone to the study. Each is put away the way its × does, at the
 * tab's last message, so the conversation above keeps what it was about. A
 * fresh tab only asks about the Presenter.
 */
export function toAnimationHandoffSession(session: ChatSessionType) {
    const lastId = session.messages.reduce((most, message) => {
        return Math.max(most, message.id);
    }, 0);
    return {
        ...session,
        focus: 'presenter' as const,
        isFocusChosen: true,
        ...(lastId > 0
            ? {
                  fileClosedAt: lastId,
                  lookupClosedAt: lastId,
                  foregroundClosedAt: lastId,
              }
            : {}),
    };
}

/** The tab's first card: what can be changed, and three things to press. */
export function genAnimationOpeningAnswer(ask: AnimationOpeningType) {
    const text =
        ask.engine === 'glsl'
            ? fillWords(
                  tran(
                      'Ask me to change the shader “{name}”: its colors, ' +
                          'speed, quality, opacity and blend, or its code ' +
                          'in Shader Code, checked before it is used. A ' +
                          'screen showing it changes at once.',
                  ),
                  { name: ask.name },
              )
            : fillWords(
                  tran(
                      'Ask me to change the animation “{name}”: its ' +
                          'effect, colors, speed, density, opacity and ' +
                          'blend, or its code in CSS Code, checked before ' +
                          'it is used. A screen showing it changes at once.',
                  ),
                  { name: ask.name },
              );
    // Written out, not shared constants: the key coverage test reads only
    // a literal (`tranKeyCoverage.test.ts`). Every animation has code to
    // explain: its own, or -- a built-in's -- what its panel opens on.
    const codeReply =
        ask.engine === 'css'
            ? tran('Explain the CSS code')
            : tran('Explain the shader code');
    const replies = [
        tran('Make it slower'),
        tran('Use warmer colors'),
        codeReply,
    ];
    return { text, replies };
}

// --- the thread ---------------------------------------------------------------

type AnimationMessageType = {
    author: 'you' | 'bot';
    isFollowUp?: true;
    isAnimationAnswer?: true;
    actions?: { toolName?: string; args?: any }[];
};

function findLastAnswer(messages: readonly AnimationMessageType[]) {
    return [...messages].reverse().find((message) => {
        return message.author === 'bot' && message.isFollowUp !== true;
    });
}

/**
 * Whether a plain line typed in the tab is more of an animation
 * conversation: the last answer was one (its opening card included), and
 * the line is not a command.
 */
export function checkIsAnimationThread(
    messages: readonly AnimationMessageType[],
    text: string,
) {
    const line = String(text ?? '').trim();
    if (line.startsWith('/')) {
        return false;
    }
    return findLastAnswer(messages)?.isAnimationAnswer === true;
}

/**
 * The undo ids of the last animation answer's change, newest first: what
 * "undo that" typed under it takes back.
 */
export function findAnimationUndoIds(
    messages: readonly AnimationMessageType[],
) {
    const lastAnswer = findLastAnswer(messages);
    if (lastAnswer?.isAnimationAnswer !== true) {
        return [];
    }
    const undoAction = (lastAnswer.actions ?? []).find((action) => {
        return (
            action.toolName === LYRIC_UNDO_TOOL_NAME &&
            action.args?.kind === ANIMATION_UNDO_KIND
        );
    });
    if (undoAction === undefined) {
        return [];
    }
    const idList = Array.isArray(undoAction.args?.ids)
        ? (undoAction.args.ids as unknown[])
        : [undoAction.args?.id];
    return idList
        .filter((id): id is string => {
            return typeof id === 'string' && /^[\w.-]{1,80}$/.test(id);
        })
        .reverse();
}

// --- the animation, read for the ask ------------------------------------------

type AnimationReadEditorType = Record<string, unknown>;

function toWords(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(String).join(', ');
    }
    return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : null;
}

function toPanelName(engine: unknown) {
    return engine === 'css' ? 'CSS Code' : 'Shader Code';
}

function toEditorLines(editor: AnimationReadEditorType) {
    const head = `- ${toWords(editor.editor) ?? '?'} (${
        toWords(editor.where) ?? ''
    })`;
    const fields = [
        'engine',
        'effect',
        'colors',
        'speed',
        'density',
        'quality',
        'opacity',
        'blend',
    ]
        .map((key) => {
            const words = toWords(editor[key]);
            return words === null ? null : `${key}: ${words}`;
        })
        .filter((line): line is string => {
            return line !== null;
        });
    const lines = [head, `  ${fields.join('; ')}`];
    if (editor.isCodeOpen === true) {
        lines.push(`  ${toPanelName(editor.engine)} panel: open`);
    }
    return lines;
}

/** A read answer as plain lines: the editors, and the target's code. */
export function toAnimationReadText(result: unknown): string | null {
    if (result === null || typeof result !== 'object') {
        return null;
    }
    const read = result as Record<string, unknown>;
    const editors = Array.isArray(read.editors)
        ? (read.editors as AnimationReadEditorType[])
        : [];
    if (editors.length === 0) {
        return typeof read.note === 'string' ? read.note : null;
    }
    const lines: string[] = [
        `Open animation editors (a change goes to ${
            toWords(read.target) ?? 'the first'
        } unless \`editor\` names another):`,
    ];
    for (const editor of editors.slice(0, MAX_READ_EDITORS)) {
        lines.push(...toEditorLines(editor));
    }
    const target =
        editors.find((editor) => {
            return editor.editor === read.target;
        }) ?? editors[0];
    const isCss = target.engine === 'css';
    if (typeof target.code === 'string') {
        const code = target.code.slice(0, MAX_READ_CODE_CHARS);
        lines.push(
            `The ${isCss ? 'CSS' : 'shader'} code of ${toWords(target.editor)}${
                target.isCodeOpen === true
                    ? ` (as the ${toPanelName(target.engine)} panel holds it)`
                    : ''
            }:`,
            isCss ? '```css' : '```glsl',
            code,
            '```',
        );
        if (target.isCodeOpen === true) {
            let verdict = isCss ? 'It passes its check.' : 'It compiles.';
            if (typeof target.codeError === 'string') {
                verdict = `${
                    isCss ? 'It does not pass its check' : 'It does not compile'
                }: ${target.codeError}`;
            }
            lines.push(verdict);
        }
    }
    return lines.join('\n');
}

const ANIMATION_WORDLESS_HINT =
    '(They sent no words: say in a sentence what the animation looks like ' +
    'and offer two or three changes.)';

/**
 * What the model is asked: their question, the animation as read just
 * now, and -- under a change -- the id that takes it back, for an "undo
 * that". In the USER turn, never the system prompt, which is a cached
 * prefix.
 */
export function toAnimationAsk(
    asked: string,
    readText: string | null,
    undoIds: readonly string[] = [],
) {
    const parts = [asked.trim() === '' ? ANIMATION_WORDLESS_HINT : asked];
    parts.push(
        readText === null
            ? `(The animation could not be read just now: read it with ${ANIMATION_EDIT_TOOL_NAME} read before changing anything.)`
            : `The animation as it is now, read just now:\n${readText}`,
    );
    if (undoIds.length > 0) {
        parts.push(
            `The last change in this conversation is taken back with ${ANIMATION_EDIT_TOOL_NAME} action "undo", ` +
                (undoIds.length === 1
                    ? `id "${undoIds[0]}"`
                    : `ids ${undoIds
                          .map((id) => {
                              return `"${id}"`;
                          })
                          .join(', ')}, one call each in that order`) +
                ' -- only when they ask to undo it, and never write an id ' +
                'in the answer.',
        );
    }
    return parts.join('\n\n');
}

// --- the change it made -------------------------------------------------------

/**
 * A change `owa_animation_edit` made, off its RESULT: a read, an "already
 * so" and a refusal changed nothing.
 */
export function readEditedAnimation(text: string): EditedLyricType | null {
    try {
        const result = JSON.parse(text);
        if (
            typeof result?.undoId !== 'string' ||
            !/^[\w.-]{1,80}$/.test(result.undoId) ||
            typeof result.did !== 'string'
        ) {
            return null;
        }
        return {
            name: ANIMATION_EDITED_NAME,
            undoId: result.undoId,
            listName: ANIMATION_EDITED_LIST_NAME,
            shownName: tran('Animations'),
        };
    } catch (_error) {
        return null;
    }
}

/** Never a document: no **Show it in the list** goes under it. */
export function checkIsAnimationEdited(edited: EditedLyricType | null) {
    return edited?.listName === ANIMATION_EDITED_LIST_NAME;
}

/**
 * Every change ONE answer made to the animation, under its one Undo: the
 * colours changed and then the code are two calls, and the press takes
 * back both -- the oldest's undo puts back everything after it too.
 */
export function mergeEditedAnimation(
    previous: EditedLyricType | null,
    next: EditedLyricType,
): EditedLyricType {
    if (previous === null || !checkIsAnimationEdited(previous)) {
        return next;
    }
    const undoIdList = [
        ...new Set([
            ...(previous.undoIdList ??
                (previous.undoId === null ? [] : [previous.undoId])),
            ...(next.undoId === null ? [] : [next.undoId]),
        ]),
    ];
    return {
        ...next,
        undoId: next.undoId ?? undoIdList[undoIdList.length - 1] ?? null,
        ...(undoIdList.length > 1 ? { undoIdList } : {}),
    };
}

/** **Undo this change** under an animation answer. */
export function genAnimationUndoAction(edited: EditedLyricType) {
    if (edited.undoId === null) {
        return null;
    }
    return {
        label: LYRIC_UNDO_LABEL,
        toolName: LYRIC_UNDO_TOOL_NAME,
        args: {
            id: edited.undoId,
            name: edited.name,
            kind: ANIMATION_UNDO_KIND,
            ...(edited.undoIdList === undefined
                ? {}
                : { ids: edited.undoIdList }),
        },
    };
}

/**
 * The id the press takes back: the OLDEST change of the answer, whose undo
 * puts back every change made after it in that editor.
 */
export function pickAnimationUndoId(args: Record<string, unknown>) {
    const idList = Array.isArray(args.ids) ? args.ids : [args.id];
    const first = idList.find((id) => {
        return typeof id === 'string' && /^[\w.-]{1,80}$/.test(id);
    });
    return typeof first === 'string' ? first : null;
}

// --- the prompt ---------------------------------------------------------------

/**
 * The system prompt of such a conversation: what each setting does, what
 * the tool takes, how a shader is written, and that the room sees what
 * changes.
 */
export const ANIMATION_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer with an ANIMATED BACKGROUND ' +
    "in Customize -- the Background panel's Animations tab, or Animation " +
    'Show over the slide. The animation as it is now is given under their ' +
    'message, read just now: do not read it again unless it says it could ' +
    'not be read. A screen showing it changes about half a second after a ' +
    'change. There are two kinds, each with the same settings and with ' +
    `CODE. Change settings with ${ANIMATION_EDIT_TOOL_NAME} action "set" -- ` +
    'effect, colors (2 to 4, the first is the ground the others move ' +
    'over; #RRGGBB, #RRGGBBAA or colour names), speed, level (a CSS ' +
    "animation's density, a shader's quality), opacity (10-100) and " +
    'blend, ALL of one change in ONE call. To write code, use action ' +
    '"code" with the WHOLE code: it is typed into the animation\'s Edit ' +
    'Code panel and applied once it passes; the code says its kind (a ' +
    'shader has mainImage), and ' +
    'code of the other kind makes the animation that kind with the same ' +
    'colours. A CSS animation (engine css) is a built-in effect or effect ' +
    "custom; its CSS -- its own, or a built-in's written as CSS -- is in " +
    'the CSS Code panel, and code sent for a built-in makes it custom. ' +
    'Its CSS styles boxes the app draws: .scene (the whole picture, its ' +
    'ground var(--color-1), --density 0, 1 or 2); inside it six .layer (full size, --i ' +
    '0..5); inside each layer N .dot (N by density: 6, 12, 20) with --i ' +
    '(its number), --x and --y (0..100, a place) and --r (0..1, a size). ' +
    '.layer and .dot exist only when the CSS names them; a .dot needs ' +
    'its size and place set (left: calc(var(--x) * 1%)). Colours are ' +
    'var(--color-1) .. var(--color-4), and var(--accent): a colour after ' +
    'the ground, the next for each .layer and .dot in turn (also ' +
    'var(--accent-1) .. var(--accent-6)) -- use them so the colour pickers ' +
    'still work; size in cqmin, cqw, cqh or %; write durations as at ' +
    'normal speed (Speed scales them). Not allowed: url(), @import, ' +
    '@font-face, image(), a backslash, "<", :host, any non-ASCII ' +
    'character; @keyframes may animate ONLY transform and opacity ' +
    '(translate, rotate, scale) -- to change a colour, fade a layer that ' +
    'holds it. ' +
    'Shader code (engine glsl, the Shader Code panel) is WebGL 1 (GLSL ' +
    'ES 1.00, loops with constant bounds): write void mainImage(out vec4 ' +
    'fragColor, in vec2 fragCoord); the app declares iResolution (vec3), ' +
    'iTime (float), uColors[4] and uColorCount (the animation’s colours ' +
    '-- use them so the colour pickers still work: groundColor(), ' +
    'colorAt(i), palette(t) vec3, paletteColor(t) and rampColor(t) vec4), ' +
    'lightOver(base, light, amount), hash21, hash22, noise and fbm; ' +
    'fragColor alpha is used. No textures, iChannel, iMouse or #include. ' +
    'Keep either kind light: it runs on old computers -- few loop steps ' +
    'and noise octaves, a few dozen moving boxes. When the answer ' +
    'carries codeError, fix what it names and send the whole code again; ' +
    'after two failed tries, say plainly what is wrong. Explaining code ' +
    'needs no call. Asked HOW to do it themselves, answer with the steps ' +
    'from the guide (owa_help_search) and offer to do it. Off the ' +
    'Presenter page, owa_goto_page presenter.html first. When they ask to ' +
    `undo the last change, call ${ANIMATION_EDIT_TOOL_NAME} action "undo" ` +
    'with the id given under their message. When the tool refuses, read ' +
    'its reason, fix the call and try once more. After a change, say in ' +
    'a sentence or two what changed (only what the answer says changed); ' +
    'when an answer carries an undoId, say in your own words, in the ' +
    'language you answer in, that the button under the answer puts it ' +
    'back. Never write an id or JSON in your answer, and no code unless ' +
    "they ask to see it. End with ONE line 'OPTIONS: a | b | c' -- two or " +
    'three short next changes they might want, on that one line, never as ' +
    'a list.';
