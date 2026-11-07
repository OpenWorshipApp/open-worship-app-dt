// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The card wrapper picks the renderer for each kind of slide and turns a click
// into a selection one macrotask later; `SlideRenderComp` (the plain slide's
// renderer, rendered for real here) decides which context menu a right click
// opens. The cards themselves are mocked to expose the props they were given.

const { state, mocks, SlideMock, PdfSlideMock, PptxSlideMock, DocxSlideMock } =
    vi.hoisted(() => {
        class SlideMock {
            canvasItemsJson: unknown[] = [];
            width = 800;
            height = 600;
            constructor(public id: number) {}
            checkIsSame(other: any) {
                return other instanceof SlideMock && other.id === this.id;
            }
            static checkIsThisType(item: any) {
                return item instanceof this;
            }
        }
        class PdfSlideMock {
            constructor(public id: number) {}
            static checkIsThisType(item: any) {
                return item instanceof this;
            }
        }
        class PptxSlideMock {
            constructor(public id: number) {}
            static checkIsThisType(item: any) {
                return item instanceof this;
            }
        }
        class DocxSlideMock {
            constructor(public id: number) {}
            static checkIsThisType(item: any) {
                return item instanceof this;
            }
        }
        return {
            SlideMock,
            PdfSlideMock,
            PptxSlideMock,
            DocxSlideMock,
            state: {
                presetScreenIds: [] as number[],
                appDocument: null as any,
                editingContext: null as any,
                selectedBack: null as any,
                extraMenuItems: [{ menuElement: 'Extra' }] as any[],
            },
            mocks: {
                fireSelected: vi.fn(),
                handleSelecting: vi.fn(),
                setSelected: vi.fn(),
                onCardClick: vi.fn(),
            },
        };
    });

vi.mock('../../app-document-list/Slide', () => ({ default: SlideMock }));
vi.mock('../../app-document-list/PdfSlide', () => ({ default: PdfSlideMock }));
vi.mock('../../app-document-list/PptxSlide', () => ({
    default: PptxSlideMock,
}));
vi.mock('../../app-document-list/DocxSlide', () => ({
    default: DocxSlideMock,
}));
vi.mock('../../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedEditingSlideContext: createContext<any>(null),
        useVaryAppDocumentContext: () => state.appDocument,
        useSelectedEditingSlideSetterContext: () => mocks.setSelected,
    };
});
vi.mock('./varyAppDocumentHelpers', () => ({
    fireOnSlideItemSelectedEvent: mocks.fireSelected,
    handleVarySlideSelecting: mocks.handleSelecting,
}));
vi.mock('../../_screen/managers/screenChoosingHelpers', () => ({
    usePresetScreenIds: () => state.presetScreenIds,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./VarySlideRenderComp', () => ({
    default: ({
        varySlide,
        selectedItemEditing,
        holdingItems,
        width,
        index,
        onContextMenu,
        onClick,
        children,
    }: any) => (
        <div
            data-testid="vary-slide"
            data-width={width}
            data-index={index}
            data-holding={holdingItems.length}
            data-editing={selectedItemEditing?.id ?? 'none'}
            onContextMenu={(event) =>
                onContextMenu(event, state.extraMenuItems)
            }
            onClick={(event) => onClick?.(event, index, varySlide)}
        >
            {children}
        </div>
    ),
}));
vi.mock('./SlideRendererComp', async () => {
    const { SlideThumbnailContext } =
        await import('../../slide-editor/canvas/box/slideThumbnailContext');
    return {
        default: function SlideRendererMockComp({
            canvasItemsJson,
            width,
            height,
        }: any) {
            const isThumbnail = use(SlideThumbnailContext);
            return (
                <span
                    data-testid="renderer"
                    data-size={`${width}x${height}`}
                    data-thumbnail={String(isThumbnail)}
                >
                    {canvasItemsJson.length}
                </span>
            );
        },
    };
});
vi.mock('./PdfSlideRenderComp', () => ({
    default: ({ pdfSlide, width, index, onClick }: any) => (
        <button
            type="button"
            data-testid="pdf"
            data-width={width}
            data-index={index}
            onClick={(event) => onClick(event, index, pdfSlide)}
        >
            pdf {pdfSlide.id}
        </button>
    ),
}));
vi.mock('./PptxSlideRenderComp', () => ({
    default: ({ pptxSlide, isWithSubSlides, menuSlide, index }: any) => (
        <span
            data-testid="pptx"
            data-sub-slides={String(isWithSubSlides)}
            data-menu-slide={menuSlide?.id ?? 'none'}
            data-index={index}
        >
            pptx {pptxSlide.id}
        </span>
    ),
}));
vi.mock('./DocxSlideRenderComp', () => ({
    default: ({ docxSlide, width, onClick, index }: any) => (
        <button
            type="button"
            data-testid="docx"
            data-width={width}
            onClick={(event) => onClick(event, index, docxSlide)}
        >
            docx {docxSlide.id}
        </button>
    ),
}));

