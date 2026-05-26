import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const files = new Map<string, string>();
    const fileSources = new Map<string, any>();
    const appProviderMock = {
        isPageReader: false,
        systemUtils: {
            isDev: true,
        },
    };

    class MockBibleItem {
        bible: any = null;
        filePath?: string;
        jsonError: any = null;
        private readonly json: any;

        constructor(id: number, json: any, filePath?: string) {
            this.json = structuredClone({ ...json, id });
            this.filePath = filePath;
        }

        static fromJson(json: any, filePath?: string) {
            if (json.invalid) {
                throw new Error('Invalid bible item');
            }
            return new MockBibleItem(json.id, json, filePath);
        }

        static fromJsonError(json: any, filePath?: string) {
            const item = new MockBibleItem(
                -1,
                {
                    bibleKey: '',
                    id: -1,
                    metadata: {},
                    target: {
                        bookKey: '',
                        chapter: 0,
                        verseEnd: 0,
                        verseStart: 0,
                    },
                },
                filePath,
            );
            item.jsonError = structuredClone(json);
            return item;
        }

        get id() {
            return this.json.id;
        }

        set id(id: number) {
            this.json.id = id;
        }

        get bibleKey() {
            return this.json.bibleKey;
        }

        set bibleKey(bibleKey: string) {
            this.json.bibleKey = bibleKey;
        }

        clone() {
            return new MockBibleItem(this.id, this.toJson(), this.filePath);
        }

        toJson() {
            return this.jsonError ?? structuredClone(this.json);
        }
    }

    const getFileSource = (filePath: string) => {
        const normalizedPath = filePath.replaceAll('\\', '/');
        if (!fileSources.has(normalizedPath)) {
            const fullName = normalizedPath.split('/').at(-1) ?? normalizedPath;
            const extensionIndex = fullName.lastIndexOf('.');
            const name =
                extensionIndex === -1
                    ? fullName
                    : fullName.slice(0, extensionIndex);
            fileSources.set(normalizedPath, {
                extension:
                    extensionIndex === -1
                        ? ''
                        : fullName.slice(extensionIndex + 1),
                filePath: normalizedPath,
                fullName,
                name,
                writeFileData: vi.fn(async (data: string) => {
                    files.set(normalizedPath, data);
                    return true;
                }),
            });
        }
        return fileSources.get(normalizedPath);
    };

    return {
        MockBibleItem,
        appProviderMock,
        createNewFileDetailMock: vi.fn(),
        files,
        fileSources,
        fsListFilesWithMimetypeMock: vi.fn(),
        getFileSource,
        getSettingMock: vi.fn(),
        handleErrorMock: vi.fn(),
        notifyNewElementAddedMock: vi.fn(),
        readFileDataMock: vi.fn(async (filePath: string) => {
            return files.get(filePath.replaceAll('\\', '/')) ?? null;
        }),
        reset() {
            files.clear();
            fileSources.clear();
        },
        showSimpleToastMock: vi.fn(),
    };
});

vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: mocks.createNewFileDetailMock,
    fsListFilesWithMimetype: mocks.fsListFilesWithMimetypeMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => mocks.getFileSource(filePath),
        readFileData: mocks.readFileDataMock,
    },
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    toMaxId: (ids: number[]) => (ids.length === 0 ? 0 : Math.max(...ids)),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
}));

vi.mock('./BibleItem', () => ({
    default: mocks.MockBibleItem,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: {
        BIBLE_PRESENT: 'bible-present-dir',
        BIBLE_READ: 'bible-read-dir',
    },
}));

vi.mock('../server/appProvider', () => ({
    default: mocks.appProviderMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../helper/domHelpers', () => ({
    notifyNewElementAdded: mocks.notifyNewElementAddedMock,
}));

import Bible, { type BibleType } from './Bible';

function createBibleJson(items: any[]): BibleType {
    return {
        items,
        metadata: {
            app: 'OpenWorship',
            fileVersion: 1,
            initDate: '2026-04-13T00:00:00.000Z',
        },
    };
}

function createBibleItemJson(id: number, bibleKey = 'KJV') {
    return {
        bibleKey,
        id,
        metadata: {},
        target: {
            bookKey: 'GEN',
            chapter: id,
            verseStart: 1,
            verseEnd: 3,
        },
    };
}

