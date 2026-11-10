/**
 * A conversation about one of the user's PRESENTING FLOWS -- the running
 * order of a service -- attached to the tab from a Presenting Flows row's
 * **Open in Chatbot** (2026-11-07, the user, with that row's menu open: _add
 * `Open in Chatbot` … follow what working for appdocument. goal: chatbot can
 * help the presenting flow modification_; the card's buttons and what the
 * assistant may change were the user's choices the same day).
 *
 * The slide document's conversation (`slideChatHelpers.ts`) is the shape: a
 * question asked while a `.owpf` is open in the tab is a `flow` ask. The
 * window reads the sheet as it stands NOW through `owa_presenting_flow_edit
 * lines` and puts it under the question as plain lines (`toFlowAsk`) --
 * never the file's JSON. The ask goes out under its own prompt with that
 * tool, offered to no other question, and a picture or a pasted order of
 * service goes with it. The model names the sheet; the window turns the name
 * into the attached file's path (`resolveFlowEditFile`), so no path ever
 * reaches it or comes from it.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    type LyricAskFileType,
    resolveAttachedDocumentFile,
} from './lyricChatHelpers';
import {
    checkIsSlideFileName,
    findOpenSlideAttachments,
} from './slideChatHelpers';

export const FLOW_ASK_KIND = 'flow';
export const FLOW_EDIT_TOOL_NAME = 'owa_presenting_flow_edit';
/** The panel a presenting flow's row is in, as `owa_find_ui` scopes it. */
export const FLOW_LIST_NAME = 'Presenting Flow List';
// A change or two (each ONE call however many lines), a retry after a
// refusal, a read of a document's slides, and the answer.
export const FLOW_MAX_TOOL_ROUNDS = 8;
/** The most presenting flows one question reads and may change. */
export const MAX_FLOW_ASK_FILES = 2;
// What one sheet may cost the question it rides on: a service of forty
// lines, each with its CCs, is ~6 000 characters.
const MAX_FLOW_SHEET_TEXT_CHARS = 14000;
// What a presenting flow's attachment keeps: a list for the chip and the
// history, never the JSON.
const MAX_FLOW_FILE_TEXT_CHARS = 6000;

const FLOW_FILE_PATTERN = /\.owpf$/i;

/** Whether a file is one of the app's presenting flows, by its name. */
export function checkIsFlowFileName(name: string) {
    return FLOW_FILE_PATTERN.test(String(name ?? '').trim());
}

/** A presenting flow's name as its list shows it: no `.owpf`. */
export function toFlowName(fileName: string) {
    const base =
        String(fileName ?? '')
            .split(/[\\/]/)
            .pop() ?? '';
    return base.replace(FLOW_FILE_PATTERN, '');
}

/** One stored line, as the attachment keeps it. */
function toStoredLineText(entry: any) {
    if (entry?.type === 'action') {
        return `action: ${String(entry?.data ?? '')}`;
    }
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    const kind = String(entry?.type ?? 'line');
    return title === '' ? kind : `${title} [${kind}]`;
}

/**
 * A presenting flow FILE as its attachment keeps it: a line a line, its
 * title and kind. Null when the text is not one.
 */
export function toFlowFileText(fileText: string) {
    let json: any;
    try {
        json = JSON.parse(fileText);
    } catch (_error) {
        return null;
    }
    if (!Array.isArray(json?.items)) {
        return null;
    }
    const lines: string[] = [`Lines: ${json.items.length}`];
    json.items.forEach((entry: any, index: number) => {
        lines.push(`Line ${index + 1}: ${toStoredLineText(entry)}`);
    });
    const text = lines.join('\n');
    return text.length > MAX_FLOW_FILE_TEXT_CHARS
        ? `${text.slice(0, MAX_FLOW_FILE_TEXT_CHARS)}\n[…]`
        : text;
}

export type FlowAskFileType = LyricAskFileType;

/**
 * The presenting flows among a tab's open files -- each a file from disk
 * with its path, once, the first `MAX_FLOW_ASK_FILES`.
 */
