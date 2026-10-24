import { describe, expect, it, vi } from 'vitest';

const {
    fsGetFileSizeMock,
    fsReadFileMock,
    fsReadFileBase64SyncMock,
    fsWriteFileSyncMock,
    electronSendAsyncMock,
    sendDataMock,
} = vi.hoisted(() => {
    return {
        fsWriteFileSyncMock: vi.fn(),
        // What main answers a posted report with (`llmReportHelpers.ts`).
        electronSendAsyncMock: vi.fn(
            async (_channel: string, _data: any): Promise<any> => {
                return { ok: true };
            },
        ),
        sendDataMock: vi.fn(),
        fsReadFileMock: vi.fn(async (_filePath: string): Promise<string> => {
            return '# Saved title\n\nsaved body\n';
        }),
        fsReadFileBase64SyncMock: vi.fn((_filePath: string): string => {
            return 'UE5H';
        }),
        fsGetFileSizeMock: vi.fn(async (_filePath: string): Promise<number> => {
            return 3;
        }),
    };
});

vi.mock('../server/appProvider', () => {
    return {
        default: {
            appInfo: {
                title: 'Open Worship app',
                version: '2026.08.15',
                homepage: 'https://www.openworship.app',
            },
            messageUtils: { sendData: sendDataMock },
            systemUtils: {
                isDev: true,
                isWindows: true,
                isMac: false,
                isLinux: false,
                is64System: true,
                commitHash: 'abcdef1234567890',
            },
        },
    };
});
vi.mock('../server/fileHelpers', async () => {
    // The real rule, borrowed from its leaf: it needs no file layer.
    const { toPathScrubbed } = await vi.importActual<
        typeof import('../server/accountPathHelpers')
    >('../server/accountPathHelpers');
    return {
        toPathScrubbed,
        fsGetFileSize: fsGetFileSizeMock,
        fsReadFile: fsReadFileMock,
        fsReadFileBase64Sync: fsReadFileBase64SyncMock,
        fsWriteFileSync: fsWriteFileSyncMock,
        getDownloadPath: () => {
            return '/downloads';
        },
        pathJoin: (...parts: string[]) => {
            return parts.join('/');
        },
        writeFileFromBase64Sync: vi.fn(),
    };
});
vi.mock('../server/electronSendHelpers', () => {
    return { electronSendAsync: electronSendAsyncMock };
});
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => {
    return { callTool: vi.fn(), parseToolJson: vi.fn() };
});

const {
    REPORT_COPY_EMAIL_TOOL_NAME,
    REPORT_COPY_IMAGE_TOOL_NAME,
    REPORT_COPY_SUBJECT_TOOL_NAME,
    REPORT_COPY_TOOL_NAME,
    REPORT_EMAIL_TOOL_NAME,
    REPORT_FIXED_TEXT,
    REPORT_FIXED_TOOL_NAME,
    REPORT_NOTE,
    REPORT_RESOLVED_NOTE,
    REPORT_STILL_TOOL_NAME,
    REPORT_SEND_TOOL_NAME,
    REPORT_START_TOOL_NAME,
    describeHowToSend,
    describePostedReport,
    collectReportEvidence,
    gatherReportFiles,
    genPreparedReport,
    genFixCard,
    genPreparedCard,
    genReportComplaint,
    genReportOffer,
    genReportPromptWithFiles,
    genReportFollowUpActions,
    genReportInvestigation,
    genReportMailtoUrl,
    genReportSubject,
    keepPreparedReport,
    parseReportDraft,
    postIssueReport,
    readFixReply,
    readReportImageDataUrl,
    readReportMarkdown,
    readReportThread,
    readReportThreadAttachments,
    readReportTitle,
    takePreparedReport,
    toSavedReportSubject,
} = await import('./reportHelpers');
const { genFileAttachment, genTextAttachment, putAttachmentData } =
    await import('./attachmentHelpers');
const { callTool } = await import('./mcpClient');

const EVIDENCE = {
    collectedAt: '2026-09-01T21:00:00.000Z',
    appLine: 'Open Worship app 2026.08.15 on Windows x64 (dev build)',
    machineLine: 'Machine: Windows NT 10.0; Win64; x64, Electron 39.0.0',
    windowLine: 'Window: Presenter (presenter.html), language en, theme dark',
    selectionLines: ['The song "Amazing Grace" is selected (4 slides).'],
    screenLine: 'Screens: none showing, 1 display(s) attached',
    screenLines: ['Screen 0 (hidden): the song "Amazing Grace" (Verse 1)'],
    displayLines: ['Display 1: 1920×1080, primary'],
    consoleLines: ['error: something went wrong'],
    turns: [{ author: 'you' as const, text: 'it went blank' }],
};

describe('parseReportDraft', () => {
    it('splits what the user reads from what the report is built from', () => {
        const parsed = parseReportDraft(
            'I looked at the Presenter. No screen is showing.\n' +
                '\n' +
                'REPORT:\n' +
                'TITLE: Projector shows nothing\n' +
                'WHAT HAPPENED: no screen was started\n' +
                'STEPS: 1) open the presenter\n' +
                '2) present a verse\n' +
                'EXPECTED: the verse appears\n' +
                'SUSPECT: the screen show control\n',
        );
        expect(parsed.summary).toBe(
            'I looked at the Presenter. No screen is showing.',
        );
        expect(parsed.title).toBe('Projector shows nothing');
        // A wrapped field keeps its later lines -- a numbered STEPS list is
        // the one that always wraps.
        expect(parsed.fields.STEPS).toBe(
            '1) open the presenter\n2) present a verse',
        );
        expect(parsed.fields.SUSPECT).toBe('the screen show control');
    });

    // The first report sent through the inbox, word for word as a free
    // model framed it: bold markers, `REPORT` with no colon, a rule.
    it('reads the frame in the markdown a model dresses it in', () => {
        const parsed = parseReportDraft(
            '**What I see**\n\nThe Bible Lookup button is at the top.\n\n' +
                '**TRY THIS:**  \n' +
                '1. Click the blue **Bible Lookup** button at the top.  \n\n' +
                'If the popup opens you can pick a book.\n\n---\n\n' +
                '**REPORT**  \n' +
                'TITLE: Cannot open Bible  \n' +
                '**WHAT HAPPENED:** They cannot open a Bible.\n' +
                '- STEPS: unknown – nothing was described.\n' +
                'EXPECTED: The lookup opens.  \n' +
                'SUSPECT: unknown\n',
        );
        expect(parsed.summary).toBe(
            '**What I see**\n\nThe Bible Lookup button is at the top.',
        );
        expect(parsed.fix).toBe(
            '1. Click the blue **Bible Lookup** button at the top.\n\n' +
                'If the popup opens you can pick a book.',
        );
        expect(parsed.title).toBe('Cannot open Bible');
        expect(parsed.fields).toEqual({
            TITLE: 'Cannot open Bible',
            'WHAT HAPPENED': 'They cannot open a Bible.',
            STEPS: 'unknown – nothing was described.',
            EXPECTED: 'The lookup opens.',
            SUSPECT: 'unknown',
        });
    });

    // The user's second inbox report: the marker's bold carried a heading.
    it('leaves out the heading a bold marker carried inside it', () => {
        const parsed = parseReportDraft(
            'You are in the Presenter.\n\n' +
                '**TRY THIS: steps you can try yourself**\n\n' +
                '1. Press **Clear All**.\n' +
                '2. Ask again.\n\n' +
                'REPORT:\nTITLE: Presenter running slowly\n',
        );
        expect(parsed.fix).toBe('1. Press **Clear All**.\n2. Ask again.');
        expect(parsed.title).toBe('Presenter running slowly');
        // A first line whose bold opens AND closes is a step, and stays.
        expect(
            parseReportDraft('TRY THIS:\n1. Press **Clear All**\n2. Ask again.')
                .fix,
        ).toBe('1. Press **Clear All**\n2. Ask again.');
    });

    it('takes no sentence that merely starts with the word for a frame', () => {
        const parsed = parseReportDraft(
            'Report the issue to the maintainers.\nTry this later.',
        );
        expect(parsed.title).toBe('');
        expect(parsed.fix).toBe('');
        expect(parsed.summary).toBe(
            'Report the issue to the maintainers.\nTry this later.',
        );
    });

    it('keeps the whole answer when the model wrote no frame', () => {
        const parsed = parseReportDraft('Something is wrong with the screen.');
        expect(parsed.summary).toBe('Something is wrong with the screen.');
        expect(parsed.title).toBe('');
        expect(parsed.fields).toEqual({});
    });
});

