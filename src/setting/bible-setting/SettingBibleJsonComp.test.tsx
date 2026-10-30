// @vitest-environment jsdom

// The downloaded / online Bible lists of the Bible settings page, rendered
// whole: SettingBibleJsonComp, both list components, both item components,
// the two list hooks and the download hook, on one mock surface.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getDownloadedBibleInfoListMock: vi.fn(),
    getOnlineBibleInfoListMock: vi.fn(),
    downloadBibleMock: vi.fn(),
    extractDownloadedBibleMock: vi.fn(),
    getBibleInfoMock: vi.fn(),
    getLangDataAsyncMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    handleErrorMock: vi.fn(),
    clearBibleDatabaseDataMock: vi.fn(),
    toBiblePathMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    getAllXMLFileKeysMock: vi.fn(),
    loadBibleXMLKeysMock: vi.fn(),
    xmlKeys: {
        bibleKeysMap: {} as Record<string, string> | null,
        isPending: false,
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
    getLangDataAsync: h.getLangDataAsyncMock,
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        // As the real hook: the effect gets its own copy of the setters,
        // neutralised once the effect is cleaned up.
        useAppEffectAsync: (
            effectMethod: (context: any) => Promise<void>,
            deps: any[],
            methods: Record<string, any> = {},
        ) => {
            react.useEffect(() => {
                const context = { ...methods };
                effectMethod(context);
                return () => {
                    for (const key in context) {
                        context[key] = () => {};
                    }
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [...deps, ...Object.values(methods)]);
        },
    };
});

vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));

vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    BIBLE_DOWNLOAD_TOAST_TITLE: 'Bible Download',
    downloadBible: h.downloadBibleMock,
    extractDownloadedBible: h.extractDownloadedBibleMock,
    getDownloadedBibleInfoList: h.getDownloadedBibleInfoListMock,
    getOnlineBibleInfoList: h.getOnlineBibleInfoListMock,
}));

vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfoMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));

vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: {
        clearBibleDatabaseData: h.clearBibleDatabaseDataMock,
        toBiblePath: h.toBiblePathMock,
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: h.fsCheckDirExistMock,
    fsDeleteDir: h.fsDeleteDirMock,
}));

vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: h.showProgressBarMock,
    hideProgressBar: h.hideProgressBarMock,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
}));

vi.mock('./bibleXMLHelpers', () => ({
    useBibleXMLKeys: () => ({
        bibleKeysMap: h.xmlKeys.bibleKeysMap,
        isPending: h.xmlKeys.isPending,
        loadBibleKeys: h.loadBibleXMLKeysMock,
    }),
}));

vi.mock('./bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: h.getAllXMLFileKeysMock,
}));

import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import SettingBibleJsonComp from './SettingBibleJsonComp';
import SettingDownloadedBibleComp from './SettingDownloadedBibleComp';
import SettingOnlineBibleComp from './SettingOnlineBibleComp';
import OnlineBibleItemComp from './OnlineBibleItemComp';

const KJV: BibleMinimalInfoType = {
    key: 'KJV',
    title: 'King James',
    locale: 'en-US',
    version: 1,
};
const KSV: BibleMinimalInfoType = {
    key: 'KSV',
    title: 'Khmer Standard',
    locale: 'km-KH',
    version: 2,
};
const ONLINE_KJV: BibleMinimalInfoType = {
    ...KJV,
    version: 2,
    filePath: 'KJV.zip',
};
const ONLINE_KSV: BibleMinimalInfoType = { ...KSV, filePath: 'KSV.zip' };
const ONLINE_NO_FILE: BibleMinimalInfoType = {
    key: 'ABC',
    title: 'Unpublished',
    locale: 'en-US',
    version: 1,
};

let container: HTMLDivElement;
let root: Root;