export function findFlowAskFiles(
    attachments: readonly ChatAttachmentType[],
): FlowAskFileType[] {
    const out: FlowAskFileType[] = [];
    for (const attachment of attachments) {
        const filePath = attachment.filePath;
        if (
            typeof filePath !== 'string' ||
            !checkIsFlowFileName(filePath) ||
            out.some((one) => {
                return one.filePath === filePath;
            })
        ) {
            continue;
        }
        out.push({ name: toFlowName(filePath), filePath });
    }
    return out.slice(0, MAX_FLOW_ASK_FILES);
}

/**
 * The presenting flows a tab is still about, however many files came after
 * -- a picture of the bulletin attached under the flow's card must not close
 * the flow it was attached to build (`findOpenSlideAttachments`' rule).
 */
export function findOpenFlowAttachments(
    messages: Parameters<typeof findOpenSlideAttachments>[0],
    closedAfterId?: number,
): ChatAttachmentType[] {
    return findOpenSlideAttachments(
        messages,
        closedAfterId,
        checkIsFlowFileName,
    );
}

/**
 * Which document a tab is about NOW when it has had both: the kind the
 * latest question with a slide document or a presenting flow attached
 * carried -- a flow handed over into a tab that was changing slides must
 * not leave the slides open to its questions. Null when it has had
 * neither since its files were closed.
 */
export function pickOpenDocumentKind(
    messages: Parameters<typeof findOpenSlideAttachments>[0],
    closedAfterId?: number,
): 'flow' | 'slide' | null {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            return null;
        }
        if (message.author !== 'you') {
            continue;
        }
        let kind: 'flow' | 'slide' | null = null;
        for (const attachment of message.attachments ?? []) {
            const filePath = attachment.filePath ?? '';
            if (checkIsFlowFileName(filePath)) {
                kind = 'flow';
            } else if (kind === null && checkIsSlideFileName(filePath)) {
                kind = 'slide';
            }
        }
        if (kind !== null) {
            return kind;
        }
    }
    return null;
}

/**
 * What a model's `file` turns into: the attached flow's own path, a flow
 * of the Presenting Flows folder by its name, or a `reason`.
 */
export function resolveFlowEditFile(
    file: unknown,
    files: readonly FlowAskFileType[],
) {
    return resolveAttachedDocumentFile(
        file,
        files,
        toFlowName,
        'presenting flow',
    );
}

function toShownValue(value: unknown) {
    return typeof value === 'string' ? value : JSON.stringify(value);
}

function toCcText(cc: any) {
    const facts = [
        cc?.follows === null || cc?.follows === undefined
            ? 'its element is a line that is gone'
            : // "line 9" alone was read as where it goes (EC-474: a
              // check called four timed songs broken, each "skipping to
              // line 9").
              `its element is line ${cc.follows}, run with this line -- ` +
              `not a jump to line ${cc.follows}`,
        Array.isArray(cc?.screenIds)
            ? `screen ${cc.screenIds.join(', ')}`
            : null,
        cc?.seconds === undefined ? null : `${cc.seconds} seconds`,
        cc?.time === undefined ? null : `at ${cc.time}`,
        cc?.mediaControl === undefined
            ? null
            : `media ${toShownValue(cc.mediaControl)}`,
    ].filter(Boolean);
    return `${cc?.n}. "${cc?.title ?? ''}" (${facts.join(', ')})`;
}