describe('Bible', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.reset();
        mocks.getSettingMock.mockReturnValue('/bibles');
        mocks.fsListFilesWithMimetypeMock.mockResolvedValue([]);
        mocks.createNewFileDetailMock.mockImplementation(
            async (_dir: string, name: string, data: string) => {
                const filePath = `/bibles/${name}.bible`;
                mocks.files.set(filePath, data);
                return filePath;
            },
        );
        mocks.notifyNewElementAddedMock.mockImplementation(
            (callback: () => unknown) => callback(),
        );
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => ({ nodeName: 'DIV' })),
        });
    });

    test('maps item JSON, handles invalid items, and manages item collections', () => {
        const bible = Bible.fromJson(
            '/bibles/main.bible',
            createBibleJson([
                createBibleItemJson(1),
                { ...createBibleItemJson(2), invalid: true },
                createBibleItemJson(3),
            ]),
        );

        expect(bible.itemsLength).toBe(3);
        expect(bible.items[0]?.bible).toBe(bible);
        expect(bible.items[1]?.id).toBe(-1);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Instantiating Bible Item',
            'Invalid bible item',
        );
        expect(bible.getItemById(3)?.id).toBe(3);
        expect(bible.getItemById(999)).toBeNull();

        const replacement = mocks.MockBibleItem.fromJson(
            createBibleItemJson(3, 'WEB'),
        );
        bible.setItemById(3, replacement as any);
        expect(bible.getItemById(3)?.bibleKey).toBe('WEB');
        expect(bible.maxItemId).toBe(3);

        bible.duplicate(0);
        expect(bible.toJson().items.map((item) => item.id)).toEqual([
            1, 4, 2, 3,
        ]);

        const removed = bible.deleteItemAtIndex(1);
        expect(removed?.id).toBe(4);
        bible.deleteItem(
            mocks.MockBibleItem.fromJson(createBibleItemJson(123)) as any,
        );
        expect(bible.toJson().items.map((item) => item.id)).toEqual([1, 2, 3]);

        bible.addBibleItem(
            mocks.MockBibleItem.fromJson(createBibleItemJson(50, 'ESV')) as any,
        );
        expect(bible.toJson().items.at(-1)?.id).toBe(4);
        expect(mocks.notifyNewElementAddedMock).toHaveBeenCalledTimes(1);
        expect(document.querySelector as any).toHaveBeenCalledWith(
            '[data-bible-item-id="main-4"]',
        );

        bible.swapItems(0, 2);
        expect(bible.toJson().items.map((item) => item.id)).toEqual([
            3, 2, 1, 4,
        ]);
        bible.swapItems(-1, 1);
        bible.swapItems(0, 99);
        expect(bible.toJson().items.map((item) => item.id)).toEqual([
            3, 2, 1, 4,
        ]);

        bible.moveItemToIndex(
            mocks.MockBibleItem.fromJson(createBibleItemJson(4, 'ESV')) as any,
            1,
        );
        expect(bible.toJson().items.map((item) => item.id)).toEqual([
            3, 4, 2, 1,
        ]);
        bible.moveItemToIndex(
            mocks.MockBibleItem.fromJson(createBibleItemJson(404)) as any,
            1,
        );
        bible.moveItemToIndex(
            mocks.MockBibleItem.fromJson(createBibleItemJson(4, 'ESV')) as any,
            1,
        );
        bible.moveItemToIndex(
            mocks.MockBibleItem.fromJson(createBibleItemJson(4, 'ESV')) as any,
            99,
        );
        expect(
            bible.getItemIndex(
                mocks.MockBibleItem.fromJson(createBibleItemJson(3)) as any,
            ),
        ).toBe(0);

        bible.empty();
        expect(bible.toJson().items).toEqual([]);
    });

    test('tracks default state, saves opened metadata, creates new bible files, and clones', async () => {
        mocks.appProviderMock.isPageReader = true;
        expect(Bible.getDirSourceSettingName()).toBe('bible-read-dir');
        mocks.appProviderMock.isPageReader = false;
        expect(Bible.getDirSourceSettingName()).toBe('bible-present-dir');

        mocks.files.set(
            '/bibles/Default.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(1)])),
        );
        const defaultBible = await Bible.fromFilePath('/bibles/Default.bible');

        expect(defaultBible).not.toBeNull();
        expect(Bible.checkIsDefault('/bibles/Default.bible')).toBe(true);
        expect(defaultBible?.isDefault).toBe(true);
        expect(defaultBible?.isOpened).toBe(false);

        await defaultBible?.setIsOpened(true);
        expect(defaultBible?.isOpened).toBe(true);
        expect(mocks.files.get('/bibles/Default.bible')).toContain(
            '"isOpened":true',
        );

        const createdFileSource = await Bible.create('/bibles', 'Created');
        expect(createdFileSource?.filePath).toBe('/bibles/Created.bible');
        mocks.createNewFileDetailMock.mockResolvedValueOnce(null);
        expect(await Bible.create('/bibles', 'Missing')).toBeNull();

        const cloned = defaultBible?.clone();
        expect(cloned?.toJson()).toEqual(defaultBible?.toJson());

        expect(await defaultBible?.save()).toBe(true);
    });

    test('finds or creates the default bible and can add items into it', async () => {
        mocks.files.set(
            '/bibles/Other.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(9)])),
        );
        mocks.files.set(
            '/bibles/Default.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(1)])),
        );
        mocks.fsListFilesWithMimetypeMock.mockResolvedValueOnce([
            '/bibles/Other.bible',
            '/bibles/Default.bible',
        ]);

        const foundDefault = await Bible.getDefault();
        expect(foundDefault?.filePath).toBe('/bibles/Default.bible');

        mocks.fsListFilesWithMimetypeMock.mockResolvedValueOnce([]);
        const createdDefault = await Bible.getDefault();
        expect(createdDefault?.filePath).toBe('/bibles/Default.bible');
        expect(createdDefault?.isOpened).toBe(true);

        const addedItem = mocks.MockBibleItem.fromJson(
            createBibleItemJson(50, 'WEB'),
        );
        expect(await Bible.addBibleItemToDefault(addedItem as any)).toBe(
            addedItem,
        );
        expect(mocks.files.get('/bibles/Default.bible')).toContain(
            '"bibleKey":"WEB"',
        );

        mocks.getSettingMock.mockReturnValueOnce('');
        expect(await Bible.getDefault()).toBeNull();

        mocks.getSettingMock.mockReturnValue('/bibles');
        mocks.fsListFilesWithMimetypeMock.mockResolvedValueOnce([]);
        mocks.createNewFileDetailMock.mockResolvedValueOnce(null);
        expect(await Bible.getDefault()).toBeNull();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Getting Default Bible File',
            'Fail to get default bible file',
        );
    });

    test('moves bible items between files and handles missing or invalid sources', async () => {
        mocks.files.set(
            '/bibles/target.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(1)])),
        );
        mocks.files.set(
            '/bibles/source.bible',
            JSON.stringify(
                createBibleJson([
                    createBibleItemJson(2, 'WEB'),
                    createBibleItemJson(3, 'ESV'),
                ]),
            ),
        );

        const targetBible = await Bible.fromFilePath('/bibles/target.bible');
        expect(targetBible).not.toBeNull();

        await targetBible?.moveItemFrom('/bibles/target.bible');
        expect(targetBible?.toJson().items.map((item) => item.id)).toEqual([1]);

        await targetBible?.moveItemFrom('/bibles/source.bible');
        expect(
            targetBible?.toJson().items.map((item) => item.bibleKey),
        ).toEqual(['KJV', 'WEB', 'ESV']);

        mocks.files.set(
            '/bibles/source-single.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(10, 'AMP')])),
        );
        await targetBible?.moveItemFrom(
            '/bibles/source-single.bible',
            mocks.MockBibleItem.fromJson(createBibleItemJson(999)) as any,
        );
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Moving Bible Item',
            'Cannot find Bible Item',
        );

        await targetBible?.moveItemFrom('/bibles/missing.bible');
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Moving Bible Item',
            'Cannot source Bible',
        );

        mocks.readFileDataMock.mockResolvedValueOnce('{bad-json');
        expect(await Bible.fromFilePath('/bibles/bad.bible')).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalled();
    });
});
