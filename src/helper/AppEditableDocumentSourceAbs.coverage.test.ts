import { describe, expect, test, vi } from 'vitest';

// A history entry that is no longer a valid document reads as no document,
// and what was wrong with it is logged.
const h = vi.hoisted(() => ({
    currentHistory: null as string | null,
    handleError: vi.fn(),
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        getInstance: () => ({
            getCurrentHistory: async () => h.currentHistory,
            getOriginalData: async () => null,
        }),
    },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: async () => {} },
}));
vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: async () => null,
    getMimetypeExtensions: () => ['owa'],
}));
vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./FileSource', () => ({
    default: { getInstance: () => ({ extension: 'owa' }) },
}));

import AppEditableDocumentSourceAbs, {
    type AppDocumentMetadataType,
} from './AppEditableDocumentSourceAbs';

class TestDocument extends AppEditableDocumentSourceAbs<{
    metadata: AppDocumentMetadataType;
}> {
    protected static mimetypeName = 'appDocument' as const;

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => new TestDocument(filePath));
    }
}

describe('getJsonData', () => {
    test('a history entry that is not a valid document reads as none', async () => {
        const documentSource = TestDocument.getInstance('/docs/broken.owa');

        // No `fileVersion`: the metadata check refuses it.
        h.currentHistory = '{"metadata":{"app":"OpenWorship"}}';
        expect(await documentSource.getJsonData()).toBeNull();
        h.currentHistory = '{"metadata":';
        expect(await documentSource.getJsonData()).toBeNull();

        expect(h.handleError).toHaveBeenCalledTimes(2);
        expect(h.handleError.mock.calls[0][0]).toEqual(
            new Error('Invalid data'),
        );
        expect(h.handleError.mock.calls[1][0]).toBeInstanceOf(SyntaxError);
    });
});