/** One line of the sheet as the model reads it. */
function toSheetLineText(line: any) {
    const facts = [
        line?.kind,
        line?.document === undefined ? null : `document "${line.document}"`,
        line?.isParked === true ? 'parked' : null,
        line?.seconds === undefined ? null : `${line.seconds} seconds`,
        line?.time === undefined ? null : `at ${line.time}`,
        line?.key === undefined ? null : `key ${line.key}`,
        line?.goesTo === undefined ? null : `goes to line ${line.goesTo}`,
        Array.isArray(line?.ccOf)
            ? `the element of the CC on line ${line.ccOf.join(', ')} -- needed, keep it`
            : null,
        line?.color === undefined ? null : `color ${line.color}`,
        Array.isArray(line?.screenIds)
            ? `pinned to screen ${line.screenIds.join(', ')}`
            : null,
    ].filter(Boolean);
    const out = [
        `Line ${line?.n}: "${line?.title ?? ''}" (${facts.join('; ')})`,
    ];
    if (Array.isArray(line?.cc) && line.cc.length > 0) {
        out.push(
            `  CC (shown with this line): ${line.cc
                .map((cc: any) => {
                    return toCcText(cc);
                })
                .join('; ')}`,
        );
    }
    const slides = line?.slides;
    if (slides !== null && typeof slides === 'object') {
        const slideFacts = [
            `${slides.count} slides`,
            Array.isArray(slides.parked)
                ? `parked slides ${slides.parked.join(', ')}`
                : null,
            Array.isArray(slides.pinned)
                ? slides.pinned
                      .map((one: any) => {
                          return `slide ${one.slide} on screen ${one.screenIds?.join(', ')}`;
                      })
                      .join(', ')
                : null,
        ].filter(Boolean);
        out.push(`  Slides: ${slideFacts.join('; ')}`);
        if (Array.isArray(slides.cc)) {
            for (const one of slides.cc) {
                out.push(
                    `  Slide ${one.slide} CC: ${(one.cc ?? [])
                        .map((cc: any) => {
                            return toCcText(cc);
                        })
                        .join('; ')}`,
                );
            }
        }
        if (Array.isArray(slides.list)) {
            out.push(`  Slide list: ${slides.list.join(' | ')}`);
        }
    }
    if (Array.isArray(line?.problems) && line.problems.length > 0) {
        out.push(`  PROBLEM: ${line.problems.join('; ')}`);
    }
    return out;
}

/** The `lines` answer as plain lines -- what the model is shown. */
export function toFlowSheetText(described: any) {
    if (described === null || typeof described !== 'object') {
        return null;
    }
    const lines: any[] = Array.isArray(described.lines) ? described.lines : [];
    const screens = Array.isArray(described.screens) ? described.screens : [];
    const out = [
        `Lines: ${described.count ?? lines.length}` +
            (screens.length > 0 ? ` · screens: ${screens.join(', ')}` : ''),
    ];
    if (lines.length === 0) {
        out.push('(no lines yet)');
    }
    for (const line of lines) {
        out.push(...toSheetLineText(line));
    }
    if (described.isTruncated === true) {
        out.push('… more lines than shown');
    }
    if (Array.isArray(described.documentChoices)) {
        out.push(
            '',
            `Documents: ${
                described.documentChoices.length === 0
                    ? '(none)'
                    : described.documentChoices
                          .map((one: string) => {
                              return `"${one}"`;
                          })
                          .join(', ')
            }` +
                (described.isDocumentChoicesTruncated === true
                    ? ', and more'
                    : ''),
        );
    }
    if (Array.isArray(described.actions)) {
        out.push('', `Actions: ${described.actions.join(' · ')}`);
    }
    if (Array.isArray(described.foregroundWidgets)) {
        out.push(
            '',
            `Foreground widgets: ${described.foregroundWidgets.join(' · ')}`,
        );
    }
    const text = out.join('\n').trim();
    return text.length > MAX_FLOW_SHEET_TEXT_CHARS
        ? `${text.slice(0, MAX_FLOW_SHEET_TEXT_CHARS)}\n[... the rest was not included]`
        : text;
}

// --- the card ----------------------------------------------------------------

/** The card's buttons, as stored and asked: the English the window reads. */
export const FLOW_CHECK_ASK = 'Check the running order';
export const FLOW_BUILD_ASK = 'Build it from my order of service';
export const FLOW_CLEAR_ASK = 'Clear the screen between items';
export const FLOW_AUTO_NEXT_ASK = 'Move on by itself';

