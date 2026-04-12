import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    deleteMetaDataFileMock,
    createNewFileDetailMock,
    getMimetypeExtensionsMock,
    handleErrorMock,
    fileSourceGetInstanceMock,
    editingHistoryGetInstanceMock,
} = vi.hoisted(() => ({
    deleteMetaDataFileMock: vi.fn(),
    createNewFileDetailMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    handleErrorMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    editingHistoryGetInstanceMock: vi.fn(),
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        getInstance: editingHistoryGetInstanceMock,
    },
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        deleteMetaDataFile: deleteMetaDataFileMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: createNewFileDetailMock,
    getMimetypeExtensions: getMimetypeExtensionsMock,
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

import AppEditableDocumentSourceAbs, {
    AppDocumentSourceAbs,
    type AppDocumentMetadataType,
} from './AppEditableDocumentSourceAbs';

type TestJsonType = {
    metadata: AppDocumentMetadataType;
    value?: string;
};

class TestDocument extends AppEditableDocumentSourceAbs<TestJsonType> {
    protected static mimetypeName = 'appDocument' as const;

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => new TestDocument(filePath));
    }
}

class OtherTestDocument extends AppEditableDocumentSourceAbs<TestJsonType> {
    protected static mimetypeName = 'appDocument' as const;

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => new OtherTestDocument(filePath));
    }
}

function createHistoryManager() {
    let currentHistory: string | null = null;
    let originalData: string | null = null;

    return {
        __setCurrentHistory(value: string | null) {
            currentHistory = value;
        },
        __setOriginalData(value: string | null) {
            originalData = value;
        },
        getOriginalData: vi.fn(async () => originalData),
        getCurrentHistory: vi.fn(async () => currentHistory),
        addHistory: vi.fn((value: string) => {
            currentHistory = value;
        }),
        save: vi.fn(async () => true),
        discard: vi.fn(),
        undo: vi.fn(() => 'undo-result'),
        redo: vi.fn(() => 'redo-result'),
    };
}

const historyManagers = new Map<string, ReturnType<typeof createHistoryManager>>();

function getHistoryManager(filePath: string) {
    if (!historyManagers.has(filePath)) {
        historyManagers.set(filePath, createHistoryManager());
    }
    return historyManagers.get(filePath)!;
}

function getMetadata(app = 'OpenWorship'): AppDocumentMetadataType {
    return {
        app,
        fileVersion: 1,
        initDate: '2026-01-01T00:00:00.000Z',
    };
}