function findButton(text: string, scope: ParentNode = container) {
    return (
        Array.from(scope.querySelectorAll('button')).find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

function findItem(text: string) {
    return (
        Array.from(container.querySelectorAll('li')).find((item) => {
            return item.textContent?.includes(text);
        }) ?? null
    );
}

function checkIsLoading(scope: ParentNode = container) {
    return scope.querySelector('img[alt="Loading..."]') !== null;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.xmlKeys.bibleKeysMap = {};
    h.xmlKeys.isPending = false;
    h.getDownloadedBibleInfoListMock.mockResolvedValue([KJV]);
    h.getOnlineBibleInfoListMock.mockResolvedValue([
        ONLINE_KJV,
        ONLINE_KSV,
        ONLINE_NO_FILE,
    ]);
    h.getAllXMLFileKeysMock.mockResolvedValue({});
    h.clearBibleDatabaseDataMock.mockResolvedValue(undefined);
    h.getBibleInfoMock.mockResolvedValue({ locale: 'km-KH' });
    h.getLangDataAsyncMock.mockResolvedValue({});
    h.extractDownloadedBibleMock.mockResolvedValue(true);
    h.showAppConfirmMock.mockResolvedValue(true);
    h.toBiblePathMock.mockResolvedValue('/bibles/KJV');
    h.fsCheckDirExistMock.mockResolvedValue(true);
    h.fsDeleteDirMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingBibleJsonComp', () => {
    test('lists the downloaded Bibles and the online ones not yet downloaded', async () => {
        await act(async () => root.render(<SettingBibleJsonComp />));
        await flush();

        expect(container.querySelector('h3')!.textContent).toBe(
            'Downloaded Bible List',
        );
        expect(container.querySelector('h4')!.textContent).toBe(
            'Online Bible List',
        );
        const items = Array.from(container.querySelectorAll('li')).map(
            (item) => {
                return item.textContent;
            },
        );
        // KJV once, as downloaded; KSV offered for download; the online
        // entry with no file to download is not offered at all.
        expect(items).toEqual([
            expect.stringContaining('(KJV) King James'),
            expect.stringContaining('Khmer Standard (KSV)'),
        ]);
        // A newer KJV is online, so the downloaded one can be updated.
        expect(findButton('Update', findItem('(KJV)')!)).not.toBeNull();
    });

    test('a list that cannot be read says so; a null answer reads as unreadable', async () => {
        h.getDownloadedBibleInfoListMock.mockResolvedValue(null);
        h.getOnlineBibleInfoListMock.mockResolvedValue(null);
        await act(async () => root.render(<SettingBibleJsonComp />));
        await flush();

        expect(container.textContent).toContain(
            'Unable to get downloaded bible list',
        );
        expect(container.textContent).toContain(
            'Unable to get online bible list',
        );
    });

    test('Refresh on the downloaded list reads it again', async () => {
        await act(async () => root.render(<SettingBibleJsonComp />));
        await flush();
        h.getDownloadedBibleInfoListMock.mockResolvedValue([KJV, KSV]);

        const downloadedSection = container.querySelector('.w-100')!;
        await act(async () =>
            findButton('Refresh', downloadedSection)!.click(),
        );
        await flush();

        expect(h.getDownloadedBibleInfoListMock).toHaveBeenCalledTimes(2);
        expect(findItem('(KSV) Khmer Standard')).not.toBeNull();
    });

    test('Refresh on the online list reads it and the XML keys again', async () => {
        await act(async () => root.render(<SettingBibleJsonComp />));
        await flush();
        const refreshButtons = Array.from(
            container.querySelectorAll('button'),
        ).filter((button) => {
            return button.textContent?.trim() === 'Refresh';
        });
        expect(refreshButtons).toHaveLength(2);

        await act(async () => refreshButtons[1].click());
        await flush();

        expect(h.getOnlineBibleInfoListMock).toHaveBeenCalledTimes(2);
        expect(h.loadBibleXMLKeysMock).toHaveBeenCalledOnce();
    });
});

describe('SettingDownloadedBibleComp', () => {
    test('shows loading, then an empty list', async () => {
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={null}
                    downloadedBibleInfoList={null}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(checkIsLoading()).toBe(true);

        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={undefined}
                    downloadedBibleInfoList={[]}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(container.textContent).toContain('No bible downloaded');
    });

    test('offers no update when the online copy is not newer or there is no list', async () => {
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={[{ ...KSV, version: 1 }]}
                    downloadedBibleInfoList={[KSV]}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(findButton('Update')).toBeNull();
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={undefined}
                    downloadedBibleInfoList={[KSV]}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(findButton('Update')).toBeNull();
    });

    test('Update turns the row into a download of the newer copy', async () => {
        const setList = vi.fn();
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={[ONLINE_KJV]}
                    downloadedBibleInfoList={[KJV]}
                    setDownloadedBibleInfoList={setList}
                />,
            ),
        );

        await act(async () => findButton('Update')!.click());

        expect(setList).toHaveBeenCalledOnce();
        const [newList] = setList.mock.calls[0];
        expect(newList).toEqual([
            expect.objectContaining({
                key: 'KJV',
                isDownloading: true,
                isUpdatable: true,
                filePath: 'KJV.zip',
            }),
        ]);

        // Fed back, the row is now the download control.
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={[ONLINE_KJV]}
                    downloadedBibleInfoList={newList}
                    setDownloadedBibleInfoList={setList}
                />,
            ),
        );
        expect(findButton('Download')).not.toBeNull();
        expect(findButton('Delete')).toBeNull();

        // The finished download reads the downloaded list again.
        setList.mockClear();
        await act(async () => findButton('Download')!.click());
        const { bibleInfo, options } = h.downloadBibleMock.mock.calls[0][0];
        expect(bibleInfo).toMatchObject({ key: 'KJV', filePath: 'KJV.zip' });
        await act(async () => options.onDone(null, '/tmp/KJV.zip'));
        await flush();
        expect(setList).toHaveBeenCalledWith(null);
    });
});

