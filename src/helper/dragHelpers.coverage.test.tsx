// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Every kind's own deserializer is stubbed to say who was asked, so this file
// can hold `deserializeDragData` to its routing -- the half of it that
// `dragHelpers.test.ts` (which runs the real classes) cannot reach cheaply.
const h = vi.hoisted(() => {
    const tagged = (kind: string) =>
        vi.fn((data: unknown): object | null => ({
            deserializedBy: kind,
            data,
        }));
    return {
        slide: tagged('Slide'),
        lyricSlide: tagged('LyricSlide'),
        bibleItem: tagged('BibleItem'),
        noteItem: tagged('NoteItem'),
        foreground: tagged('foreground'),
        fileSource: tagged('FileSource'),
        web: tagged('web'),
        camera: tagged('camera'),
        color: tagged('color'),
        documentSlideValid: true,
        getAttachedBackground: vi.fn(),
        detachBackground: vi.fn(),
        useFileSourceEvents: vi.fn(),
        genContextMenuItemIcon: vi.fn(),
    };
});

function genDocumentSlideClass(kind: string) {
    return class {
        static readonly tryValidate = vi.fn(() => h.documentSlideValid);
        readonly kind = kind;
        constructor(
            readonly filePath: string,
            readonly data: unknown,
        ) {}
    };
}

