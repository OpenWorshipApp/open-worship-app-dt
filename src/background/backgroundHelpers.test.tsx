// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    currentDirSourceState,
    getSelectBackgroundSrcListMock,
    handleBackgroundSelectingMock,
    pptxGetInstanceMock,
    useGenDirSourceReloadMock,
} = vi.hoisted(() => ({
    currentDirSourceState: { value: null as any },
    getSelectBackgroundSrcListMock: vi.fn(),
    handleBackgroundSelectingMock: vi.fn(),
    pptxGetInstanceMock: vi.fn(),
    useGenDirSourceReloadMock: vi.fn(() => currentDirSourceState.value),
}));

vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: {
        getSelectBackgroundSrcList: getSelectBackgroundSrcListMock,
        handleBackgroundSelecting: handleBackgroundSelectingMock,
    },
}));

vi.mock('../app-document-list/PptxAppDocument', () => ({
    default: {
        getInstance: pptxGetInstanceMock,
    },
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: useEffect,
    useAppEffectAsync: (
        effectMethod: (
            methods: Record<string, unknown>,
        ) => Promise<void | (() => void)>,
        deps: readonly unknown[] | undefined,
        methods?: Record<string, unknown>,
    ) => {
        const methodContext = methods === undefined ? {} : { ...methods };
        useEffect(() => {
            let cleanup: void | (() => void);
            void effectMethod(methodContext).then((resolved) => {
                cleanup = resolved;
            });
            return () => {
                cleanup?.();
            };
        }, deps);
    },
}));

vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: useGenDirSourceReloadMock,
}));

import { DragTypeEnum } from '../helper/DragInf';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import {
    cameraDragDeserialize,
    cameraDragSerialize,
    genBackgroundMediaItemData,
    useAppDocumentAudioData,
} from './backgroundHelpers';

describe('backgroundHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        currentDirSourceState.value = null;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function flushEffects() {
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
    }

    async function renderAudioDataHost() {
        const observedValues: Array<unknown> = [];

        function Host() {
            const value = useAppDocumentAudioData();
            useEffect(() => {
                observedValues.push(value);
            }, [value]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Host />);
        });

        return observedValues;
    }

    test('builds selected media item data and forwards selections', () => {
        getSelectBackgroundSrcListMock.mockReturnValue([
            ['stage', 'image'],
            ['preview', 'image'],
        ]);

        const itemData = genBackgroundMediaItemData(
            'Sample title',
            '/backgrounds/sky.jpg',
            DragTypeEnum.BACKGROUND_IMAGE,
        );

        expect(itemData.backgroundType).toBe('image');
        expect(itemData.isInScreen).toBe(true);
        expect(itemData.selectedCN).toBe(
            `${HIGHLIGHT_SELECTED_CLASSNAME} animation`,
        );
        expect(itemData.title).toBe(
            'Sample title \nShow in presents:stage,preview',
        );
        expect(itemData.selectedBackgroundSrcList).toEqual([
            ['stage', 'image'],
            ['preview', 'image'],
        ]);

        itemData.handleSelecting('event-object', true);

        expect(handleBackgroundSelectingMock).toHaveBeenCalledWith(
            'event-object',
            'image',
            { src: '/backgrounds/sky.jpg' },
            true,
        );
    });

    test('builds unselected media item data and serializes camera payloads', () => {
        getSelectBackgroundSrcListMock.mockReturnValue([]);

        const itemData = genBackgroundMediaItemData(
            'Ambient video',
            '/backgrounds/ambient.mp4',
            DragTypeEnum.BACKGROUND_VIDEO,
        );

        expect(itemData.backgroundType).toBe('video');
        expect(itemData.isInScreen).toBe(false);
        expect(itemData.selectedCN).toBe('');
        expect(itemData.title).toBe('Ambient video');
        expect(cameraDragSerialize({ deviceId: 'camera-1' } as any)).toEqual({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            data: 'camera-1',
        });
        expect(cameraDragDeserialize('camera-2')).toEqual({
            src: 'camera-2',
        });
    });

    test('keeps audio data null when the dir source is unavailable', async () => {
        const observedValues = await renderAudioDataHost();

        await flushEffects();

        expect(observedValues).toEqual([null]);
        expect(pptxGetInstanceMock).not.toHaveBeenCalled();
    });

    test('skips audio loading when the dir source has no directory path', async () => {
        let refreshCallback: (() => Promise<void> | void) | undefined;
        const dirSource = {
            dirPath: '',
            registerEventListener: vi.fn(
                (_events: string[], callback: () => Promise<void> | void) => {
                    refreshCallback = callback;
                    return ['refresh-listener'];
                },
            ),
            unregisterEventListener: vi.fn(),
            getFilePathsQuick: vi.fn(),
        };
        currentDirSourceState.value = dirSource;

        const observedValues = await renderAudioDataHost();

        await flushEffects();
        await act(async () => {
            await refreshCallback?.();
            await Promise.resolve();
        });

        expect(observedValues).toEqual([null]);
        expect(dirSource.getFilePathsQuick).not.toHaveBeenCalled();

        await act(async () => {
            root?.unmount();
        });
        root = null;

        expect(dirSource.unregisterEventListener).toHaveBeenCalledWith([
            'refresh-listener',
        ]);
    });

    test('loads and refreshes app document audio data', async () => {
        let refreshCallback: (() => Promise<void> | void) | undefined;
        const dirSource = {
            dirPath: '/slides',
            registerEventListener: vi.fn(
                (_events: string[], callback: () => Promise<void> | void) => {
                    refreshCallback = callback;
                    return ['refresh-listener'];
                },
            ),
            unregisterEventListener: vi.fn(),
            getFilePathsQuick: vi
                .fn()
                .mockResolvedValue(['/slides/empty.pptx', '/slides/song.pptx']),
        };
        currentDirSourceState.value = dirSource;
        pptxGetInstanceMock.mockImplementation((filePath: string) => ({
            fileSource: {
                name: filePath.endsWith('empty.pptx')
                    ? 'empty.pptx'
                    : 'song.pptx',
            },
            getAudioFilePaths: vi.fn().mockResolvedValue(
                filePath.endsWith('empty.pptx')
                    ? []
                    : [
                          {
                              slideIndex: 2,
                              filePaths: ['/audio/song.mp3'],
                          },
                      ],
            ),
        }));

        const observedValues = await renderAudioDataHost();

        await flushEffects();

        expect(dirSource.getFilePathsQuick).toHaveBeenCalledWith('pptx', true);
        expect(pptxGetInstanceMock).toHaveBeenCalledWith('/slides/empty.pptx');
        expect(pptxGetInstanceMock).toHaveBeenCalledWith('/slides/song.pptx');
        expect(observedValues).toContainEqual({
            'song.pptx': [
                {
                    slideIndex: 2,
                    filePaths: ['/audio/song.mp3'],
                },
            ],
        });

        await act(async () => {
            await refreshCallback?.();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(dirSource.getFilePathsQuick).toHaveBeenCalledTimes(2);

        await act(async () => {
            root?.unmount();
        });
        root = null;

        expect(dirSource.unregisterEventListener).toHaveBeenCalledWith([
            'refresh-listener',
        ]);
    });
});
