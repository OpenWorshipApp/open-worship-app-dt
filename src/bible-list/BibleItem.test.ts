import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const settings = new Map<string, string>();

    return {
        appErrorMock: vi.fn(),
        copyToClipboardMock: vi.fn(),
        extractBibleTitleMock: vi.fn(),
        fileSourceGetInstanceMock: vi.fn(),
        fromVerseKeyMock: vi.fn(),
        getSettingMock: vi.fn((key: string) => settings.get(key) ?? null),
        handleErrorMock: vi.fn(),
        isValidJsonMock: vi.fn(),
        reset() {
            settings.clear();
        },
        setSettingMock: vi.fn((key: string, value: string) => {
            settings.set(key, value);
        }),
        settings,
        toChapterFullKeyFormatMock: vi.fn(
            (bookKey: string, chapter: number) => {
                return `${bookKey} ${chapter}`;
            },
        ),
        toVerseFullKeyFormatMock: vi.fn(
            (
                bookKey: string,
                chapter: number,
                verseStart: number | string,
                verseEnd?: number,
            ) => {
                if (verseEnd === undefined) {
                    return `${bookKey} ${chapter}:${verseStart}`;
                }
                return `${bookKey} ${chapter}:${verseStart}-${verseEnd}`;
            },
        ),
        bibleRenderHelperMock: {
            getJumpingChapter: vi.fn(),
            toText: vi.fn(),
            toTitle: vi.fn(),
            toVerseTextList: vi.fn(),
        },
    };
});

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    isValidJson: mocks.isValidJsonMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: mocks.fileSourceGetInstanceMock,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
    setSetting: mocks.setSettingMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../helper/loggerHelpers', () => ({
    appError: mocks.appErrorMock,
}));

vi.mock('./bibleRenderHelpers', () => ({
    bibleRenderHelper: mocks.bibleRenderHelperMock,
}));

vi.mock('../server/appHelpers', () => ({
    copyToClipboard: mocks.copyToClipboardMock,
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    extractBibleTitle: mocks.extractBibleTitleMock,
}));

vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    fromVerseKey: mocks.fromVerseKeyMock,
    toChapterFullKeyFormat: mocks.toChapterFullKeyFormatMock,
    toVerseFullKeyFormat: mocks.toVerseFullKeyFormatMock,
}));

import BibleItem from './BibleItem';

function createBibleItemJson(id = 1, bibleKey = 'KJV') {
    return {
        bibleKey,
        extraBibleKeys: ['WEB'],
        id,
        isAudioEnabled: true,
        metadata: { note: 'memo' },
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseEnd: 3,
            verseStart: 1,
        },
    };
}

