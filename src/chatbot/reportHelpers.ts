// Reporting a problem from inside the app.
//
// The volunteer who hits a bug mid-service is the one person who can say what
// happened and the last person with the time to write it down: they are
// standing at a machine in a hall, the band is playing, and the bug report
// that would actually help a maintainer -- what was on screen, which window,
// which build, what the console said -- is exactly the part they cannot
// produce. So the assistant produces it. **Report** takes what they said,
// looks at the running app itself, and writes the report for them.
//
// Three steps, in this order, and the order is the point:
//
//   1. INVESTIGATE. The model is asked to look at the app with its own tools
//      before it writes anything, so the report says what is wrong and not
//      only what it felt like.
//   2. COLLECT. The window gathers the evidence a model should not be trusted
//      to transcribe -- the build, the window, the console, the screens, the
//      picture -- as facts rather than as recollection.
//   3. PREPARE. The two are written up as one document and shown to the user,
//      who presses Send. Nothing leaves this machine before that press.
//
// There is NO issue tracker endpoint yet. `postIssueReport` is the seam where
// one goes, and until there is one it is honest about it: it saves the report
// where the user can find it and says plainly that nothing was sent. A window
// that told a volunteer their problem had been filed with someone, when it had
// not, would be worse than having no button at all.

import appProvider from '../server/appProvider';
import {
    fsWriteFileSync,
    getDownloadPath,
    pathJoin,
    writeFileFromBase64Sync,
} from '../server/fileHelpers';
import { appError } from '../helper/loggerHelpers';
import { callTool, parseToolJson } from './mcpClient';
import type { ChatTurnType } from './helpBotHelpers';

/**
 * What the window found out for itself, as opposed to what the model made of
 * it. Every field is a short line meant to be read in a report -- this is
 * evidence, not a state dump: `owa_app_state` also carries the user's data
 * directory (their account name is in that path) and forty component names,
 * and neither belongs in a document they are about to hand to a stranger.
 */
export type ReportEvidenceType = {
    collectedAt: string;
    appLine: string;
    windowLine: string;
    screenLine: string;
    consoleLines: string[];
    turns: ChatTurnType[];
};

export type PreparedReportType = {
    reference: string;
    title: string;
    // What the user is shown in the transcript: the model's own account,
    // already stripped of the frame it was written in.
    summary: string;
    markdown: string;
    evidence: ReportEvidenceType;
    // The picture of the app taken when Report was pressed, as a data URL.
    // Held here for as long as the report is, and never written to the
    // sessions file -- the same rule attachments follow.
    imageDataUrl: string | null;
};

export type PostedReportType = {
    reference: string;
    isSent: boolean;
    filePath: string | null;
    imageFilePath: string | null;
    failure: string | null;
};

/** The pseudo tool name the Send button carries. Never sent to a model. */
export const REPORT_SEND_TOOL_NAME = 'owa-report-send';

// The frame the model writes the report in. Same shape as `OPTIONS:` and
// `SHOWS:` -- a marker at the start of a line, parsed off, never shown -- and
// for the same reason: a small model told merely to "be structured" writes a
// different structure every time, and the report has to be one document.
const REPORT_MARKER = /^[ \t]*REPORT:[ \t]*/im;
const FIELD_PATTERN =
    /^[ \t]*(TITLE|WHAT HAPPENED|STEPS|EXPECTED|SUSPECT):[ \t]*/i;

const MAX_CONSOLE_LINES = 12;
const MAX_REPORT_TURNS = 8;
const MAX_CONSOLE_LINE_LENGTH = 300;
const MAX_TITLE_LENGTH = 90;
// A report is a document, not an answer: it may run long. But it is written by
// a model, saved to disk and shown in a 460px window, so it is not unbounded.
const MAX_FIELD_LENGTH = 1500;

/**
 * What the model is told to do. It is machine instruction and the user never
 * sees it -- `handleReporting` sends it with `shownText` set to the user's own
 * words.
 *
 * The tools it names are named on purpose. Told only to "investigate", a small
 * model writes the report from the complaint alone in one round, which is the
 * report the user could have written themselves.
 */
