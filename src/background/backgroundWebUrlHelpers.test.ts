import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    storageState,
    getItemMock,
    setItemMock,
    fileDragDeserializeMock,
    getColorNoteFilePathSettingMock,
    setColorNoteFilePathSettingMock,
    askForURLMock,
    showSimpleToastMock,
    handleErrorMock,
} = vi.hoisted(() => {
    const storageState = new Map<string, string>();
    return {
        storageState,
        getItemMock: vi.fn((key: string) => storageState.get(key) ?? null),
        setItemMock: vi.fn((key: string, value: string) => {
            storageState.set(key, value);
        }),
        fileDragDeserializeMock: vi.fn(),
        getColorNoteFilePathSettingMock: vi.fn(),
        setColorNoteFilePathSettingMock: vi.fn(),
        askForURLMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        handleErrorMock: vi.fn(),
    };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        dragDeserialize: fileDragDeserializeMock,
    },
}));

vi.mock('../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSetting: getColorNoteFilePathSettingMock,
    setColorNoteFilePathSetting: setColorNoteFilePathSettingMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./downloadHelper', () => ({
    askForURL: askForURLMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

import { DragTypeEnum } from '../helper/DragInf';
import {
    BackgroundWebUrlSource,
    createBackgroundWebUrlSourceList,
    deserializeBackgroundWebDragItem,
    getBackgroundWebUrlItemList,
    isBackgroundWebUrlItemData,
    normalizeBackgroundWebUrl,
    promptBackgroundWebUrlSource,
    setBackgroundWebUrlItemList,
} from './backgroundWebUrlHelpers';

describe('backgroundWebUrlHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storageState.clear();
    });

    test('normalizes, validates, and sanitizes stored URL items', () => {
        storageState.set(
            'background-web-url-list',
            JSON.stringify([
                {
                    id: 'web-1',
                    src: ' https://example.com/page ',
                    isUrl: true,
                },
                {
                    id: 'web-2',
                    src: 'https://example.com/page',
                    isUrl: true,
                },
                {
                    id: 'web-3',
                    src: 'not-a-url',
                    isUrl: true,
                },
                {
                    id: '',
                    src: 'https://example.com/ignored',
                    isUrl: true,
                },
                {
                    id: 'web-4',
                    src: 'https://example.com/next',
                    isUrl: true,
                },
            ]),
        );

        expect(normalizeBackgroundWebUrl(' https://example.com/page ')).toBe(
            'https://example.com/page',
        );
        expect(
            isBackgroundWebUrlItemData({
                id: 'web-1',
                src: 'https://example.com/page',
                isUrl: true,
            }),
        ).toBe(true);
        expect(
            isBackgroundWebUrlItemData({
                id: 'web-1',
                src: 'https://example.com/page',
                isUrl: false,
            }),
        ).toBe(false);

        expect(getBackgroundWebUrlItemList()).toEqual([
            {
                id: 'web-1',
                src: 'https://example.com/page',
                isUrl: true,
            },
            {
                id: 'web-4',
                src: 'https://example.com/next',
                isUrl: true,
            },
        ]);
        expect(handleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('stores sanitized URL items', () => {
        setBackgroundWebUrlItemList([
            {
                id: 'web-1',
                src: ' https://example.com/page ',
                isUrl: true,
            },
            {
                id: 'web-2',
                src: 'https://example.com/page',
                isUrl: true,
            },
            {
                id: 'web-3',
                src: 'https://example.com/next',
                isUrl: true,
            },
        ]);

        expect(setItemMock).toHaveBeenCalledWith(
            'background-web-url-list',
            JSON.stringify([
                {
                    id: 'web-1',
                    src: 'https://example.com/page',
                    isUrl: true,
                },
                {
                    id: 'web-3',
                    src: 'https://example.com/next',
                    isUrl: true,
                },
            ]),
        );
        expect(getBackgroundWebUrlItemList()).toEqual([
            {
                id: 'web-1',
                src: 'https://example.com/page',
                isUrl: true,
            },
            {
                id: 'web-3',
                src: 'https://example.com/next',
                isUrl: true,
            },
        ]);
    });

    test('supports drag serialization, color notes, and drag deserialization', async () => {
        const source = new BackgroundWebUrlSource({
            id: 'web-1',
            src: ' https://example.com/page ',
            isUrl: true,
        });
        fileDragDeserializeMock.mockReturnValue({ kind: 'file-source' });
        getColorNoteFilePathSettingMock.mockReturnValue('blue');

        expect(source.src).toBe('https://example.com/page');
        expect(source.fullName).toBe('https://example.com/page');
        expect(source.name).toBe('https://example.com/page');
        expect(source.filePath).toBe('https://example.com/page');
        expect(source.dragSerialize()).toEqual({
            type: DragTypeEnum.BACKGROUND_WEB,
            data: {
                id: 'web-1',
                src: 'https://example.com/page',
                isUrl: true,
            },
        });
        expect(await source.getColorNote()).toBe('blue');

        await source.setColorNote('green');

        expect(getColorNoteFilePathSettingMock).toHaveBeenCalledWith(
            'background-web-url:web-1',
            null,
        );
        expect(setColorNoteFilePathSettingMock).toHaveBeenCalledWith(
            'background-web-url:web-1',
            null,
            'green',
        );
        expect(createBackgroundWebUrlSourceList([source.toData()])).toEqual([
            expect.objectContaining({
                id: 'web-1',
                src: 'https://example.com/page',
            }),
        ]);
        expect(deserializeBackgroundWebDragItem('/files/page.html')).toEqual({
            kind: 'file-source',
        });
        expect(fileDragDeserializeMock).toHaveBeenCalledWith(
            '/files/page.html',
        );

        const urlDragItem = deserializeBackgroundWebDragItem({
            id: 'web-2',
            src: 'https://example.com/drag',
            isUrl: true,
        });
        expect(urlDragItem).toBeInstanceOf(BackgroundWebUrlSource);
        expect((urlDragItem as BackgroundWebUrlSource).toData()).toEqual({
            id: 'web-2',
            src: 'https://example.com/drag',
            isUrl: true,
        });
        expect(
            deserializeBackgroundWebDragItem({
                id: 'bad',
                src: '',
                isUrl: true,
            }),
        ).toBeNull();
    });

    test('prompts for URLs with validation and duplicate checks', async () => {
        askForURLMock.mockResolvedValueOnce(null);
        expect(await promptBackgroundWebUrlSource([])).toBeNull();

        askForURLMock.mockResolvedValueOnce('not-a-url');
        expect(await promptBackgroundWebUrlSource([])).toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Add URL',
            'Invalid URL',
        );

        askForURLMock.mockResolvedValueOnce(' https://example.com/page ');
        expect(
            await promptBackgroundWebUrlSource(['https://example.com/page']),
        ).toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Add URL',
            'URL already exists',
        );

        const randomUUIDMock = vi
            .spyOn(globalThis.crypto, 'randomUUID')
            .mockReturnValue('00000000-0000-4000-8000-000000000001');
        askForURLMock.mockResolvedValueOnce(' https://example.com/created ');

        const urlSource = await promptBackgroundWebUrlSource([
            'https://example.com/page',
        ]);

        expect(urlSource).toBeInstanceOf(BackgroundWebUrlSource);
        expect(urlSource?.toData()).toEqual({
            id: '00000000-0000-4000-8000-000000000001',
            src: 'https://example.com/created',
            isUrl: true,
        });

        randomUUIDMock.mockRestore();
    });
});
