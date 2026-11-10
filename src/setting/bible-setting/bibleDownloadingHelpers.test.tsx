// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        // What the last `downloadBible` was given, so a case can play the
        // download's own callbacks.
        options: null as any,
        bibleInfo: { locale: 'xx' } as object | null,
        isExtracted: true,
    },
    mocks: {
        clear: vi.fn(),
        download: vi.fn(),
        extract: vi.fn(),
        getBibleInfo: vi.fn(),
        getLangDataAsync: vi.fn(),
        toast: vi.fn(),
        handleError: vi.fn(),
        onDownloaded: vi.fn(),
    },
}));

vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    BIBLE_DOWNLOAD_TOAST_TITLE: 'Bible Download',
    downloadBible: mocks.download,
    extractDownloadedBible: mocks.extract,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfo,
}));
vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { clearBibleDatabaseData: mocks.clear },
}));
vi.mock('../../lang/langHelpers', () => ({
    getLangDataAsync: mocks.getLangDataAsync,
    tran: (text: string) => text,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

import { useDownloadBible } from './bibleDownloadingHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleInfo = { key: 'KJV', title: 'King James' } as any;

let container: HTMLDivElement;
let root: Root;
let start: () => void;

function ProbeComp() {
    const [progress, startDownload] = useDownloadBible(
        bibleInfo,
        mocks.onDownloaded,
    );
    start = startDownload;
    return <div>{progress === null ? 'idle' : `${progress}`}</div>;
}

async function startDownload() {
    await act(async () => {
        await start();
    });
}

async function finish(error: unknown, filePath?: string) {
    await act(async () => {
        await state.options.onDone(error, filePath);
    });
    // `onDone` does not await the finishing step: let it run out.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(async () => {
    state.options = null;
    state.bibleInfo = { locale: 'xx' };
    state.isExtracted = true;
    mocks.clear.mockResolvedValue(undefined);
    mocks.download.mockImplementation(({ options }: any) => {
        state.options = options;
    });
    mocks.extract.mockImplementation(async () => state.isExtracted);
    mocks.getBibleInfo.mockImplementation(async () => state.bibleInfo);
    mocks.getLangDataAsync.mockResolvedValue({});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(<ProbeComp />);
    });
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('downloading a Bible', () => {
    test('clears the old data first, then shows progress from zero', async () => {
        expect(container.textContent).toBe('idle');
        await startDownload();
        expect(mocks.clear).toHaveBeenCalledWith('KJV');
        expect(mocks.clear.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.download.mock.invocationCallOrder[0],
        );
        expect(mocks.download).toHaveBeenCalledWith(
            expect.objectContaining({ bibleInfo }),
        );
        expect(container.textContent).toBe('0');

        await act(async () => {
            state.options.onProgress(0.42);
        });
        expect(container.textContent).toBe('0.42');
    });

    test('says how big the file is when it starts', async () => {
        await startDownload();
        state.options.onStart(12.789);
        expect(mocks.toast).toHaveBeenCalledWith(
            'Bible Download',
            'Start downloading "KJV". File size 12mb',
        );
    });

    test('a finished download is extracted, its language loaded, and reported done', async () => {
        await startDownload();
        await finish(null, '/downloads/KJV.zip');
        expect(mocks.extract).toHaveBeenCalledWith('/downloads/KJV.zip');
        expect(mocks.getBibleInfo).toHaveBeenCalledWith('KJV', true);
        expect(mocks.getLangDataAsync).toHaveBeenCalledWith('xx');
        expect(mocks.onDownloaded).toHaveBeenCalledOnce();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(container.textContent).toBe('idle');
    });

    test('a failed download is logged, never extracted and never reported done', async () => {
        await startDownload();
        const error = new Error('network down');
        await finish(error);
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(mocks.extract).not.toHaveBeenCalled();
        expect(mocks.onDownloaded).not.toHaveBeenCalled();
        // The progress bar does not stay up after a failure.
        expect(container.textContent).toBe('idle');
    });

    test('an archive that will not extract says so and still ends the download', async () => {
        state.isExtracted = false;
        await startDownload();
        await finish(null, '/downloads/KJV.zip');
        expect(mocks.toast).toHaveBeenCalledWith(
            'Extracting Bible',
            'Fail to extract bible',
        );
        expect(mocks.getLangDataAsync).not.toHaveBeenCalled();
        expect(mocks.onDownloaded).toHaveBeenCalledOnce();
        expect(container.textContent).toBe('idle');
    });

    test('a Bible whose info cannot be read after extracting is reported as an error', async () => {
        await startDownload();
        state.bibleInfo = null;
        await finish(null, '/downloads/KJV.zip');
        expect(mocks.toast).toHaveBeenCalledWith(
            'Getting Bible Info',
            'Cannot get bible info',
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'Bible Download',
            'Error occurred during finishing bible download',
        );
        expect(mocks.handleError).toHaveBeenCalledWith(
            new Error('Cannot get bible info'),
        );
        expect(mocks.getLangDataAsync).not.toHaveBeenCalled();
        expect(mocks.onDownloaded).toHaveBeenCalledOnce();
        expect(container.textContent).toBe('idle');
    });
});