describe('AppEditableDocumentSourceAbs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        historyManagers.clear();

        getMimetypeExtensionsMock.mockReturnValue(['owa']);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            const fileName = filePath.split('/').at(-1) ?? '';
            const dotIndex = fileName.lastIndexOf('.');
            return {
                filePath,
                fullName: fileName,
                extension: dotIndex >= 0 ? fileName.substring(dotIndex + 1) : '',
            };
        });
        editingHistoryGetInstanceMock.mockImplementation((filePath: string) => {
            return getHistoryManager(filePath);
        });
        createNewFileDetailMock.mockResolvedValue('/docs/new-file.owa');
    });

    test('validates metadata and enforces instance caching by class', () => {
        expect(() => {
            TestDocument.validate({ metadata: getMetadata() });
        }).not.toThrow();

        expect(() => {
            TestDocument.validate({ metadata: null });
        }).toThrow('Invalid data');
        expect(handleErrorMock).toHaveBeenCalledTimes(1);

        const instance = TestDocument.getInstance('/docs/shared.owa');

        expect(TestDocument.getInstance('/docs/shared.owa')).toBe(instance);
        expect(instance.fileSource).toEqual({
            filePath: '/docs/shared.owa',
            fullName: 'shared.owa',
            extension: 'owa',
        });

        expect(() => TestDocument.getInstance('/docs/wrong.txt')).toThrow(
            'File extension txt does not match expected extensions: owa',
        );
        expect(() => OtherTestDocument.getInstance('/docs/shared.owa')).toThrow(
            'Invalid Instance',
        );
        expect(() => AppDocumentSourceAbs.getInstance('/docs/any.owa')).toThrow(
            'getInstance must be implemented in derived class',
        );
    });

    test('parses data text from history and reports invalid payloads', async () => {
        const filePath = '/docs/current.owa';
        const history = getHistoryManager(filePath);
        const currentData = {
            metadata: getMetadata(),
            value: 'current',
        };
        const originalData = {
            metadata: getMetadata(),
            value: 'original',
        };
        history.__setCurrentHistory(JSON.stringify(currentData));
        history.__setOriginalData(JSON.stringify(originalData));

        const documentSource = TestDocument.getInstance(filePath);

        expect(TestDocument.fromDataText<TestJsonType>(JSON.stringify(currentData))).toEqual(
            currentData,
        );
        expect(TestDocument.fromDataText<TestJsonType>('{"metadata":null}')).toBeNull();
        expect(handleErrorMock).toHaveBeenCalledTimes(2);

        expect(await documentSource.getJsonData()).toEqual(currentData);
        expect(await documentSource.getJsonData(true)).toEqual(originalData);

        history.__setCurrentHistory(null);
        expect(await documentSource.getJsonData()).toBeNull();
    });

    test('updates metadata, note fields and persisted JSON history', async () => {
        const filePath = '/docs/editable.owa';
        const history = getHistoryManager(filePath);
        history.__setCurrentHistory(
            JSON.stringify({ metadata: getMetadata(), value: 'draft' }),
        );
        const documentSource = TestDocument.getInstance(filePath);

        await documentSource.setJsonData({
            metadata: getMetadata(),
            value: 'saved',
        });
        expect(history.addHistory).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    metadata: getMetadata(),
                    value: 'saved',
                },
                null,
                2,
            ),
        );
                expect(TestDocument.toJsonString({ ok: true })).toBe(
                        JSON.stringify({ ok: true }, null, 2),
                );

        await documentSource.setMetadata({
            ...getMetadata(),
            note: 'meta-note',
        });
        await documentSource.setNote('body-note');

        expect(await documentSource.getMetadata()).toEqual({
            ...getMetadata(),
            note: 'body-note',
        });
        expect(await documentSource.getNote()).toBe('body-note');

        history.__setCurrentHistory(null);
        await documentSource.setMetadata(getMetadata());
        await documentSource.setNote('ignored');
        expect(history.addHistory).toHaveBeenCalledTimes(3);
    });

    test('sanitizes data on save and exposes helper checks', async () => {
        const filePath = '/docs/save-target.owa';
        const history = getHistoryManager(filePath);
        history.save.mockImplementation(async (sanitizeData?: (data: string) => string | null) => {
            const jsonText = JSON.stringify({ metadata: getMetadata(), value: 'v1' });
            const result = sanitizeData?.(jsonText);
            expect(result).not.toBeNull();
            expect(JSON.parse(result!).metadata.lastEditDate).toEqual(
                expect.any(String),
            );
            return true;
        });

        const documentSource = TestDocument.getInstance(filePath);
        const sameTypeDocument = TestDocument.getInstance('/docs/another.owa');

        expect(TestDocument.checkIsThisType(documentSource)).toBe(true);
        expect(documentSource.checkIsSame(TestDocument.getInstance(filePath))).toBe(true);
        expect(documentSource.checkIsSame(sameTypeDocument)).toBe(false);
        expect((documentSource as any)._sanitizeDataText('bad-data')).toBeNull();
        expect(await documentSource.save()).toBe(true);
    });

    test('creates new documents and delegates pre-delete and history actions', async () => {
        const filePath = '/docs/history.owa';
        const history = getHistoryManager(filePath);
        history.save.mockReturnValue('history-save');
        history.undo.mockReturnValue('undo');
        history.redo.mockReturnValue('redo');
        history.discard.mockReturnValue('discard');

        const documentSource = TestDocument.getInstance(filePath);

        expect(TestDocument.genMetadata()).toMatchObject({
            app: 'OpenWorship',
            fileVersion: 1,
        });
        expect(TestDocument.genNewJsonData<TestJsonType>({ value: 'new' })).toEqual({
            metadata: expect.objectContaining({ app: 'OpenWorship' }),
            value: 'new',
        });
        expect(await TestDocument.create('/docs', 'new-file', { value: 'new' })).toEqual({
            filePath: '/docs/new-file.owa',
            fullName: 'new-file.owa',
            extension: 'owa',
        });

        createNewFileDetailMock.mockResolvedValueOnce(null);
        expect(await TestDocument.create('/docs', 'missing-file', {})).toBeNull();

        await documentSource.preDelete();
        expect(deleteMetaDataFileMock).toHaveBeenCalledWith(filePath);
        expect(history.discard).toHaveBeenCalledTimes(1);

        expect(documentSource.historyUndo()).toBe('undo');
        expect(documentSource.historyRedo()).toBe('redo');
        expect(documentSource.historyDiscard()).toBe('discard');
        expect(documentSource.historySave()).toBe('history-save');
    });
});
