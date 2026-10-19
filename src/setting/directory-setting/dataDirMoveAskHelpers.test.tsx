// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    os: 'windows' as 'windows' | 'mac' | 'linux',
    isHidden: false,
    existingDirs: new Set<string>(),
    movedFrom: null as { dirPath: string; movedAt: string | null } | null,
    movedTo: null as { dirPath: string; movedAt: string | null } | null,
    confirm: vi.fn(
        async (
            _title: string,
            _body: ReactElement,
            _options?: Record<string, any>,
        ) => false,
    ),
    alert: vi.fn(async (_title: string, _message: string) => {}),
    hide: vi.fn(),
    request: vi.fn(),
    showExplorer: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return {
                isWindows: mocks.os === 'windows',
                isMac: mocks.os === 'mac',
                isLinux: mocks.os === 'linux',
            };
        },
    },
}));
vi.mock('../../lang/langHelpers', () => ({
    getCurrentLocale: () => 'km-KH',
    getLangData: () => ({
        numList: ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
    }),
    toStringNum: (numList: string[], n: number) => {
        return `${n}`
            .split('')
            .map((digit) => numList[Number(digit)])
            .join('');
    },
    tran: (text: string) => text,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
    showAppAlert: mocks.alert,
}));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.showExplorer,
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (dirPath: string) => mocks.existingDirs.has(dirPath),
    getDefaultDataDirPath: () => '/home/.owa/open-worship-data',
}));
vi.mock('./dataDirMoveHelpers', () => ({
    checkIsDataDirMoveHidden: () => mocks.isHidden,
    hideDataDirMoveForAWhile: mocks.hide,
    readDataDirMovedFromFlag: async () => mocks.movedFrom,
    readDataDirMovedToFlag: async () => mocks.movedTo,
    requestDataDirMove: mocks.request,
}));

import {
    askToMoveDesktopDataDir,
    remindOldDataDirCopy,
    showDataDirMoveResult,
} from './dataDirMoveAskHelpers';

const DESKTOP_DIR = '/home/Desktop/open-worship-data';
const TARGET_DIR = '/home/.owa/open-worship-data';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.os = 'windows';
    mocks.isHidden = false;
    mocks.existingDirs.clear();
    mocks.movedFrom = null;
    mocks.movedTo = null;
});

function renderAskedBody() {
    return renderToStaticMarkup(mocks.confirm.mock.calls[0][1]);
}

describe('askToMoveDesktopDataDir', () => {
    test('explains the risk in the words of this computer', async () => {
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        let html = renderAskedBody();
        expect(html).toContain('Microsoft OneDrive');
        expect(html).toContain(DESKTOP_DIR);
        expect(html).toContain(TARGET_DIR);
        expect(mocks.confirm.mock.calls[0][2]).toMatchObject({
            enterToOk: false,
            confirmButtonLabel: 'Move Now',
            cancelButtonLabel: 'Not Now',
            extraButtonLabel: 'Hide for 30 days',
        });

        mocks.confirm.mockClear();
        mocks.os = 'mac';
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        html = renderAskedBody();
        expect(html).toContain('iCloud Drive');
        expect(html).not.toContain('OneDrive');

        mocks.confirm.mockClear();
        mocks.os = 'linux';
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        html = renderAskedBody();
        expect(html).toContain('Backup and sync tools');
        expect(html).not.toContain('iCloud');
    });

    test('Not Now changes nothing, so the next launch asks again', async () => {
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        expect(mocks.hide).not.toHaveBeenCalled();
        expect(mocks.request).not.toHaveBeenCalled();
    });

    test('Move Now asks for the move', async () => {
        mocks.confirm.mockResolvedValueOnce(true);
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith(DESKTOP_DIR);
        expect(mocks.hide).not.toHaveBeenCalled();
    });

    test('Hide for 30 days puts the question away and moves nothing', async () => {
        mocks.confirm.mockImplementationOnce(async (_title, _body, options) => {
            options?.onExtraButtonClick();
            return false;
        });
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        expect(mocks.hide).toHaveBeenCalledOnce();
        expect(mocks.request).not.toHaveBeenCalled();

        mocks.confirm.mockClear();
        mocks.isHidden = true;
        await askToMoveDesktopDataDir(DESKTOP_DIR);
        expect(mocks.confirm).not.toHaveBeenCalled();
    });
});