describe('BibleItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.reset();
        mocks.fileSourceGetInstanceMock.mockImplementation(
            (filePath: string) => ({ filePath }),
        );
        mocks.isValidJsonMock.mockImplementation((value: string) => {
            try {
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
        });
        mocks.bibleRenderHelperMock.getJumpingChapter.mockResolvedValue({
            bookKey: 'EXO',
            chapter: 2,
            verseEnd: 4,
            verseStart: 1,
        });
        mocks.bibleRenderHelperMock.toText.mockResolvedValue('Verse text');
        mocks.bibleRenderHelperMock.toTitle.mockResolvedValue('Genesis 1:1-3');
        mocks.bibleRenderHelperMock.toVerseTextList.mockResolvedValue([
            { text: 'Verse text' },
        ]);
        mocks.fromVerseKeyMock.mockResolvedValue({
            bookKey: 'EXO',
            chapter: 2,
            verseEnd: 5,
            verseStart: 4,
        });
    });

    test('constructs, validates, compares, serializes, and clones bible items', () => {
        const bibleItem = BibleItem.fromJson(
            createBibleItemJson(),
            '/bibles/main.bible',
        );

        expect(bibleItem.id).toBe(1);
        bibleItem.id = 7;
        bibleItem.bibleKey = 'WEB';
        bibleItem.target = {
            bookKey: 'EXO',
            chapter: 2,
            verseEnd: 6,
            verseStart: 4,
        };
        bibleItem.metadata = { color: 'blue' };
        bibleItem.extraBibleKeys = ['AMP'];
        bibleItem.isAudioEnabled = false;

        expect(bibleItem.checkIsSameId(7)).toBe(true);
        expect(
            bibleItem.checkIsSameId(BibleItem.fromJson(createBibleItemJson(7))),
        ).toBe(true);
        expect(
            bibleItem.checkIsTargetIdentical(
                BibleItem.fromJson({
                    ...createBibleItemJson(2),
                    target: bibleItem.target,
                }),
            ),
        ).toBe(true);
        expect(
            bibleItem.checkIsTargetIdentical(
                BibleItem.fromJson(createBibleItemJson(2)),
            ),
        ).toBe(false);

        expect(bibleItem.toJson()).toEqual({
            bibleKey: 'WEB',
            extraBibleKeys: ['AMP'],
            id: 7,
            isAudioEnabled: false,
            metadata: { color: 'blue' },
            target: {
                bookKey: 'EXO',
                chapter: 2,
                verseEnd: 6,
                verseStart: 4,
            },
        });

        const clone = bibleItem.clone();
        expect(clone.id).toBe(-1);
        expect(bibleItem.clone(true).id).toBe(7);

        const errorItem = BibleItem.fromJsonError(
            createBibleItemJson(9),
            '/bibles/error.bible',
        );
        expect(errorItem.toJson()).toEqual(createBibleItemJson(9));

        expect(() => BibleItem.validate(createBibleItemJson())).not.toThrow();
        expect(() =>
            BibleItem.validate({
                ...createBibleItemJson(),
                bibleKey: '',
            } as any),
        ).toThrow('Invalid bible item data');
        expect(mocks.appErrorMock).toHaveBeenCalled();
    });

    test('creates items from bible title helpers and saves updates through a bible source', async () => {
        const extractedItem = BibleItem.fromData('KJV', 'PSA', 23, 1, 6);
        mocks.extractBibleTitleMock.mockResolvedValueOnce({
            result: {
                bibleItem: extractedItem,
            },
        });
        mocks.extractBibleTitleMock.mockResolvedValueOnce({
            result: { bibleItem: null },
        });

        expect(await BibleItem.fromTitleText('KJV', 'Psalm 23')).toBe(
            extractedItem,
        );
        expect(await BibleItem.fromTitleText('KJV', 'Missing')).toBeNull();

        const fromVerseKey = await BibleItem.fromVerseKey('WEB', 'EXO 2:4-5');
        expect(fromVerseKey?.toJson()).toEqual({
            bibleKey: 'WEB',
            extraBibleKeys: [],
            id: -1,
            isAudioEnabled: false,
            metadata: {},
            target: {
                bookKey: 'EXO',
                chapter: 2,
                verseEnd: 5,
                verseStart: 4,
            },
        });
        mocks.fromVerseKeyMock.mockResolvedValueOnce(null);
        expect(await BibleItem.fromVerseKey('WEB', 'bad')).toBeNull();

        const bibleItem = BibleItem.fromJson(
            createBibleItemJson(1),
            '/bibles/main.bible',
        );
        expect(await bibleItem.save(null)).toBe(false);

        const storedItem = BibleItem.fromJson(createBibleItemJson(1, 'KJV'));
        const bible = {
            getItemById: vi.fn(() => storedItem),
            save: vi.fn(async () => true),
            setItemById: vi.fn(),
        };
        const updatedItem = BibleItem.fromJson({
            ...createBibleItemJson(1, 'WEB'),
            metadata: { note: 'updated' },
        });
        expect(await updatedItem.save(bible as any)).toBe(true);
        expect(storedItem.bibleKey).toBe('WEB');
        expect(bible.setItemById).toHaveBeenCalledWith(1, storedItem);
        expect(bible.save).toHaveBeenCalledTimes(1);

        const missingBible = {
            getItemById: vi.fn(() => null),
            save: vi.fn(async () => true),
            setItemById: vi.fn(),
        };
        expect(await updatedItem.save(missingBible as any)).toBe(false);

        expect(
            BibleItem.convertPresent(updatedItem, [storedItem]),
        ).toHaveLength(1);
        const converted = BibleItem.convertPresent(updatedItem, [
            storedItem,
            extractedItem,
        ]);
        expect(converted.map((item) => item.bibleKey)).toEqual(['WEB', 'KJV']);
    });

    test('stores presenter settings, delegates rendering helpers, and copies formatted content', async () => {
        const bibleItem = BibleItem.fromJson(
            createBibleItemJson(1, 'WEB'),
            '/bibles/main.bible',
        );
        BibleItem.setBiblePresenterSetting([bibleItem]);
        expect(mocks.setSettingMock).toHaveBeenCalledWith(
            'bible-presenter',
            JSON.stringify([bibleItem.toJson()]),
        );

        expect(BibleItem.getBiblePresenterSetting()).toHaveLength(1);

        mocks.settings.set('bible-presenter', '{bad-json');
        mocks.isValidJsonMock.mockReturnValueOnce(true);
        expect(BibleItem.getBiblePresenterSetting()).toEqual([]);
        expect(mocks.handleErrorMock).toHaveBeenCalled();

        expect(await bibleItem.toTitleText()).toEqual({
            title: 'Genesis 1:1-3',
            text: 'Verse text',
        });
        expect(await bibleItem.toTitleWithBibleKey()).toBe(
            '(WEB) Genesis 1:1-3',
        );
        expect(await bibleItem.toText()).toBe('Verse text');
        expect(await bibleItem.toVerseTextList()).toEqual([
            { text: 'Verse text' },
        ]);
        expect(bibleItem.toChapterFullKey()).toBe('GEN 1');
        expect(bibleItem.toVerseFullKey()).toBe('GEN 1:1-3');
        expect(bibleItem.getCopyingBibleKey()).toBe('(WEB)');

        await bibleItem.copyTitleToClipboard();
        await bibleItem.copyTextToClipboard();
        await bibleItem.copyToClipboard();
        bibleItem.copyVerseFullKeyToClipboard();
        bibleItem.copyChapterFullKeyToClipboard();

        expect(
            mocks.copyToClipboardMock.mock.calls.map((call) => call[0]),
        ).toEqual([
            '(WEB) Genesis 1:1-3',
            'Verse text',
            '(WEB) Genesis 1:1-3\nVerse text',
            'GEN 1:1-3',
            'GEN 1',
        ]);
        expect(await bibleItem.getJumpingChapter(true)).toEqual({
            bookKey: 'EXO',
            chapter: 2,
            verseEnd: 4,
            verseStart: 1,
        });

        const synced = BibleItem.fromJson(createBibleItemJson(9, 'AMP'));
        bibleItem.syncData(synced);
        expect(bibleItem.toJson()).toEqual({
            ...synced.toJson(),
            id: 1,
        });
    });

    test('serializes drag and lookup data and can save bible lookups back to an existing item', async () => {
        const bibleItem = BibleItem.fromJson(
            createBibleItemJson(3, 'KJV'),
            '/bibles/main.bible',
        );

        expect(bibleItem.dragSerialize()).toEqual({
            data: {
                ...bibleItem.toJson(),
                filePath: '/bibles/main.bible',
            },
            type: 'bibleItem',
        });

        expect(
            BibleItem.dragDeserialize({
                ...createBibleItemJson(4, 'WEB'),
                filePath: '/bibles/web.bible',
            })?.toJson(),
        ).toEqual(createBibleItemJson(4, 'WEB'));

        expect(BibleItem.dragDeserialize({ broken: true })).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalled();

        expect(BibleItem.genBibleLookupData(bibleItem)).toBe(
            JSON.stringify({
                ...bibleItem.toJson(),
                filePath: '/bibles/main.bible',
            }),
        );
        expect(
            BibleItem.genBibleLookupData(
                BibleItem.fromJson(createBibleItemJson(5)),
            ),
        ).toBeUndefined();
        expect(BibleItem.parseBibleLookupData()).toBeNull();
        expect(
            BibleItem.parseBibleLookupData(
                JSON.stringify({
                    ...createBibleItemJson(6, 'ESV'),
                    filePath: '/bibles/esv.bible',
                }),
            )?.filePath,
        ).toBe('/bibles/esv.bible');

        const oldBibleItem = BibleItem.fromJson(createBibleItemJson(7, 'KJV'));
        const newBibleItem = BibleItem.fromJson({
            ...createBibleItemJson(8, 'WEB'),
            target: {
                bookKey: 'REV',
                chapter: 22,
                verseEnd: 21,
                verseStart: 21,
            },
        });
        const saveSpy = vi.spyOn(oldBibleItem, 'save').mockResolvedValue(true);

        expect(
            await BibleItem.saveFromBibleLookup(
                {} as any,
                oldBibleItem,
                newBibleItem,
            ),
        ).toBe(true);
        expect(oldBibleItem.bibleKey).toBe('WEB');
        expect(oldBibleItem.target.bookKey).toBe('REV');
        expect(saveSpy).toHaveBeenCalledWith({} as any);

        mocks.extractBibleTitleMock.mockResolvedValueOnce({
            result: {
                bibleItem: {
                    toVerseFullKey: () => 'REV 22:21',
                },
            },
        });
        mocks.extractBibleTitleMock.mockResolvedValueOnce({
            result: { bibleItem: null },
        });
        expect(
            await BibleItem.bibleTitleToKJVVerseKey('KJV', 'Revelation 22:21'),
        ).toBe('REV 22:21');
        expect(
            await BibleItem.bibleTitleToKJVVerseKey('KJV', 'Missing'),
        ).toBeNull();
    });
});
