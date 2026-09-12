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
//      to transcribe -- the build, the machine, the window, what is selected,
//      the console, the screens and what each one holds, the picture -- as
//      facts rather than as recollection.
//   3. PREPARE. The two are written up as one document and shown to the user,
//      who presses Send. Nothing leaves this machine before that press.
//
// There is NO issue tracker endpoint yet. `postIssueReport` is the seam where
// one goes, and until there is one it is honest about it: it saves the report
// where the user can find it and says plainly that nothing was sent. A window
// that told a volunteer their problem had been filed with someone, when it had
// not, would be worse than having no button at all.
//
// What there IS is an address. The package's `author` field carries the
// maintainers' email, so the saved document opens with where to send it and
// the subject line to use, and the window offers what a person needs to do
// that by hand -- the report, its subject line, its picture and the address,
// each onto the clipboard -- plus a press that opens their own mail app with
// both filled in. "Saved to Downloads, pass it on however you like" left the
// volunteer holding a file and no idea who wanted it.

import appProvider from '../server/appProvider';
import type { ContactEmailType } from '../server/appHelpers';
import {
    fsReadFile,
    fsReadFileBase64Sync,
    fsWriteFileSync,
    getDownloadPath,
    pathJoin,
    writeFileFromBase64Sync,
} from '../server/fileHelpers';
import { appError } from '../helper/loggerHelpers';
import { describeScreenContent } from '../../tools/owa-devtools-mcp/agentScreens.mjs';
import {
    describeRunSheet,
    describeSelectedDocument,
} from '../../tools/owa-devtools-mcp/agentPresenter.mjs';
import { callTool, parseToolJson } from './mcpClient';
import type { BotActionType, ChatTurnType } from './helpBotHelpers';

/**
 * What the window found out for itself, as opposed to what the model made of
 * it. Every field is a short line meant to be read in a report -- this is
 * evidence, not a state dump: `owa_app_state` also carries the user's data
 * directory (their account name is in that path), and that does not belong
 * in a document they are about to hand to a stranger.
 */
