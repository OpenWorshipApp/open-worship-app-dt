import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../../tools/owa-devtools-mcp/tran.mjs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        entries: [] as any[],
        rows: [] as any[],
        manifest: {} as any,
        importResult: { importedBibleKeys: [] as string[] },
        dictionaries: [] as Record<string, string>[],
    },
    mocks: {
        input: vi.fn(),
        selectFiles: vi.fn(),
        create: vi.fn(),
        open: vi.fn(),
        resolve: vi.fn(),
        imported: vi.fn(),
        progress: vi.fn(),
        hideProgress: vi.fn(),
        toast: vi.fn(),
        error: vi.fn(),
        explorer: vi.fn(),
        cleanup: vi.fn(),
        callback: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../../helper/appArchiveHelpers', () => ({
    createWorkDir: async () => '/tmp/import',
    safeDeleteDir: mocks.cleanup,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: mocks.error }));
vi.mock('../../popup-widget/ArchiveItemSelectorComp', () => ({
    default: () => null,
}));
vi.mock('../../popup-widget/ArchivePasswordComp', () => ({
    ArchivePasswordComp: () => null,
    MAX_PASSWORD_ATTEMPTS: 3,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: mocks.input,
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.progress,
    hideProgressBar: mocks.hideProgress,
}));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.explorer,
}));
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../../server/fileHelpers', () => ({ selectFiles: mocks.selectFiles }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./bibleXMLArchiveHelpers', () => ({
    BIBLE_XML_IMPORT_ISSUE_MESSAGE_MAP: {
        unreadable: 'Unable to read this bible file',
        duplicate: 'Bible key already exists',
        'duplicate-in-archive': 'Duplicate bible key in this archive',
    },
    createBibleXMLArchive: mocks.create,
    getExportableBibleXMLEntries: async () => state.entries,
    importBibleXMLEntries: mocks.imported,
    openBibleXMLArchive: mocks.open,
    resolveBibleXMLImportEntries: mocks.resolve,
}));

import {
    handleBibleXMLExporting,
    handleBibleXMLImporting,
} from './bibleXMLArchiveMenuHelpers';

const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
);
const bible = (key: string, issue: string | null = null) => ({
    bibleKey: key,
    title: `${key} Bible`,
    filePath: `/bibles/${key}.xml`,
    archivePath: `files/${key}.xml`,
    issue,
});

function children(element: any) {
    return element.props.children;
}

beforeEach(() => {
    state.dictionaries = dictionaries;
    state.entries = [];
    state.rows = [];
    state.manifest = { bibles: [] };
    state.importResult = { importedBibleKeys: [] };
    mocks.input.mockResolvedValue(true);
    mocks.selectFiles.mockResolvedValue(['/downloads/bibles.tar']);
    mocks.create.mockResolvedValue('/downloads/bibles.tar');
    mocks.open.mockImplementation(async () => state.manifest);
    mocks.resolve.mockImplementation(async () => state.rows);
    mocks.imported.mockImplementation(async () => state.importResult);
    mocks.cleanup.mockResolvedValue(undefined);
});

describe('Bible XML archive menu flows', () => {
    test('explains an empty export without opening a picker', async () => {
        await handleBibleXMLExporting();
        expect(mocks.input).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Bible Data',
            expect.stringContaining('no Bible XML file'),
        );
        expect(mocks.progress).toHaveBeenCalledWith('Export Bible Data');
        expect(mocks.hideProgress).toHaveBeenCalledWith('Export Bible Data');
    });

    test('exports only chosen Bibles with a confirmed password', async () => {
        state.entries = [bible('KJV'), bible('WEB')];
        mocks.input.mockImplementation(async (_title: string, element: any) => {
            const [selector, passwordBox] = children(element);
            selector.props.onChange(['WEB']);
            children(passwordBox).props.onChange('secret', 'secret');
            return true;
        });
        await handleBibleXMLExporting();
        expect(mocks.create).toHaveBeenCalledWith([bible('WEB')], 'secret');
        expect(mocks.explorer).toHaveBeenCalledWith('/downloads/bibles.tar');
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Bible Data',
            'Exported to /downloads/bibles.tar',
        );
    });

    test('re-asks a mismatched password without exporting the first answer', async () => {
        state.entries = [bible('KJV'), bible('WEB')];
        let attempt = 0;
        mocks.input.mockImplementation(async (_title: string, element: any) => {
            const [selector, passwordBox] = children(element);
            selector.props.onChange(['KJV']);
            children(passwordBox).props.onChange(
                'secret',
                attempt++ === 0 ? 'mistyped' : 'secret',
            );
            return true;
        });
        await handleBibleXMLExporting();
        expect(mocks.input).toHaveBeenCalledTimes(2);
        expect(mocks.create).toHaveBeenCalledOnce();
        expect(mocks.create).toHaveBeenCalledWith([bible('KJV')], 'secret');
    });

    test('a cancelled export or an unchecked list creates nothing', async () => {
        state.entries = [bible('KJV')];
        mocks.input.mockResolvedValueOnce(false);
        await handleBibleXMLExporting();
        mocks.input.mockImplementationOnce(
            async (_title: string, element: any) => {
                children(element)[0].props.onChange([]);
                return true;
            },
        );
        await handleBibleXMLExporting();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    test('imports only selectable rows, reports refused rows and cleans extraction', async () => {
        state.rows = [bible('NEW'), bible('KJV', 'duplicate')];
        state.importResult = { importedBibleKeys: ['NEW'] };
        await handleBibleXMLImporting('/downloads/bibles.tar', mocks.callback);
        expect(mocks.imported).toHaveBeenCalledWith([bible('NEW')]);
        expect(mocks.callback).toHaveBeenCalledOnce();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Import Bible Data',
            'Imported 1 bible(s); 1 skipped',
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
        expect(mocks.open).toHaveBeenCalledOnce();
    });

    test('a cancelled password prompt returns silently and still cleans extraction', async () => {
        state.manifest = null;
        await handleBibleXMLImporting('/downloads/protected.enc');
        expect(mocks.input).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
    });

    test('picks a file when no path was supplied and contains archive errors', async () => {
        state.rows = [bible('NEW')];
        mocks.imported.mockRejectedValue(new Error('copy failed'));
        await handleBibleXMLImporting();
        expect(mocks.selectFiles).toHaveBeenCalledOnce();
        expect(mocks.error).toHaveBeenCalledOnce();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Import Bible Data',
            'copy failed',
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
        expect(mocks.hideProgress).toHaveBeenCalledWith('Import Bible Data');
    });
});
