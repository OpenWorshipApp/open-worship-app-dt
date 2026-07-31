// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getVersesMock,
    getJumpingChapterMock,
    getInstanceMock,
    handleErrorMock,
    listenForDataMock,
    appProviderMock,
} = vi.hoisted(() => {
    return {
        getVersesMock: vi.fn(),
        getJumpingChapterMock: vi.fn(),
        getInstanceMock: vi.fn(),
        handleErrorMock: vi.fn(),
        listenForDataMock: vi.fn(),
        appProviderMock: {
            isPageScreen: false,
            systemUtils: { isDev: false },
        } as any,
    };
});

vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: getVersesMock,
}));

vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { getJumpingChapter: getJumpingChapterMock },
}));

vi.mock('./managers/ScreenBibleManager', () => ({
    default: { getInstance: getInstanceMock },
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

import {
    initScreenBibleStepping,
    stepScreenBibleItem,
    toSteppedBibleTarget,
} from './screenBibleSteppingHelpers';

const JOHN_3 = { bookKey: 'JHN', chapter: 3, verseStart: 12, verseEnd: 12 };

function mockVerseCount(count: number) {
    const verses: { [key: string]: string } = {};
    for (let verse = 1; verse <= count; verse++) {
        verses[`${verse}`] = `verse ${verse}`;
    }
    getVersesMock.mockResolvedValue(verses);
}

function genBibleItemJson(target = JOHN_3) {
    return {
        id: 7,
        bibleKey: 'KJV',
        target,
        metadata: {},
    };
}

describe('screenBibleSteppingHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appProviderMock.isPageScreen = false;
        appProviderMock.messageUtils = { listenForData: listenForDataMock };
    });

    test('steps a single verse forward and backward inside the chapter', async () => {
        mockVerseCount(36);

        await expect(
            toSteppedBibleTarget('KJV', JOHN_3, true),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 13,
            verseEnd: 13,
        });
        await expect(
            toSteppedBibleTarget('KJV', JOHN_3, false),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 11,
            verseEnd: 11,
        });
        expect(getJumpingChapterMock).not.toHaveBeenCalled();
    });

    test('keeps the window size when stepping a verse range', async () => {
        mockVerseCount(36);
        const target = {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 12,
            verseEnd: 14,
        };

        await expect(
            toSteppedBibleTarget('KJV', target, true),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 15,
            verseEnd: 17,
        });
        await expect(
            toSteppedBibleTarget('KJV', target, false),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 9,
            verseEnd: 11,
        });
    });

    test('rolls over into the neighbouring chapter at either edge', async () => {
        mockVerseCount(36);
        getJumpingChapterMock.mockResolvedValue({
            bookKey: 'JHN',
            chapter: 4,
            verseStart: 1,
            verseEnd: 54,
        });

        await expect(
            toSteppedBibleTarget(
                'KJV',
                { bookKey: 'JHN', chapter: 3, verseStart: 35, verseEnd: 36 },
                true,
            ),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 4,
            verseStart: 1,
            verseEnd: 2,
        });

        getJumpingChapterMock.mockResolvedValue({
            bookKey: 'JHN',
            chapter: 2,
            verseStart: 1,
            verseEnd: 25,
        });
        await expect(
            toSteppedBibleTarget(
                'KJV',
                { bookKey: 'JHN', chapter: 3, verseStart: 1, verseEnd: 2 },
                false,
            ),
        ).resolves.toEqual({
            bookKey: 'JHN',
            chapter: 2,
            verseStart: 24,
            verseEnd: 25,
        });
    });

    test('gives up instead of guessing when the chapter data is missing', async () => {
        getVersesMock.mockResolvedValue(null);

        await expect(
            toSteppedBibleTarget('KJV', JOHN_3, true),
        ).resolves.toBeNull();

        mockVerseCount(36);
        getJumpingChapterMock.mockResolvedValue(null);
        await expect(
            toSteppedBibleTarget(
                'KJV',
                { bookKey: 'JHN', chapter: 3, verseStart: 36, verseEnd: 36 },
                true,
            ),
        ).resolves.toBeNull();
    });

    test('re-applies the stepped item to the screen without its background', async () => {
        mockVerseCount(36);
        const applyNewBibleItemJson = vi.fn();
        getInstanceMock.mockReturnValue({
            screenViewData: {
                bibleItemData: { bibleItem: genBibleItemJson() },
            },
            applyNewBibleItemJson,
        });

        await stepScreenBibleItem(2, true);

        expect(getInstanceMock).toHaveBeenCalledWith(2);
        expect(applyNewBibleItemJson).toHaveBeenCalledWith(
            {
                ...genBibleItemJson(),
                target: {
                    bookKey: 'JHN',
                    chapter: 3,
                    verseStart: 13,
                    verseEnd: 13,
                },
            },
            // no filePath: stepping must not re-attach the bible's background
            undefined,
        );
    });

    test('does nothing when the screen has no bible on it', async () => {
        mockVerseCount(36);
        const applyNewBibleItemJson = vi.fn();
        getInstanceMock.mockReturnValue({
            screenViewData: null,
            applyNewBibleItemJson,
        });

        await stepScreenBibleItem(2, true);
        expect(applyNewBibleItemJson).not.toHaveBeenCalled();

        getInstanceMock.mockReturnValue(null);
        await stepScreenBibleItem(2, true);
        expect(applyNewBibleItemJson).not.toHaveBeenCalled();
    });

    test('subscribes to the main-process message only outside the screen page', () => {
        initScreenBibleStepping();
        expect(listenForDataMock).toHaveBeenCalledWith(
            'app:main:change-bible',
            expect.any(Function),
        );

        listenForDataMock.mockClear();
        appProviderMock.isPageScreen = true;
        initScreenBibleStepping();
        expect(listenForDataMock).not.toHaveBeenCalled();
    });

    test('ignores a malformed payload', async () => {
        mockVerseCount(36);
        const applyNewBibleItemJson = vi.fn();
        getInstanceMock.mockReturnValue({
            screenViewData: {
                bibleItemData: { bibleItem: genBibleItemJson() },
            },
            applyNewBibleItemJson,
        });
        initScreenBibleStepping();
        const handler = listenForDataMock.mock.calls[0][1];

        handler({}, undefined);
        handler({}, { screenId: '2', isNext: true });
        handler({}, { screenId: 2 });
        await Promise.resolve();
        expect(applyNewBibleItemJson).not.toHaveBeenCalled();

        handler({}, { screenId: 2, isNext: true });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(applyNewBibleItemJson).toHaveBeenCalledTimes(1);
    });
});