// Said to the model under a pressed button, so the job is never its guess.
// The check names a CC's element as no fault (2026-11-10, EC-474: a sheet
// of four timed songs was reported "skipping to line 9", then "redundant").
const FLOW_BUTTON_HINT_MAP: Record<string, string> = {
    [FLOW_CHECK_ASK]:
        "(Check it: read every line's PROBLEM first, then what looks out of " +
        'place for a service -- a song right after a passage with no clear ' +
        'between them, a Next: Timeout with nothing after it that no CC ' +
        'names, a Jump to with ' +
        'no target, a document parked by mistake. A CC and the line it ' +
        'names as its element are how a CC works -- that line is needed, ' +
        'never a problem, a duplicate or a jump. Report only what is ' +
        'wrong; when nothing is, say the running order looks ready. ' +
        'Change NOTHING yet: say what you found in a short list, and end ' +
        'with one line that starts OPTIONS: and names each fix in a few ' +
        'words, the fixes separated by |.)',
    [FLOW_BUILD_ASK]:
        '(Build the running order from their order of service. When their ' +
        'message, a pasted list or an attached picture of a bulletin gives ' +
        'it, add the items in ONE update-lines call, in order, at the end: ' +
        'a song or slide document by the closest name in Documents, a Bible ' +
        'passage as a `reference`, a welcome countdown as a foreground ' +
        'countdown, announcements as a foreground message. An item whose ' +
        'document is NOT in the Documents list is LEFT OUT of the call -- ' +
        'never add a name the list does not have, or the whole call is ' +
        'refused. Then say which items had no document to match. ' +
        'When nothing gives the order yet, ask them to paste it or attach a ' +
        'picture of it, and end with NEEDS: file.)',
    [FLOW_CLEAR_ASK]:
        '(Put a clear-all action after every document, passage and slide ' +
        'line that has no clear right after it already -- ONE update-lines ' +
        'call, each add with `after` that line. Change nothing else.)',
    [FLOW_AUTO_NEXT_ASK]:
        '(Make it move on by itself: on every song and slide document line, ' +
        'attach a Next: Timeout as a CC -- `cc: {add: {actionId: ' +
        '"next-timeout", seconds}}` -- so each of its slides goes on to the ' +
        'next by itself. A line that already has a Next: Timeout CC gets ' +
        'THAT one changed -- `cc: {index, seconds}` -- never a second one. ' +
        'When they have not said how many seconds a slide ' +
        'stays, ask first and end with OPTIONS: 5 seconds | 8 seconds | 10 ' +
        'seconds. Then ONE update-lines call.)',
};

/** The hint of a pressed (or typed) card button -- English or translated. */
export function readFlowButtonHint(asked: string) {
    const text = String(asked ?? '').trim();
    // The button's words, or a message that STARTS with them -- _Build it
    // from my order of service:_ and the order pasted under it had gone out
    // with no hint at all (seen live).
    const checkIsLed = (label: string) => {
        return (
            text === label ||
            (text.startsWith(label) &&
                !/[\p{L}\p{N}]/u.test(text.charAt(label.length)))
        );
    };
    for (const [label, hint] of Object.entries(FLOW_BUTTON_HINT_MAP)) {
        if (checkIsLed(label) || checkIsLed(tran(label))) {
            return hint;
        }
    }
    return null;
}

// Sent with nothing typed -- a picture of the bulletin dropped on the box and
// Send pressed, the way a person shows what they want.
export const FLOW_WORDLESS_HINT =
    '(They sent this with no words of their own. A picture or a list ' +
    'attached here is their order of service: build the running order ' +
    'from it now, in one update-lines call. With nothing attached, say in a ' +
    'sentence what you can change and end with OPTIONS.)';

/**
 * The question as the model is asked it: the hint of a pressed button,
 * what they typed, then each attached flow as it reads now, named as `file`
 * takes it.
 */
export function toFlowAsk(
    asked: string,
    docs: readonly { name: string; text: string | null }[],
    isWordless = false,
) {
    const hint = readFlowButtonHint(asked);
    const shown = docs.map((doc) => {
        return (
            `(The presenting flow "${doc.name}" is attached. Change it with ` +
            `${FLOW_EDIT_TOOL_NAME}, file "${doc.name}". It reads now:\n` +
            `${doc.text ?? `(it could not be read just now; call ${FLOW_EDIT_TOOL_NAME} with action "lines")`})`
        );
    });
    return [
        ...(isWordless ? [FLOW_WORDLESS_HINT] : []),
        asked,
        ...(hint === null ? [] : [hint]),
        ...shown,
    ].join('\n\n');
}

