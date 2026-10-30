// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Audios tab: which row a click opens, the split with a document's own
// sounds, and Download From URL. The player rows themselves are in
// `BackgroundAudiosComp.coverage.test.tsx`.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        mediaProps: null as any,
        mediaRenderCount: 0,
        // What each row holds, by the order the grid draws them.
        rows: [] as { src: string; filePath: string | null }[],
        appDocumentAudioData: null as any,
        resizeProps: null as any,
        toastUpdates: [] as [string, string][],
        downloadArgs: null as any[] | null,
        isExtraBinMissing: false,
    },
    mocks: {
        downloadVideoOrAudio: vi.fn(),
        fsMove: vi.fn(),
        handleError: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
        showAudioPlayingToast: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (dirPath: string, fileName?: string) => {
            const filePath =
                fileName === undefined ? dirPath : `${dirPath}/${fileName}`;
            return { genNextFilePath: async () => `${filePath}.1` };
        },
    },
}));
vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        state.mediaProps = props;
        state.mediaRenderCount += 1;
        return (
            <div>
                {state.rows.map(({ src, filePath }) => (
                    <div
                        key={src}
                        data-file-item-file-src={src}
                        onClick={props.onClick}
                    >
                        <span data-name>{src}</span>
                        {filePath === null
                            ? null
                            : props.rendChild(filePath, [], 300, 100)}
                    </div>
                ))}
            </div>
        );
    },
}));
vi.mock('./AudioBodyComp', () => ({
    genAudioBodyChild: (
        activeMap: { [filePath: string]: boolean },
        filePath: string,
    ) => (
        <div data-file-path={filePath}>
            {activeMap[filePath] ? 'open' : 'closed'}
        </div>
    ),
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { BACKGROUND_AUDIO: 'audios' },
    dirSourceSettingNames: { BACKGROUND_AUDIO: 'background-audio' },
}));
vi.mock('../helper/mediaControlHelpers', () => ({
    checkAudioPlaying: () => false,
    showAudioPlayingToast: mocks.showAudioPlayingToast,
}));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (label: string) => ({ widgetName: label }),
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => (title: string, message: string) => {
        state.toastUpdates.push([title, message]);
    },
    showSimpleToast: vi.fn(),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgressBar,
    hideProgressBar: mocks.hideProgressBar,
}));
vi.mock('../server/fileHelpers', () => ({
    fsMove: mocks.fsMove,
    getTempPath: () => '/os-temp',
}));
vi.mock('./downloadHelper', () => ({
    genDownloadContextMenuItems: async (...args: any[]) => {
        state.downloadArgs = args;
        return [];
    },
    toDownloadFailureMessage: (message: string, error: any) =>
        `${message}: ${error.message}`,
}));
vi.mock('../server/appHelpers', () => ({
    downloadVideoOrAudio: mocks.downloadVideoOrAudio,
}));
vi.mock('./VaryAppDocumentAudiosComp', () => ({
    default: ({ appDocumentAudioData }: any) => (
        <div data-testid="document-audios">
            {Object.keys(appDocumentAudioData).join(',')}
        </div>
    ),
}));
vi.mock('./backgroundHelpers', () => ({
    useAppDocumentAudioData: () => state.appDocumentAudioData,
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        state.resizeProps = props;
        return (
            <div data-testid="split">
                {props.dataInput.map((item: any) => (
                    <section key={item.key} data-pane={item.widgetName}>
                        {item.children.render()}
                    </section>
                ))}
            </div>
        );
    },
}));
vi.mock('../helper/extra-bin/extraBinErrors', () => ({
    checkIsExtraBinMissingError: () => state.isExtraBinMissing,
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: () => ({
        activeId: 'session-a',
        element: null,
        dirSourceSettingName: 'background-audio',
    }),
}));

import BackgroundAudiosComp from './BackgroundAudiosComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.mediaProps = null;
    state.rows = [
        { src: 'file:///a.mp3', filePath: 'audios/a.mp3' },
        { src: 'file:///b.mp3', filePath: 'audios/b.mp3' },
    ];
    state.appDocumentAudioData = null;
    state.resizeProps = null;
    state.toastUpdates = [];
    state.downloadArgs = null;
    state.isExtraBinMissing = false;
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
        root.render(<BackgroundAudiosComp />);
    });
}
function getRow(src: string) {
    return container.querySelector(
        `[data-file-item-file-src="${src}"]`,
    ) as HTMLElement;
}
async function click(element: Element) {
    await act(async () => (element as HTMLElement).click());
}

