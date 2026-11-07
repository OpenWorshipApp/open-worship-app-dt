// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, fileSourceEvents, constructed } = vi.hoisted(() => ({
    mocks: {
        slideDeserialize: vi.fn(),
        lyricSlideDeserialize: vi.fn(),
        bibleItemDeserialize: vi.fn(),
        noteItemDeserialize: vi.fn(),
        foregroundDeserialize: vi.fn(),
        fileSourceDeserialize: vi.fn(),
        webDeserialize: vi.fn(),
        cameraDeserialize: vi.fn(),
        colorDeserialize: vi.fn(),
        pdfValidate: vi.fn(),
        pptxValidate: vi.fn(),
        docxValidate: vi.fn(),
        getAttachedBackground: vi.fn(),
        detachBackground: vi.fn(),
        genContextMenuItemIcon: vi.fn(),
    },
    fileSourceEvents: [] as Array<{
        events: string[];
        callback: () => void;
        filePath?: string;
    }>,
    constructed: [] as Array<{ kind: string; args: unknown[] }>,
}));

function genSlideClass(kind: string, validate: () => any) {
    return class {
        static tryValidate(...args: unknown[]) {
            return (validate as any)(...args);
        }
        constructor(...args: unknown[]) {
            constructed.push({ kind, args });
        }
    };
}

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: () => {} },
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { dragDeserialize: mocks.bibleItemDeserialize },
}));
vi.mock('../bible-list/note/NoteItem', () => ({
    default: { dragDeserialize: mocks.noteItemDeserialize },
}));
vi.mock('../others/color/colorHelpers', () => ({
    colorDeserialize: mocks.colorDeserialize,
}));
vi.mock('./FileSource', () => ({
    default: { dragDeserialize: mocks.fileSourceDeserialize },
}));
vi.mock('../app-document-list/PdfSlide', () => ({
    default: genSlideClass('pdf', mocks.pdfValidate),
}));
vi.mock('../app-document-list/PptxSlide', () => ({
    default: genSlideClass('pptx', mocks.pptxValidate),
}));
vi.mock('../app-document-list/DocxSlide', () => ({
    default: genSlideClass('docx', mocks.docxValidate),
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    default: {
        genMetaDataFilePath: (filePath: string) => `${filePath}.meta`,
    },
    attachBackgroundManager: {
        getAttachedBackground: mocks.getAttachedBackground,
        detachBackground: mocks.detachBackground,
        attachDroppedBackground: () => {},
    },
}));
vi.mock('./dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => void,
        _deps: unknown[],
        filePath?: string,
    ) => {
        fileSourceEvents.push({ events, callback, filePath });
    },
}));
vi.mock('./helpers', () => ({
    changeDragEventStyle: () => {},
    stopDraggingState: () => {},
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: mocks.genContextMenuItemIcon,
}));
vi.mock('../app-document-list/Slide', () => ({
    default: { dragDeserialize: mocks.slideDeserialize },
}));
vi.mock('../background/backgroundHelpers', () => ({
    cameraDragDeserialize: mocks.cameraDeserialize,
}));
vi.mock('../background/backgroundWebUrlHelpers', () => ({
    deserializeBackgroundWebDragItem: mocks.webDeserialize,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../lyric-list/LyricSlide', () => ({
    default: { dragDeserialize: mocks.lyricSlideDeserialize },
}));
vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({
    foregroundDragDeserialize: mocks.foregroundDeserialize,
}));

import { DragTypeEnum, genDragMimeType } from './DragInf';
import {
    addDragPayload,
    deserializeDragData,
    genRemovingAttachedBackgroundMenu,
    useAttachedBackgroundData,
} from './dragHelpers';

beforeEach(() => {
    constructed.length = 0;
    fileSourceEvents.length = 0;
});

