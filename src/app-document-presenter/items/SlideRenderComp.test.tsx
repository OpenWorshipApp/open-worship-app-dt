// @vitest-environment jsdom

import { act, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appDocument: {
        showHoldingSlidesContextMenu: vi.fn(),
        showSlideContextMenu: vi.fn(),
    },
    // The props the card was last drawn with.
    cardProps: null as null | Record<string, any>,
    rendererProps: null as null | Record<string, any>,
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

vi.mock('../../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedEditingSlideContext: createContext<any>(null),
        useVaryAppDocumentContext: () => mocks.appDocument,
    };
});

vi.mock('./VarySlideRenderComp', () => ({
    default: (props: Record<string, any> & { children: ReactNode }) => {
        mocks.cardProps = props;
        return <div className="card">{props.children}</div>;
    },
}));

vi.mock('./SlideRendererComp', async () => {
    const { SlideThumbnailContext } =
        await import('../../slide-editor/canvas/box/slideThumbnailContext');
    return {
        default: function SlideRendererMockComp(props: Record<string, any>) {
            mocks.rendererProps = {
                ...props,
                isThumbnail: use(SlideThumbnailContext),
            };
            return <div className="renderer" />;
        },
    };
});

import { SelectedEditingSlideContext } from '../../app-document-list/appDocumentHelpers';
import type Slide from '../../app-document-list/Slide';
import SlideRenderComp from './SlideRenderComp';

function genSlide(id: number) {
    return {
        id,
        width: 1920,
        height: 1080,
        canvasItemsJson: [{ id: 1, type: 'text' }],
        checkIsSame(other: { id: number } | null) {
            return other?.id === id;
        },
    } as unknown as Slide;
}

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function withContext(
    node: ReactNode,
    context: { selectedSlideEditing: Slide | null; holdingSlides: Slide[] },
) {
    return (
        <SelectedEditingSlideContext
            value={{
                ...context,
                setSelectedSlide: () => {},
                onSlideItemsKeyboardEvent: () => {},
            }}
        >
            {node}
        </SelectedEditingSlideContext>
    );
}

function genEvent(ctrlKey = false) {
    return {
        ctrlKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    };
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.cardProps = null;
    mocks.rendererProps = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideRenderComp', () => {
    test("draws the slide's own items at its own size as a thumbnail", async () => {
        const slide = genSlide(2);

        await render(<SlideRenderComp slide={slide} width={240} index={1} />);

        expect(mocks.cardProps).toMatchObject({
            varySlide: slide,
            selectedItemEditing: null,
            holdingItems: [],
            width: 240,
            index: 1,
        });
        expect(mocks.rendererProps).toEqual({
            canvasItemsJson: slide.canvasItemsJson,
            width: '1920px',
            height: '1080px',
            isThumbnail: true,
        });
        expect(container.querySelector('.card .renderer')).not.toBeNull();
    });

    test('passes on the slide being edited and the slides being held', async () => {
        const selected = genSlide(2);
        const holding = [genSlide(3)];

        await render(
            withContext(
                <SlideRenderComp slide={genSlide(2)} width={240} index={1} />,
                {
                    selectedSlideEditing: selected,
                    holdingSlides: holding,
                },
            ),
        );

        expect(mocks.cardProps?.selectedItemEditing).toBe(selected);
        expect(mocks.cardProps?.holdingItems).toBe(holding);
    });

    test('Ctrl + right click selects the slide instead of opening a menu', async () => {
        const slide = genSlide(2);
        const onClick = vi.fn();
        await render(
            <SlideRenderComp
                slide={slide}
                width={240}
                index={4}
                onClick={onClick}
            />,
        );
        const event = genEvent(true);

        mocks.cardProps?.onContextMenu(event, []);

        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(onClick).toHaveBeenCalledExactlyOnceWith(event, 4, slide);
        expect(mocks.appDocument.showSlideContextMenu).not.toHaveBeenCalled();
        expect(
            mocks.appDocument.showHoldingSlidesContextMenu,
        ).not.toHaveBeenCalled();
    });

    test('right click on a held slide opens the menu for every held slide', async () => {
        const holding = [genSlide(2), genSlide(3)];
        await render(
            withContext(
                <SlideRenderComp slide={genSlide(3)} width={240} index={2} />,
                {
                    selectedSlideEditing: null,
                    holdingSlides: holding,
                },
            ),
        );
        const event = genEvent();

        mocks.cardProps?.onContextMenu(event, [{ menuElement: 'Extra' }]);

        expect(
            mocks.appDocument.showHoldingSlidesContextMenu,
        ).toHaveBeenCalledExactlyOnceWith(event, holding);
        expect(mocks.appDocument.showSlideContextMenu).not.toHaveBeenCalled();
    });

    test("right click on any other slide opens that slide's menu, saying if it is the one being edited", async () => {
        const slide = genSlide(2);
        const extra = [{ menuElement: 'Extra' }];
        await render(
            withContext(
                <SlideRenderComp slide={slide} width={240} index={1} />,
                {
                    selectedSlideEditing: genSlide(2),
                    holdingSlides: [genSlide(5)],
                },
            ),
        );
        const event = genEvent();

        mocks.cardProps?.onContextMenu(event, extra);
        expect(mocks.appDocument.showSlideContextMenu).toHaveBeenLastCalledWith(
            event,
            slide,
            extra,
            true,
        );

        await render(
            withContext(
                <SlideRenderComp slide={slide} width={240} index={1} />,
                {
                    selectedSlideEditing: genSlide(9),
                    holdingSlides: [],
                },
            ),
        );
        mocks.cardProps?.onContextMenu(event, extra);
        expect(mocks.appDocument.showSlideContextMenu).toHaveBeenLastCalledWith(
            event,
            slide,
            extra,
            false,
        );
    });

    test('a menu opened after a re-render acts on the new slide', async () => {
        await render(
            <SlideRenderComp slide={genSlide(1)} width={240} index={0} />,
        );
        const handler = mocks.cardProps?.onContextMenu;
        const newSlide = genSlide(7);

        await render(
            <SlideRenderComp slide={newSlide} width={240} index={0} />,
        );
        // The same handler, reading the latest props through its refs.
        expect(mocks.cardProps?.onContextMenu).toBe(handler);
        handler(genEvent(), []);

        expect(mocks.appDocument.showSlideContextMenu).toHaveBeenCalledWith(
            expect.anything(),
            newSlide,
            [],
            false,
        );
    });
});