describe('genReportInvestigation', () => {
    it('hands the model everything the window collected', () => {
        const asked = genReportInvestigation('it went blank', EVIDENCE);
        expect(asked).toContain(EVIDENCE.machineLine);
        expect(asked).toContain(EVIDENCE.selectionLines[0]);
        expect(asked).toContain(EVIDENCE.screenLines[0]);
        expect(asked).toContain('error: something went wrong');
    });

    // The first report a person sent (an uncaught error, nothing said of
    // what led to it) came back with three made-up steps: open the
    // Presenter, the Documents tab, select a song. A maintainer follows them.
    it('asks for steps somebody saw, and "unknown" when nobody knows', () => {
        const asked = genReportInvestigation('it went blank', EVIDENCE);
        const steps = asked.slice(asked.indexOf('STEPS:'));
        expect(steps).toContain('only what the');
        expect(steps).toContain('write "unknown"');
        expect(steps).toContain('never a guess');
    });
});

describe('genPreparedReport', () => {
    it('writes one document out of the account and the evidence', () => {
        const report = genPreparedReport({
            complaint: 'the bible text does not show on the projector',
            answerText:
                'No screen is showing.\n\nREPORT:\nTITLE: Projector blank\n' +
                'WHAT HAPPENED: no screen was started\n',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
            investigatedBy: 'Claude (claude-sonnet-5)',
        });
        expect(report.reference).toMatch(/^OWA-\d{6}-[0-9a-f]{4}$/);
        expect(report.title).toBe('Projector blank');
        expect(report.summary).toBe('No screen is showing.');
        expect(report.markdown).toContain('# Projector blank');
        expect(report.markdown).toContain(
            'the bible text does not show on the projector',
        );
        expect(report.markdown).toContain(
            'Investigated by Claude (claude-sonnet-5)',
        );
        for (const line of [
            EVIDENCE.machineLine,
            EVIDENCE.windowLine,
            EVIDENCE.selectionLines[0],
            EVIDENCE.screenLine,
            EVIDENCE.screenLines[0],
            EVIDENCE.displayLines[0],
            'error: something went wrong',
        ]) {
            expect(report.markdown).toContain(line);
        }
        // The picture is named in the document, and the document says whose.
        expect(report.markdown).toContain(`${report.reference}.png`);
    });

    it('opens with where to send it and what to call it', () => {
        const report = genPreparedReport({
            complaint: 'font is too small',
            answerText: 'REPORT:\nTITLE: Font too small on screen\n',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
            contact: { email: 'owf2025@gmail.com', source: 'help page' },
        });
        expect(report.contactEmail).toBe('owf2025@gmail.com');
        expect(report.contactSource).toBe('help page');
        // Says the address is today's, off the live page.
        expect(report.markdown).toContain(
            "read from the app's help page when the report was written",
        );
        expect(describeHowToSend(report, null)).toContain(
            "(from the app's help page)",
        );
        expect(report.subject).toBe(
            `[Open Worship app] Font too small on screen (${report.reference})`,
        );
        // The first section, before anything else: a volunteer who finds the
        // file a week later must see what to do with it.
        const howToSend = report.markdown.indexOf('## How to send this');
        expect(howToSend).toBeGreaterThan(-1);
        expect(howToSend).toBeLessThan(
            report.markdown.indexOf('## What the user reported'),
        );
        expect(report.markdown).toContain('**owf2025@gmail.com**');
        expect(report.markdown).toContain(`Subject: \`${report.subject}\``);
        expect(report.markdown).toContain(`attach \`${report.reference}.png\``);
        // Nobody investigated: the document does not claim somebody did.
        expect(report.investigatedBy).toBeNull();
        expect(report.markdown).not.toContain('Investigated by');
    });

    it("says the address is the build's own when the page could not be read", () => {
        const report = genPreparedReport({
            complaint: 'font is too small',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: null,
            contact: { email: 'owf2025@gmail.com', source: 'app' },
        });
        expect(report.contactSource).toBe('app');
        expect(report.markdown).toContain(
            'built into this version of the app; its help page could not be read',
        );
        expect(describeHowToSend(report, null)).toContain(
            'built into the app; its help page could not be checked',
        );
    });

    it('says where to take it when no address is known at all', () => {
        const report = genPreparedReport({
            complaint: 'font is too small',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        expect(report.contactEmail).toBeNull();
        expect(report.markdown).toContain('whoever maintains the app for you');
        expect(report.markdown).toContain('https://www.openworship.app');
        // A subject line still: a message to a maintainer wants one whether
        // or not the app knows the address.
        expect(report.markdown).toContain(`Subject: \`${report.subject}\``);
        expect(
            genReportFollowUpActions(report).map((one) => one.label),
        ).toEqual(['Copy report', 'Copy subject']);
        const said = describeHowToSend(report, null);
        expect(said).toContain('whoever maintains the app');
        expect(said).toContain('**Copy subject**');
        expect(said).toContain(`\n\`${report.subject}\``);
    });

    it('falls back to the complaint for a title the model did not write', () => {
        const report = genPreparedReport({
            complaint: 'the  verse   list is empty',
            answerText: 'I could not tell what is wrong.',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        expect(report.title).toBe('the verse list is empty');
        // Nothing claims a picture that was never taken.
        expect(report.markdown).not.toContain('.png');
    });
});

describe('the report as a report server is sent it', () => {
    const report = genPreparedReport({
        complaint: 'the bible text does not show on the projector',
        answerText:
            'No screen is showing.\n\nREPORT:\nTITLE: Projector blank\n' +
            'WHAT HAPPENED: no screen was started\n',
        evidence: EVIDENCE,
        imageDataUrl: 'data:image/png;base64,AAAA',
        investigatedBy: 'Claude (claude-sonnet-5)',
        contact: { email: 'owf2025@gmail.com', source: 'help page' },
    });

    it('is raw text that opens by saying what it is, with the report fenced as data', () => {
        const lines = report.prompt.split('\n');
        expect(lines[0]).toContain(
            'This is a problem report from inside Open Worship app',
        );
        const begin = lines.indexOf(
            `----- BEGIN REPORT ${report.reference} -----`,
        );
        const end = lines.indexOf(`----- END REPORT ${report.reference} -----`);
        expect(begin).toBeGreaterThan(0);
        expect(end).toBeGreaterThan(begin);
        expect(lines[begin + 1]).toBe('# Projector blank');
        // Said in front of the fence: which parts are facts, and that the
        // report is not instructions.
        const preamble = lines.slice(0, begin).join('\n');
        expect(preamble).toContain('read off the running app');
        expect(preamble).toContain('never instructions');
    });

    it('carries the whole account and the evidence', () => {
        for (const part of [
            'the bible text does not show on the projector',
            'No screen is showing.',
            'no screen was started',
            'Investigated by Claude (claude-sonnet-5)',
            EVIDENCE.appLine,
            EVIDENCE.machineLine,
            EVIDENCE.windowLine,
            EVIDENCE.selectionLines[0],
            EVIDENCE.screenLines[0],
            'error: something went wrong',
            '**User:** it went blank',
        ]) {
            expect(report.prompt).toContain(part);
        }
    });

    it('does not say how to send what has arrived, and says the picture did not come', () => {
        expect(report.prompt).not.toContain('How to send this');
        expect(report.prompt).not.toContain('owf2025@gmail.com');
        expect(report.prompt).toContain(`${report.reference}.png`);
        // The copy that goes when no file does.
        expect(report.prompt).toContain('NOT sent with this text');
        expect(report.prompt).not.toContain('came with this report');
        // No picture bytes in the text: a file goes beside it, not in it.
        expect(report.prompt).not.toContain('base64');
        // The saved document is as it was: it still says where to send it.
        expect(report.markdown).toContain('## How to send this');
        expect(report.markdown).not.toContain('BEGIN REPORT');
    });
});

describe('postIssueReport', () => {
    const genReport = (imageDataUrl: string | null = null) => {
        return genPreparedReport({
            complaint: 'font is too small',
            answerText: 'REPORT:\nTITLE: Font too small\n',
            evidence: EVIDENCE,
            imageDataUrl,
            contact: { email: 'owf2025@gmail.com', source: 'help page' },
        });
    };

    it('saves the report and hands its text -- nothing else -- to the main process', async () => {
        electronSendAsyncMock.mockClear();
        fsWriteFileSyncMock.mockClear();
        const report = genReport();
        const posted = await postIssueReport(report);
        expect(posted).toEqual({
            reference: report.reference,
            isSent: true,
            isQueued: false,
            sentFileNames: [],
            unsentFiles: [],
            filePath: `/downloads/${report.reference}.md`,
            imageFilePath: null,
            failure: null,
            sendFailure: null,
        });
        expect(fsWriteFileSyncMock).toHaveBeenCalledWith(
            `/downloads/${report.reference}.md`,
            report.markdown,
        );
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
        const [channel, data] = electronSendAsyncMock.mock.calls[0];
        expect(channel).toBe('main:app:llm-report-post');
        // No address and no key: this window knows neither.
        expect(Object.keys(data).sort()).toEqual([
            'files',
            'requestId',
            'text',
        ]);
        expect(data.text).toBe(report.prompt);
        // No picture was taken and nothing was attached.
        expect(data.files).toEqual([]);
        const said = describePostedReport(report, posted);
        expect(said).toContain('Sent.');
        expect(said).not.toContain('file');
    });

    // "Accept json ... {"prompt":"...", "attachments":[...]} ... and accept
    // files like markdown pdf".
    it('sends the picture of the app and what was attached, as files beside the text', async () => {
        electronSendAsyncMock.mockClear();
        fsGetFileSizeMock.mockClear();
        putAttachmentData('pic1', 'data:image/jpeg;base64,/9j/4AAQ');
        const report = genPreparedReport({
            complaint: 'the order of service prints wrong',
            answerText: 'REPORT:\nTITLE: Print is wrong\n',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
            attachments: [
                // Pasted: held in this window, and called only "picture".
                {
                    id: 'pic1',
                    kind: 'image',
                    name: 'picture',
                    mimeType: 'image/jpeg',
                    byteSize: 6,
                },
                // Read whole off the disk, not the first 16 KB of it.
                genTextAttachment('notes.md', '# Notes', 'C:/docs/notes.md'),
                genFileAttachment('order.pdf', 2048, 'C:/docs/order.pdf'),
                // A control they pointed at is words, never a file.
                {
                    id: 'el1',
                    kind: 'element',
                    name: 'Print',
                    mimeType: 'application/x-owa-element',
                    byteSize: 0,
                    summary: 'The user pointed at a control',
                },
            ],
        });
        const posted = await postIssueReport(report);
        const [, data] = electronSendAsyncMock.mock.calls[0];
        expect(data.files).toEqual([
            {
                name: `${report.reference}.png`,
                mimeType: 'image/png',
                data: 'AAAA',
            },
            { name: 'picture.jpg', mimeType: 'image/jpeg', data: '/9j/4AAQ' },
            { name: 'notes.md', mimeType: 'text/markdown', data: 'UE5H' },
            { name: 'order.pdf', mimeType: 'application/pdf', data: 'UE5H' },
        ]);
        // Its size is asked before a file is read.
        expect(fsGetFileSizeMock).toHaveBeenCalledWith('C:/docs/notes.md');
        expect(fsGetFileSizeMock).toHaveBeenCalledWith('C:/docs/order.pdf');
        // The text names them: up front, and each under Attached.
        expect(data.text).toContain(
            '4 files came with this report, as the "attachments" of the ' +
                `same message: ${report.reference}.png, picture.jpg, ` +
                'notes.md, order.pdf.',
        );
        expect(data.text).toContain(
            `- \`${report.reference}.png\` — a picture of the app when this ` +
                'was reported. Sent with this report.',
        );
        expect(data.text).toContain(
            '- `order.pdf` — attached by the user while reporting. Sent ' +
                'with this report.',
        );
        expect(data.text).not.toContain('NOT sent');
        expect(data.text).not.toContain('Print`');
        expect(posted.sentFileNames).toEqual([
            `${report.reference}.png`,
            'picture.jpg',
            'notes.md',
            'order.pdf',
        ]);
        expect(posted.unsentFiles).toEqual([]);
        const said = describePostedReport(report, posted);
        expect(said).toContain(
            `with 4 files — \`${report.reference}.png\`, \`picture.jpg\`, ` +
                '`notes.md`, `order.pdf` — and I kept a copy',
        );
        expect(said).not.toContain('Not sent');
        // Named on the card BEFORE the press that sends them.
        expect(genPreparedCard(report).text).toContain(
            'any file you attach — here `picture`, `notes.md`, `order.pdf`.',
        );
    });

    // "Attachment should have id like 1 2 3 so user can mention in the
    // text": the report's own list says which file each number is.
    it('names each file by the number the person called it by', async () => {
        electronSendAsyncMock.mockClear();
        putAttachmentData('num1', 'data:image/png;base64,AAAA');
        const report = genPreparedReport({
            complaint: 'in 1 the button is there, in 2 it is missing',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: null,
            attachments: [
                {
                    id: 'num1',
                    kind: 'image',
                    name: 'my screen',
                    mimeType: 'image/png',
                    byteSize: 3,
                    number: 1,
                },
                {
                    ...genFileAttachment('huge.pdf', 9, '/d/huge.pdf'),
                    number: 2,
                },
            ],
        });
        // On the card, before anything is sent.
        expect(genPreparedCard(report).text).toContain(
            'here `my screen` (attachment 1), `huge.pdf` (attachment 2).',
        );
        // In the saved document.
        expect(report.markdown).toContain(
            '- `my screen` (attachment 1) — attached by the user while reporting.',
        );
        fsGetFileSizeMock.mockResolvedValueOnce(6 * 1024 * 1024);
        await postIssueReport(report);
        const [, data] = electronSendAsyncMock.mock.calls[0];
        expect(data.text).toContain(
            '- `my screen.png` (attachment 1) — attached by the user while ' +
                'reporting. Sent with this report.',
        );
        expect(data.text).toContain(
            '- `huge.pdf` (attachment 2) — attached by the user while ' +
                'reporting. It was NOT sent (larger than a report may ' +
                'carry, 5 MB): ask them for it.',
        );
    });

    it('sends what it can and says of each other file why it stayed behind', async () => {
        electronSendAsyncMock.mockClear();
        fsGetFileSizeMock.mockImplementation(async (filePath: string) => {
            if (filePath.includes('gone')) {
                throw new Error('ENOENT');
            }
            return filePath.includes('huge') ? 6 * 1024 * 1024 : 3;
        });
        try {
            const report = genPreparedReport({
                complaint: 'x',
                answerText: '',
                evidence: EVIDENCE,
                imageDataUrl: null,
                attachments: [
                    genFileAttachment(
                        'huge.pdf',
                        6 * 1024 * 1024,
                        '/d/huge.pdf',
                    ),
                    genFileAttachment('gone.pdf', 100, '/d/gone.pdf'),
                    // Not a kind a report carries.
                    genTextAttachment('page.html', '<p>x</p>', '/d/page.html'),
                    // Gone from the disk, but its words are still held.
                    genTextAttachment('gone.txt', 'សួស្តី', '/d/gone.txt'),
                    // A picture this window no longer holds.
                    {
                        id: 'lost',
                        kind: 'image',
                        name: 'photo.png',
                        mimeType: 'image/png',
                        byteSize: 9,
                    },
                    genTextAttachment('same.md', 'a', '/d/one/same.md'),
                    genTextAttachment('same.md', 'b', '/d/two/same.md'),
                ],
            });
            const gathered = await gatherReportFiles(report);
            expect(
                gathered.files.map((file) => {
                    return file.name;
                }),
            ).toEqual(['gone.txt', 'same.md', '2-same.md']);
            // UTF-8, whole, as base64.
            expect(
                Buffer.from(gathered.files[0].data, 'base64').toString('utf8'),
            ).toBe('សួស្តី');
            expect(
                gathered.notes.filter((note) => {
                    return note.why !== undefined;
                }),
            ).toEqual([
                {
                    name: 'huge.pdf',
                    what: 'attached by the user while reporting',
                    why: 'larger than a report may carry, 5 MB',
                },
                {
                    name: 'gone.pdf',
                    what: 'attached by the user while reporting',
                    why: 'the file is not where it was on their computer any more',
                },
                {
                    name: 'page.html',
                    what: 'attached by the user while reporting',
                    why: 'not a kind of file a report carries',
                },
                {
                    name: 'photo.png',
                    what: 'attached by the user while reporting',
                    why: 'this window no longer holds the picture',
                },
            ]);
            const text = genReportPromptWithFiles(report, gathered.notes);
            expect(text).toContain(
                '- `huge.pdf` — attached by the user while reporting. It ' +
                    'was NOT sent (larger than a report may carry, 5 MB): ' +
                    'ask them for it.',
            );
            expect(text).toContain('3 files came with this report');
            const posted = await postIssueReport(report);
            const said = describePostedReport(report, posted);
            expect(said).toContain('with 3 files — `gone.txt`');
            expect(said).toContain(
                'Not sent with it: `huge.pdf` (larger than a report may ' +
                    'carry, 5 MB), `gone.pdf`',
            );
        } finally {
            fsGetFileSizeMock.mockImplementation(async () => {
                return 3;
            });
        }
    });

    // The words are the report; the files are what helps read it.
    it('sends the words alone when a report server finds the files too large', async () => {
        electronSendAsyncMock.mockClear();
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'too-large',
            detail: 'the report server said it is too large',
        });
        const report = genReport('data:image/png;base64,AAAA');
        const posted = await postIssueReport(report);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
        const [, first] = electronSendAsyncMock.mock.calls[0];
        const [, second] = electronSendAsyncMock.mock.calls[1];
        expect(first.files).toHaveLength(1);
        expect(second.files).toEqual([]);
        // The second text does not promise a file that is not coming.
        expect(second.text).not.toContain('came with this report');
        expect(second.text).toContain(
            'It was NOT sent (the report server found the files too large)',
        );
        expect(posted.isSent).toBe(true);
        expect(posted.sentFileNames).toEqual([]);
        const said = describePostedReport(report, posted);
        expect(said).toContain('Sent.');
        expect(said).toContain(
            `Not sent with it: \`${report.reference}.png\` (the report ` +
                'server found the files too large). The picture is still ' +
                'in Downloads',
        );
        // Too large with nothing to leave behind is simply not sent.
        electronSendAsyncMock.mockClear();
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'too-large',
            detail: 'the report server said it is too large',
        });
        const bare = await postIssueReport(genReport());
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
        expect(bare.isSent).toBe(false);
        expect(bare.sendFailure).toBe('the report server said it is too large');
    });

    it('gives a Stop two seconds to hear what became of the post, then stops waiting', async () => {
        vi.useFakeTimers();
        try {
            sendDataMock.mockClear();
            // A main process that never answers.
            electronSendAsyncMock.mockReturnValueOnce(new Promise(() => {}));
            const controller = new AbortController();
            const waiting = postIssueReport(genReport(), controller.signal);
            await vi.advanceTimersByTimeAsync(1000);
            controller.abort();
            expect(sendDataMock).toHaveBeenCalledWith(
                'main:app:llm-report-post-cancel',
                { requestId: expect.any(String) },
            );
            await vi.advanceTimersByTimeAsync(2000);
            const stopped = await waiting;
            expect(stopped.isSent).toBe(false);
            // Taken as Stop was pressed: main says so, and it is believed.
            let answer: (value: any) => void = () => {};
            electronSendAsyncMock.mockReturnValueOnce(
                new Promise((resolve) => {
                    answer = resolve;
                }),
            );
            const second = new AbortController();
            const racing = postIssueReport(genReport(), second.signal);
            await vi.advanceTimersByTimeAsync(10);
            second.abort();
            answer({ ok: true });
            await vi.advanceTimersByTimeAsync(2000);
            expect((await racing).isSent).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('says nothing was sent when no report server is shared, with how to send it by hand', async () => {
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'no-server',
            detail: 'no report server is shared right now',
        });
        const report = genReport();
        const posted = await postIssueReport(report);
        expect(posted.isSent).toBe(false);
        expect(posted.sendFailure).toBeNull();
        const said = describePostedReport(report, posted);
        expect(said).toContain('No report server is shared');
        expect(said).toContain('nothing was sent');
        expect(said).not.toContain('Sent.');
        expect(said).toContain('`owf2025@gmail.com`');
        expect(said).toContain('**Copy report**');
    });

    // The report server asleep at the press: the report is kept by the
    // app and goes by itself -- not left to an email nobody writes.
    it('says a report the server was away for is kept and will go by itself', async () => {
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
            queued: true,
        });
        const report = genReport('data:image/png;base64,AAAA');
        const posted = await postIssueReport(report);
        expect(posted.isSent).toBe(false);
        expect(posted.isQueued).toBe(true);
        const said = describePostedReport(report, posted);
        expect(said).toContain(
            'the report server is not answering right now (the report ' +
                'server did not answer). I kept it, and the app will send it ' +
                'by itself as soon as that server is back',
        );
        expect(said).toContain('nothing more you need to do');
        // Not the words for a report that went nowhere.
        expect(said).not.toContain('Nothing was sent');
        expect(said).not.toContain('Sent.');
        // Not kept: said as before.
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
        });
        const notKept = await postIssueReport(report);
        expect(notKept.isQueued).toBe(false);
        expect(describePostedReport(report, notKept)).toContain(
            'Nothing was sent',
        );
    });

    it('says why a report server did not take it, and still how to send it by hand', async () => {
        electronSendAsyncMock.mockResolvedValueOnce({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
        });
        const report = genReport('data:image/png;base64,AAAA');
        const posted = await postIssueReport(report);
        expect(posted.isSent).toBe(false);
        expect(posted.sendFailure).toBe('the report server did not answer');
        const said = describePostedReport(report, posted);
        expect(said).toContain(
            'I could not send it: the report server did not answer. ' +
                'Nothing was sent',
        );
        expect(said).toContain('Downloads folder');
        expect(said).toContain(`attach \`${report.reference}.png\``);
    });

    it('does not claim a send the main process never answered for', async () => {
        electronSendAsyncMock.mockRejectedValueOnce(new Error('no handler'));
        const report = genReport();
        const posted = await postIssueReport(report);
        expect(posted.isSent).toBe(false);
        expect(posted.sendFailure).toBe('the app could not hand it over');
        vi.useFakeTimers();
        try {
            electronSendAsyncMock.mockReturnValueOnce(new Promise(() => {}));
            const waiting = postIssueReport(report);
            await vi.advanceTimersByTimeAsync(60 * 1000);
            const late = await waiting;
            expect(late.isSent).toBe(false);
            expect(late.sendFailure).toBe('the app took too long to send it');
        } finally {
            vi.useRealTimers();
        }
    });

    it('says the picture went with the text', async () => {
        const report = genReport('data:image/png;base64,AAAA');
        const posted = await postIssueReport(report);
        expect(posted.imageFilePath).toBe(`/downloads/${report.reference}.png`);
        expect(posted.sentFileNames).toEqual([`${report.reference}.png`]);
        const said = describePostedReport(report, posted);
        expect(said).toContain('Sent.');
        expect(said).toContain(
            `with 1 file — \`${report.reference}.png\` — and I kept a copy`,
        );
        expect(said).not.toContain('Not sent');
    });

    it('sends nothing when the report could not even be saved', async () => {
        electronSendAsyncMock.mockClear();
        fsWriteFileSyncMock.mockImplementationOnce(() => {
            throw new Error('disk full');
        });
        const report = genReport();
        const posted = await postIssueReport(report);
        expect(posted).toMatchObject({
            isSent: false,
            filePath: null,
            failure: 'I could not save the report: disk full',
        });
        expect(electronSendAsyncMock).not.toHaveBeenCalled();
        expect(describePostedReport(report, posted)).toBe(
            'I could not save the report: disk full The report is called ' +
                `${report.reference}.`,
        );
    });

    it('tells the main process to stop the sending when Stop is pressed', async () => {
        sendDataMock.mockClear();
        let answer: (value: any) => void = () => {};
        electronSendAsyncMock.mockReturnValueOnce(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        const controller = new AbortController();
        const waiting = postIssueReport(genReport(), controller.signal);
        // The save is synchronous; the post is out by the next turn.
        await Promise.resolve();
        const { requestId } = electronSendAsyncMock.mock.lastCall?.[1] ?? {};
        expect(typeof requestId).toBe('string');
        controller.abort();
        expect(sendDataMock).toHaveBeenCalledWith(
            'main:app:llm-report-post-cancel',
            { requestId },
        );
        answer({ ok: false, reason: 'cancelled', detail: 'stopped' });
        expect((await waiting).isSent).toBe(false);
    });
});

