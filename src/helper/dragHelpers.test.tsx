// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    slideDragDeserializeMock,
    bibleDragDeserializeMock,
    fileDragDeserializeMock,
    pdfTryValidateMock,
    pptxTryValidateMock,
    docxTryValidateMock,
    colorDeserializeMock,
    cameraDragDeserializeMock,
    attachDroppedBackgroundMock,
    getAttachedBackgroundMock,
    detachBackgroundMock,
    genMetaDataFilePathMock,
    stopDraggingStateMock,
    useFileSourceEventsMock,
    translateMock,
} = vi.hoisted(() => ({
    slideDragDeserializeMock: vi.fn(),
    bibleDragDeserializeMock: vi.fn(),
    fileDragDeserializeMock: vi.fn(),
    pdfTryValidateMock: vi.fn(),
    pptxTryValidateMock: vi.fn(),
    docxTryValidateMock: vi.fn(),
    colorDeserializeMock: vi.fn(),
    cameraDragDeserializeMock: vi.fn(),
    attachDroppedBackgroundMock: vi.fn(),
    getAttachedBackgroundMock: vi.fn(),
    detachBackgroundMock: vi.fn(),
    genMetaDataFilePathMock: vi.fn((filePath: string) => `${filePath}.meta`),
    stopDraggingStateMock: vi.fn(),
    useFileSourceEventsMock: vi.fn(),
    translateMock: vi.fn((value: string) => value),
}));

vi.mock('../app-document-list/Slide', () => ({
    default: {
        dragDeserialize: slideDragDeserializeMock,
    },
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: {
        dragDeserialize: bibleDragDeserializeMock,
    },
}));

vi.mock('./FileSource', () => ({
    default: {
        dragDeserialize: fileDragDeserializeMock,
    },
}));

vi.mock('../app-document-list/PdfSlide', () => ({
    default: class PdfSlideMock {
        static tryValidate = pdfTryValidateMock;
        constructor(
            public filePath: string,
            public data: Record<string, unknown>,
        ) {}
    },
}));

vi.mock('../app-document-list/PptxSlide', () => ({
    default: class PptxSlideMock {
        static tryValidate = pptxTryValidateMock;
        constructor(
            public filePath: string,
            public data: Record<string, unknown>,
        ) {}
    },
}));

vi.mock('../app-document-list/DocxSlide', () => ({
    default: class DocxSlideMock {
        static tryValidate = docxTryValidateMock;
        constructor(
            public filePath: string,
            public data: Record<string, unknown>,
        ) {}
    },
}));

vi.mock('../others/color/colorHelpers', () => ({
    colorDeserialize: colorDeserializeMock,
}));

vi.mock('../background/backgroundHelpers', () => ({
    cameraDragDeserialize: cameraDragDeserializeMock,
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    default: class AttachBackgroundManagerMock {
        static genMetaDataFilePath(filePath: string) {
            return genMetaDataFilePathMock(filePath);
        }
    },
    attachBackgroundManager: {
        attachDroppedBackground: attachDroppedBackgroundMock,
        getAttachedBackground: getAttachedBackgroundMock,
        detachBackground: detachBackgroundMock,
    },
}));

vi.mock('./helpers', () => ({
    stopDraggingState: stopDraggingStateMock,
}));

vi.mock('./dirSourceHelpers', () => ({
    useFileSourceEvents: useFileSourceEventsMock,
}));

vi.mock('./debuggerHelpers', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppEffectAsync: (
            effectMethod: (methods: Record<string, unknown>) => Promise<void>,
            deps: React.DependencyList,
            methods?: Record<string, unknown>,
        ) => {
            React.useEffect(() => {
                void effectMethod({ ...(methods ?? {}) });
            }, deps);
        },
    };
});

vi.mock('../lang/langHelpers', () => ({
    tran: translateMock,
}));

