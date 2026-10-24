// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    doc: null as any,
    slides: [] as any[] | null,
    selected: false,
    stage: 0,
    fileUpdate: null as null | (() => void),
    keyboard: null as null | ((event: KeyboardEvent) => void),
    autoNext: null as null | ((data: any) => unknown),
    gridProps: null as any,
    bannerProps: null as any,
    getSlides: vi.fn(),
    getMissingFonts: vi.fn(),
    moveSlide: vi.fn(),
    selectNext: vi.fn(),
    removePdf: vi.fn(),
    removePptx: vi.fn(),
    removeDocx: vi.fn(),
    follow: vi.fn(),
    height: vi.fn(),
}));

vi.mock('../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        _maps: unknown,
        callback: (event: KeyboardEvent) => void,
    ) => {
        h.keyboard = callback;
    },
}));
vi.mock('../../keyboard-shortcut/appShortcutMappers', () => ({
    slideMovingEventMappers: [{ key: 'ArrowRight' }],
}));
vi.mock('../../event/VaryAppDocumentEventListener', () => ({
    useVarySlideThumbnailSizeScale: () => [15],
}));
vi.mock('./varyAppDocumentHelpers', () => ({
    handleSlideMoving: h.moveSlide,
    handleNextItemSelecting: h.selectNext,
}));
vi.mock('./VarySlideRenderWrapperComp', () => ({
    default: ({ index }: { index: number }) =>
        createElement('span', {}, `Slide ${index}`),
}));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: unknown, callback: () => void) => {
        h.fileUpdate = callback;
    },
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => createElement('span', {}, 'Loading slides'),
}));
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useAnyItemSelected: () => h.selected,
    useVaryAppDocumentContext: () => h.doc,
}));
vi.mock('../../slide-auto-play/SlideAutoPlayComp', () => ({
    default: ({ onNext }: { onNext: (data: any) => unknown }) => {
        h.autoNext = onNext;
        return createElement('span', {}, 'Autoplay');
    },
}));
vi.mock('../../app-document-list/appDocumentTypeHelpers', () => ({
    DEFAULT_THUMBNAIL_SIZE_FACTOR: 12,
    MIN_THUMBNAIL_SCALE: 2,
}));
vi.mock('../../virtual-list/VirtualGridComp', () => ({
    default: (props: any) => {
        h.gridProps = props;
        return createElement(
            'div',
            { className: 'grid' },
            props.items.map((item: any) => props.renderItem(item)),
        );
    },
}));
vi.mock('./varySlideGridHelpers', () => ({
    genSlideHeightGetter: () => (slide: any) => slide.height ?? 100,
    THUMBNAIL_EXTRA_HEIGHT: 8,
    THUMBNAIL_EXTRA_WIDTH: 6,
    toVarySlideGridItemKey: (item: any) => item.varySlide.id,
    toVarySlideGridItems: (slides: any[]) =>
        slides.map((varySlide, index) => ({
            varySlide,
            ownerSlide: varySlide,
            index,
        })),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../app-document-list/PdfAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'pdf' },
}));
vi.mock('../../app-document-list/PptxAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'pptx' },
}));
vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'docx' },
}));
vi.mock('../../helper/pdfHelpers', () => ({
    removePdfImagesPreview: h.removePdf,
}));
vi.mock('../../server/pptxHelpers', () => ({
    removePptxHtmlsPreview: h.removePptx,
}));
vi.mock('../../server/docxHelpers', () => ({
    removeDocxHtmlsPreview: h.removeDocx,
}));
vi.mock('./MissingFontFamilyBannerComp', () => ({
    default: (props: any) => {
        h.bannerProps = props;
        return createElement(
            'div',
            {},
            `Fonts: ${props.missingFontFamilyList.join(',')}`,
        );
    },
}));
vi.mock('../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('./useFollowPresentedSlide', () => ({
    useFollowPresentedSlide: h.follow,
}));
vi.mock('./slidesPreviewerScopeHelpers', () => ({
    useSlidesPreviewerScope: () => ({ containerRef: { current: null } }),
    useThumbnailScaleSettingOptions: () => ({}),
}));
vi.mock('./PdfConversionProgressComp', () => ({
    default: ({ filePath }: { filePath: string | null }) =>
        createElement('span', {}, `PDF progress: ${filePath ?? 'none'}`),
}));
vi.mock('../stage/documentStageContexts', async () => {
    const react = await import('react');
    return {
        SlideStageDeckContext: react.createContext(null),
        useSlideStage: () => h.stage,
    };
});
vi.mock('../stage/documentStageHelpers', () => ({
    getDocumentStageDefinition: (stage: number) =>
        stage === 0 ? null : { stage },
    toStageDeck: (slides: any[]) => slides.map(({ id }) => id),
}));