export function genReportInvestigation(
    complaint: string,
    evidence: ReportEvidenceType,
) {
    return [
        'The user is REPORTING A PROBLEM with this app, not asking how to do',
        'something. Do not tell them how to work around it and do not open a',
        'walkthrough.',
        '',
        'What they said is:',
        complaint,
        '',
        'What the window has already collected:',
        `- ${evidence.appLine}`,
        `- ${evidence.windowLine}`,
        `- ${evidence.screenLine}`,
        evidence.consoleLines.length === 0
            ? '- Console: nothing was logged'
            : `- Console:\n${evidence.consoleLines
                  .map((line) => {
                      return `  ${line}`;
                  })
                  .join('\n')}`,
        '',
        'INVESTIGATE FIRST. Look at the app before you write anything:',
        '`owa_app_state` for where they are, `owa_list_ui` or `owa_find_ui`',
        'for the control they mean, `list_console_messages` for errors,',
        '`owa_list_screens` when it is about a projector. A picture of the',
        'app is already attached. Use the manual (`owa_help_search`)',
        'to check whether what they describe is how the app is meant to',
        'behave -- a report saying "this is by design" is worth as much as',
        'one saying it is broken.',
        '',
        'Then answer in two parts. FIRST, two or three plain sentences for',
        'the user saying what you found -- no ids, no file paths, no tool',
        'names. THEN the report, each field on its own line:',
        '',
        'REPORT:',
        'TITLE: one line a maintainer can read in a list',
        'WHAT HAPPENED: what is actually wrong, in your words, with what you',
        'saw in the app that shows it',
        'STEPS: how to make it happen again, numbered',
        'EXPECTED: what should have happened instead',
        'SUSPECT: the part of the app you think is at fault, or "unknown"',
    ].join('\n');
}