export type ReportEvidenceType = {
    collectedAt: string;
    appLine: string;
    // The OS, the Electron and Chromium builds, the locale and the display
    // scale -- read off this window, so nothing has to be asked for them.
    machineLine: string;
    windowLine: string;
    // What the user is in the middle of: the selected document and the run
    // sheet, in the words the `/selected` and `/run` commands use. Empty off
    // the Presenter, where neither is known.
    selectionLines: string[];
    screenLine: string;
    // One line per screen saying what it HOLDS, showing or not -- "it is off
    // but already has verse 2 on it" is most of the answer to most reports
    // about a projector -- and one per display it could be put on.
    screenLines: string[];
    displayLines: string[];
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
    // Where the report should go and what to call it -- found at prepare
    // time (the app's help page first, the package's own address when that
    // cannot be read) so the document and the buttons under it agree.
    contactEmail: string | null;
    contactSource: ContactEmailType['source'] | null;
    subject: string;
    // The assistant that wrote the diagnosis, named so a maintainer can weigh
    // it: a small free model's "suspected area" and a large one's are not the
    // same evidence.
    investigatedBy: string | null;
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
// The buttons under a saved report. Pseudo tools like Send: caught in the
// window, registered nowhere, so nothing a model says can press them.
export const REPORT_COPY_TOOL_NAME = 'owa-report-copy';
export const REPORT_COPY_SUBJECT_TOOL_NAME = 'owa-report-copy-subject';
export const REPORT_COPY_IMAGE_TOOL_NAME = 'owa-report-copy-image';
export const REPORT_COPY_EMAIL_TOOL_NAME = 'owa-report-copy-email';
export const REPORT_EMAIL_TOOL_NAME = 'owa-report-email';

// The frame the model writes the report in. Same shape as `OPTIONS:` and
// `SHOWS:` -- a marker at the start of a line, parsed off, never shown -- and
// for the same reason: a small model told merely to "be structured" writes a
// different structure every time, and the report has to be one document.
const REPORT_MARKER = /^[ \t]*REPORT:[ \t]*/im;
const FIELD_PATTERN =
    /^[ \t]*(TITLE|WHAT HAPPENED|STEPS|EXPECTED|SUSPECT):[ \t]*/i;

const MAX_CONSOLE_LINES = 20;
const MAX_REPORT_TURNS = 8;
const MAX_CONSOLE_LINE_LENGTH = 300;
const MAX_TITLE_LENGTH = 90;
const MAX_ACTIVE_TABS = 6;
// A report is a document, not an answer: it may run long. But it is written by
// a model, saved to disk and shown in a 460px window, so it is not unbounded.
const MAX_FIELD_LENGTH = 1500;
// What a saved report is called, and the only shape `readReportMarkdown` will
// go to the disk for.
const REPORT_REFERENCE_PATTERN = /^OWA-\d{6}-[0-9a-f]{4}$/;

function toIndented(lines: string[]) {
    return lines
        .map((line) => {
            return `  ${line}`;
        })
        .join('\n');
}

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
        `- ${evidence.machineLine}`,
        `- ${evidence.windowLine}`,
        ...evidence.selectionLines.map((line) => {
            return `- ${line}`;
        }),
        `- ${evidence.screenLine}`,
        ...(evidence.screenLines.length === 0
            ? []
            : [`- Each screen:\n${toIndented(evidence.screenLines)}`]),
        evidence.consoleLines.length === 0
            ? '- Console: nothing was logged'
            : `- Console:\n${toIndented(evidence.consoleLines)}`,
        '',
        'INVESTIGATE FIRST. Look at the app before you write anything:',
        '`owa_app_state` for where they are, `owa_list_ui` or `owa_find_ui`',
        'for the control they mean, `owa_list_screens` when it is about a',
        "projector. The app's own log lines are already listed above, and a",
        'picture of the app is already attached. Use the manual (`owa_help_search`)',
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
    const arch = systemUtils.isArm64
        ? ' arm64'
        : systemUtils.is64System
          ? ' x64'
          : '';
    const commit =
        systemUtils.commitHash === undefined
            ? ''
            : `, commit ${systemUtils.commitHash.slice(0, 8)}`;
    return (
        `${appInfo.title} ${appInfo.version} on ${platform}${arch} ` +
        `(${systemUtils.isDev ? 'dev' : 'packaged'} build${commit})`
    );
}

/**
 * The machine, off this window's own user agent: the OS build, the Electron
 * and Chromium versions, the locale and the display scale. Read here because
 * the chatbot window's `process` is a decoy with no `versions` in it, and
 * the user agent is the one place those numbers are left. The scale is the
 * fact behind most "too small" and "cut off" reports.
 */
function genMachineLine() {
    if (typeof navigator === 'undefined') {
        return 'Machine: could not be read';
    }
    const userAgent = navigator.userAgent ?? '';
    const parts: string[] = [];
    const os = /\(([^)]+)\)/.exec(userAgent)?.[1];
    if (os !== undefined) {
        parts.push(os);
    }
    const electron = /Electron\/([\d.]+)/.exec(userAgent)?.[1];
    if (electron !== undefined) {
        parts.push(`Electron ${electron}`);
    }
    const chromium = /Chrome\/([\d.]+)/.exec(userAgent)?.[1];
    if (chromium !== undefined) {
        parts.push(`Chromium ${chromium}`);
    }
    if (navigator.language) {
        parts.push(`locale ${navigator.language}`);
    }
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone) {
            parts.push(`time zone ${timeZone}`);
        }
    } catch (_error) {
        // An engine with no zone name is still a machine.
    }
    if (typeof window !== 'undefined' && window.devicePixelRatio) {
        parts.push(`display scale ${window.devicePixelRatio.toString()}x`);
    }
    return `Machine: ${parts.length === 0 ? 'unknown' : parts.join(', ')}`;
}