describe('genReportOffer', () => {
    it('offers to look into a problem the app named, and does nothing itself', () => {
        const offer = genReportOffer(
            'The app showed an error in the Presenter window:\n `boom`',
        );
        expect(offer.text).toContain('The app ran into a problem:');
        // On one line, and it cannot break out of the code span.
        expect(offer.text).toContain(
            "`The app showed an error in the Presenter window: 'boom'`",
        );
        expect(offer.text).toContain('Press Report to let me look into it');
        expect(offer.text).toContain(
            'Nothing is sent until you then press Send report.',
        );
        expect(offer.actions).toEqual([
            {
                label: 'Report',
                toolName: REPORT_START_TOOL_NAME,
                args: {
                    complaint:
                        'The app showed an error in the Presenter window: `boom`',
                },
            },
        ]);
    });

    it('asks what went wrong -- or what could be better -- when nothing is named', () => {
        const offer = genReportOffer('  ');
        expect(offer.text).toContain('Tell me what went wrong');
        expect(offer.text).toContain('what you wish the app did better');
        expect(offer.text).toContain(
            'Nothing is sent until you then press Send report.',
        );
        // Report then takes what is in the box: the card carries no words.
        expect(offer.actions).toEqual([
            { label: 'Report', toolName: REPORT_START_TOOL_NAME, args: {} },
        ]);
    });
});

