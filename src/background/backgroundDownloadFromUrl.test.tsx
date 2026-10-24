// @vitest-environment jsdom

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    mediaProps: null as any,
    toastUpdates: [] as [string, string][],
    showSimpleToast: vi.fn(),
    downloadImage: vi.fn(),
    downloadVideoOrAudio: vi.fn(),
    fsMove: vi.fn(),
    fsDeleteFile: vi.fn(async (_filePath: string) => {}),
}));

vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        h.mediaProps = props;
        return null;
    },
}));
vi.mock('./RenderBackgroundScreenIdsComp', () => ({ default: () => null }));
vi.mock('./VideoTilePreviewComp', () => ({
    default: () => null,
    HOVER_PLAY_DELAY: 0,
}));
vi.mock('./videoBackgroundHelpers', () => ({
    getIsFadingAtTheEndSetting: () => true,
    methodMapIsFadingAtTheEnd: {},
    setIsFadingAtTheEndSetting: vi.fn(),
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    BackgroundTransitionTileBadgeComp: () => null,
    genBackgroundItemTransitionMenuItems: () => [],
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: () => ({
        activeId: 'default',
        element: null,
        autoPlayPrefix: 'p',
        dirSourceSettingName: 'select-dir-x',
    }),
}));
vi.mock('./downloadHelper', () => ({
    askForURL: async () => 'https://example.org/a',
    getOpenSharedLinkMenuItem: () => ({ menuElement: 'shared' }),
    // The menu item, pressed, hands the address straight to the panel.
    genDownloadContextMenuItems: async (
        _texts: unknown,
        _dirSource: unknown,
        download: (url: string) => Promise<void>,
    ) => [
        {
            menuElement: 'Download From URL',
            onSelect: () => download('https://example.org/v'),
        },
    ],
    toDownloadFailureMessage: (message: string) => message,
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (dirPath: string, fileFullName?: string) => ({
            src: `file:///${dirPath}`,
            filePath: `${dirPath}/${fileFullName}`,
            genNextFilePath: async () => `${dirPath}/next-${fileFullName}`,
        }),
    },
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: {
        BACKGROUND_IMAGE: 'images',
        BACKGROUND_VIDEO: 'videos',
    },
    dirSourceSettingNames: { BACKGROUND_IMAGE: 'img', BACKGROUND_VIDEO: 'vid' },
}));
vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: async () => false,
    downloadImage: h.downloadImage,
    readImagesFromClipboard: vi.fn(),
    downloadVideoOrAudio: h.downloadVideoOrAudio,
    timeToTimeString: () => '',
}));
vi.mock('../server/fileHelpers', () => ({
    fsDeleteFile: h.fsDeleteFile,
    fsMove: h.fsMove,
    getDotExtensionFromBase64Data: () => '.png',
    getTempPath: () => '/os-temp',
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
    createSimpleToastUpdater: () => (title: string, message: string) => {
        h.toastUpdates.push([title, message]);
    },
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/extra-bin/extraBinErrors', () => ({
    checkIsExtraBinMissingError: () => false,
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => vi.fn(),
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: () => {},
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));

import BackgroundImagesComp from './BackgroundImagesComp';
import BackgroundVideosComp from './BackgroundVideosComp';

async function pressDownload(Comp: () => any) {
    renderToStaticMarkup(createElement(Comp));
    const items = await h.mediaProps.genContextMenuItems({
        dirPath: '/data/in-use',
    });
    const item = items.find((one: any) => {
        return one.menuElement === 'Download From URL';
    });
    await item.onSelect();
}

beforeEach(() => {
    h.toastUpdates = [];
    h.showSimpleToast.mockClear();
    h.fsMove.mockReset();
    h.fsDeleteFile.mockClear();
    h.downloadImage.mockReset();
    h.downloadVideoOrAudio.mockReset();
});

describe('Download From URL', () => {
    test('an image is staged in the OS temp folder, never the default data folder', async () => {
        h.downloadImage.mockResolvedValue({
            filePath: '/os-temp/1.png',
            fileFullName: '1.png',
        });
        await pressDownload(BackgroundImagesComp);
        // It was `getDefaultDataDir()`: a download failed with that folder
        // absent and otherwise wrote into a folder not in use.
        expect(h.downloadImage).toHaveBeenCalledWith(
            'https://example.org/a',
            '/os-temp',
        );
        // Never over an image already there.
        expect(h.fsMove).toHaveBeenCalledWith(
            '/os-temp/1.png',
            '/data/in-use/next-1.png',
        );
    });

    test('a download that cannot be moved in leaves nothing in the temp folder', async () => {
        h.downloadImage.mockResolvedValue({
            filePath: '/os-temp/1.png',
            fileFullName: '1.png',
        });
        h.fsMove.mockRejectedValueOnce(new Error('EPERM'));
        await pressDownload(BackgroundImagesComp);
        expect(h.fsDeleteFile).toHaveBeenCalledWith('/os-temp/1.png');
        expect(h.toastUpdates.at(-1)?.[1]).toBe(
            'Error occurred during downloading image',
        );
        // A success deletes nothing.
        h.fsDeleteFile.mockClear();
        await pressDownload(BackgroundImagesComp);
        expect(h.fsDeleteFile).not.toHaveBeenCalled();
    });

    test('an image download says "downloading" then the outcome, in ONE toast', async () => {
        h.downloadImage.mockResolvedValue({
            filePath: '/os-temp/1.png',
            fileFullName: '1.png',
        });
        await pressDownload(BackgroundImagesComp);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.toastUpdates.map(([, message]) => message)).toEqual([
            'Downloading image from "https://example.org/a", please wait...',
            'Image downloaded successfully, file path: "/data/in-use/next-1.png"',
        ]);
    });

    test('a video download says "downloading" then the outcome, in ONE toast', async () => {
        h.downloadVideoOrAudio.mockImplementation(
            async (
                _url: string,
                _dir: string,
                _isVideo: boolean,
                onStart: () => void,
            ) => {
                onStart();
                return { filePath: '/os-temp/v.webm', fileFullName: 'v.webm' };
            },
        );
        await pressDownload(BackgroundVideosComp);
        // The two toasts stacked, and the pointer resting on the first kept
        // "please wait" up beside "downloaded successfully".
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.toastUpdates.map(([, message]) => message)).toEqual([
            'Downloading video from "https://example.org/v", please wait...',
            'Video downloaded successfully, file path: "/data/in-use/next-v.webm"',
        ]);
    });
});