async function readWindowLines(
    signal?: AbortSignal | null,
): Promise<{ windowLine: string; selectionLines: string[] }> {
    try {
        const state = parseToolJson(
            await callTool('owa_app_state', {}, signal),
        );
        const main = state?.mainWindow;
        if (main === undefined || main === null) {
            return {
                windowLine: 'Window: could not be read',
                selectionLines: [],
            };
        }
        // Deliberately NOT the whole payload: `instances` carries the user's
        // data directory, which has their account name in it.
        const activeTabs: string[] = (Array.isArray(main.tabs) ? main.tabs : [])
            .filter((tab: any) => {
                return tab?.isActive === true && typeof tab.label === 'string';
            })
            .map((tab: any) => {
                return tab.label as string;
            })
            .slice(0, MAX_ACTIVE_TABS);
        const windowLine =
            `Window: ${main.title ?? 'unknown'} (${main.page ?? 'unknown page'}), ` +
            `language ${main.language ?? 'unknown'}, ` +
            `theme ${main.theme ?? 'unknown'}` +
            (activeTabs.length === 0
                ? ''
                : `, active tabs: ${activeTabs.join(' / ')}`);
        // The selection and the run sheet ride the same answer on the
        // Presenter (`foldPresenterState`); off it neither field is there,
        // and the window says nothing rather than "could not be read".
        const selectionLines: string[] = [];
        if ('selectedDocument' in main) {
            selectionLines.push(
                describeSelectedDocument(main.selectedDocument),
            );
        }
        if (main.runSheet !== undefined && main.runSheet !== null) {
            selectionLines.push(describeRunSheet(main.runSheet));
        }
        return { windowLine, selectionLines };
    } catch (error: any) {
        return {
            windowLine: `Window: could not be read (${error.message})`,
            selectionLines: [],
        };
    }
}

function describeDisplay(display: any) {
    const name =
        typeof display?.label === 'string' ? ` "${display.label}"` : '';
    const size =
        typeof display?.width === 'number' &&
        typeof display?.height === 'number'
            ? `${display.width.toString()}×${display.height.toString()}`
            : 'size unknown';
    const primary = display?.isPrimary === true ? ', primary' : '';
    return `Display ${String(display?.id ?? '?')}${name}: ${size}${primary}`;
}

function describeScreenLine(screen: any) {
    const state = screen?.isShowing === true ? 'showing' : 'hidden';
    const locked = screen?.isLocked === true ? ', locked' : '';
    const display =
        screen?.display?.id === undefined
            ? ''
            : `, on display ${String(screen.display.id)}`;
    const held = describeScreenContent(screen);
    return (
        `Screen ${String(screen?.screenId ?? '?')} (${state}${locked}${display}): ` +
        (held.length === 0 ? 'nothing known' : held)
    );
}