describe('deserializeDragData routes each kind to its own reader', () => {
    test.each([
        [DragTypeEnum.SLIDE, 'slideDeserialize'],
        [DragTypeEnum.LYRIC_SLIDE, 'lyricSlideDeserialize'],
        [DragTypeEnum.BIBLE_ITEM, 'bibleItemDeserialize'],
        [DragTypeEnum.NOTE_ITEM, 'noteItemDeserialize'],
        [DragTypeEnum.FOREGROUND, 'foregroundDeserialize'],
        [DragTypeEnum.BACKGROUND_VIDEO, 'fileSourceDeserialize'],
        [DragTypeEnum.BACKGROUND_IMAGE, 'fileSourceDeserialize'],
        [DragTypeEnum.BACKGROUND_AUDIO, 'fileSourceDeserialize'],
        [DragTypeEnum.BACKGROUND_WEB, 'webDeserialize'],
        [DragTypeEnum.BACKGROUND_CAMERA, 'cameraDeserialize'],
        [DragTypeEnum.BACKGROUND_COLOR, 'colorDeserialize'],
    ] as const)('%s', (type, mockName) => {
        const item = { from: mockName };
        mocks[mockName].mockReturnValue(item);
        const data = { payload: type };
        expect(deserializeDragData({ type, data })).toEqual({ type, item });
        expect(mocks[mockName]).toHaveBeenCalledWith(data);
        // No other reader was asked.
        for (const [name, mock] of Object.entries(mocks)) {
            if (name !== mockName && name.endsWith('Deserialize')) {
                expect(mock).not.toHaveBeenCalled();
            }
        }
    });

    test('a reader that answers null drops the drag', () => {
        mocks.slideDeserialize.mockReturnValue(null);
        mocks.webDeserialize.mockReturnValue(null);
        expect(
            deserializeDragData({ type: DragTypeEnum.SLIDE, data: 'x' }),
        ).toBeNull();
        expect(
            deserializeDragData({
                type: DragTypeEnum.BACKGROUND_WEB,
                data: 'x',
            }),
        ).toBeNull();
    });

    test('an app document needs a non-empty path', () => {
        expect(
            deserializeDragData({ type: DragTypeEnum.APP_DOCUMENT, data: '' }),
        ).toBeNull();
        expect(
            deserializeDragData({ type: DragTypeEnum.APP_DOCUMENT, data: 7 }),
        ).toBeNull();
    });

    test.each([
        [DragTypeEnum.PDF_SLIDE, 'pdf', 'pdfValidate'],
        [DragTypeEnum.PPTX_SLIDE, 'pptx', 'pptxValidate'],
        [DragTypeEnum.DOCX_SLIDE, 'docx', 'docxValidate'],
    ] as const)(
        'a valid %s is rebuilt from its file path and page data',
        (type, kind, validateName) => {
            mocks[validateName].mockReturnValue(true);
            const pageData = { pageNumber: 3, width: 800 };
            const dropped = deserializeDragData({
                type,
                data: JSON.stringify({
                    filePath: '/docs/sermon.file',
                    data: pageData,
                }),
            });
            expect(mocks[validateName]).toHaveBeenCalledWith(pageData);
            expect(constructed).toEqual([
                { kind, args: ['/docs/sermon.file', pageData] },
            ]);
            expect(dropped?.type).toBe(type);
        },
    );

    test.each([
        [DragTypeEnum.PDF_SLIDE, 'pdfValidate'],
        [DragTypeEnum.PPTX_SLIDE, 'pptxValidate'],
        [DragTypeEnum.DOCX_SLIDE, 'docxValidate'],
    ] as const)('an invalid %s is dropped', (type, validateName) => {
        mocks[validateName].mockReturnValue(false);
        expect(
            deserializeDragData({
                type,
                data: JSON.stringify({ filePath: '/a', data: {} }),
            }),
        ).toBeNull();
        expect(constructed).toEqual([]);
        // ...and not mistaken for a background on the way out.
        expect(mocks.fileSourceDeserialize).not.toHaveBeenCalled();
    });
});

