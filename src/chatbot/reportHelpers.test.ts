import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/appProvider', () => {
    return {
        default: {
            appInfo: { title: 'Open Worship app', version: '2026.08.15' },
            systemUtils: {
                isDev: true,
                isWindows: true,
                isMac: false,
                isLinux: false,
                commitHash: 'abcdef1234567890',
            },
        },
    };
});
vi.mock('../server/fileHelpers', () => {
    return {
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
    genPreparedReport,
    keepPreparedReport,
    parseReportDraft,
    takePreparedReport,
} = await import('./reportHelpers');

const EVIDENCE = {
    collectedAt: '2026-09-01T21:00:00.000Z',
    appLine: 'Open Worship app 2026.08.15 on Windows (dev build)',
    windowLine: 'Window: Presenter (presenter.html), language en, theme dark',
    screenLine: 'Screens: none showing, 1 display(s) attached',
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

describe('genPreparedReport', () => {
    it('writes one document out of the account and the evidence', () => {
        const report = genPreparedReport({
            complaint: 'the bible text does not show on the projector',
            answerText:
                'No screen is showing.\n\nREPORT:\nTITLE: Projector blank\n' +
                'WHAT HAPPENED: no screen was started\n',
            evidence: EVIDENCE,
            imageDataUrl: 'data:image/png;base64,AAAA',
        });
        expect(report.reference).toMatch(/^OWA-\d{6}-[0-9a-f]{4}$/);
        expect(report.title).toBe('Projector blank');
        expect(report.summary).toBe('No screen is showing.');
        expect(report.markdown).toContain('# Projector blank');
        expect(report.markdown).toContain(
            'the bible text does not show on the projector',
        );
        expect(report.markdown).toContain(EVIDENCE.screenLine);
        expect(report.markdown).toContain('error: something went wrong');
        // The picture is named in the document, and the document says whose.
        expect(report.markdown).toContain(`${report.reference}.png`);
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
