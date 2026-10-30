// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    // The renderer chosen for the card, and the props it got.
    rendered: null as null | { kind: string; props: Record<string, any> },
    setSelectedSlideMock: vi.fn(),
    presetScreenIds: [] as number[],
    fireOnSlideItemSelectedEventMock: vi.fn(),
    handleVarySlideSelectingMock: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});

function genRendererMock(kind: string) {
    return {
        default: (props: Record<string, any>) => {
            mocks.rendered = { kind, props };
            return <div className={kind} />;
        },
    };
}
vi.mock('./SlideRenderComp', () => genRendererMock('slide'));
vi.mock('./PdfSlideRenderComp', () => genRendererMock('pdf'));
vi.mock('./PptxSlideRenderComp', () => genRendererMock('pptx'));
vi.mock('./DocxSlideRenderComp', () => genRendererMock('docx'));

vi.mock('./varyAppDocumentHelpers', () => ({
    fireOnSlideItemSelectedEvent: mocks.fireOnSlideItemSelectedEventMock,
    handleVarySlideSelecting: mocks.handleVarySlideSelectingMock,
}));
vi.mock('../../_screen/managers/screenChoosingHelpers', () => ({
    usePresetScreenIds: () => mocks.presetScreenIds,
}));
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useSelectedEditingSlideSetterContext: () => mocks.setSelectedSlideMock,
}));

// What the real slide models reach for.
vi.mock('../../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../../helper/FileSource', () => ({ default: {} }));
vi.mock('../../server/fileHelpers', () => ({ pathJoin: vi.fn() }));
vi.mock('../../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: vi.fn(),
}));
vi.mock('../../server/fontHelpers', () => ({ getFontFamilies: vi.fn() }));
vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import DocxSlide from '../../app-document-list/DocxSlide';
import PdfSlide from '../../app-document-list/PdfSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import Slide from '../../app-document-list/Slide';
import VarySlideRenderWrapperComp from './VarySlideRenderWrapperComp';

const metadata = { width: 1280, height: 720 };

function genSlide(id = 3) {
    return new Slide('/docs/a.ows', {
        id,
        metadata,
        canvasItems: [],
        type: 'slide',
    });
}

function genPdfSlide() {
    return new PdfSlide('/docs/a.pdf', {
        id: 2,
        imagePreviewSrc: 'file:///p/1.png',
        pdfPageNumber: 1,
        metadata,
        type: 'pdf-slide',
    });
}

function genPptxSlide(id = 1) {
    return new PptxSlide('/docs/a.pptx', {
        id,
        htmlFilePath: '/p/slide.html',
        subHtmlFilePaths: [],
        isDisabled: false,
        note: null,
        metadata,
        images: [],
        videos: [],
        audios: [],
        type: 'pptx-slide',
    });
}

function genDocxSlide() {
    return new DocxSlide('/docs/a.docx', {
        id: 1,
        htmlFilePath: '/p/page.html',
        metadata,
        type: 'docx-slide',
    });
}

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function genClickEvent(keys: { ctrlKey?: boolean; shiftKey?: boolean } = {}) {
    return {
        ctrlKey: false,
        shiftKey: false,
        ...keys,
        stopPropagation: vi.fn(),
    };
}