// "I'm trying to report but it's hard": asked what went wrong, the user
// typed it, attached a picture and pressed Ask -- and it was answered as a
// question. A tab that is reporting keeps reporting.
describe('readReportThread', () => {
    const offer = (problem: string) => {
        return { author: 'bot', ...genReportOffer(problem) };
    };
    const said = (text: string) => {
        return { author: 'you', text, note: REPORT_NOTE };
    };
    const prepared = {
        author: 'bot',
        text: 'Press Send report',
        actions: [
            {
                label: 'Send report',
                toolName: REPORT_SEND_TOOL_NAME,
                args: { reference: 'OWA-261013-127b' },
            },
            {
                label: 'Copy report',
                toolName: REPORT_COPY_TOOL_NAME,
                args: { reference: 'OWA-261013-127b' },
            },
        ],
    };
    const sent = {
        author: 'bot',
        text: 'Sent.',
        actions: [
            { label: 'Copy report', toolName: REPORT_COPY_TOOL_NAME, args: {} },
            {
                label: 'Copy subject',
                toolName: REPORT_COPY_SUBJECT_TOOL_NAME,
                args: {},
            },
        ],
    };

    it('is nothing in a tab that only asked questions', () => {
        expect(readReportThread([])).toBeNull();
        expect(
            readReportThread([
                { author: 'you', text: 'How do I add a song?' },
                { author: 'bot', text: 'Like this.' },
            ]),
        ).toBeNull();
    });

    it('starts at the card that asks what went wrong', () => {
        expect(readReportThread([offer('')])).toEqual({
            problem: '',
            said: [],
            isPrepared: false,
        });
        // What is typed next is the report, whatever button sends it.
        expect(
            genReportComplaint(
                readReportThread([offer('')])!,
                ' keep seeing the error in console log ',
            ),
        ).toBe('keep seeing the error in console log');
    });

    it('keeps the problem the app named behind what the person adds', () => {
        const thread = readReportThread([
            { author: 'you', text: 'an earlier question' },
            { author: 'bot', text: 'an earlier answer' },
            offer('The app showed an error: boom'),
        ])!;
        expect(thread.problem).toBe('The app showed an error: boom');
        expect(genReportComplaint(thread, 'I had just opened the Reader')).toBe(
            'I had just opened the Reader\n\nThe app showed an error: boom',
        );
        // Nothing typed: the problem alone, once.
        expect(genReportComplaint(thread, '')).toBe(
            'The app showed an error: boom',
        );
    });

    it('goes on after the write-up, until Send report has been pressed', () => {
        const messages = [offer(''), said('the screen went black'), prepared];
        const thread = readReportThread(messages)!;
        expect(thread).toEqual({
            problem: '',
            said: ['the screen went black'],
            isPrepared: true,
        });
        // More from them is added to what they said, not asked afresh.
        expect(genReportComplaint(thread, 'it happens after I press F5')).toBe(
            'the screen went black\n\nit happens after I press F5',
        );
        // Saying the same thing again adds nothing.
        expect(genReportComplaint(thread, 'the screen went black')).toBe(
            'the screen went black',
        );
        // Sent: the tab is back to questions.
        expect(readReportThread([...messages, sent])).toBeNull();
        // And a new report after it starts clean.
        expect(
            readReportThread([...messages, sent, offer(''), said('another')]),
        ).toEqual({ problem: '', said: ['another'], isPrepared: false });
    });

    it('knows a report started with the Report button, with no card', () => {
        expect(
            readReportThread([said('the font is too small'), prepared]),
        ).toEqual({
            problem: '',
            said: ['the font is too small'],
            isPrepared: true,
        });
        // Said, but nothing written up yet and no card: it is being
        // looked into, and what is typed next is more for the same report.
        expect(readReportThread([said('the font is too small')])).toEqual({
            problem: '',
            said: ['the font is too small'],
            isPrepared: false,
        });
    });

    // A report written again -- more was said, or the steps did not help.
    it('keeps everything attached to the report, each once, past a second write-up', () => {
        const picture = {
            id: 'a1',
            kind: 'image' as const,
            name: 'image.png',
            mimeType: 'image/png',
            byteSize: 9,
        };
        const pdf = genFileAttachment('order.pdf', 100, '/d/order.pdf');
        const messages = [
            // Attached to a QUESTION, before any report: not the report's.
            {
                author: 'you',
                text: 'how do I print?',
                attachments: [{ ...picture, id: 'q1' }],
            },
            offer(''),
            { ...said('it prints wrong'), attachments: [picture] },
            prepared,
            { ...said('still wrong'), attachments: [picture, pdf] },
        ];
        expect(
            readReportThreadAttachments(messages).map((one) => {
                return one.id;
            }),
        ).toEqual(['a1', pdf.id]);
        // Sent: the next report starts with nothing.
        expect(readReportThreadAttachments([...messages, sent])).toEqual([]);
    });
});