describe('showDataDirMoveResult', () => {
    test('says nothing for a result it cannot read', async () => {
        await showDataDirMoveResult('not json');
        await showDataDirMoveResult('{"isMoved":true}');
        expect(mocks.alert).not.toHaveBeenCalled();
    });

    test('a renamed folder is named where it is now, with no old copy', async () => {
        await showDataDirMoveResult(
            JSON.stringify({
                isMoved: true,
                fromDirPath: DESKTOP_DIR,
                toDirPath: TARGET_DIR,
                isCopied: false,
            }),
        );
        const [title, message] = mocks.alert.mock.calls[0];
        expect(title).toBe('Data Folder Moved');
        expect(message).toContain(TARGET_DIR);
        expect(message).not.toContain('The old copy is still at:');
    });

    test('a copied folder also names the old copy to put away', async () => {
        await showDataDirMoveResult(
            JSON.stringify({
                isMoved: true,
                fromDirPath: '/home/<odd>/open-worship-data',
                toDirPath: TARGET_DIR,
                isCopied: true,
            }),
        );
        const [, message] = mocks.alert.mock.calls[0];
        expect(message).toContain('The old copy is still at:');
        // A path is text, never markup.
        expect(message).toContain('/home/&lt;odd&gt;/open-worship-data');
    });

    test('a failure says nothing changed, and why', async () => {
        await showDataDirMoveResult(
            JSON.stringify({
                isMoved: false,
                fromDirPath: DESKTOP_DIR,
                toDirPath: TARGET_DIR,
                isCopied: false,
                errorMessage: 'ENOSPC <disk full>',
            }),
        );
        const [title, message] = mocks.alert.mock.calls[0];
        expect(title).toBe('Data Folder Not Moved');
        expect(message).toContain('Nothing was changed.');
        expect(message).toContain('ENOSPC &lt;disk full&gt;');
    });
});

describe('remindOldDataDirCopy', () => {
    test('only while a marked old copy is still there', async () => {
        await remindOldDataDirCopy(TARGET_DIR);
        mocks.movedFrom = { dirPath: DESKTOP_DIR, movedAt: null };
        await remindOldDataDirCopy(TARGET_DIR);
        // There, but not marked as moved: not the old copy.
        mocks.existingDirs.add(DESKTOP_DIR);
        await remindOldDataDirCopy(TARGET_DIR);
        expect(mocks.confirm).not.toHaveBeenCalled();

        mocks.movedTo = { dirPath: TARGET_DIR, movedAt: null };
        await remindOldDataDirCopy(TARGET_DIR);
        expect(mocks.confirm).toHaveBeenCalledOnce();
        expect(mocks.confirm.mock.calls[0][2]).toMatchObject({
            confirmButtonLabel: 'Show Folder',
            cancelButtonLabel: 'Ok',
        });
        expect(renderAskedBody()).toContain(DESKTOP_DIR);
        expect(mocks.showExplorer).not.toHaveBeenCalled();
    });

    test('Show Folder opens the old copy for the person to put away', async () => {
        mocks.movedFrom = {
            dirPath: DESKTOP_DIR,
            movedAt: '2026-10-17T09:30:00.000Z',
        };
        mocks.movedTo = { dirPath: TARGET_DIR, movedAt: null };
        mocks.existingDirs.add(DESKTOP_DIR);
        mocks.confirm.mockResolvedValueOnce(true);
        await remindOldDataDirCopy(TARGET_DIR);
        expect(renderAskedBody()).toContain('Moved on:');
        // The date in the app's language and digits, not the browser's.
        const html = renderAskedBody();
        // Year first, 24-hour, whatever the browser would make of km-KH.
        expect(html).toMatch(/២០២៦-១០-[០-៩]{2} [០-៩]{2}:[០-៩]{2}/);
        expect(html).not.toMatch(/2026|PM|AM/);
        expect(mocks.showExplorer).toHaveBeenCalledExactlyOnceWith(DESKTOP_DIR);
    });
});
