import { describe, expect, it, vi } from 'vitest';

const { fsReadFileMock, fsReadFileBase64SyncMock } = vi.hoisted(() => {
    return {
        fsReadFileMock: vi.fn(async (_filePath: string): Promise<string> => {
            return '# Saved title\n\nsaved body\n';
        }),
        fsReadFileBase64SyncMock: vi.fn((_filePath: string): string => {
            return 'UE5H';
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
vi.mock('../server/fileHelpers', () => {
    return {
        fsReadFile: fsReadFileMock,
        fsReadFileBase64Sync: fsReadFileBase64SyncMock,
        fsWriteFileSync: vi.fn(),
        getDownloadPath: () => {
            return '/downloads';
        },
        pathJoin: (...parts: string[]) => {
            return parts.join('/');
        },
        writeFileFromBase64Sync: vi.fn(),
    };
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
    describeHowToSend,
    genPreparedReport,
    genReportFollowUpActions,
    genReportInvestigation,
    genReportMailtoUrl,
    genReportSubject,
    keepPreparedReport,
    parseReportDraft,
    readReportImageDataUrl,
    readReportMarkdown,
    readReportTitle,
    takePreparedReport,
    toSavedReportSubject,
} = await import('./reportHelpers');

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
