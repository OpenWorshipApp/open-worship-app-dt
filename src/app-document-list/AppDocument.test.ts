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
        static toJsonString(jsonData: object) {
            return JSON.stringify(jsonData, null, 2);
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
        defaultSlideData: (id: number) => ({
            id,
            metadata: { width: 1920, height: 1080 },
            canvasItems: [] as any[],
        }),
        fromJson: (json: { id: number }) => ({
            id: json.id,
            getBibleKeys: () => [],
            toJson: () => ({ ...json, type: 'slide' }),
        }),
        toComparableJson: (json: object) => ({ ...json, type: 'slide' }),
        fromJsonError: (json: { id: number }) => ({ id: json.id }),
    },
}));

vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        // The real default box: 700x400 at a fixed spot that centres on no
        // slide size anyone projects at.
        genDefaultItem: () => {
            const props = {
                type: 'text',
                left: 356,
                top: 279,
                width: 700,
                height: 400,
            };
            return {
                props,
                applyProps: (newProps: object) => {
                    Object.assign(props, newProps);
                },
                toJson: () => ({ ...props }),
            };
        },
    },
}));

vi.mock('./appDocumentHelpers', () => ({
    genSelectedSlidesContextMenuItems: vi.fn(),
    genSlideContextMenuItems: vi.fn(),
    getSelectedVaryAppDocument: vi.fn(),
}));