// "Did that solve it?" answered in the box instead of on a button.
describe('readFixReply', () => {
    const fixCard = {
        author: 'bot',
        text: 'Try this first',
        actions: [
            {
                label: 'That fixed it',
                toolName: REPORT_FIXED_TOOL_NAME,
                args: { reference: 'OWA-261013-0abc' },
            },
            {
                label: 'Still a problem — report it',
                toolName: REPORT_STILL_TOOL_NAME,
                args: { reference: 'OWA-261013-0abc' },
            },
        ],
    };
    const asked = { author: 'you', text: 'the words do not show' };

    it('reads a yes or a no as the button it means', () => {
        for (const typed of [
            'yes',
            'Yes, thanks!',
            'that fixed it',
            'it works now',
            'thank you',
            'ok',
            'Fixed.',
        ]) {
            expect(readFixReply([asked, fixCard], typed)).toEqual({
                reply: 'fixed',
                reference: 'OWA-261013-0abc',
            });
        }
        for (const typed of [
            'no',
            'No.',
            'still broken',
            'still',
            "it didn't",
            'that did not help',
            'same problem',
        ]) {
            expect(readFixReply([asked, fixCard], typed)?.reply).toBe('still');
        }
    });

    it('leaves anything that says more to the report, and other cards alone', () => {
        // More to say IS more for the report.
        for (const typed of [
            'no, the screen is still black after I press Show',
            'yes but now the font is tiny',
            'it happens after F6',
            '',
        ]) {
            expect(readFixReply([asked, fixCard], typed)).toBeNull();
        }
        // "yes" under any other answer is not this card's button.
        expect(readFixReply([asked], 'yes')).toBeNull();
        expect(
            readFixReply(
                [fixCard, { author: 'bot', text: 'I have written this up' }],
                'yes',
            ),
        ).toBeNull();
    });
});

