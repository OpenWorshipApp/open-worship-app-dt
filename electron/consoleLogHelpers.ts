import { app, type WebContents } from 'electron';

/**
 * The last few errors and warnings each window logged, kept in the main
 * process for the one reader that needs them: a problem report
 * (`main:app:recent-console`, `src/chatbot/reportHelpers.ts`).
 *
 * A report promises _the app's console log (its recent errors and
 * warnings)_, and for weeks carried none: it asked the tool host for them
 * with `list_console_messages`, which since `chrome-devtools-mcp` 1.8 refuses
 * a call that names no page -- and the help window named none, so every
 * report said _Nothing was logged_ (found 2026-10-13 in the first report a
 * person sent, about an uncaught error). That tool could not have had the
 * line anyway when the help window is opened BY the error: it hears a page
 * only from the moment its session starts. Here the window is heard from the
 * moment it exists, reloads included.
 *
 * Small and bounded on purpose -- this is memory held for the life of a
 * window on a machine with none to spare: forty lines a window, five hundred
 * characters a line, let go with the window.
 */

const MAX_LINES = 40;
const MAX_LINE_LENGTH = 500;
// Electron's own banner about how a development window is set up, printed
// twice at every load. It is not something that went wrong, and in the
// first report that carried a console it was thirteen of the sixteen lines.
const NOISE_PATTERN = /^%cElectron Security Warning/;

const lineMap = new Map<number, string[]>();

// Electron has told a console line two ways: the level as a number among
// the listener's arguments, and as a word on the event.
function toLevelName(level: unknown) {
    if (level === 3 || level === 'error') {
        return 'error';
    }
    if (level === 2 || level === 'warning') {
        return 'warning';
    }
    return null;
}

/**
 * One console line as a report quotes it, or null for a line it does not
 * keep (a log, an info). The source is its file's NAME and line: a whole
 * address names where the app is installed.
 */
export function toConsoleLine(
    level: unknown,
    message: unknown,
    lineNumber?: unknown,
    sourceId?: unknown,
) {
    const levelName = toLevelName(level);
    if (levelName === null) {
        return null;
    }
    const text = String(message ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_LINE_LENGTH);
    if (text.length === 0 || NOISE_PATTERN.test(text)) {
        return null;
    }
    const fileName =
        typeof sourceId === 'string'
            ? (sourceId.split(/[?#]/)[0].split(/[\\/]/).pop() ?? '')
            : '';
    const where =
        fileName.length === 0
            ? ''
            : ` (${fileName}${typeof lineNumber === 'number' && lineNumber > 0 ? `:${lineNumber.toString()}` : ''})`;
    return `${levelName}: ${text}${where}`;
}

function watchConsole(contents: WebContents) {
    // The app's own windows only: a `<webview>` is a stranger's page.
    if (contents.getType() !== 'window') {
        return;
    }
    const { id } = contents;
    contents.on('console-message', (event: any, ...rest: any[]) => {
        const line =
            typeof rest[0] === 'number'
                ? toConsoleLine(rest[0], rest[1], rest[2], rest[3])
                : toConsoleLine(
                      event?.level,
                      event?.message,
                      event?.lineNumber,
                      event?.sourceId,
                  );
        if (line === null) {
            return;
        }
        const lines = lineMap.get(id) ?? [];
        // The same line again -- an error thrown on every frame, or at
        // every reload -- is one line, not forty: it moves to the end,
        // where the newest is.
        const seenAt = lines.indexOf(line);
        if (seenAt !== -1) {
            lines.splice(seenAt, 1);
        }
        lines.push(line);
        if (lines.length > MAX_LINES) {
            lines.splice(0, lines.length - MAX_LINES);
        }
        lineMap.set(id, lines);
    });
    contents.once('destroyed', () => {
        lineMap.delete(id);
    });
}

/** Starts listening to every window made from here on. Called once. */
export function initConsoleLog() {
    app.on('web-contents-created', (_event, contents) => {
        watchConsole(contents);
    });
}

/** What a window has logged as an error or a warning, oldest first. */
export function getRecentConsoleLines(
    contents: WebContents | null | undefined,
) {
    if (contents === null || contents === undefined || contents.isDestroyed()) {
        return [];
    }
    return [...(lineMap.get(contents.id) ?? [])];
}

/** Tests only. */
export function resetConsoleLogForTests() {
    lineMap.clear();
}