describe('DownloadedBibleItemComp', () => {
    async function renderDownloaded() {
        const setList = vi.fn();
        await act(async () =>
            root.render(
                <SettingDownloadedBibleComp
                    onlineBibleInfoList={[]}
                    downloadedBibleInfoList={[KJV]}
                    setDownloadedBibleInfoList={setList}
                />,
            ),
        );
        return setList;
    }

    test('deletes the Bible folder and its database once confirmed', async () => {
        const setList = await renderDownloaded();

        await act(async () => findButton('Delete')!.click());

        expect(h.showAppConfirmMock).toHaveBeenCalledWith(
            'Delete Bible',
            'Are you sure to delete bible "King James"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(h.showProgressBarMock).toHaveBeenCalledWith(
            'Deleting bible "King James"',
        );
        expect(h.toBiblePathMock).toHaveBeenCalledWith('KJV');
        expect(h.fsDeleteDirMock).toHaveBeenCalledWith('/bibles/KJV');
        expect(h.clearBibleDatabaseDataMock).toHaveBeenCalledWith('KJV');
        expect(h.hideProgressBarMock).toHaveBeenCalledWith(
            'Deleting bible "King James"',
        );
        // The list is read again.
        expect(setList).toHaveBeenCalledWith(null);
    });

    test('a "No" deletes nothing', async () => {
        h.showAppConfirmMock.mockResolvedValue(false);
        const setList = await renderDownloaded();

        await act(async () => findButton('Delete')!.click());

        expect(h.showProgressBarMock).not.toHaveBeenCalled();
        expect(h.fsDeleteDirMock).not.toHaveBeenCalled();
        expect(setList).not.toHaveBeenCalled();
    });

    test('a Bible folder already gone still refreshes the list', async () => {
        h.fsCheckDirExistMock.mockResolvedValue(false);
        const setList = await renderDownloaded();

        await act(async () => findButton('Delete')!.click());

        expect(h.fsDeleteDirMock).not.toHaveBeenCalled();
        expect(h.clearBibleDatabaseDataMock).not.toHaveBeenCalled();
        expect(setList).toHaveBeenCalledWith(null);

        h.toBiblePathMock.mockResolvedValue(null);
        await act(async () => findButton('Delete')!.click());
        expect(h.fsCheckDirExistMock).toHaveBeenCalledOnce();
        expect(setList).toHaveBeenCalledTimes(2);
    });

    test('a failed delete is reported and the list is left as it was', async () => {
        h.fsDeleteDirMock.mockRejectedValue(new Error('EBUSY'));
        const setList = await renderDownloaded();

        await act(async () => findButton('Delete')!.click());

        expect(h.showSimpleToastMock).toHaveBeenCalledWith('Deleting', 'EBUSY');
        expect(setList).not.toHaveBeenCalled();
    });
});