function toCleanLine(text: string, max: number) {
    return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Splits the model's answer into the half the user reads and the half the
 * report is built from. A model that wrote no frame at all is not an error --
 * its whole answer becomes the account, and the report still goes out with the
 * evidence, which is the half a maintainer cannot get any other way.
 */
export function parseReportDraft(text: string): {
    summary: string;
    title: string;
    fields: Record<string, string>;
} {
    const matched = REPORT_MARKER.exec(text);
    if (matched === null) {
        return { summary: text.trim(), title: '', fields: {} };
    }
    const summary = text.slice(0, matched.index).trim();
    const fields: Record<string, string> = {};
    let current: string | null = null;
    for (const line of text
        .slice(matched.index + matched[0].length)
        .split('\n')) {
        const field = FIELD_PATTERN.exec(line);
        if (field !== null) {
            current = field[1].toUpperCase();
            fields[current] = line.slice(field[0].length).trim();
            continue;
        }
        if (current !== null && line.trim().length > 0) {
            // A wrapped field -- a numbered STEPS list is the usual one.
            fields[current] = `${fields[current]}\n${line.trim()}`.slice(
                0,
                MAX_FIELD_LENGTH,
            );
        }
    }
    return {
        summary,
        title: toCleanLine(fields.TITLE ?? '', MAX_TITLE_LENGTH),
        fields,
    };
}

function genReference() {
    const now = new Date();
    const stamp = [
        now.getFullYear().toString().slice(2),
        (now.getMonth() + 1).toString().padStart(2, '0'),
        now.getDate().toString().padStart(2, '0'),
    ].join('');
    const salt = Math.random().toString(16).slice(2, 6);
    return `OWA-${stamp}-${salt}`;
}

function genAppLine() {
    const { appInfo, systemUtils } = appProvider;
    const platform = systemUtils.isWindows
        ? 'Windows'
        : systemUtils.isMac
          ? 'macOS'
          : systemUtils.isLinux
            ? 'Linux'
            : 'unknown OS';
    const commit =
        systemUtils.commitHash === undefined
            ? ''
            : `, commit ${systemUtils.commitHash.slice(0, 8)}`;
    return (
        `${appInfo.title} ${appInfo.version} on ${platform} ` +
        `(${systemUtils.isDev ? 'dev' : 'packaged'} build${commit})`
    );
}

async function readWindowLine(signal?: AbortSignal | null) {
    try {
        const state = parseToolJson(
            await callTool('owa_app_state', {}, signal),
        );
        const main = state?.mainWindow;
        if (main === undefined || main === null) {
            return 'Window: could not be read';
        }
        // Deliberately NOT the whole payload: `instances` carries the user's
        // data directory, which has their account name in it, and the
        // component list is forty dev-only names nobody reading a report
        // needs.
        return (
            `Window: ${main.title ?? 'unknown'} (${main.page ?? 'unknown page'}), ` +
            `language ${main.language ?? 'unknown'}, ` +
            `theme ${main.theme ?? 'unknown'}`
        );
    } catch (error: any) {
        return `Window: could not be read (${error.message})`;
    }
}

async function readScreenLine(signal?: AbortSignal | null) {
    try {
        const screens = parseToolJson(
            await callTool('owa_list_screens', {}, signal),
        );
        // `displays` is a flat list of the displays a screen can be put on --
        // it used to be Electron's own answer, an object carrying
        // `primaryDisplay` AND a `displays` array, and read as a list it had
        // no `length`, which is how the first report this wrote came back
        // saying the screens could not be read at all.
        const showing: unknown[] = Array.isArray(screens?.showingScreenIds)
            ? screens.showingScreenIds
            : [];
        const displayList: unknown[] = Array.isArray(screens?.displays)
            ? screens.displays
            : [];
        const displayCount = displayList.length.toString();
        return showing.length === 0
            ? `Screens: none showing, ${displayCount} display(s) attached`
            : `Screens: ${showing.join(', ')} showing, ` +
                  `${displayCount} display(s) attached`;
    } catch (error: any) {
        return `Screens: could not be read (${error.message})`;
    }
}

async function readConsoleLines(signal?: AbortSignal | null) {
    try {
        // Annotated on the way in: `callTool` answers `any`, and an untyped
        // `split` spreads that through every line below it.
        const text: string = await callTool(
            'list_console_messages',
            {},
            signal,
        );
        return text
            .split('\n')
            .filter((line) => {
                return /error|warn|exception|failed/i.test(line);
            })
            .slice(-MAX_CONSOLE_LINES)
            .map((line) => {
                return toCleanLine(line, MAX_CONSOLE_LINE_LENGTH);
            });
    } catch (_error) {
        // A console that cannot be read is not a reason to lose the report.
        return [];
    }
}

/**
 * The facts, gathered from the app itself. Every reader is wrapped on its own:
 * a machine with no CDP endpoint (AI features off) must still be able to send
 * a report, it just sends one with less in it.
 */
export async function collectReportEvidence(
    turns: ChatTurnType[],
    signal?: AbortSignal | null,
): Promise<ReportEvidenceType> {
    const [windowLine, screenLine, consoleLines] = await Promise.all([
        readWindowLine(signal),
        readScreenLine(signal),
        readConsoleLines(signal),
    ]);
    return {
        collectedAt: new Date().toISOString(),
        appLine: genAppLine(),
        windowLine,
        screenLine,
        consoleLines,
        // The END of the conversation, not all of it. A tab holds sixty
        // messages and this window gets left open through a service, so the
        // whole thing is a wall of last Sunday under a report about today --
        // measured: the first report this wrote carried ten turns about
        // showing and hiding a screen for a complaint about the projector.
        turns: turns.slice(-MAX_REPORT_TURNS),
    };
}

function genSection(heading: string, body: string) {
    return body.trim().length === 0
        ? ''
        : `\n## ${heading}\n\n${body.trim()}\n`;
}

export function genReportMarkdown({
    reference,
    title,
    complaint,
    summary,
    fields,
    evidence,
    hasImage,
}: {
    reference: string;
    title: string;
    complaint: string;
    summary: string;
    fields: Record<string, string>;
    evidence: ReportEvidenceType;
    hasImage: boolean;
}) {
    const conversation = evidence.turns
        .map((turn) => {
            return `**${turn.author === 'you' ? 'User' : 'Assistant'}:** ${turn.text}`;
        })
        .join('\n\n');
    return (
        `# ${title}\n\n` +
        `Reference: \`${reference}\`  \n` +
        `Written by the in-app assistant at ${evidence.collectedAt}\n` +
        genSection('What the user reported', complaint) +
        genSection('What the assistant found', summary) +
        genSection('What happened', fields['WHAT HAPPENED'] ?? '') +
        genSection('Steps to reproduce', fields.STEPS ?? '') +
        genSection('Expected', fields.EXPECTED ?? '') +
        genSection('Suspected area', fields.SUSPECT ?? '') +
        genSection(
            'App',
            [
                `- ${evidence.appLine}`,
                `- ${evidence.windowLine}`,
                `- ${evidence.screenLine}`,
            ].join('\n'),
        ) +
        genSection(
            'Console',
            evidence.consoleLines.length === 0
                ? 'Nothing was logged.'
                : '```\n' + evidence.consoleLines.join('\n') + '\n```',
        ) +
        genSection('Conversation', conversation) +
        genSection(
            'Attached',
            hasImage
                ? `- \`${reference}.png\` — the app when this was reported`
                : '',
        )
    );
}

export function genPreparedReport({
    complaint,
    answerText,
    evidence,
    imageDataUrl,
}: {
    complaint: string;
    answerText: string;
    evidence: ReportEvidenceType;
    imageDataUrl: string | null;
}): PreparedReportType {
    const reference = genReference();
    const { summary, title, fields } = parseReportDraft(answerText);
    // A report with no title is a row in a list nobody opens. The user's own
    // first line is a better one than anything this window could invent.
    const finalTitle =
        title.length > 0 ? title : toCleanLine(complaint, MAX_TITLE_LENGTH);
    return {
        reference,
        title: finalTitle,
        summary,
        markdown: genReportMarkdown({
            reference,
            title: finalTitle,
            complaint,
            summary,
            fields,
            evidence,
            hasImage: imageDataUrl !== null,
        }),
        evidence,
        imageDataUrl,
    };
}

// Prepared reports, waiting on the press that sends them. In memory only and
// bounded, exactly like the attachment bytes: `chatbot-sessions` is read whole
// and synchronously at startup, so a document with a screenshot in it must
// never reach that file. What the SESSION keeps is the reference on the
// button; a window that has been closed and reopened finds nothing here and
// says so rather than sending an empty report.
const preparedReportMap = new Map<string, PreparedReportType>();
const MAX_PREPARED_REPORTS = 3;

export function keepPreparedReport(report: PreparedReportType) {
    preparedReportMap.set(report.reference, report);
    while (preparedReportMap.size > MAX_PREPARED_REPORTS) {
        const oldest = preparedReportMap.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        preparedReportMap.delete(oldest);
    }
}

export function takePreparedReport(reference: string) {
    return preparedReportMap.get(reference) ?? null;
}

// THE SEAM. There is no issue tracker for this app yet; when there is one, its
// URL goes here and the branch below starts doing something. Everything else
// in this file is written as though it already existed, which is the point --
// the day the endpoint arrives, nothing but this constant changes.
const ISSUE_TRACKER_ENDPOINT: string | null = null;

function toBase64Payload(dataUrl: string) {
    const comma = dataUrl.indexOf(',');
    return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/**
 * Sends the report -- or, while there is nowhere to send it, saves it where the
 * user can get at it and says so. The file is written either way: an endpoint
 * that answered 500 in a church hall with bad wifi must not be the reason the
 * only account of the bug is lost.
 */
/**
 * The report as two files beside each other in the user's Downloads folder,
 * named after the reference so the picture and the document are obviously one
 * thing. Written before anything is sent, and kept whatever the sending does.
 */
function saveReportFiles(report: PreparedReportType) {
    const dirPath = getDownloadPath();
    const filePath = pathJoin(dirPath, `${report.reference}.md`);
    fsWriteFileSync(filePath, report.markdown);
    if (report.imageDataUrl === null) {
        return { filePath, imageFilePath: null };
    }
    const imageFilePath = pathJoin(dirPath, `${report.reference}.png`);
    writeFileFromBase64Sync(
        imageFilePath,
        toBase64Payload(report.imageDataUrl),
    );
    return { filePath, imageFilePath };
}

export async function postIssueReport(
    report: PreparedReportType,
    signal?: AbortSignal | null,
): Promise<PostedReportType> {
    let saved: { filePath: string; imageFilePath: string | null };
    try {
        saved = saveReportFiles(report);
    } catch (error: any) {
        appError(error);
        return {
            reference: report.reference,
            isSent: false,
            filePath: null,
            imageFilePath: null,
            failure: `I could not save the report: ${error.message}`,
        };
    }
    if (ISSUE_TRACKER_ENDPOINT === null) {
        return {
            reference: report.reference,
            isSent: false,
            ...saved,
            failure: null,
        };
    }
    try {
        const response = await fetch(ISSUE_TRACKER_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                reference: report.reference,
                title: report.title,
                body: report.markdown,
                app: report.evidence.appLine,
            }),
            signal: signal ?? undefined,
        });
        if (!response.ok) {
            throw new Error(
                `the tracker answered ${response.status.toString()}`,
            );
        }
        return {
            reference: report.reference,
            isSent: true,
            ...saved,
            failure: null,
        };
    } catch (error: any) {
        return {
            reference: report.reference,
            isSent: false,
            ...saved,
            failure: `I could not send it: ${error.message}`,
        };
    }
}
