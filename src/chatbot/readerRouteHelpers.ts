import { detectBotFocus } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import { tran } from './chatTranHelpers';
import { BUILTIN_TOOL_NAME, type BotActionType } from './helpBotHelpers';

/**
 * The way back to the Bible Reader, offered under an answer about reading
 * the Bible when the main window is somewhere else (2026-10-13, the user,
 * with a picture of _how can I open bible_ answered with the Presenter's
 * lookup steps: _the elderly user might accidentally changed page to
 * presenter, if user ask question like bible reading open bible or find
 * bible let add extra follow up to let user know they also should change
 * page to reader as well as extra option to open lookup panel_).
 *
 * The answer above it is right for the page they are on -- on the Presenter
 * a Bible is opened through Bible Lookup, to be shown. But somebody who only
 * wants to READ got there by a stray press, and nothing in that answer says
 * so. This says it, and its button is the window's own `/goto reader`: the
 * person's press, which changes the page and leaves the projector alone.
 *
 * In code and not in the prompt: it has to be there under every such answer,
 * whichever assistant wrote it and when none did.
 */

// The pages of the main window that are not the Reader.
const OTHER_MAIN_PAGE_LIST = ['presenter', 'appDocumentEditor'];

const BIBLE_PATTERN =
    /\b(?:bibles?|scriptures?|verses?|passages?|psalms?|gospels?)\b|ព្រះគម្ពីរ|គម្ពីរ/i;
// Reading it, getting to it, finding something in it.
const READING_PATTERN =
    /\b(?:read|reading|open|opening|find|finding|look(?:ing)?\s?up|lookup|search|searching|study|studying|where|go\s+to|get\s+to|see)\b|អាន|បើក|រក|មើល/i;
// For the people in the room: that is the Presenter's own work, and the
// answer about it needs no way out.
const PRESENTING_PATTERN =
    /\b(?:screens?|projectors?|present|presenting|presentation|display|slides?|congregation|audience|live|cast)\b|\bshow(?:ing|s)?\b.*\b(?:on|to)\b|អេក្រង់|បញ្ចាំង/i;

export const READER_ROUTE_COMMAND = '/goto reader';
// Stored English on the button and translated where it is drawn
// (`chatTranLabels.test.ts` holds it to its Khmer and French).
export const READER_ROUTE_LABEL = 'Go to the Bible Reader';
export const READER_ROUTE_TEXT =
    'Only want to read the Bible? The Bible Reader page is made for that. ' +
    `Press ${READER_ROUTE_LABEL} below and the main window changes to it — ` +
    'whatever is on the projector is left as it is.';

// `READER_ROUTE_TEXT` in the window's language, written out so the key gate
// can read it; the test that holds the advice to `READER_ROUTE_TEXT` holds
// the two together.
function genReaderRouteText() {
    return tran(
        'Only want to read the Bible? The Bible Reader page is made for ' +
            'that. Press Go to the Bible Reader below and the main window ' +
            'changes to it — whatever is on the projector is left as it is.',
    );
}

/**
 * The page the main window is on NOW, as the name a tab's _asking about_
 * goes by, off what `owa_app_state` answers -- or null when that says
 * nothing. Asked at the question, because a tab keeps the page it was
 * opened from: the stray press this is all for happens AFTER the help
 * window is up, and a tab opened from the Reader still reads _Bible Reader_
 * with the Presenter in front of the person (seen live 2026-10-13).
 */
export function toMainWindowFocus(appState: any): string | null {
    const page = appState?.mainWindow?.page;
    return typeof page === 'string' ? detectBotFocus(page) : null;
}

// "Open" that describes a window rather than asks to open something: "How do
// I get help with another open window, like a Bible Reader window?" is about
// the help window's own window line, and was answered with that line AND
// "Only want to read the Bible? … Go to the Bible Reader" (2026-10-16).
const OPEN_WINDOW_PATTERN = /\bopen\s+windows?\b/gi;

/** Whether the words are about reading, opening or finding the Bible. */
export function checkIsBibleReadingAsk(asked: string) {
    const words = asked.replace(OPEN_WINDOW_PATTERN, 'window');
    return (
        BIBLE_PATTERN.test(words) &&
        READING_PATTERN.test(words) &&
        !PRESENTING_PATTERN.test(words)
    );
}

const toPlainWords = (text: string) => {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
};

/**
 * Whether the ask IS one of the app's own supported questions, word for
 * word, filed on a page other than the Bible Reader's. Such a question is
 * already known to be about something else: "Where did a Bible I imported
 * come from?" -- a Settings question -- carries a Bible word and "where",
 * and was answered about Bible notes AND "Only want to read the Bible?"
 * (2026-10-16). Only an exact row counts: a sentence typed in the
 * person's own words and matched by a phrase keeps the word test above,
 * which is what an elderly reader's "how can I open bible" is.
 */
// Read in either of the row's wordings: it SHOWS the window's language, and a
// pressed chip asks its English (`textEn`) -- in a Khmer window four of the
// corpus's Bible-source and Bible-audio rows still drew the line (pass 6 of
// the whole list asked in Khmer, 2026-10-17, EC-321).
function checkIsOtherPageRow(asked: string, knownRow: KnownRowType | null) {
    // A `common` row belongs to every window, the Reader's too: _I only want
    // to read the Bible — how do I get back to the Bible Reader?_ is one, and
    // lost its own button once the row was matched by its English (EC-321).
    if (
        knownRow === null ||
        knownRow.page === 'reader' ||
        knownRow.page === 'common'
    ) {
        return false;
    }
    const askedWords = toPlainWords(asked);
    return [knownRow.text, knownRow.textEn].some((text) => {
        return typeof text === 'string' && toPlainWords(text) === askedWords;
    });
}

type KnownRowType = { text: string; textEn?: string; page: string };

/**
 * The sentence and the button, or null: the question is not about reading
 * the Bible, the main window is not on another of its pages (`focus` is
 * the page it is on, `toMainWindowFocus`), the answer already carries
 * that button, or the ask is a supported question filed somewhere else
 * (`knownRow`, the row `findKnownQuestion` matched).
 */
export function genReaderRouteAdvice(
    asked: string,
    focus: string,
    actions: readonly BotActionType[] = [],
    knownRow: KnownRowType | null = null,
): { text: string; action: BotActionType } | null {
    if (
        !OTHER_MAIN_PAGE_LIST.includes(focus) ||
        !checkIsBibleReadingAsk(asked) ||
        checkIsOtherPageRow(asked, knownRow) ||
        actions.some((action) => {
            return (
                action.toolName === BUILTIN_TOOL_NAME &&
                action.args?.command === READER_ROUTE_COMMAND
            );
        })
    ) {
        return null;
    }
    return {
        text: genReaderRouteText(),
        action: {
            label: READER_ROUTE_LABEL,
            toolName: BUILTIN_TOOL_NAME,
            args: { command: READER_ROUTE_COMMAND },
        },
    };
}