/** Clicks the drawn card, then lets the deferred selection run. */
async function clickCard(event: ReturnType<typeof genClickEvent>) {
    const { props } = mocks.rendered!;
    props.onClick(event, props.index, props.varySlide ?? props.pdfSlide);
    await vi.advanceTimersByTimeAsync(0);
    const [, , , onSelected] = mocks.handleVarySlideSelectingMock.mock
        .lastCall as [unknown, number, unknown, (slide: unknown) => void];
    return onSelected;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.rendered = null;
    mocks.presetScreenIds = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('VarySlideRenderWrapperComp picks the renderer for the slide kind', () => {
    test('an Open Worship slide', async () => {
        const slide = genSlide();

        await render(
            <VarySlideRenderWrapperComp
                thumbSize={200}
                varySlide={slide}
                index={5}
            />,
        );

        expect(mocks.rendered?.kind).toBe('slide');
        expect(mocks.rendered?.props).toMatchObject({
            slide,
            width: 200,
            index: 5,
        });
    });

    test('a PDF page', async () => {
        const pdfSlide = genPdfSlide();

        await render(
            <VarySlideRenderWrapperComp
                thumbSize={150}
                varySlide={pdfSlide}
                index={2}
            />,
        );

        expect(mocks.rendered?.kind).toBe('pdf');
        expect(mocks.rendered?.props).toMatchObject({
            pdfSlide,
            width: 150,
            index: 2,
        });
    });

    test('a Word page', async () => {
        const docxSlide = genDocxSlide();

        await render(
            <VarySlideRenderWrapperComp
                thumbSize={150}
                varySlide={docxSlide}
                index={1}
            />,
        );

        expect(mocks.rendered?.kind).toBe('docx');
        expect(mocks.rendered?.props).toMatchObject({ docxSlide, index: 1 });
    });

    test('a PowerPoint slide draws its sub-slides only without a grid owner', async () => {
        const pptxSlide = genPptxSlide(1);

        await render(
            <VarySlideRenderWrapperComp
                thumbSize={150}
                varySlide={pptxSlide}
                index={1}
            />,
        );
        expect(mocks.rendered?.kind).toBe('pptx');
        expect(mocks.rendered?.props).toMatchObject({
            pptxSlide,
            isWithSubSlides: true,
            menuSlide: undefined,
        });

        // A sub-slide cell of a grid: its menu is its PowerPoint slide's.
        const owner = genPptxSlide(9);
        await render(
            <VarySlideRenderWrapperComp
                thumbSize={150}
                varySlide={pptxSlide}
                index={1}
                ownerSlide={owner}
            />,
        );
        expect(mocks.rendered?.props).toMatchObject({
            isWithSubSlides: false,
            menuSlide: owner,
        });

        await render(
            <VarySlideRenderWrapperComp
                thumbSize={150}
                varySlide={pptxSlide}
                index={1}
                ownerSlide={genSlide()}
            />,
        );
        expect(mocks.rendered?.props).toMatchObject({
            isWithSubSlides: false,
            menuSlide: undefined,
        });
    });
});

describe('VarySlideRenderWrapperComp selecting', () => {
    test('a click is announced at once and selected on the next tick, one-based', async () => {
        mocks.presetScreenIds = [2];
        const slide = genSlide();
        await render(
            <VarySlideRenderWrapperComp
                thumbSize={200}
                varySlide={slide}
                index={5}
            />,
        );
        const event = genClickEvent();

        mocks.rendered!.props.onClick(event, 5, slide);

        expect(mocks.fireOnSlideItemSelectedEventMock).toHaveBeenCalledWith(
            event,
        );
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(mocks.handleVarySlideSelectingMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(0);

        expect(mocks.handleVarySlideSelectingMock).toHaveBeenCalledWith(
            event,
            6,
            slide,
            expect.any(Function),
            [2],
        );
    });

    test.each([
        [{}, undefined],
        [{ ctrlKey: true }, 'Ctrl'],
        [{ shiftKey: true }, 'Shift'],
        [{ ctrlKey: true, shiftKey: true }, 'Ctrl'],
    ])(
        'a slide selected with %j is set with control %s',
        async (keys, controlType) => {
            const slide = genSlide();
            await render(
                <VarySlideRenderWrapperComp
                    thumbSize={200}
                    varySlide={slide}
                    index={0}
                />,
            );

            const onSelected = await clickCard(genClickEvent(keys));
            onSelected(slide);

            expect(mocks.setSelectedSlideMock).toHaveBeenCalledExactlyOnceWith(
                slide,
                controlType,
            );
        },
    );

    test('a page of another kind is never set as the slide being edited', async () => {
        const pdfSlide = genPdfSlide();
        await render(
            <VarySlideRenderWrapperComp
                thumbSize={200}
                varySlide={pdfSlide}
                index={0}
            />,
        );

        const onSelected = await clickCard(genClickEvent());
        onSelected(pdfSlide);

        expect(mocks.setSelectedSlideMock).not.toHaveBeenCalled();
    });
});
