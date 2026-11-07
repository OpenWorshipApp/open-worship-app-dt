// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Images tab's tile body and its folder menu: Paste Image (every way a
// clipboard image can fail to land) and the Download prompt being cancelled.
// The download itself is `backgroundDownloadFromUrl.test.tsx`'s.
const h = vi.hoisted(() => ({
    filePaths: [] as string[],
    onScreen: {} as Record<string, string[]>,
    mediaProps: null as any,
    sessionOptions: null as any,
    toastUpdates: [] as [string, string][],
    checkClipboard: vi.fn(),
    readImages: vi.fn(),
    getSrcData: vi.fn(),
    getDotExt: vi.fn(),
    writeBase64: vi.fn(),
    genRandomFilePath: vi.fn(),
    askForURL: vi.fn(),
    downloadImage: vi.fn(),
    showSimpleToast: vi.fn(),
    showProgressBar: vi.fn(),
}));

vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        h.mediaProps = props;
        return (
            <div data-media-grid>
                {props.topBarChild}
                {h.filePaths.map((filePath) => (
                    <div key={filePath} data-tile={filePath}>
                        {props.rendChild(
                            filePath,
                            (h.onScreen[filePath] ?? []).map((key) => [
                                key,
                                {},
                            ]),
                            240,
                            135,
                            <span data-extra-child={filePath} />,
                        )}
                    </div>
                ))}
            </div>
        );
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            const fullName = filePath.split('/').at(-1)!;
            return {
                filePath,
                src: `file://${filePath}`,
                fullName,
                name: fullName.replace(/\.[^.]+$/, ''),
            };
        },
        getSrcDataFromFrom: (blob: unknown) => h.getSrcData(blob),
        writeFileBase64Data: (filePath: string, data: string) =>
            h.writeBase64(filePath, data),
    },
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: unknown) => {
        h.sessionOptions = options;
        return {
            activeId: 'default',
            element: <span data-session-chips />,
            dirSourceSettingName: 'select-dir-image-bg',
            autoPlayPrefix: 'background-image',
        };
    },
}));
vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: () => h.checkClipboard(),
    readImagesFromClipboard: () => h.readImages(),
    downloadImage: (...args: unknown[]) => h.downloadImage(...args),
}));
vi.mock('../server/fileHelpers', () => ({
    fsDeleteFile: async () => {},
    fsMove: async () => {},
    getDotExtensionFromBase64Data: (data: string) => h.getDotExt(data),
    getTempPath: () => '/os-temp',
}));
vi.mock('./downloadHelper', () => ({
    askForURL: (title: string, subTitle: string) =>
        h.askForURL(title, subTitle),
    getOpenSharedLinkMenuItem: (sharedKey: string) => ({
        menuElement: 'Open Shared Link',
        sharedKey,
    }),
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => (title: string, message: string) => {
        h.toastUpdates.push([title, message]);
    },
    showSimpleToast: (title: string, message: string) =>
        h.showSimpleToast(title, message),
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: (key: string) => h.showProgressBar(key),
    hideProgressBar: () => {},
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: () => {} }));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    BackgroundTransitionTileBadgeComp: ({ backgroundType, src }: any) => (
        <i data-badge={`${backgroundType} ${src}`} />
    ),
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition (${type} ${src})` },
    ],
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span data-screen-id={screenId} />
    ),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import BackgroundImagesComp from './BackgroundImagesComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const SUNRISE = '/images/sunrise.jpg';

let host: HTMLDivElement;
let root: Root;

const dirSource = {
    dirPath: '/data/images',
    genRandomFilePath: (dotExt: string) => h.genRandomFilePath(dotExt),
};

async function genFolderMenu(source: object = dirSource) {
    return (await h.mediaProps.genContextMenuItems(source)) as any[];
}

beforeEach(() => {
    h.filePaths = [SUNRISE];
    h.onScreen = {};
    h.mediaProps = null;
    h.sessionOptions = null;
    h.toastUpdates = [];
    h.checkClipboard.mockResolvedValue(false);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('Images tab', () => {
    test('hands the grid this tab’s folder and drag type, and draws each picture lazily', async () => {
        h.onScreen = { [SUNRISE]: ['2'] };
        await act(async () => root.render(<BackgroundImagesComp />));
        expect(h.sessionOptions).toEqual({
            target: 'background-image',
            dirSourceSettingName: 'select-dir-image-bg',
            autoPlayPrefix: 'background-image',
        });
        expect(h.mediaProps).toMatchObject({
            defaultFolderName: 'images',
            dragType: 'bg-image',
            dirSourceSettingName: 'select-dir-image-bg',
            autoPlayPrefix: 'background-image',
        });

        const body = host.querySelector<HTMLElement>(
            `[data-tile="${SUNRISE}"] > .card-body`,
        )!;
        expect(body.style.height).toBe('135px');
        const image = body.querySelector('img')!;
        expect(image.getAttribute('src')).toBe(`file://${SUNRISE}`);
        expect(image.alt).toBe('sunrise');
        expect(image.getAttribute('loading')).toBe('lazy');
        // Never the drag source itself: the tile is.
        expect(image.style.pointerEvents).toBe('none');
        expect(
            body
                .querySelector('[data-screen-id]')
                ?.getAttribute('data-screen-id'),
        ).toBe('2');
        expect(
            body.querySelector('[data-badge]')?.getAttribute('data-badge'),
        ).toBe(`image file://${SUNRISE}`);
        expect(
            body.querySelector(`[data-extra-child="${SUNRISE}"]`),
        ).not.toBeNull();

        expect(h.mediaProps.genExtraItemContextMenuItems(SUNRISE)).toEqual([
            { menuElement: `Transition (image file://${SUNRISE})` },
        ]);
    });

    test('a list with no folder has no menu, and the clipboard is not even read', async () => {
        await act(async () => root.render(<BackgroundImagesComp />));
        expect(await genFolderMenu({ dirPath: '' })).toEqual([]);
        expect(h.checkClipboard).not.toHaveBeenCalled();
    });

    test('with no image in the clipboard the menu offers the download and the shared link', async () => {
        await act(async () => root.render(<BackgroundImagesComp />));
        const items = await genFolderMenu();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Download From URL',
            'Open Shared Link',
        ]);
        expect(items[0].childBefore).toBe('icon:download');
        expect(items[1].sharedKey).toBe('images');
    });

    test('Paste Image writes every readable image and says why each other one did not land', async () => {
        h.checkClipboard.mockResolvedValue(true);
        const blobs = ['unreadable', 'no-type', 'no-name', 'no-write', 'good'];
        h.readImages.mockImplementation(async function* () {
            for (const blob of blobs) {
                yield blob;
            }
        });
        h.getSrcData.mockImplementation(async (blob: string) =>
            blob === 'unreadable' ? null : `data:${blob}`,
        );
        h.getDotExt.mockImplementation((data: string) =>
            data === 'data:no-type' ? null : '.png',
        );
        h.genRandomFilePath.mockImplementation(async (dotExt: string) =>
            h.genRandomFilePath.mock.calls.length === 1
                ? null
                : `/data/images/pasted-${h.genRandomFilePath.mock.calls.length}${dotExt}`,
        );
        h.writeBase64.mockImplementation(
            async (_filePath: string, data: string) => data === 'data:good',
        );
        await act(async () => root.render(<BackgroundImagesComp />));

        const items = await genFolderMenu();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Paste Image',
            'Download From URL',
            'Open Shared Link',
        ]);
        expect(items[0].childBefore).toBe('icon:card-image');
        await items[0].onSelect();

        expect(h.showSimpleToast.mock.calls).toEqual([
            [
                'Paste Image',
                'Error occurred during reading image data from clipboard',
            ],
            [
                'Paste Image',
                'Error occurred during getting image file extension',
            ],
            ['Paste Image', 'Error occurred during generating file name'],
            ['Paste Image', 'Error occurred during pasting image'],
        ]);
        expect(h.writeBase64.mock.calls).toEqual([
            ['/data/images/pasted-2.png', 'data:no-write'],
            ['/data/images/pasted-3.png', 'data:good'],
        ]);
    });

    test('a cancelled address prompt downloads nothing', async () => {
        h.askForURL.mockResolvedValue(null);
        await act(async () => root.render(<BackgroundImagesComp />));
        const items = await genFolderMenu();
        await items[0].onSelect();
        expect(h.askForURL).toHaveBeenCalledWith(
            'Download From URL',
            'Image URL:',
        );
        expect(h.downloadImage).not.toHaveBeenCalled();
        expect(h.showProgressBar).not.toHaveBeenCalled();
        expect(h.toastUpdates).toEqual([]);
    });
});