describe('what a report says of the machine it came from', () => {
    it('reads the console without the account name, and quotes the conversation cut', async () => {
        vi.mocked(callTool).mockImplementation(async () => {
            throw new Error('not read');
        });
        // What main kept of the main window's console: errors and warnings
        // only, heard since the window was made.
        electronSendAsyncMock.mockClear();
        electronSendAsyncMock.mockResolvedValueOnce([
            "error: ENOENT: no such file, open 'C:\\Users\\Sokha Chan\\AppData\\Roaming\\open-worship-app\\x.json'",
            'warning: failed to load file:///C:/Users/sokha/Desktop/song.lyric',
            'error: at /home/sokha/.config/app/main.js:10:2',
            // Not a line: dropped, never drawn.
            42,
        ]);
        try {
            const evidence = await collectReportEvidence([
                { author: 'bot', text: 'x'.repeat(55000) },
                { author: 'you', text: 'short' },
            ]);
            expect(evidence.consoleLines).toEqual([
                "error: ENOENT: no such file, open 'C:\\Users\\~\\AppData\\Roaming\\open-worship-app\\x.json'",
                'warning: failed to load file:///C:/Users/~/Desktop/song.lyric',
                'error: at /home/~/.config/app/main.js:10:2',
            ]);
            // Asked of the main process, which has heard the window since
            // it was made -- not of the tool host, whose console tool
            // refuses a call that names no page and so answered nothing.
            expect(electronSendAsyncMock).toHaveBeenCalledWith(
                'main:app:recent-console',
                {},
            );
            expect(
                vi.mocked(callTool).mock.calls.some(([name]) => {
                    return name === 'list_console_messages';
                }),
            ).toBe(false);
            // A manual page read whole into an answer is not quoted whole.
            expect(evidence.turns[0].text.length).toBeLessThan(2100);
            expect(evidence.turns[0].text).toContain(
                '53000 more characters were left out',
            );
            expect(evidence.turns[1].text).toBe('short');
        } finally {
            vi.mocked(callTool).mockReset();
        }
    });
});