async function readScreenLines(signal?: AbortSignal | null): Promise<{
    screenLine: string;
    screenLines: string[];
    displayLines: string[];
}> {
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
        const screenLine =
            showing.length === 0
                ? `Screens: none showing, ${displayCount} display(s) attached`
                : `Screens: ${showing.join(', ')} showing, ` +
                  `${displayCount} display(s) attached`;
        const screenList: unknown[] = Array.isArray(screens?.screens)
            ? screens.screens
            : [];
        // Off the Presenter the tool says why it cannot say what a screen
        // holds; that sentence is worth more to a maintainer than a blank.
        const screenLines =
            screenList.length === 0 && typeof screens?.note === 'string'
                ? [screens.note]
                : screenList.map(describeScreenLine);
        return {
            screenLine,
            screenLines,
            displayLines: displayList.map(describeDisplay),
        };
    } catch (error: any) {
        return {
            screenLine: `Screens: could not be read (${error.message})`,
            screenLines: [],
            displayLines: [],
        };
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
    const [window, screens, consoleLines] = await Promise.all([
        readWindowLines(signal),
        readScreenLines(signal),
        readConsoleLines(signal),
    ]);
    return {
        collectedAt: new Date().toISOString(),
        appLine: genAppLine(),
        machineLine: genMachineLine(),
        windowLine: window.windowLine,
        selectionLines: window.selectionLines,
        screenLine: screens.screenLine,
        screenLines: screens.screenLines,
        displayLines: screens.displayLines,
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

function toBullets(lines: string[]) {
    return lines
        .map((line) => {
            return `- ${line}`;
        })
        .join('\n');
}

/** The subject line a maintainer can sort a mailbox by. */
export function genReportSubject(title: string, reference: string) {
    return `[${appProvider.appInfo.title}] ${title} (${reference})`;
}

/**
 * The first section of the document: who wants it and what to call it. A
 * volunteer who finds this file in Downloads a week later, with the help
 * window long closed, must still be able to see what to do with it.
 */
function genHowToSend({
    contactEmail,
    subject,
    reference,
    hasImage,
    contactSource,
}: {
    contactEmail: string | null;
    subject: string;
    reference: string;
    hasImage: boolean;
    contactSource: ContactEmailType['source'] | null;
}) {
    const picture = hasImage
        ? `, and attach \`${reference}.png\` (the picture of the app, saved ` +
          'beside this file) to the same message'
        : '';
    if (contactEmail === null) {
        return (
            `Pass this document${hasImage ? ` and \`${reference}.png\`` : ''} ` +
            'to whoever maintains the app for you ' +
            `(${appProvider.appInfo.homepage}), under the subject line ` +
            'below.\n\n' +
            `Subject: \`${subject}\``
        );
    }
    // Where the address came from, because a build goes stale: a reader who
    // knows it was read off the live help page today can trust it, and one
    // who knows it is the build's own can check the site for a newer one.
    const provenance =
        contactSource === 'help page'
            ? "This address was read from the app's help page when the " +
              'report was written.'
            : 'This address is the one built into this version of the app; ' +
              'its help page could not be read to check for a newer one.';
    return (
        `Email this document to **${contactEmail}** with the subject line ` +
        `below${picture}.\n\n` +
        `Subject: \`${subject}\`\n\n` +
        provenance
    );
}

export function genReportMarkdown({
    reference,
    title,
    complaint,
    summary,
    fields,
    evidence,
    hasImage,
    contactEmail,
    contactSource,
    subject,
    investigatedBy,
}: {
    reference: string;
    title: string;
    complaint: string;
    summary: string;
    fields: Record<string, string>;
    evidence: ReportEvidenceType;
    hasImage: boolean;
    contactEmail: string | null;
    contactSource: ContactEmailType['source'] | null;
    subject: string;
    investigatedBy: string | null;
}) {
    const conversation = evidence.turns
        .map((turn) => {
            return `**${turn.author === 'you' ? 'User' : 'Assistant'}:** ${turn.text}`;
        })
        .join('\n\n');
    const screens = [
        evidence.screenLine,
        ...evidence.screenLines,
        ...evidence.displayLines,
    ];
    return (
        `# ${title}\n\n` +
        `Reference: \`${reference}\`  \n` +
        `Written by the in-app assistant at ${evidence.collectedAt}` +
        (investigatedBy === null
            ? ''
            : `  \nInvestigated by ${investigatedBy}`) +
        '\n' +
        genSection(
            'How to send this',
            genHowToSend({
                contactEmail,
                subject,
                reference,
                hasImage,
                contactSource,
            }),
        ) +
        genSection('What the user reported', complaint) +
        genSection('What the assistant found', summary) +
        genSection('What happened', fields['WHAT HAPPENED'] ?? '') +
        genSection('Steps to reproduce', fields.STEPS ?? '') +
        genSection('Expected', fields.EXPECTED ?? '') +
        genSection('Suspected area', fields.SUSPECT ?? '') +
        genSection(
            'App',
            toBullets([
                evidence.appLine,
                evidence.machineLine,
                evidence.windowLine,
            ]),
        ) +
        genSection('Selected in the app', toBullets(evidence.selectionLines)) +
        genSection('Screens', toBullets(screens)) +
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
    investigatedBy = null,
    contact = null,
}: {
    complaint: string;
    answerText: string;
    evidence: ReportEvidenceType;
    imageDataUrl: string | null;
    investigatedBy?: string | null;
    // Found by the window (`findContactEmail`) while the investigation ran,
    // so preparing the document stays synchronous and asks nothing.
    contact?: ContactEmailType | null;
}): PreparedReportType {
    const reference = genReference();
    const { summary, title, fields } = parseReportDraft(answerText);
    // A report with no title is a row in a list nobody opens. The user's own
    // first line is a better one than anything this window could invent.
    const finalTitle =
        title.length > 0 ? title : toCleanLine(complaint, MAX_TITLE_LENGTH);
    const contactEmail = contact?.email ?? null;
    const contactSource = contact?.source ?? null;
    const subject = genReportSubject(finalTitle, reference);
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
            contactEmail,
            contactSource,
            subject,
            investigatedBy,
        }),
        evidence,
        contactEmail,
        contactSource,
        subject,
        investigatedBy,
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