import { SelectedEditingSlideContext } from '../../app-document-list/appDocumentHelpers';
import SlideRenderComp from './SlideRenderComp';
import VarySlideRenderWrapperComp from './VarySlideRenderWrapperComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function find(testId: string) {
    const element = container.querySelector<HTMLElement>(
        `[data-testid="${testId}"]`,
    );
    if (element === null) {
        throw new Error(`Missing ${testId}`);
    }
    return element;
}

beforeEach(() => {
    vi.useFakeTimers();
    state.presetScreenIds = [];
    state.editingContext = null;
    state.selectedBack = null;
    state.appDocument = {
        showHoldingSlidesContextMenu: vi.fn(),
        showSlideContextMenu: vi.fn(),
    };
    mocks.handleSelecting.mockImplementation(
        (
            _event: unknown,
            _index: number,
            _varySlide: unknown,
            callback: (selected: unknown) => void,
        ) => {
            callback(state.selectedBack);
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

async function renderWrapper(varySlide: any, ownerSlide?: any) {
    await act(async () => {
        root.render(
            <SelectedEditingSlideContext value={state.editingContext}>
                <VarySlideRenderWrapperComp
                    thumbSize={240}
                    varySlide={varySlide}
                    index={3}
                    ownerSlide={ownerSlide}
                />
            </SelectedEditingSlideContext>,
        );
    });
}

describe('VarySlideRenderWrapperComp', () => {
    test('a PDF page is drawn by the PDF card and selected one macrotask after its click', async () => {
        state.presetScreenIds = [2];
        const pdfSlide = new PdfSlideMock(7);
        await renderWrapper(pdfSlide);
        const card = find('pdf');
        expect(card.dataset.width).toBe('240');
        expect(card.dataset.index).toBe('3');

        await act(async () => card.click());
        expect(mocks.fireSelected).toHaveBeenCalledOnce();
        expect(mocks.handleSelecting).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(mocks.handleSelecting).toHaveBeenCalledExactlyOnceWith(
            expect.anything(),
            4,
            pdfSlide,
            expect.any(Function),
            [2],
        );
        // What came back is not an editable slide: nothing is selected.
        expect(mocks.setSelected).not.toHaveBeenCalled();
    });

    test('a PPTX slide draws its sub-slides only when it is not a grid cell of its own', async () => {
        await renderWrapper(new PptxSlideMock(1));
        expect(find('pptx').dataset.subSlides).toBe('true');
        expect(find('pptx').dataset.menuSlide).toBe('none');

        await renderWrapper(new PptxSlideMock(1.01), new PptxSlideMock(1));
        expect(find('pptx').dataset.subSlides).toBe('false');
        expect(find('pptx').dataset.menuSlide).toBe('1');

        // An owner that is not a PPTX slide lends it no menu.
        await renderWrapper(new PptxSlideMock(2), new SlideMock(9));
        expect(find('pptx').dataset.subSlides).toBe('false');
        expect(find('pptx').dataset.menuSlide).toBe('none');
    });

    test('a DOCX page is drawn by the DOCX card', async () => {
        await renderWrapper(new DocxSlideMock(5));
        expect(find('docx').textContent).toBe('docx 5');
        expect(
            container.querySelector('[data-testid="vary-slide"]'),
        ).toBeNull();
    });

    test.each([
        [{}, undefined],
        [{ ctrlKey: true }, 'Ctrl'],
        [{ shiftKey: true }, 'Shift'],
    ])(
        'a plain slide click selects it with the held modifier %o',
        async (modifiers, controlType) => {
            const slide = new SlideMock(4);
            state.selectedBack = slide;
            await renderWrapper(slide);
            await act(async () => {
                find('vary-slide').dispatchEvent(
                    new MouseEvent('click', { bubbles: true, ...modifiers }),
                );
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(mocks.setSelected).toHaveBeenCalledExactlyOnceWith(
                slide,
                controlType,
            );
        },
    );
});

describe('SlideRenderComp', () => {
    async function renderSlide(slide: any, onClick = mocks.onCardClick) {
        await act(async () => {
            root.render(
                <SelectedEditingSlideContext value={state.editingContext}>
                    <SlideRenderComp
                        slide={slide}
                        width={180}
                        index={2}
                        onClick={onClick}
                    />
                </SelectedEditingSlideContext>,
            );
        });
    }

    test('draws the slide as a thumbnail at its own size', async () => {
        const slide = new SlideMock(1);
        slide.canvasItemsJson = [{}, {}];
        slide.width = 1920;
        slide.height = 1080;
        await renderSlide(slide);
        const renderer = find('renderer');
        expect(renderer.dataset.size).toBe('1920pxx1080px');
        expect(renderer.dataset.thumbnail).toBe('true');
        expect(renderer.textContent).toBe('2');
        expect(find('vary-slide').dataset.width).toBe('180');
        // No editing context at all: nothing is held, nothing is edited.
        expect(find('vary-slide').dataset.holding).toBe('0');
        expect(find('vary-slide').dataset.editing).toBe('none');
    });

    test('Ctrl + right click selects the slide instead of opening a menu', async () => {
        const slide = new SlideMock(1);
        await renderSlide(slide);
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        });
        await act(async () => {
            find('vary-slide').dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.onCardClick).toHaveBeenCalledExactlyOnceWith(
            expect.anything(),
            2,
            slide,
        );
        expect(state.appDocument.showSlideContextMenu).not.toHaveBeenCalled();
        expect(
            state.appDocument.showHoldingSlidesContextMenu,
        ).not.toHaveBeenCalled();
    });

    test('a right click on a held slide opens the menu for all held slides', async () => {
        const slide = new SlideMock(1);
        const holdingSlides = [new SlideMock(1), new SlideMock(2)];
        state.editingContext = {
            selectedSlideEditing: null,
            holdingSlides,
        };
        await renderSlide(slide);
        expect(find('vary-slide').dataset.holding).toBe('2');
        await act(async () => {
            find('vary-slide').dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(
            state.appDocument.showHoldingSlidesContextMenu,
        ).toHaveBeenCalledExactlyOnceWith(expect.anything(), holdingSlides);
        expect(state.appDocument.showSlideContextMenu).not.toHaveBeenCalled();
    });

    test.each([
        [4, true],
        [5, false],
    ])(
        'a right click on a free slide opens its own menu (editing slide %i → %s)',
        async (editingId, isSelectedEditing) => {
            const slide = new SlideMock(4);
            state.editingContext = {
                selectedSlideEditing: new SlideMock(editingId),
                holdingSlides: [new SlideMock(9)],
            };
            await renderSlide(slide);
            expect(find('vary-slide').dataset.editing).toBe(`${editingId}`);
            await act(async () => {
                find('vary-slide').dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
            expect(
                state.appDocument.showSlideContextMenu,
            ).toHaveBeenCalledExactlyOnceWith(
                expect.anything(),
                slide,
                state.extraMenuItems,
                isSelectedEditing,
            );
        },
    );

    test('Ctrl + right click with no click handler does nothing else', async () => {
        await act(async () => {
            root.render(
                <SlideRenderComp
                    slide={new SlideMock(1) as any}
                    width={10}
                    index={0}
                />,
            );
        });
        await act(async () => {
            find('vary-slide').dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, ctrlKey: true }),
            );
        });
        expect(state.appDocument.showSlideContextMenu).not.toHaveBeenCalled();
        expect(
            state.appDocument.showHoldingSlidesContextMenu,
        ).not.toHaveBeenCalled();
    });
});