describe('which row a click opens', () => {
    test('a click anywhere in a row opens that row only, and a second closes it', async () => {
        await render();
        await click(getRow('file:///b.mp3').querySelector('[data-name]')!);
        expect(getRow('file:///a.mp3').textContent).toContain('closed');
        expect(getRow('file:///b.mp3').textContent).toContain('open');
        // The row's own padding, not only its name line.
        await click(getRow('file:///b.mp3'));
        expect(getRow('file:///b.mp3').textContent).toContain('closed');
    });

    test('a row holding no track is left alone', async () => {
        state.rows = [{ src: 'file:///empty', filePath: null }];
        await render();
        const renderCount = state.mediaRenderCount;
        await click(getRow('file:///empty'));
        // Nothing to open: the list did not even redraw.
        expect(state.mediaRenderCount).toBe(renderCount);
        expect(mocks.showAudioPlayingToast).not.toHaveBeenCalled();
        // ...whereas a row with a track does.
        state.rows = [{ src: 'file:///a.mp3', filePath: 'audios/a.mp3' }];
        await render();
        const countBefore = state.mediaRenderCount;
        await click(getRow('file:///a.mp3'));
        expect(state.mediaRenderCount).toBe(countBefore + 1);
    });

    test('a click that lands outside every row opens nothing', async () => {
        await render();
        await act(async () => {
            state.mediaProps.onClick({ target: document.body });
            state.mediaProps.onClick({ target: null });
        });
        expect(container.textContent).not.toContain('open');
    });
});

describe('a document’s own sounds', () => {
    test('split the tab, the folder above the document’s sounds', async () => {
        state.appDocumentAudioData = { 'Service.pptx': [] };
        await render();
        expect(state.resizeProps).toMatchObject({
            flexSizeName: 'flex-size-background',
            isHorizontal: false,
            isDisableQuickResize: true,
            flexSizeDefault: { v1: ['3'], v2: ['1'] },
        });
        const panes = Array.from(
            container.querySelectorAll('[data-pane]'),
        ) as HTMLElement[];
        expect(panes.map((pane) => pane.dataset.pane)).toEqual([
            'Background',
            'Background Audio',
        ]);
        expect(
            panes[0].querySelector('[data-file-item-file-src]'),
        ).not.toBeNull();
        expect(panes[1].textContent).toBe('Service.pptx');
    });
});

describe('Download From URL', () => {
    async function download() {
        await render();
        const dirSource = { dirPath: '/data/audios' };
        await state.mediaProps.genContextMenuItems(dirSource);
        const [texts, passedDirSource, downloadAudio, folderName] =
            state.downloadArgs!;
        expect(texts).toEqual({
            title: 'Download From URL',
            subTitle: 'Audio URL:',
        });
        expect(passedDirSource).toBe(dirSource);
        expect(folderName).toBe('audios');
        await downloadAudio('https://example.org/a');
    }

    test('stages in the OS temp folder, never over a file already there, in ONE toast', async () => {
        mocks.downloadVideoOrAudio.mockImplementationOnce(
            async (
                _url: string,
                _tempDir: string,
                _isVideo: boolean,
                onStart: () => void,
            ) => {
                onStart();
                return { filePath: '/os-temp/a.mp3', fileFullName: 'a.mp3' };
            },
        );
        await download();
        expect(mocks.downloadVideoOrAudio).toHaveBeenCalledWith(
            'https://example.org/a',
            '/os-temp',
            false,
            expect.any(Function),
        );
        expect(mocks.showProgressBar).toHaveBeenCalledWith(
            'https://example.org/a',
        );
        expect(mocks.fsMove).toHaveBeenCalledWith(
            '/os-temp/a.mp3',
            '/data/audios/a.mp3.1',
        );
        expect(state.toastUpdates.map(([, message]) => message)).toEqual([
            'Downloading audio from "https://example.org/a", please wait...',
            'Audio downloaded successfully, file path: "/data/audios/a.mp3.1"',
        ]);
        expect(mocks.hideProgressBar).toHaveBeenCalledWith(
            'https://example.org/a',
        );
    });

    test('a failure is reported in the same toast', async () => {
        const error = new Error('HTTP 500');
        mocks.downloadVideoOrAudio.mockRejectedValueOnce(error);
        await download();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(state.toastUpdates).toEqual([
            [
                'Download From URL',
                'Error occurred during downloading audio: HTTP 500',
            ],
        ]);
        expect(mocks.hideProgressBar).toHaveBeenCalled();
    });

    test('missing media tools are already a dialog: nothing more is said', async () => {
        state.isExtraBinMissing = true;
        mocks.downloadVideoOrAudio.mockRejectedValueOnce(new Error('no bin'));
        await download();
        expect(mocks.handleError).not.toHaveBeenCalled();
        expect(state.toastUpdates).toEqual([]);
        expect(mocks.hideProgressBar).toHaveBeenCalledWith(
            'https://example.org/a',
        );
    });
});