/**
 * The report's text for the Copy button. From memory while the window still
 * holds it; otherwise from the copy in Downloads, because a window reopened
 * since Send was pressed has the same document on disk and a Copy button
 * that answers "not prepared any more" over a file that exists is a lie.
 *
 * Only a well-formed reference is looked for, and only in Downloads under its
 * own name: the args on a button live in the sessions file, and a hand-edited
 * one must not turn Copy report into "copy any file on this machine".
 */
export async function readReportMarkdown(reference: string) {
    const kept = preparedReportMap.get(reference);
    if (kept !== undefined) {
        return kept.markdown;
    }
    if (!REPORT_REFERENCE_PATTERN.test(reference)) {
        return null;
    }
    try {
        return await fsReadFile(pathJoin(getDownloadPath(), `${reference}.md`));
    } catch (_error) {
        return null;
    }
}

/**
 * The picture for the Copy picture button: from memory while the window
 * holds the report, else the `.png` saved beside the document in Downloads,
 * by the same rule `readReportMarkdown` follows -- a well-formed reference,
 * under its own name, nowhere else. Null when there is no picture to copy.
 */
export function readReportImageDataUrl(reference: string) {
    const kept = preparedReportMap.get(reference);
    if (kept !== undefined) {
        return kept.imageDataUrl;
    }
    if (!REPORT_REFERENCE_PATTERN.test(reference)) {
        return null;
    }
    try {
        const base64 = fsReadFileBase64Sync(
            pathJoin(getDownloadPath(), `${reference}.png`),
        );
        return base64.length === 0 ? null : `data:image/png;base64,${base64}`;
    } catch (_error) {
        return null;
    }
}

/**
 * The `mailto:` for the Email it button: the address and the subject filled
 * in, and a SHORT body. The whole report does not go in the link -- mail
 * clients cut a `mailto:` body at a couple of thousand characters and a
 * report runs longer than that -- so the press puts the report on the
 * clipboard first and the body says to paste it.
 */
export function genReportMailtoUrl({
    contactEmail,
    subject,
    reference,
    hasImage,
}: {
    contactEmail: string;
    subject: string;
    reference: string;
    hasImage: boolean;
}) {
    const { appInfo } = appProvider;
    const body = [
        `Report ${reference} from ${appInfo.title} ${appInfo.version}.`,
        '',
        '(Paste the report here -- it was copied to the clipboard when this ' +
            'message was opened' +
            (hasImage
                ? ` -- and attach ${reference}.png from the Downloads folder.)`
                : '.)'),
    ].join('\n');
    return (
        `mailto:${contactEmail}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`
    );
}