describe('dragHelpers', () => {
    let latestFileUpdate: (() => void) | undefined;
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.resetModules();
        latestFileUpdate = undefined;
        container = document.createElement('div');
        document.body.appendChild(container);
        useFileSourceEventsMock.mockImplementation(
            (_events: string[], callback: () => void) => {
                latestFileUpdate = callback;
            },
        );
        pdfTryValidateMock.mockReturnValue(true);
        pptxTryValidateMock.mockReturnValue(true);
        docxTryValidateMock.mockReturnValue(true);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('serializes drag data on drag start', async () => {
        const { handleDragStart } = await import('./dragHelpers');
        const setData = vi.fn();

        handleDragStart(
            { dataTransfer: { setData } },
            {
                dragSerialize: (type?: string) => ({ type, data: { id: 1 } }),
            } as any,
        );

        expect(setData).toHaveBeenCalledWith(
            'text',
            JSON.stringify({ type: undefined, data: { id: 1 } }),
        );
    });

    test('deserializes supported drop types and ignores empty payloads', async () => {
        const { DragTypeEnum } = await import('./DragInf');
        const { extractDropData } = await import('./dragHelpers');

        slideDragDeserializeMock.mockReturnValue({ kind: 'slide' });
        bibleDragDeserializeMock.mockReturnValue({ kind: 'bible' });
        fileDragDeserializeMock.mockReturnValue({ kind: 'file' });
        colorDeserializeMock.mockReturnValue({ kind: 'color' });
        cameraDragDeserializeMock.mockReturnValue({ kind: 'camera' });

        const makeEvent = (payload: unknown) => ({
            dataTransfer: {
                getData: () => (payload ? JSON.stringify(payload) : ''),
            },
        });

        expect(extractDropData(makeEvent(null))).toBeNull();
        expect(
            extractDropData(
                makeEvent({ type: DragTypeEnum.SLIDE, data: '{"id":1}' }),
            ),
        ).toEqual({ type: DragTypeEnum.SLIDE, item: { kind: 'slide' } });
        expect(
            extractDropData(
                makeEvent({ type: DragTypeEnum.BIBLE_ITEM, data: '{"id":2}' }),
            ),
        ).toEqual({ type: DragTypeEnum.BIBLE_ITEM, item: { kind: 'bible' } });
        expect(
            extractDropData(
                makeEvent({
                    type: DragTypeEnum.BACKGROUND_VIDEO,
                    data: '{"src":"video"}',
                }),
            ),
        ).toEqual({
            type: DragTypeEnum.BACKGROUND_VIDEO,
            item: { kind: 'file' },
        });
        expect(
            extractDropData(
                makeEvent({
                    type: DragTypeEnum.BACKGROUND_CAMERA,
                    data: '{"id":"camera"}',
                }),
            ),
        ).toEqual({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            item: { kind: 'camera' },
        });
        expect(
            extractDropData(
                makeEvent({
                    type: DragTypeEnum.BACKGROUND_COLOR,
                    data: '{"color":"#fff"}',
                }),
            ),
        ).toEqual({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: { kind: 'color' },
        });
    });

    test('creates slide instances for PDF, PPTX, and DOCX payloads', async () => {
        const { DragTypeEnum } = await import('./DragInf');
        const { extractDropData } = await import('./dragHelpers');

        const makeEvent = (type: string, filePath: string) => ({
            dataTransfer: {
                getData: () =>
                    JSON.stringify({
                        type,
                        data: JSON.stringify({
                            filePath,
                            data: { id: 1 },
                        }),
                    }),
            },
        });

        expect(
            extractDropData(makeEvent(DragTypeEnum.PDF_SLIDE, '/docs/pdf.json')),
        ).toMatchObject({
            type: DragTypeEnum.PDF_SLIDE,
            item: { filePath: '/docs/pdf.json', data: { id: 1 } },
        });
        expect(
            extractDropData(makeEvent(DragTypeEnum.PPTX_SLIDE, '/docs/pptx.json')),
        ).toMatchObject({
            type: DragTypeEnum.PPTX_SLIDE,
            item: { filePath: '/docs/pptx.json', data: { id: 1 } },
        });
        expect(
            extractDropData(makeEvent(DragTypeEnum.DOCX_SLIDE, '/docs/docx.json')),
        ).toMatchObject({
            type: DragTypeEnum.DOCX_SLIDE,
            item: { filePath: '/docs/docx.json', data: { id: 1 } },
        });

        pdfTryValidateMock.mockReturnValueOnce(false);
        expect(
            extractDropData(makeEvent(DragTypeEnum.PDF_SLIDE, '/docs/bad.json')),
        ).toBeNull();
    });

    test('routes supported background drops to the attachment manager', async () => {
        const { DragTypeEnum } = await import('./DragInf');
        const { handleAttachBackgroundDrop } = await import('./dragHelpers');

        const allowEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: {
                getData: () =>
                    JSON.stringify({
                        type: DragTypeEnum.BACKGROUND_IMAGE,
                        data: '{"src":"img"}',
                    }),
            },
        } as any;
        fileDragDeserializeMock.mockReturnValue({ kind: 'bg-file' });

        handleAttachBackgroundDrop(allowEvent, { filePath: '/docs/slide.owa', id: 3 });

        expect(stopDraggingStateMock).toHaveBeenCalledWith(allowEvent);
        expect(attachDroppedBackgroundMock).toHaveBeenCalledWith(
            {
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: { kind: 'bg-file' },
            },
            '/docs/slide.owa',
            3,
        );
    });

    test('loads attached background data and refreshes it on file updates', async () => {
        const { useAttachedBackgroundData } = await import('./dragHelpers');
        getAttachedBackgroundMock
            .mockResolvedValueOnce({ type: 'bg-color', item: { color: 'red' } })
            .mockResolvedValueOnce({ type: 'bg-image', item: { src: 'next' } });
        const onValue = vi.fn();

        function Probe() {
            const value = useAttachedBackgroundData('/docs/slide.owa', 7);

            useEffect(() => {
                onValue(value);
            }, [value]);

            return null;
        }

        await act(async () => {
            root = createRoot(container!);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(genMetaDataFilePathMock).toHaveBeenCalledWith('/docs/slide.owa');
        expect(useFileSourceEventsMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
            [expect.any(Function)],
            '/docs/slide.owa.meta',
        );
        expect(onValue).toHaveBeenLastCalledWith({
            type: 'bg-color',
            item: { color: 'red' },
        });

        await act(async () => {
            latestFileUpdate?.();
            await Promise.resolve();
        });

        expect(onValue).toHaveBeenLastCalledWith({
            type: 'bg-image',
            item: { src: 'next' },
        });
    });

    test('builds a remove-background menu item that detaches the background', async () => {
        const { genRemovingAttachedBackgroundMenu } = await import('./dragHelpers');

        const items = genRemovingAttachedBackgroundMenu('/docs/slide.owa', 9);
        expect(items).toEqual([
            {
                menuElement: 'Remove background',
                onSelect: expect.any(Function),
            },
        ]);

        items[0].onSelect?.();
        expect(detachBackgroundMock).toHaveBeenCalledWith('/docs/slide.owa', 9);
    });
});
