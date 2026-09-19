import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    baseGetJsonDataMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    saveMock: vi.fn(),
    setJsonDataMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

// The base class reads the editing history and the file; what is under test
// is what `AppDocument` does when neither can be read.
vi.mock('../helper/AppEditableDocumentSourceAbs', () => {
    class AppEditableDocumentSourceAbs {
        filePath: string;
        constructor(filePath: string) {
            this.filePath = filePath;
        }
        async getJsonData(isOriginal = false) {
            return mocks.baseGetJsonDataMock(isOriginal);
        }
        async setJsonData(jsonData: unknown) {
            return mocks.setJsonDataMock(jsonData);
        }
        async save() {
            return mocks.saveMock();
        }
        static genNewJsonData(extraData: object = {}) {
            return {
                metadata: {
                    app: 'OpenWorship',
                    fileVersion: 1,
                    initDate: '2026-09-19T00:00:00.000Z',
                },
                ...extraData,
            };
        }
    }
    return { default: AppEditableDocumentSourceAbs };
});

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: mocks.fsCheckFileExistMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./Slide', () => ({
    default: {
        defaultSlideData: (id: number) => ({ id, canvasItems: [] as any[] }),
        fromJson: (json: { id: number }) => ({
            id: json.id,
            getBibleKeys: () => [],
            toJson: () => json,
        }),
        fromJsonError: (json: { id: number }) => ({ id: json.id }),
    },
}));

vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        genDefaultItem: () => ({ toJson: () => ({ type: 'text' }) }),
    },
}));

vi.mock('./appDocumentHelpers', () => ({
    genSelectedSlidesContextMenuItems: vi.fn(),
    genSlideContextMenuItems: vi.fn(),
    getSelectedVaryAppDocument: vi.fn(),
}));

vi.mock('../helper/helpers', () => ({
    checkIsSameValues: vi.fn(() => true),
    toMaxId: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));

vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(),
}));

vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: vi.fn(),
    readImagesFromClipboard: vi.fn(),
}));

vi.mock('../app-document-presenter/items/appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'app-document-item',
    createNewSlidesFromDroppedData: vi.fn(),
}));

vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: vi.fn(),
    openPopupWindow: vi.fn(),
    setParamFileFullName: vi.fn(),
    setParamIdNum: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: vi.fn(),
}));

vi.mock('./appDocumentTypeHelpers', () => ({}));

vi.mock('../server/appProvider', () => ({ default: {} }));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: vi.fn(),
}));

import AppDocument from './AppDocument';

describe('AppDocument.getJsonData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Neither the editing history nor the file gives a document.
        mocks.baseGetJsonDataMock.mockResolvedValue(null);
    });

    test('a document that is not on disk is missing, not corrupted', async () => {
        mocks.fsCheckFileExistMock.mockResolvedValue(false);
        const appDocument = new AppDocument('/docs/a.ows');

        const jsonData = await appDocument.getJsonData();

        expect(jsonData.items).toEqual([]);
        expect(mocks.fsCheckFileExistMock).toHaveBeenCalledWith('/docs/a.ows');
        // A run sheet naming a deleted document read it on every load: each
        // read toasted "Corrupted Document" and tried to write a new one into
        // a file that is not there.
        expect(mocks.showSimpleToastMock).not.toHaveBeenCalled();
        expect(mocks.setJsonDataMock).not.toHaveBeenCalled();
        expect(mocks.saveMock).not.toHaveBeenCalled();
    });

    test('a missing document has no slide to present', async () => {
        mocks.fsCheckFileExistMock.mockResolvedValue(false);
        const appDocument = new AppDocument('/docs/a.ows');

        // Was the reset's made-up default slide, listed under the run sheet's
        // row and presentable on a live screen.
        expect(await appDocument.getSlides()).toEqual([]);
    });

    test('a document on disk that cannot be read is still reset', async () => {
        mocks.fsCheckFileExistMock.mockResolvedValue(true);
        const appDocument = new AppDocument('/docs/broken.ows');

        const jsonData = await appDocument.getJsonData();

        expect(jsonData.items).toHaveLength(1);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Corrupted Document',
            expect.any(String),
        );
        expect(mocks.setJsonDataMock).toHaveBeenCalledWith(jsonData);
        expect(mocks.saveMock).toHaveBeenCalledTimes(1);
    });
});