describe('what the person attached to a report', () => {
    const toAttached = (name: string) => {
        return genTextAttachment(name, 'words');
    };

    it('is named in the saved document and in the copy that goes as words alone', () => {
        const report = genPreparedReport({
            complaint: 'keep seeing the error in console log',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
            attachments: [toAttached('image.png'), toAttached('odd`name.txt')],
        });
        for (const text of [report.markdown, report.prompt]) {
            expect(text).toContain(
                '- `image.png` — attached by the user while reporting. ' +
                    'It is NOT part of this text: ask them for it.',
            );
            expect(text).toContain("- `odd'name.txt`");
            expect(text).toContain(`${report.reference}.png`);
        }
        // With no picture of the app and nothing attached there is no section.
        expect(
            genPreparedReport({
                complaint: 'x',
                answerText: '',
                evidence: EVIDENCE,
                imageDataUrl: null,
            }).markdown,
        ).not.toContain('## Attached');
        // Their file alone still gets one.
        expect(
            genPreparedReport({
                complaint: 'x',
                answerText: '',
                evidence: EVIDENCE,
                imageDataUrl: null,
                attachments: [toAttached('log.txt')],
            }).markdown,
        ).toContain('## Attached\n\n- `log.txt`');
    });
});

// "Some problem is not issue, it is user problem so before helping user to
// report let try to help user to resolve it first."
describe('helping before reporting', () => {
    const ANSWER =
        'No screen is switched on, so there is nowhere for the words to go.\n' +
        '\n' +
        'TRY THIS:\n' +
        '1. Press Show under the Mini Screen.\n' +
        '2. Click the slide again.\n' +
        '\n' +
        'REPORT:\n' +
        'TITLE: Nothing appears on the projector\n' +
        'WHAT HAPPENED: no screen was showing when the slide was presented\n' +
        'EXPECTED: the slide appears\n';

    it('asks the model to say first whether they can put it right themselves', () => {
        const asked = genReportInvestigation('it went blank', EVIDENCE);
        expect(asked).toContain('something they can put right THEMSELVES');
        expect(asked).toContain('a line starting TRY THIS:');
        // Never a guess dressed as a fix, and the report is written anyway.
        expect(asked).toContain('when you are not sure the steps would work');
        expect(asked).toContain('THEN, always, the report');
        expect(asked).toContain('For a wish, write what');
    });

    it('reads what to try apart from what was found and from the report', () => {
        const parsed = parseReportDraft(ANSWER);
        expect(parsed.summary).toBe(
            'No screen is switched on, so there is nowhere for the words to go.',
        );
        expect(parsed.fix).toBe(
            '1. Press Show under the Mini Screen.\n2. Click the slide again.',
        );
        expect(parsed.title).toBe('Nothing appears on the projector');
        // A fault or a wish carries none.
        expect(parseReportDraft('Broken.\n\nREPORT:\nTITLE: x\n').fix).toBe('');
        // Steps with no report after them are still steps.
        expect(parseReportDraft('Found it.\nTRY THIS: press Show').fix).toBe(
            'press Show',
        );
    });

    it('answers with the steps and two buttons, and holds the report back', () => {
        const report = genPreparedReport({
            complaint: 'the words do not show on the projector',
            answerText: ANSWER,
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        expect(report.fix).toContain('Press Show under the Mini Screen');
        const card = genFixCard(report);
        expect(card.text).toContain('No screen is switched on');
        expect(card.text).toContain('Try this first:\n1. Press Show');
        expect(card.text).toContain('Did that solve it?');
        // Not offered yet: no Send, and no word of filing.
        expect(card.text).not.toContain('Send report');
        expect(card.actions).toEqual([
            {
                label: 'That fixed it',
                toolName: REPORT_FIXED_TOOL_NAME,
                args: { reference: report.reference },
            },
            {
                label: 'Still a problem — report it',
                toolName: REPORT_STILL_TOOL_NAME,
                args: { reference: report.reference },
            },
        ]);
        // What a maintainer reads, if it is sent after all.
        for (const document of [report.markdown, report.prompt]) {
            expect(document).toContain(
                '## What the user was told to try first',
            );
            expect(document).toContain('They said it did not solve it.');
        }
    });

    it('offers the report at once for a fault or a wish', () => {
        const report = genPreparedReport({
            complaint: 'I wish the verse numbers were bigger',
            answerText:
                'That is not a setting.\n\nREPORT:\nTITLE: Bigger numbers\n',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        expect(report.fix).toBe('');
        expect(report.markdown).not.toContain('told to try first');
        const card = genPreparedCard(report);
        expect(card.text).toContain('That is not a setting.');
        expect(card.text).toContain(
            'I have written this up as "Bigger numbers"',
        );
        expect(card.actions.map((one) => one.label)).toEqual([
            'Send report',
            'Copy report',
        ]);
        // Put up after "Still a problem": what was found is not said twice.
        expect(
            genPreparedCard(report, false).text.startsWith('I have written'),
        ).toBe(true);
    });

    it('keeps the tab reporting while they try it, and closes it when it worked', () => {
        const fixCard = {
            author: 'bot',
            text: 'Try this first',
            actions: [
                {
                    label: 'That fixed it',
                    toolName: REPORT_FIXED_TOOL_NAME,
                    args: {},
                },
                {
                    label: 'Still a problem — report it',
                    toolName: REPORT_STILL_TOOL_NAME,
                    args: {},
                },
            ],
        };
        const said = {
            author: 'you',
            text: 'the words do not show',
            note: REPORT_NOTE,
        };
        // "No, the screen is still black" typed under the steps is more
        // for the same report, not a new question.
        expect(readReportThread([said, fixCard])).toEqual({
            problem: '',
            said: ['the words do not show'],
            isPrepared: true,
        });
        // It worked: closed, nothing to send, and the tab asks questions again.
        const closed = {
            author: 'bot',
            text: REPORT_FIXED_TEXT,
            note: REPORT_RESOLVED_NOTE,
        };
        expect(readReportThread([said, fixCard, closed])).toBeNull();
        expect(REPORT_FIXED_TEXT).toContain('Nothing was sent');
    });
});

describe('the buttons under a saved report', () => {
    const report = genPreparedReport({
        complaint: 'font is too small',
        answerText: 'REPORT:\nTITLE: Font too small\n',
        evidence: EVIDENCE,
        imageDataUrl: 'data:image/png;base64,AAAA',
        contact: { email: 'owf2025@gmail.com', source: 'help page' },
    });

    it('carry only the reference, never the address', () => {
        const actions = genReportFollowUpActions(report);
        expect(actions.map((one) => one.toolName)).toEqual([
            REPORT_COPY_TOOL_NAME,
            REPORT_COPY_SUBJECT_TOOL_NAME,
            REPORT_COPY_IMAGE_TOOL_NAME,
            REPORT_COPY_EMAIL_TOOL_NAME,
            REPORT_EMAIL_TOOL_NAME,
        ]);
        for (const action of actions) {
            expect(action.args).toEqual({ reference: report.reference });
        }
    });

    it('describe the same route the document names', () => {
        const said = describeHowToSend(report, `${report.reference}.png`);
        expect(said).toContain('`owf2025@gmail.com`');
        expect(said).toContain('**Copy report**');
        expect(said).toContain(`\`${report.reference}.png\``);
        // The subject on a line of its own, with the button that copies it.
        expect(said).toContain('**Copy subject**');
        expect(said).toContain(`\n\`${report.subject}\`\n`);
        expect(said).toContain('**Email it**');
    });

    it('rebuild the subject for a report the window no longer holds', () => {
        expect(toSavedReportSubject(report, '', report.reference)).toBe(
            report.subject,
        );
        expect(
            toSavedReportSubject(
                null,
                '# Font too small\n\nbody',
                'OWA-260912-abcd',
            ),
        ).toBe('[Open Worship app] Font too small (OWA-260912-abcd)');
        // A saved file with no heading still gets a line a mailbox can sort.
        expect(
            toSavedReportSubject(null, 'no heading', 'OWA-260912-abcd'),
        ).toBe('[Open Worship app] OWA-260912-abcd (OWA-260912-abcd)');
    });

    it('open the mail app with the address and subject, not the report', () => {
        const url = genReportMailtoUrl({
            contactEmail: report.contactEmail ?? '',
            subject: report.subject,
            reference: report.reference,
            hasImage: true,
        });
        expect(url.startsWith('mailto:owf2025@gmail.com?subject=')).toBe(true);
        expect(url).toContain(encodeURIComponent(report.subject));
        // The body says to paste and to attach; the report itself is on the
        // clipboard, because a mailto body is cut at a couple of thousand
        // characters by the clients that take one at all.
        const body = decodeURIComponent(url.split('&body=')[1]);
        expect(body).toContain(`attach ${report.reference}.png`);
        expect(body).not.toContain('## What the user reported');
        expect(
            decodeURIComponent(
                genReportMailtoUrl({
                    contactEmail: 'x@y.z',
                    subject: 's',
                    reference: 'OWA-260912-abcd',
                    hasImage: false,
                }).split('&body=')[1],
            ),
        ).not.toContain('.png');
    });
});

describe('genReportSubject and readReportTitle', () => {
    it('name the app, the title and the reference', () => {
        expect(genReportSubject('Font too small', 'OWA-260912-abcd')).toBe(
            '[Open Worship app] Font too small (OWA-260912-abcd)',
        );
    });
    it('read the title back off a saved document', () => {
        expect(readReportTitle('# Font too small\n\nbody')).toBe(
            'Font too small',
        );
        expect(readReportTitle('no heading')).toBe('');
    });
});

describe('the prepared-report map', () => {
    it('hands a report back once and forgets the oldest past its cap', () => {
        const reports = [1, 2, 3, 4].map((index) => {
            const report = genPreparedReport({
                complaint: `problem ${index.toString()}`,
                answerText: '',
                evidence: EVIDENCE,
                imageDataUrl: null,
            });
            keepPreparedReport(report);
            return report;
        });
        expect(takePreparedReport(reports[3].reference)).not.toBeNull();
        expect(takePreparedReport(reports[1].reference)).not.toBeNull();
        // Four kept, three held: the first one out is the first one in.
        expect(takePreparedReport(reports[0].reference)).toBeNull();
        // A reference nobody prepared is a window that has been reopened.
        expect(takePreparedReport('OWA-000000-0000')).toBeNull();
    });
});

describe('readReportMarkdown', () => {
    it('answers from memory while the window holds the report', async () => {
        fsReadFileMock.mockClear();
        const report = genPreparedReport({
            complaint: 'kept',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        keepPreparedReport(report);
        expect(await readReportMarkdown(report.reference)).toBe(
            report.markdown,
        );
        expect(fsReadFileMock).not.toHaveBeenCalled();
    });

    it('falls back to the saved file in Downloads by its own name', async () => {
        fsReadFileMock.mockClear();
        expect(await readReportMarkdown('OWA-260912-abcd')).toBe(
            '# Saved title\n\nsaved body\n',
        );
        expect(fsReadFileMock).toHaveBeenCalledWith(
            '/downloads/OWA-260912-abcd.md',
        );
    });

    it('never goes to the disk for a reference that is not one', async () => {
        fsReadFileMock.mockClear();
        for (const bad of ['../etc/passwd', 'OWA-260912-abcd/../x', '']) {
            expect(await readReportMarkdown(bad)).toBeNull();
        }
        expect(fsReadFileMock).not.toHaveBeenCalled();
    });

    it('answers null, not a throw, for a file that is gone', async () => {
        fsReadFileMock.mockRejectedValueOnce(new Error('ENOENT'));
        expect(await readReportMarkdown('OWA-260912-ffff')).toBeNull();
    });
});

describe('readReportImageDataUrl', () => {
    it('answers the kept picture, or null for a report with none', () => {
        fsReadFileBase64SyncMock.mockClear();
        const withImage = genPreparedReport({
            complaint: 'kept',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
        });
        keepPreparedReport(withImage);
        expect(readReportImageDataUrl(withImage.reference)).toBe(
            'data:image/png;base64,AAAA',
        );
        const without = genPreparedReport({
            complaint: 'kept',
            answerText: '',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        keepPreparedReport(without);
        // A kept report with no picture never goes looking on disk for one.
        expect(readReportImageDataUrl(without.reference)).toBeNull();
        expect(fsReadFileBase64SyncMock).not.toHaveBeenCalled();
    });

    it('reads the saved picture back by its own name after a reopen', () => {
        fsReadFileBase64SyncMock.mockClear();
        expect(readReportImageDataUrl('OWA-260912-abcd')).toBe(
            'data:image/png;base64,UE5H',
        );
        expect(fsReadFileBase64SyncMock).toHaveBeenCalledWith(
            '/downloads/OWA-260912-abcd.png',
        );
        fsReadFileBase64SyncMock.mockImplementationOnce(() => {
            throw new Error('ENOENT');
        });
        expect(readReportImageDataUrl('OWA-260912-ffff')).toBeNull();
    });

    it('never goes to the disk for a reference that is not one', () => {
        fsReadFileBase64SyncMock.mockClear();
        for (const bad of ['../etc/passwd', 'OWA-260912-abcd/../x', '']) {
            expect(readReportImageDataUrl(bad)).toBeNull();
        }
        expect(fsReadFileBase64SyncMock).not.toHaveBeenCalled();
    });
});