/**
 * The system prompt of such a conversation: what the tool takes, one call
 * for many lines, and what a running order is made of.
 */
export const FLOW_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer change a PRESENTING FLOW -- ' +
    'the running order of a service, which the operator steps through on ' +
    'Sunday. Each attached flow is given under their message as it reads ' +
    'now: every line with its number, title and kind, how it is armed, its ' +
    'color and screens, its CC elements (lines that ride along with it), ' +
    'its problems; then the Documents they can add by name, the actions and ' +
    'the foreground widgets there are. Change it with ' +
    `${FLOW_EDIT_TOOL_NAME}, naming the flow in \`file\` exactly as it is ` +
    'given. Make the change asked for in ONE update-lines call where one ' +
    'call can do it, every line named by its number AS GIVEN -- never ' +
    'renumber after an add or a move. A line is: a document (a song or slide ' +
    'document, by its name in Documents -- never a name that is not ' +
    'listed; say which items could not be found), a Bible passage ' +
    '(`reference`), an action (`actionId`: a clear takes the screen down, ' +
    'Screen: Show/Hide needs screenIds, Next: Timeout waits `seconds` or ' +
    'until a `time` "HH:mm" then goes on, Next: Interval keeps going on every ' +
    'N seconds, Jump to goes back to its `target` line, Keyboard Event fires ' +
    'its CCs on a `key`), or a foreground line (`foreground` {widget, …}: a ' +
    'countdown before the service, a clock, a message, a marquee, a quick ' +
    'text). A CC element rides along when its line is shown: attach one ' +
    'with cc {add:{line}} or cc {add:{actionId, seconds}}; a Next: Timeout ' +
    'CC on a song makes every slide of it go on by itself. A CC points at ' +
    'its ELEMENT, another line of the flow: a Next: Timeout line that CCs ' +
    'point at is that element and is needed -- never call it a duplicate ' +
    'or remove it while a CC follows it. Slide numbers ' +
    "come from `lines` with `line`. Colors are the color menu's names. When " +
    'a request has one sensible reading, do it rather than ask: every change ' +
    'can be undone. Remove only lines they named (remove-lines). Never make ' +
    'up a song, a sermon or a verse. When the tool refuses, read its reason, ' +
    'fix the call and try once more; then say plainly what went wrong. ' +
    'After a change, say in a sentence or two what changed, that it is kept ' +
    'at once (a presenting flow has no Save), and that Undo this change puts ' +
    'it back. Never write the lines or any JSON out in your answer. End with ' +
    "ONE line 'OPTIONS: a | b | c' -- two or three short next changes " +
    'they might want, on that one line, never as a list.';

/**
 * The card a presenting flow opens under in the help window, written with no
 * model: that it is attached, what can be done to it, and the four jobs asked
 * for most as buttons. Every button is a question pressed, answered by the
 * assistant with `owa_presenting_flow_edit`.
 */
export function genFlowOpeningAnswer(fileName: string) {
    const name = toFlowName(fileName);
    return {
        text: fillWords(
            tran(
                '“{name}” is attached below. I can change this presenting ' +
                    'flow for you: add songs, slide documents, Bible ' +
                    'passages, actions and countdowns by name; remove, move, ' +
                    'copy or park lines; set timers, shortcuts, colors and ' +
                    'screens; and attach CC elements. Paste your order of ' +
                    'service or send a picture of it, and I will build the ' +
                    'flow from it. Press one, or say what you want.',
            ),
            { name },
        ),
        // Written out, not the constants above: the key coverage test reads
        // only a literal (`tranKeyCoverage.test.ts`).
        replies: [
            tran('Check the running order'),
            tran('Build it from my order of service'),
            tran('Clear the screen between items'),
            tran('Move on by itself'),
        ],
    };
}