vi.mock('../app-document-list/Slide', () => ({
    default: { dragDeserialize: h.slide },
}));
vi.mock('../lyric-list/LyricSlide', () => ({
    default: { dragDeserialize: h.lyricSlide },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { dragDeserialize: h.bibleItem },
}));
vi.mock('../bible-list/note/NoteItem', () => ({
    default: { dragDeserialize: h.noteItem },
}));
vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({
    foregroundDragDeserialize: h.foreground,
}));
vi.mock('./FileSource', () => ({
    default: { dragDeserialize: h.fileSource },
}));
vi.mock('../background/backgroundWebUrlHelpers', () => ({
    deserializeBackgroundWebDragItem: h.web,
}));
vi.mock('../background/backgroundHelpers', () => ({
    cameraDragDeserialize: h.camera,
}));
vi.mock('../others/color/colorHelpers', () => ({
    colorDeserialize: h.color,
}));
vi.mock('../app-document-list/PdfSlide', () => ({
    default: genDocumentSlideClass('pdf'),
}));
vi.mock('../app-document-list/PptxSlide', () => ({
    default: genDocumentSlideClass('pptx'),
}));
vi.mock('../app-document-list/DocxSlide', () => ({
    default: genDocumentSlideClass('docx'),
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    default: {
        genMetaDataFilePath: (filePath: string) => `${filePath}.meta`,
    },
    attachBackgroundManager: {
        getAttachedBackground: h.getAttachedBackground,
        detachBackground: h.detachBackground,
        attachDroppedBackground: vi.fn(),
    },
}));
vi.mock('./appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effect: (methods: Record<string, unknown>) => Promise<void>,
            deps: unknown[],
            methods: Record<string, unknown>,
        ) => {
            useEffect(() => {
                void effect({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('./dirSourceHelpers', () => ({
    useFileSourceEvents: h.useFileSourceEvents,
}));
vi.mock('./helpers', () => ({
    changeDragEventStyle: vi.fn(),
    stopDraggingState: vi.fn(),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: h.genContextMenuItemIcon,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import {
    addDragPayload,
    deserializeDragData,
    genRemovingAttachedBackgroundMenu,
    useAttachedBackgroundData,
} from './dragHelpers';
import { DragTypeEnum } from './DragInf';

beforeEach(() => {
    h.documentSlideValid = true;
});

describe('addDragPayload', () => {
    test('an item that names no kind adds nothing', () => {
        const setData = vi.fn();
        addDragPayload(
            { dataTransfer: { setData } },
            { dragSerialize: () => ({ type: '' as DragTypeEnum, data: 'x' }) },
        );
        expect(setData).not.toHaveBeenCalled();
    });
});

describe('deserializeDragData routes each kind to its own reader', () => {
    const routes: [DragTypeEnum, string, ReturnType<typeof vi.fn>][] = [
        [DragTypeEnum.SLIDE, 'Slide', h.slide],
        [DragTypeEnum.LYRIC_SLIDE, 'LyricSlide', h.lyricSlide],
        [DragTypeEnum.BIBLE_ITEM, 'BibleItem', h.bibleItem],
        [DragTypeEnum.NOTE_ITEM, 'NoteItem', h.noteItem],
        [DragTypeEnum.FOREGROUND, 'foreground', h.foreground],
        [DragTypeEnum.BACKGROUND_VIDEO, 'FileSource', h.fileSource],
        [DragTypeEnum.BACKGROUND_IMAGE, 'FileSource', h.fileSource],
        [DragTypeEnum.BACKGROUND_AUDIO, 'FileSource', h.fileSource],
        [DragTypeEnum.BACKGROUND_WEB, 'web', h.web],
        [DragTypeEnum.BACKGROUND_CAMERA, 'camera', h.camera],
        [DragTypeEnum.BACKGROUND_COLOR, 'color', h.color],
    ];
    test.each(routes)('%s is read by %s', (type, reader, deserialize) => {
        const data = { from: type };
        expect(deserializeDragData({ type, data })).toEqual({
            type,
            item: { deserializedBy: reader, data },
        });
        expect(deserialize).toHaveBeenCalledWith(data);
    });

    test('a reader that refuses its data makes the drop nothing', () => {
        h.bibleItem.mockReturnValueOnce(null);
        expect(
            deserializeDragData({ type: DragTypeEnum.BIBLE_ITEM, data: {} }),
        ).toBeNull();
    });

    test('a document travels by a path that must be a non-empty string', () => {
        expect(
            deserializeDragData({
                type: DragTypeEnum.APP_DOCUMENT,
                data: '/docs/sermon.ows',
            }),
        ).toEqual({
            type: DragTypeEnum.APP_DOCUMENT,
            item: { filePath: '/docs/sermon.ows' },
        });
        for (const data of ['', 42, null]) {
            expect(
                deserializeDragData({ type: DragTypeEnum.APP_DOCUMENT, data }),
            ).toBeNull();
        }
    });

    const documentSlides: [DragTypeEnum, string][] = [
        [DragTypeEnum.PDF_SLIDE, 'pdf'],
        [DragTypeEnum.PPTX_SLIDE, 'pptx'],
        [DragTypeEnum.DOCX_SLIDE, 'docx'],
    ];
    test.each(documentSlides)(
        'a %s page is rebuilt from its file and page data',
        (type, kind) => {
            const data = JSON.stringify({
                filePath: '/docs/deck',
                data: { index: 3 },
            });
            const dropped = deserializeDragData({ type, data });
            expect(dropped?.type).toBe(type);
            expect(dropped?.item).toMatchObject({
                kind,
                filePath: '/docs/deck',
                data: { index: 3 },
            });
        },
    );

    test.each(documentSlides)(
        'a %s page that does not validate is no drop',
        (type) => {
            h.documentSlideValid = false;
            const data = JSON.stringify({ filePath: '/docs/deck', data: {} });
            expect(deserializeDragData({ type, data })).toBeNull();
            expect(h.fileSource).not.toHaveBeenCalled();
        },
    );
});

describe('useAttachedBackgroundData', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    test('reads the attached background, and again when its file updates', async () => {
        const seen: unknown[] = [];
        function ProbeComp() {
            seen.push(useAttachedBackgroundData('/docs/a.ows', 2));
            return null;
        }
        const first = { type: DragTypeEnum.BACKGROUND_COLOR, item: '#000' };
        h.getAttachedBackground.mockResolvedValueOnce(first);
        await act(async () => root.render(<ProbeComp />));
        expect(h.getAttachedBackground).toHaveBeenCalledWith('/docs/a.ows', 2);
        expect(seen[0]).toBeUndefined();
        expect(seen.at(-1)).toBe(first);

        const [eventNames, onUpdate, , watchedPath] =
            h.useFileSourceEvents.mock.calls.at(-1)!;
        expect(eventNames).toEqual(['update']);
        expect(watchedPath).toBe('/docs/a.ows.meta');

        const second = { type: DragTypeEnum.BACKGROUND_COLOR, item: '#fff' };
        h.getAttachedBackground.mockResolvedValueOnce(second);
        await act(async () => {
            onUpdate();
        });
        expect(h.getAttachedBackground).toHaveBeenCalledTimes(2);
        expect(seen.at(-1)).toBe(second);
    });

    test('a different item reads its own background', async () => {
        const seen: unknown[] = [];
        function ProbeComp({ id }: Readonly<{ id: number }>) {
            seen.push(useAttachedBackgroundData('/docs/b.ows', id));
            return null;
        }
        h.getAttachedBackground.mockResolvedValueOnce('first');
        await act(async () => root.render(<ProbeComp id={1} />));
        expect(seen.at(-1)).toBe('first');

        h.getAttachedBackground.mockResolvedValueOnce(null);
        await act(async () => root.render(<ProbeComp id={2} />));
        expect(h.getAttachedBackground).toHaveBeenLastCalledWith(
            '/docs/b.ows',
            2,
        );
        expect(seen.at(-1)).toBeNull();
    });
});

describe('genRemovingAttachedBackgroundMenu', () => {
    test('offers one item that detaches the item’s background', () => {
        h.genContextMenuItemIcon.mockReturnValue('icon');
        const menu = genRemovingAttachedBackgroundMenu('/docs/a.ows', 5);
        expect(menu).toHaveLength(1);
        expect(menu[0].menuElement).toBe('Remove background');
        expect(menu[0].childBefore).toBe('icon');
        expect(h.genContextMenuItemIcon).toHaveBeenCalledWith('x-circle', {
            color: 'var(--bs-danger)',
        });
        expect(h.detachBackground).not.toHaveBeenCalled();
        menu[0].onSelect?.({} as any);
        expect(h.detachBackground).toHaveBeenCalledWith('/docs/a.ows', 5);
    });
});
