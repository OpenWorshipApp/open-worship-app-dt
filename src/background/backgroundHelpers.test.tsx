// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getBackgroundSrcListByType: vi.fn(),
    getSelectBackgroundSrcList: vi.fn(),
    handleBackgroundSelecting: vi.fn(),
    getFileSource: vi.fn(),
    handleDragStart: vi.fn(),
    useGenDirSourceReload: vi.fn(),
    getPptx: vi.fn(),
    checkDirExist: vi.fn(),
    dirListener: null as null | (() => void),
}));

vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: {
        getBackgroundSrcListByType: h.getBackgroundSrcListByType,
        getSelectBackgroundSrcList: h.getSelectBackgroundSrcList,
        handleBackgroundSelecting: h.handleBackgroundSelecting,
    },
}));
vi.mock('../helper/helpers', () => ({
    HIGHLIGHT_SELECTED_CLASSNAME: 'selected',
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getFileSource },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: h.checkDirExist,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: h.useGenDirSourceReload,
}));
vi.mock('../app-document-list/PptxAppDocument', () => ({
    default: { getInstance: h.getPptx },
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import { DragTypeEnum } from '../helper/DragInf';
import {
    cameraDragDeserialize,
    cameraDragSerialize,
    genBackgroundLayerMarker,
    genBackgroundMediaItemData,
    genBackgroundMediaItemDataByFilePath,
    useAppDocumentAudioData,
} from './backgroundHelpers';

function AudioData() {
    const data = useAppDocumentAudioData();
    return createElement(
        'output',
        null,
        data ? Object.keys(data).join(',') : 'none',
    );
}

let root: Root;
let container: HTMLDivElement;
const dirSource = {
    dirPath: '/documents',
    getFilePathsQuick: vi.fn(),
    registerEventListener: vi.fn((_names: string[], callback: () => void) => {
        h.dirListener = callback;
        return 'listener';
    }),
    unregisterEventListener: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    h.dirListener = null;
    h.getBackgroundSrcListByType.mockReturnValue([]);
    h.getSelectBackgroundSrcList.mockReturnValue([]);
    h.getFileSource.mockImplementation((filePath: string) => ({
        filePath,
        fullName: 'Image.png',
        src: `file://${filePath}`,
    }));
    h.useGenDirSourceReload.mockReturnValue(dirSource);
    h.checkDirExist.mockResolvedValue(true);
    dirSource.dirPath = '/documents';
    dirSource.getFilePathsQuick.mockResolvedValue(['/documents/a.pptx']);
    h.getPptx.mockReturnValue({
        fileSource: { name: 'A' },
        getAudioFilePaths: async () => [
            { slideId: 1, filePaths: ['song.mp3'] },
        ],
    });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

describe('background layer helpers', () => {
    it('marks the exact screen sources and selects a tile on the right layer', () => {
        h.getBackgroundSrcListByType.mockReturnValue([
            ['1', { src: 'file:///a.png' }],
            ['2', { src: 'file:///b.png' }],
        ]);
        expect(genBackgroundLayerMarker('image')).toBe(
            '1:file:///a.png|2:file:///b.png',
        );
        h.getSelectBackgroundSrcList.mockReturnValue([
            ['2', { src: 'file:///b.png' }],
        ]);
        const item = genBackgroundMediaItemData(
            'Image.png',
            'file:///b.png',
            DragTypeEnum.BACKGROUND_IMAGE,
        );
        expect(item).toMatchObject({
            isInScreen: true,
            backgroundType: 'image',
            selectedCN: 'selected animation',
        });
        expect(item.title).toContain('Show in presents:2');
        item.handleSelecting({ type: 'click' }, true);
        expect(h.handleBackgroundSelecting).toHaveBeenCalledWith(
            { type: 'click' },
            'image',
            { src: 'file:///b.png' },
            true,
        );
    });

    it('uses file-source paths for drag and serializes a camera by device id', () => {
        const item = genBackgroundMediaItemDataByFilePath(
            '/images/Image.png',
            DragTypeEnum.BACKGROUND_IMAGE,
        );
        expect(item.title).toBe('Image.png');
        item.handleDragStart({ type: 'dragstart' });
        expect(h.handleDragStart).toHaveBeenCalledWith(
            { type: 'dragstart' },
            expect.objectContaining({
                filePath: '/images/Image.png',
            }),
            DragTypeEnum.BACKGROUND_IMAGE,
        );
        expect(cameraDragSerialize({ deviceId: 'camera-1' } as never)).toEqual({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            data: 'camera-1',
        });
        expect(cameraDragDeserialize('camera-1')).toEqual({ src: 'camera-1' });
    });

    it('loads slide audio and refreshes it after the document folder changes', async () => {
        await act(async () => root.render(createElement(AudioData)));
        expect(container.textContent).toBe('A');
        expect(dirSource.getFilePathsQuick).toHaveBeenCalledWith('pptx', true);
        h.getPptx.mockReturnValue({
            fileSource: { name: 'B' },
            getAudioFilePaths: async () => [
                { slideId: 2, filePaths: ['new.mp3'] },
            ],
        });
        await act(async () => {
            await h.dirListener?.();
        });
        expect(container.textContent).toBe('B');
        expect(dirSource.registerEventListener).toHaveBeenCalledWith(
            ['refresh', 'reload'],
            expect.any(Function),
        );
    });

    it('asks nothing of a Documents folder that is not there', async () => {
        // A typo in the path box: listing it threw an uncaught ENOENT, and
        // the app offered a crash report, then asked to be reloaded.
        h.checkDirExist.mockResolvedValue(false);
        dirSource.getFilePathsQuick.mockRejectedValue(new Error('ENOENT'));
        await act(async () => root.render(createElement(AudioData)));
        expect(container.textContent).toBe('none');
        expect(dirSource.getFilePathsQuick).not.toHaveBeenCalled();
        // And a listing that fails anyway is an empty list, not a throw.
        h.checkDirExist.mockResolvedValue(true);
        await act(async () => {
            await h.dirListener?.();
        });
        expect(container.textContent).toBe('none');
    });

    it('leaves the audio list empty when the folder has no audio', async () => {
        h.getPptx.mockReturnValue({
            fileSource: { name: 'A' },
            getAudioFilePaths: async () => [],
        });
        await act(async () => root.render(createElement(AudioData)));
        expect(container.textContent).toBe('none');
    });
});