describe('addDragPayload', () => {
    test('an item that names no kind adds nothing', () => {
        const setData = vi.fn();
        addDragPayload(
            { dataTransfer: { setData } },
            { dragSerialize: () => ({ type: '' as DragTypeEnum, data: 1 }) },
        );
        expect(setData).not.toHaveBeenCalled();
    });

    test('the second payload is written under its own mime type', () => {
        const setData = vi.fn();
        const dragSerialize = vi.fn(() => ({
            type: DragTypeEnum.NOTE_ITEM,
            data: { id: 4 },
        }));
        addDragPayload(
            { dataTransfer: { setData } },
            { dragSerialize },
            DragTypeEnum.NOTE_ITEM,
        );
        expect(dragSerialize).toHaveBeenCalledWith(DragTypeEnum.NOTE_ITEM);
        expect(setData).toHaveBeenCalledWith(
            genDragMimeType(DragTypeEnum.NOTE_ITEM),
            JSON.stringify({ type: DragTypeEnum.NOTE_ITEM, data: { id: 4 } }),
        );
    });
});

describe('genRemovingAttachedBackgroundMenu', () => {
    test('one danger item that detaches this item background', () => {
        mocks.genContextMenuItemIcon.mockReturnValue('icon');
        const items = genRemovingAttachedBackgroundMenu('/docs/a.owd', 5);
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe('Remove background');
        expect(items[0].childBefore).toBe('icon');
        expect(mocks.genContextMenuItemIcon).toHaveBeenCalledWith('x-circle', {
            color: 'var(--bs-danger)',
        });
        expect(mocks.detachBackground).not.toHaveBeenCalled();
        items[0].onSelect!(undefined as any, undefined as any);
        expect(mocks.detachBackground).toHaveBeenCalledWith('/docs/a.owd', 5);
    });
});

describe('useAttachedBackgroundData', () => {
    let container: HTMLDivElement;
    let root: Root;
    const seen: unknown[] = [];

    function ProbeComp({
        filePath,
        id,
    }: Readonly<{ filePath: string; id?: number }>) {
        const data = useAttachedBackgroundData(filePath, id);
        seen.push(data);
        return (
            <span>{data === undefined ? 'loading' : JSON.stringify(data)}</span>
        );
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        seen.length = 0;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('loads the attached background, and reloads it when its meta file updates', async () => {
        mocks.getAttachedBackground.mockResolvedValueOnce({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#111111',
        });
        await act(async () => {
            root.render(<ProbeComp filePath="/docs/a.owd" id={2} />);
        });
        expect(mocks.getAttachedBackground).toHaveBeenCalledWith(
            '/docs/a.owd',
            2,
        );
        expect(container.textContent).toBe(
            JSON.stringify({ type: 'bg-color', item: '#111111' }),
        );
        expect(seen[0]).toBeUndefined();

        const subscription = fileSourceEvents.at(-1)!;
        expect(subscription.events).toEqual(['update']);
        expect(subscription.filePath).toBe('/docs/a.owd.meta');

        mocks.getAttachedBackground.mockResolvedValueOnce(null);
        await act(async () => {
            subscription.callback();
        });
        expect(mocks.getAttachedBackground).toHaveBeenLastCalledWith(
            '/docs/a.owd',
            2,
        );
        expect(container.textContent).toBe('null');
    });

    test('a new file path starts over from loading', async () => {
        let resolveSecond: (value: unknown) => void = () => {};
        mocks.getAttachedBackground
            .mockResolvedValueOnce({ type: 'bg-color', item: '#1' })
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveSecond = resolve;
                }),
            );
        await act(async () => {
            root.render(<ProbeComp filePath="/docs/a.owd" />);
        });
        expect(container.textContent).toContain('#1');

        await act(async () => {
            root.render(<ProbeComp filePath="/docs/b.owd" />);
        });
        expect(mocks.getAttachedBackground).toHaveBeenLastCalledWith(
            '/docs/b.owd',
            undefined,
        );
        expect(container.textContent).toBe('loading');
        expect(fileSourceEvents.at(-1)!.filePath).toBe('/docs/b.owd.meta');

        await act(async () => {
            resolveSecond({ type: 'bg-color', item: '#2' });
        });
        expect(container.textContent).toContain('#2');
    });
});