describe('SettingOnlineBibleComp', () => {
    test('waits for the online list and for the XML keys', async () => {
        await act(async () =>
            root.render(
                <SettingOnlineBibleComp
                    downloadedBibleInfoList={[]}
                    onlineBibleInfoList={null}
                    setOnlineBibleInfoList={vi.fn()}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(checkIsLoading()).toBe(true);

        h.xmlKeys.isPending = true;
        await act(async () =>
            root.render(
                <SettingOnlineBibleComp
                    downloadedBibleInfoList={[]}
                    onlineBibleInfoList={[ONLINE_KSV]}
                    setOnlineBibleInfoList={vi.fn()}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(checkIsLoading()).toBe(true);
    });

    test('cannot list without the XML keys, but can still refresh', async () => {
        h.xmlKeys.bibleKeysMap = null;
        const setOnline = vi.fn();
        await act(async () =>
            root.render(
                <SettingOnlineBibleComp
                    downloadedBibleInfoList={undefined}
                    onlineBibleInfoList={[ONLINE_KSV]}
                    setOnlineBibleInfoList={setOnline}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        expect(container.textContent).toContain(
            'Unable to get online bible list',
        );

        await act(async () => findButton('Refresh')!.click());

        expect(setOnline).toHaveBeenCalledWith(null);
        expect(h.loadBibleXMLKeysMock).toHaveBeenCalledOnce();
    });

    test('a Bible already kept as XML cannot be downloaded again', async () => {
        h.xmlKeys.bibleKeysMap = { KSV: '/bibles/KSV.xml' };
        await act(async () =>
            root.render(
                <SettingOnlineBibleComp
                    downloadedBibleInfoList={undefined}
                    onlineBibleInfoList={[ONLINE_KSV]}
                    setOnlineBibleInfoList={vi.fn()}
                    setDownloadedBibleInfoList={vi.fn()}
                />,
            ),
        );
        const item = findItem('Khmer Standard (KSV)')!;
        expect(item.querySelector('div')!.title).toBe('Already in XML');
        expect(findButton('Download', item)!.disabled).toBe(true);
    });
});

describe('OnlineBibleItemComp download', () => {
    async function renderOnline(setDownloadedList = vi.fn()) {
        const setOnline = vi.fn();
        await act(async () =>
            root.render(
                <SettingOnlineBibleComp
                    downloadedBibleInfoList={[]}
                    onlineBibleInfoList={[ONLINE_KSV]}
                    setOnlineBibleInfoList={setOnline}
                    setDownloadedBibleInfoList={setDownloadedList}
                />,
            ),
        );
        return setOnline;
    }

    async function startDownload() {
        await act(async () => findButton('Download')!.click());
        expect(h.downloadBibleMock).toHaveBeenCalledOnce();
        return h.downloadBibleMock.mock.calls[0][0];
    }

    test('downloads, shows its progress, extracts and loads the language', async () => {
        const setDownloadedList = vi.fn();
        await renderOnline(setDownloadedList);

        const { bibleInfo, options } = await startDownload();

        expect(bibleInfo).toEqual(ONLINE_KSV);
        // The stale database goes first.
        expect(h.clearBibleDatabaseDataMock).toHaveBeenCalledWith('KSV');
        expect(findButton('Download')).toBeNull();
        const progressBar = container.querySelector(
            '[role="progressbar"]',
        ) as HTMLElement;
        expect(progressBar.style.width).toBe('0%');

        options.onStart(12.6789);
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Bible Download',
            'Start downloading "KSV". File size 12mb',
        );
        await act(async () => options.onProgress(0.5));
        expect(progressBar.style.width).toBe('50%');
        expect(progressBar.getAttribute('aria-valuenow')).toBe('50');

        await act(async () => options.onDone(null, '/tmp/KSV.zip'));
        await flush();

        expect(h.extractDownloadedBibleMock).toHaveBeenCalledWith(
            '/tmp/KSV.zip',
        );
        expect(h.getBibleInfoMock).toHaveBeenCalledWith('KSV', true);
        expect(h.getLangDataAsyncMock).toHaveBeenCalledWith('km-KH');
        expect(setDownloadedList).toHaveBeenCalledWith(null);
        expect(h.handleErrorMock).not.toHaveBeenCalled();
        // Done: the button is back.
        expect(findButton('Download')).not.toBeNull();
    });

    test('a failed download is reported and nothing is extracted', async () => {
        const setDownloadedList = vi.fn();
        await renderOnline(setDownloadedList);
        const { options } = await startDownload();
        const error = new Error('offline');

        await act(async () => options.onDone(error));
        await flush();

        expect(h.handleErrorMock).toHaveBeenCalledWith(error);
        expect(h.extractDownloadedBibleMock).not.toHaveBeenCalled();
        expect(setDownloadedList).not.toHaveBeenCalled();
        expect(findButton('Download')).not.toBeNull();
    });

    test('a file that cannot be extracted says so', async () => {
        h.extractDownloadedBibleMock.mockResolvedValue(false);
        const setDownloadedList = vi.fn();
        await renderOnline(setDownloadedList);
        const { options } = await startDownload();

        await act(async () => options.onDone(null, '/tmp/KSV.zip'));
        await flush();

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Extracting Bible',
            'Fail to extract bible',
        );
        expect(h.getLangDataAsyncMock).not.toHaveBeenCalled();
        expect(setDownloadedList).toHaveBeenCalledWith(null);
    });

    test('a Bible whose info cannot be read after extracting is reported', async () => {
        const setDownloadedList = vi.fn();
        await renderOnline(setDownloadedList);
        const { options } = await startDownload();
        h.getBibleInfoMock.mockResolvedValue(null);

        await act(async () => options.onDone(null, '/tmp/KSV.zip'));
        await flush();

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Getting Bible Info',
            'Cannot get bible info',
        );
        expect(h.handleErrorMock).toHaveBeenCalledWith(
            new Error('Cannot get bible info'),
        );
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Bible Download',
            'Error occurred during finishing bible download',
        );
        expect(setDownloadedList).toHaveBeenCalledWith(null);
        expect(findButton('Download')).not.toBeNull();
    });

    test('a Bible that turned up as XML meanwhile is not downloaded', async () => {
        h.getAllXMLFileKeysMock.mockResolvedValue({ KSV: '/bibles/KSV.xml' });
        const setOnline = await renderOnline();

        await act(async () => findButton('Download')!.click());

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Already in XML',
            'This bible is already in XML',
        );
        expect(h.downloadBibleMock).not.toHaveBeenCalled();
        // The list is refreshed so the row is shown as taken.
        expect(setOnline).toHaveBeenCalledWith(null);
    });

    test('without a refresher, a Bible already in XML is only reported', async () => {
        h.getAllXMLFileKeysMock.mockResolvedValue({ KSV: '/bibles/KSV.xml' });
        await act(async () =>
            root.render(
                <OnlineBibleItemComp
                    bibleInfo={ONLINE_KSV as any}
                    onDownloaded={vi.fn()}
                />,
            ),
        );

        await act(async () => findButton('Download')!.click());

        expect(h.showSimpleToastMock).toHaveBeenCalledOnce();
        expect(h.downloadBibleMock).not.toHaveBeenCalled();
    });
});