import VarySlidesComp from './VarySlidesComp';

let container: HTMLDivElement;
let root: Root;

async function renderSlides() {
    await act(async () => root.render(createElement(VarySlidesComp)));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.slides = [
        { id: 'one', height: 100 },
        { id: 'two', height: 120 },
    ];
    h.selected = false;
    h.stage = 0;
    h.fileUpdate = null;
    h.keyboard = null;
    h.autoNext = null;
    h.gridProps = null;
    h.bannerProps = null;
    h.getSlides.mockImplementation(async () => h.slides);
    h.getMissingFonts.mockResolvedValue([]);
    h.doc = {
        kind: 'app',
        filePath: 'C:/documents/service.owa',
        fileSource: { fireUpdateEvent: vi.fn() },
        getSlides: h.getSlides,
        getMissingFontFamilyList: h.getMissingFonts,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('slide list', () => {
    it('renders a windowed grid, missing fonts, stage deck, and autoplay', async () => {
        h.selected = true;
        h.stage = 1;
        h.getMissingFonts.mockResolvedValue(['Missing Serif']);
        await renderSlides();
        expect(container.textContent).toContain('Slide 0');
        expect(container.textContent).toContain('Slide 1');
        expect(container.textContent).toContain('Fonts: Missing Serif');
        expect(container.textContent).toContain('Autoplay');
        expect(h.gridProps.items).toHaveLength(2);
        expect(h.gridProps.estimateRowHeight).toBe(108);
        expect(h.follow).toHaveBeenCalledWith(
            h.doc.filePath,
            h.gridProps.items,
        );
        h.selectNext.mockReturnValue(false);
        expect(h.autoNext!({ isNext: true, options: {} })).toBe(false);
        expect(h.selectNext).toHaveBeenCalledWith({
            varySlides: h.slides,
            isNext: true,
            options: {},
        });
    });

    it('shows loading and failure states, with a reload action', async () => {
        let resolveSlides!: (slides: any[] | null) => void;
        h.getSlides.mockReturnValue(
            new Promise((resolve) => {
                resolveSlides = resolve;
            }),
        );
        await renderSlides();
        expect(container.textContent).toContain('Loading slides');
        await act(async () => resolveSlides(null));
        expect(container.textContent).toContain('Fail to load slides');
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(container.textContent).toContain('Loading slides');
    });

    it.each([
        ['pdf', 'Refresh PDF Images', 'removePdf'],
        ['pptx', 'Refresh PPTX Slides', 'removePptx'],
        ['docx', 'Refresh DOCX Pages', 'removeDocx'],
    ])(
        'offers a %s refresh when no slides exist',
        async (kind, label, remover) => {
            h.doc.kind = kind;
            h.slides = [];
            await renderSlides();
            expect(container.textContent).toContain(
                kind === 'docx'
                    ? 'No pages to display'
                    : 'No slides to display',
            );
            expect(container.querySelector('button')?.textContent).toBe(label);
            await act(async () =>
                container.querySelector<HTMLButtonElement>('button')!.click(),
            );
            expect((h as any)[remover]).toHaveBeenCalledWith(h.doc.filePath);
            expect(h.doc.fileSource.fireUpdateEvent).toHaveBeenCalledTimes(1);
        },
    );

    it('refreshes on file updates and delegates slide keys to its own scope', async () => {
        await renderSlides();
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        h.keyboard!(event);
        expect(h.moveSlide).toHaveBeenCalledWith(event, h.slides, null);
        h.slides = [{ id: 'updated', height: 80 }];
        await act(async () => h.fileUpdate!());
        expect(h.getSlides).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('Slide 0');
        expect(h.gridProps.items[0].varySlide.id).toBe('updated');
    });
});
