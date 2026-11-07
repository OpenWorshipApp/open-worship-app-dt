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

vi.mock('../../../../../../server/appProvider', () => {
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
vi.mock('../../../../../../server/fileHelpers', async () => {
    // The real rule, borrowed from its leaf: it needs no file layer.
    const { toPathScrubbed } = await vi.importActual<
        typeof import('../../../../../../server/accountPathHelpers')
    >('../../../../../../server/accountPathHelpers');
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
vi.mock('../../../../../../server/electronSendHelpers', () => {
    return { electronSendAsync: electronSendAsyncMock };
});
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/mcpClient', () => {
    return { callTool: vi.fn(), parseToolJson: vi.fn() };
});

const {
    describePostedReport,
    gatherReportFiles,
    genPreparedReport,
    genReportPromptWithFiles,
    postIssueReport,
} = await import('../../../../../../chatbot/reportHelpers');
const { genFileAttachment, genTextAttachment } =
    await import('../../../../../../chatbot/attachmentHelpers');

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

describe('postIssueReport', () => {
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
});