/** The title a saved report was written under: its first heading. */
export function readReportTitle(markdown: string) {
    return /^# (.+)$/m.exec(markdown)?.[1]?.trim() ?? '';
}

/**
 * The subject line for a report the window may no longer hold: the kept
 * report's own, else rebuilt from the saved document's first heading -- so
 * Copy subject and Email it name the same line the document does, before and
 * after a reopen alike.
 */
export function toSavedReportSubject(
    kept: PreparedReportType | null,
    markdown: string,
    reference: string,
) {
    if (kept !== null) {
        return kept.subject;
    }
    const title = readReportTitle(markdown);
    return genReportSubject(title.length > 0 ? title : reference, reference);
}

/**
 * The buttons under a saved report. Every one carries only the REFERENCE:
 * the address and the link are worked out at the press -- off the kept
 * report, or found again from the help page and the package -- never from
 * anything a session file could carry.
 */
export function genReportFollowUpActions(
    report: PreparedReportType,
): BotActionType[] {
    const args = { reference: report.reference };
    const actions: BotActionType[] = [
        { label: 'Copy report', toolName: REPORT_COPY_TOOL_NAME, args },
        // The subject stands even with no address: a message to whoever
        // maintains the app still wants a line a mailbox can sort by.
        {
            label: 'Copy subject',
            toolName: REPORT_COPY_SUBJECT_TOOL_NAME,
            args,
        },
    ];
    if (report.imageDataUrl !== null) {
        // The screenshot, for pasting into the message: most mail apps take
        // a pasted picture as an attachment, which saves a trip to Downloads.
        actions.push({
            label: 'Copy picture',
            toolName: REPORT_COPY_IMAGE_TOOL_NAME,
            args,
        });
    }
    if (report.contactEmail !== null) {
        actions.push(
            {
                label: 'Copy email address',
                toolName: REPORT_COPY_EMAIL_TOOL_NAME,
                args,
            },
            { label: 'Email it', toolName: REPORT_EMAIL_TOOL_NAME, args },
        );
    }
    return actions;
}

/** A few words on where an address came from, for the transcript. */
export function describeContactSource(
    contactSource: ContactEmailType['source'] | null,
) {
    if (contactSource === 'help page') {
        return " (from the app's help page)";
    }
    if (contactSource === 'app') {
        return ' (the address built into the app; its help page could not be checked)';
    }
    return '';
}

/**
 * The sentence under a saved report saying how to send it -- written here so
 * it and the document's own "How to send this" cannot disagree.
 */
export function describeHowToSend(
    report: PreparedReportType,
    imageFileName: string | null,
) {
    // The subject on a line of its own: it is the one thing here a person
    // retypes by hand when the buttons are not used, and a line inside a
    // sentence is a line half-copied.
    const subjectLine =
        'give it this subject line (**Copy subject** copies it):\n' +
        `\`${report.subject}\``;
    if (report.contactEmail === null) {
        return (
            'Pass the saved file' +
            (imageFileName === null ? '' : ' and its picture') +
            ` on to whoever maintains the app for you, and ${subjectLine}`
        );
    }
    return (
        `To send it, email the report to \`${report.contactEmail}\`` +
        `${describeContactSource(report.contactSource)} — press ` +
        '**Copy report** and paste it into the message' +
        (imageFileName === null
            ? ''
            : `, attach \`${imageFileName}\` from your Downloads folder`) +
        `, and ${subjectLine}\n**Email it** opens your mail app with the ` +
        'address and subject filled in and the report on your clipboard.'
    );
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

/**
 * Sends the report -- or, while there is nowhere to send it, saves it where the
 * user can get at it and says so. The file is written either way: an endpoint
 * that answered 500 in a church hall with bad wifi must not be the reason the
 * only account of the bug is lost.
 */
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