vi.mock('../helper/helpers', () => ({
    checkIsSameValues: (a: unknown, b: unknown) =>
        JSON.stringify(a) === JSON.stringify(b),
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

describe('AppDocument.changeSlidesFont', () => {
    const text = (id: number, extra: object = {}) => ({
        id,
        type: 'text',
        text: 'Keep these words',
        fontSize: 45,
        fontFamily: 'Arial',
        fontWeight: '700',
        left: 20,
        top: 30,
        color: '#ffffff',
        ...extra,
    });
    const fixture = () => {
        const data = {
            metadata: { note: 'Keep the document note' },
            items: [
                {
                    id: 10,
                    name: 'First',
                    metadata: { width: 1920, height: 1080 },
                    canvasItems: [
                        text(1),
                        text(2, {
                            type: 'bible',
                            bibleRenderingList: [
                                { title: 'A verse', text: 'Verse words' },
                            ],
                        }),
                        text(3, { locked: true }),
                        { id: 4, type: 'image', src: 'image.png' },
                    ],
                },
                {
                    id: 20,
                    isDisabled: true,
                    canvasItems: [
                        text(1, { type: 'html', html: '<p>Hello</p>' }),
                        text(2),
                    ],
                },
            ],
        };
        for (const slide of data.items) {
            for (const item of slide.canvasItems) {
                Object.assign(item, {
                    uuid: `10000000-0000-4000-8000-${slide.id.toString(16).padStart(6, '0')}${item.id.toString(16).padStart(6, '0')}`,
                });
            }
        }
        return data;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.baseGetJsonDataMock.mockResolvedValue(fixture());
    });

    test('updates all text-bearing items, including disabled slides, in one unsaved history entry', async () => {
        const expected = fixture();
        for (const slide of expected.items) {
            for (const item of slide.canvasItems) {
                if (item.id !== 3 && item.type !== 'image') {
                    Object.assign(item, { fontSize: 72 });
                }
            }
        }
        const doc = new AppDocument('/docs/a.ows');
        expect(await doc.changeSlidesFont({ fontSize: 72 })).toBe(4);
        expect(mocks.baseGetJsonDataMock).toHaveBeenCalledExactlyOnceWith(
            false,
        );
        expect(mocks.setJsonDataMock).toHaveBeenCalledExactlyOnceWith(expected);
        expect(mocks.saveMock).not.toHaveBeenCalled();
    });

    test('scopes an item id to its own slide and keeps all other content and styles', async () => {
        const expected = fixture();
        Object.assign(expected.items[1].canvasItems[0], {
            fontFamily: 'Verdana',
        });
        const doc = new AppDocument('/docs/a.ows');
        expect(
            await doc.changeSlidesFont(
                { fontFamily: 'Verdana' },
                {
                    targets: [{ slideId: 20, itemIds: [1] }],
                },
            ),
        ).toBe(1);
        expect(mocks.setJsonDataMock).toHaveBeenCalledExactlyOnceWith(expected);
    });

    test('accepts whole-slide targets and locked items only when explicitly included', async () => {
        const doc = new AppDocument('/docs/a.ows');
        expect(
            await doc.changeSlidesFont(
                { fontSize: 90 },
                {
                    targets: [{ slideId: 10 }],
                    includeLocked: true,
                },
            ),
        ).toBe(3);
        const data = mocks.setJsonDataMock.mock.calls[0][0];
        expect(data.items[0].canvasItems[2]).toMatchObject({
            fontSize: 90,
            locked: true,
        });
        expect(data.items[1]).toEqual(fixture().items[1]);
    });

    test.each([
        { targets: [] },
        { targets: [{ slideId: 10, itemIds: [] }] },
        { targets: [{ slideId: 999 }] },
        { targets: [{ slideId: 10, itemIds: [3, 4, 999] }] },
    ])(
        'empty, missing or ineligible targets do not fall back to all items: %j',
        async ({ targets }) => {
            expect(
                await new AppDocument('/docs/a.ows').changeSlidesFont(
                    { fontSize: 72 },
                    { targets },
                ),
            ).toBe(0);
            expect(mocks.setJsonDataMock).not.toHaveBeenCalled();
        },
    );

    test.each([0, -1, NaN, Infinity])(
        'refuses invalid size %s without reading or writing',
        async (fontSize) => {
            expect(
                await new AppDocument('/docs/a.ows').changeSlidesFont({
                    fontSize,
                }),
            ).toBe(0);
            expect(mocks.baseGetJsonDataMock).not.toHaveBeenCalled();
            expect(mocks.setJsonDataMock).not.toHaveBeenCalled();
        },
    );

    test('does not create history for unchanged values or a noneditable document', async () => {
        const doc = new AppDocument('/docs/a.ows');
        expect(await doc.changeSlidesFont({ fontSize: 45 })).toBe(0);
        expect(await doc.changeSlidesFont({ fontFamily: 'Arial' })).toBe(0);
        doc.isEditable = false;
        expect(await doc.changeSlidesFont({ fontSize: 72 })).toBe(0);
        expect(mocks.setJsonDataMock).not.toHaveBeenCalled();
    });

    test('clears an explicit family without altering the weight or size', async () => {
        const doc = new AppDocument('/docs/a.ows');
        expect(await doc.changeSlidesFont({ fontFamily: '' })).toBe(4);
        expect(
            mocks.setJsonDataMock.mock.calls[0][0].items[0].canvasItems[0],
        ).toMatchObject(text(1, { fontFamily: null }));
    });
});

describe('AppDocument.genNewExtraJsonData', () => {
    test("a new document's text box sits in the middle of its slide", () => {
        const jsonData = AppDocument.genNewExtraJsonData();

        // Was left 356 / top 279 whatever the slide: on a 1920x1080 projector
        // the box hung in the upper-left quadrant.
        expect(jsonData.items[0].canvasItems).toEqual([
            expect.objectContaining({
                left: 610,
                top: 340,
                width: 700,
                height: 400,
            }),
        ]);
    });
});

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

    test('legacy items are unique throughout the file without a read writing history, and edits persist them', async () => {
        const existing = crypto.randomUUID();
        const raw: any = {
            metadata: {},
            items: [
                { id: 1, canvasItems: [{ id: 1, uuid: existing }, { id: 2 }] },
                { id: 2, canvasItems: [{ id: 1, uuid: existing }, { id: 2 }] },
            ],
        };
        mocks.baseGetJsonDataMock.mockResolvedValue(raw);
        const doc = new AppDocument('/docs/legacy.ows');
        const current = await doc.getJsonData();
        const original = await doc.getJsonData(true);
        const ids = current.items.flatMap((slide) =>
            slide.canvasItems.map((item) => item.uuid),
        );
        expect(new Set(ids).size).toBe(4);
        expect(ids[0]).toBe(existing);
        expect(current).toEqual(original);
        expect(raw.items[0].canvasItems[1]).not.toHaveProperty('uuid');
        expect(raw.items[1].canvasItems[0].uuid).toBe(existing);
        expect(mocks.setJsonDataMock).not.toHaveBeenCalled();
        expect(mocks.saveMock).not.toHaveBeenCalled();
        const slides = await doc.getSlides();
        expect(slides.every((slide) => !slide.isChanged)).toBe(true);

        const written = JSON.parse(AppDocument.toJsonString(raw));
        expect(written).toEqual(current);
        const reordered = { ...written, items: [...written.items].reverse() };
        expect(JSON.parse(AppDocument.toJsonString(reordered))).toEqual(
            reordered,
        );
    });

    test('duplicating and pasting slides renews item UUIDs without changing the source or its transitions', async () => {
        const uuid = crypto.randomUUID();
        const makeSlide = (json: any): any => ({
            id: json.id,
            filePath: '/docs/source.ows',
            canvasItemsJson: json.canvasItems,
            clone: () => makeSlide(structuredClone(json)),
            toJson() {
                return {
                    ...json,
                    id: this.id,
                    canvasItems: this.canvasItemsJson,
                };
            },
        });
        const raw: any = {
            metadata: {},
            items: [
                {
                    id: 1,
                    canvasItems: [{ id: 1, uuid, transitionEffect: 'zoom' }],
                },
            ],
        };
        const source = makeSlide(raw.items[0]);
        mocks.baseGetJsonDataMock.mockResolvedValue(raw);
        const doc = new AppDocument('/docs/source.ows');
        vi.spyOn(doc, 'getSlides').mockImplementation(async () => [source]);
        vi.spyOn(doc, 'getSlideIndex').mockResolvedValue(0);
        vi.spyOn(doc, 'getMaxSlideId').mockResolvedValue(1);
        vi.spyOn(doc, 'notifyNewSlidesAdded').mockImplementation(() => {});
        await doc.duplicateSlides([source]);
        const duplicated = mocks.setJsonDataMock.mock.lastCall![0].items;
        expect(duplicated[0].canvasItems[0].uuid).toBe(uuid);
        expect(duplicated[1].canvasItems[0].uuid).not.toBe(uuid);
        expect(duplicated[1].canvasItems[0].transitionEffect).toBe('zoom');

        await doc.addSlides([makeSlide(structuredClone(raw.items[0]))]);
        const pasted = mocks.setJsonDataMock.mock.lastCall![0].items;
        expect(pasted[1].canvasItems[0].uuid).not.toBe(uuid);
        expect(pasted[1].canvasItems[0].uuid).not.toBe(
            duplicated[1].canvasItems[0].uuid,
        );
        expect(source.canvasItemsJson[0].uuid).toBe(uuid);
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
