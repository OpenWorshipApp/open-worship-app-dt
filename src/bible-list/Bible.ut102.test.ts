import { beforeEach, describe, expect, test, vi } from 'vitest';

// The Bibles list's remaining paths: a Default that will not save, one item
// moved from another list, and a move that fails part way.

const session = vi.hoisted(() => ({ suffix: '' }));
vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => {
        return `${settingName}${session.suffix}`;
    },
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

const mocks = vi.hoisted(() => {
    const files = new Map<string, string>();
    const fileSources = new Map<string, any>();
    const appProviderMock = {
        isPageReader: false,
        systemUtils: {
            isDev: true,
        },
        // langHelpers registers a menu listener at module load.
        messageUtils: {
            listenForData: vi.fn(),
            sendData: vi.fn(),
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
        notifyElementHighlightMock: vi.fn(),
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

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: mocks.getSettingMock,
        setItem: vi.fn(),
    },
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
    notifyElementHighlight: mocks.notifyElementHighlightMock,
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

describe('Bible residual paths', () => {
    beforeEach(() => {
        mocks.reset();
        mocks.getSettingMock.mockReturnValue('/bibles');
        mocks.fsListFilesWithMimetypeMock.mockResolvedValue([]);
        mocks.readFileDataMock.mockImplementation(async (filePath: string) => {
            return mocks.files.get(filePath.replaceAll('\\', '/')) ?? null;
        });
        mocks.notifyElementHighlightMock.mockImplementation(() => {});
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => null),
        });
    });

    test('adding to a Default list that fails to save answers null', async () => {
        mocks.files.set(
            '/bibles/Default.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(1)])),
        );
        mocks.fsListFilesWithMimetypeMock.mockResolvedValue([
            '/bibles/Default.bible',
        ]);
        const fileSource = mocks.getFileSource('/bibles/Default.bible');
        fileSource.writeFileData.mockResolvedValue(false);
        const item = mocks.MockBibleItem.fromJson(createBibleItemJson(7));
        expect(await Bible.addBibleItemToDefault(item as any)).toBeNull();
        expect(fileSource.writeFileData).toHaveBeenCalledOnce();
        // Nothing reached the disk.
        expect(mocks.files.get('/bibles/Default.bible')).not.toContain(
            '"id":2',
        );
    });

    test('adding with no Bibles folder set answers null and writes nothing', async () => {
        mocks.getSettingMock.mockReturnValue('');
        const item = mocks.MockBibleItem.fromJson(createBibleItemJson(7));
        expect(await Bible.addBibleItemToDefault(item as any)).toBeNull();
        expect(mocks.fsListFilesWithMimetypeMock).not.toHaveBeenCalled();
        expect(mocks.createNewFileDetailMock).not.toHaveBeenCalled();
    });

    test('a folder that cannot be listed still finds no Default and creates one', async () => {
        mocks.fsListFilesWithMimetypeMock.mockResolvedValue(null);
        mocks.createNewFileDetailMock.mockImplementation(
            async (_dir: string, name: string, data: string) => {
                const filePath = `/bibles/${name}.bible`;
                mocks.files.set(filePath, data);
                return filePath;
            },
        );
        const defaultBible = await Bible.getDefault();
        expect(defaultBible?.filePath).toBe('/bibles/Default.bible');
        expect(defaultBible?.isOpened).toBe(true);
        expect(mocks.createNewFileDetailMock).toHaveBeenCalledWith(
            '/bibles',
            'Default',
            expect.any(String),
            'bible',
        );
    });

    test('moving ONE item takes only it and leaves the rest in the source', async () => {
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
        await targetBible!.moveItemFrom(
            '/bibles/source.bible',
            mocks.MockBibleItem.fromJson(createBibleItemJson(3, 'ESV')) as any,
        );
        expect(
            targetBible!.toJson().items.map((item) => item.bibleKey),
        ).toEqual(['KJV', 'ESV']);
        // The new item takes the next id in its new list.
        expect(targetBible!.toJson().items.map((item) => item.id)).toEqual([
            1, 2,
        ]);
        const sourceJson = JSON.parse(mocks.files.get('/bibles/source.bible')!);
        expect(sourceJson.items.map((item: any) => item.bibleKey)).toEqual([
            'WEB',
        ]);
        expect(mocks.showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('a move that fails while saving tells the person why', async () => {
        mocks.files.set(
            '/bibles/target.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(1)])),
        );
        mocks.files.set(
            '/bibles/source.bible',
            JSON.stringify(createBibleJson([createBibleItemJson(2, 'WEB')])),
        );
        const targetBible = await Bible.fromFilePath('/bibles/target.bible');
        mocks
            .getFileSource('/bibles/target.bible')
            .writeFileData.mockRejectedValue(new Error('disk is full'));
        await expect(
            targetBible!.moveItemFrom('/bibles/source.bible'),
        ).resolves.toBeUndefined();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Moving Bible Item',
            'disk is full',
        );
        // The source keeps its item: the delete never ran.
        const sourceJson = JSON.parse(mocks.files.get('/bibles/source.bible')!);
        expect(sourceJson.items.map((item: any) => item.bibleKey)).toEqual([
            'WEB',
        ]);
    });
});
