// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Images tab: its tiles, its per-file menu and its folder menu -- paste
// images from the clipboard, download one. `backgroundDownloadFromUrl.test.tsx`
// holds the download itself.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        mediaProps: null as any,
        isClipboardHasImage: false,
        clipboardBlobs: [] as Blob[],
        srcDataByBlob: new Map<Blob, string | null>(),
        extensionBySrcData: new Map<string, string | null>(),
        writeResults: [] as boolean[],
        askedUrl: null as string | null,
    },
    mocks: {
        toast: vi.fn(),
        writeFile: vi.fn(),
        downloadImage: vi.fn(),
        handleError: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `file:///${filePath}`,
            name: filePath.split('/').at(-1),
        }),
        getSrcDataFromFrom: async (blob: Blob) =>
            state.srcDataByBlob.get(blob) ?? null,
        writeFileBase64Data: async (filePath: string, srcData: string) => {
            mocks.writeFile(filePath, srcData);
            return state.writeResults.shift() ?? true;
        },
    },
}));
vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        state.mediaProps = props;
        return (
            <div data-testid="grid">
                {props.rendChild(
                    'images/sunrise.png',
                    [['2', {}]],
                    160,
                    90,
                    <span data-extra-child />,
                )}
            </div>
        );
    },
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { BACKGROUND_IMAGE: 'images' },
    dirSourceSettingNames: { BACKGROUND_IMAGE: 'background-image' },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: async () => state.isClipboardHasImage,
    downloadImage: mocks.downloadImage,
    readImagesFromClipboard: async function* () {
        for (const blob of state.clipboardBlobs) {
            yield blob;
        }
    },
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => vi.fn(),
    showSimpleToast: mocks.toast,
}));
vi.mock('../server/fileHelpers', () => ({
    fsDeleteFile: vi.fn(),
    fsMove: vi.fn(),
    getDotExtensionFromBase64Data: (srcData: string) =>
        state.extensionBySrcData.get(srcData) ?? null,
    getTempPath: () => '/os-temp',
}));
vi.mock('./downloadHelper', () => ({
    askForURL: async () => state.askedUrl,
    getOpenSharedLinkMenuItem: (folderName: string) => ({
        menuElement: `Open Shared Link ${folderName}`,
    }),
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./RenderBackgroundScreenIdsComp', () => ({
    default: ({ screenIds }: { screenIds: number[] }) => (
        <span data-screen-ids={screenIds.join(',')} />
    ),
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: any) => ({
        activeId: 'session-a',
        element: <div data-testid="sessions" />,
        autoPlayPrefix: `${options.autoPlayPrefix}-a`,
        dirSourceSettingName: `${options.dirSourceSettingName}-a`,
    }),
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    BackgroundTransitionTileBadgeComp: ({ backgroundType, src }: any) => (
        <span data-badge={`${backgroundType}:${src}`} />
    ),
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition ${type}`, src },
    ],
}));

import BackgroundImagesComp from './BackgroundImagesComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.mediaProps = null;
    state.isClipboardHasImage = false;
    state.clipboardBlobs = [];
    state.srcDataByBlob.clear();
    state.extensionBySrcData.clear();
    state.writeResults = [];
    state.askedUrl = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<BackgroundImagesComp />);
    });
}
function genDirSource(genRandomFilePath: (dotExt: string) => any) {
    return {
        dirPath: '/data/images',
        genRandomFilePath: vi.fn(async (dotExt: string) =>
            genRandomFilePath(dotExt),
        ),
    };
}

describe('the Images tab', () => {
    test('draws a lazy picture per tile, marked with its screens and transition', async () => {
        await render();
        expect(state.mediaProps).toMatchObject({
            autoPlayPrefix: 'background-image-a',
            defaultFolderName: 'images',
            dragType: 'bg-image',
            dirSourceSettingName: 'background-image-a',
        });
        const image = container.querySelector('img') as HTMLImageElement;
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.src).toBe('file:///images/sunrise.png');
        expect(image.alt).toBe('sunrise.png');
        const body = image.parentElement as HTMLElement;
        expect(body.style.height).toBe('90px');
        expect(
            (body.querySelector('[data-screen-ids]') as HTMLElement).dataset
                .screenIds,
        ).toBe('2');
        expect(
            (body.querySelector('[data-badge]') as HTMLElement).dataset.badge,
        ).toBe('image:file:///images/sunrise.png');
        expect(body.querySelector('[data-extra-child]')).not.toBeNull();
    });

    test('a file’s own menu rows are its transition', async () => {
        await render();
        expect(
            state.mediaProps.genExtraItemContextMenuItems('images/a.png'),
        ).toEqual([
            { menuElement: 'Transition image', src: 'file:///images/a.png' },
        ]);
    });
});

describe('the folder menu', () => {
    test('offers nothing while no folder is chosen', async () => {
        await render();
        expect(
            await state.mediaProps.genContextMenuItems({ dirPath: '' }),
        ).toEqual([]);
    });

    test('offers Paste Image only while the clipboard holds one', async () => {
        await render();
        const dirSource = genDirSource(() => null);
        let items = await state.mediaProps.genContextMenuItems(dirSource);
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Download From URL',
            'Open Shared Link images',
        ]);
        state.isClipboardHasImage = true;
        items = await state.mediaProps.genContextMenuItems(dirSource);
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Paste Image',
            'Download From URL',
            'Open Shared Link images',
        ]);
        expect(items[0].childBefore).toBe('icon:card-image');
    });

    test('pastes every clipboard image it can, and names each one that fails', async () => {
        await render();
        state.isClipboardHasImage = true;
        const [unreadable, noExtension, noName, unwritable, good] = [
            'unreadable',
            'no-extension',
            'no-name',
            'unwritable',
            'good',
        ].map((name) => new Blob([name]));
        state.clipboardBlobs = [
            unreadable,
            noExtension,
            noName,
            unwritable,
            good,
        ];
        state.srcDataByBlob.set(noExtension, 'data:noext');
        state.srcDataByBlob.set(noName, 'data:noname');
        state.srcDataByBlob.set(unwritable, 'data:unwritable');
        state.srcDataByBlob.set(good, 'data:good');
        state.extensionBySrcData.set('data:noname', '.png');
        state.extensionBySrcData.set('data:unwritable', '.jpg');
        state.extensionBySrcData.set('data:good', '.webp');
        state.writeResults = [false, true];
        let fileCount = 0;
        const dirSource = genDirSource((dotExt) =>
            dotExt === '.png' ? null : `/data/images/${++fileCount}${dotExt}`,
        );
        const [pasteItem] =
            await state.mediaProps.genContextMenuItems(dirSource);
        await pasteItem.onSelect();
        expect(mocks.toast.mock.calls).toEqual([
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
        expect(mocks.writeFile.mock.calls).toEqual([
            ['/data/images/1.jpg', 'data:unwritable'],
            ['/data/images/2.webp', 'data:good'],
        ]);
    });

    test('Download From URL put away without an address downloads nothing', async () => {
        await render();
        const items = await state.mediaProps.genContextMenuItems(
            genDirSource(() => null),
        );
        const downloadItem = items.find(
            (item: any) => item.menuElement === 'Download From URL',
        );
        expect(downloadItem.childBefore).toBe('icon:download');
        await downloadItem.onSelect();
        expect(mocks.downloadImage).not.toHaveBeenCalled();
    });
});
