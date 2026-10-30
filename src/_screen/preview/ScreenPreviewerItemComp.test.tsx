// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    screenManager: null as any,
    isNoRendering: false,
    extractDropData: vi.fn(),
    dragStore: { onDropped: undefined as undefined | ((event: any) => void) },
    openContextMenu: vi.fn(),
    observers: [] as {
        callback: () => void;
        observed: Element[];
        disconnect: ReturnType<typeof vi.fn>;
    }[],
}));

// Defines the `<mini-screen-previewer-custom-html>` element on import; the
// card only needs the tag to exist.
vi.mock('./CustomHTMLScreenPreviewer', () => ({}));
vi.mock('../../helper/dragHelpers', () => ({
    dragStore: h.dragStore,
    extractDropData: h.extractDropData,
}));
vi.mock('./screenPreviewerHelpers', () => ({
    openContextMenu: h.openContextMenu,
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => h.screenManager,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('./ScreenPreviewerHeaderComp', () => ({
    default: ({
        isFullView,
        setIsFullView,
    }: {
        isFullView: boolean;
        setIsFullView: (isFullView: boolean) => void;
    }) => (
        <button
            type="button"
            data-stub="header"
            data-full-view={String(isFullView)}
            onClick={() => {
                setIsFullView(!isFullView);
            }}
        >
            full view
        </button>
    ),
}));
vi.mock('./ScreenPreviewerFooterComp', () => ({
    default: () => <div data-stub="footer" />,
}));
vi.mock('../../helper/helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    HIGHLIGHT_SELECTED_CLASSNAME: 'app-highlight-selected',
    RECEIVING_DROP_CLASSNAME: 'receiving-data-drop',
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./miniScreenRenderingHelpers', () => ({
    useIsMiniScreenNoRendering: () => [h.isNoRendering, vi.fn()],
}));

import ScreenPreviewerItemComp from './ScreenPreviewerItemComp';

class FakeResizeObserver {
    readonly observed: Element[] = [];
    readonly disconnect = vi.fn();
    constructor(readonly callback: () => void) {
        h.observers.push(this);
    }
    observe(element: Element) {
        this.observed.push(element);
    }
}

let container: HTMLDivElement;
let root: Root;

function createScreenManager(overrides: Record<string, unknown> = {}) {
    const registered: { events: string[]; listener: () => void }[] = [];
    return {
        screenId: 3,
        key: 'screen-3',
        width: 1920,
        height: 1080,
        isSelected: false,
        divRef: null as any,
        registered,
        registerEventListener: vi.fn(
            (events: string[], listener: () => void) => {
                const entry = { events, listener };
                registered.push(entry);
                return entry;
            },
        ),
        unregisterEventListener: vi.fn(),
        fireScaleEvent: vi.fn(),
        receiveScreenDropped: vi.fn(),
        screenLongTextManager: { isShowing: false },
        ...overrides,
    };
}

async function renderItem(extra?: { onParentWheel?: () => void }) {
    await act(async () => {
        root.render(
            <div onWheel={extra?.onParentWheel}>
                <ScreenPreviewerItemComp width={240} />
            </div>,
        );
    });
}

function getCard() {
    return container.querySelector<HTMLDivElement>('.mini-screen')!;
}

function setSize(element: Element, width: number, height: number) {
    Object.defineProperty(element, 'clientWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: height,
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    h.screenManager = createScreenManager();
    h.isNoRendering = false;
    h.observers.length = 0;
    h.dragStore.onDropped = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ScreenPreviewerItemComp', () => {
    test('draws the card for its screen at the asked width', async () => {
        await renderItem();
        const card = getCard();
        expect(card.dataset.screenKey).toBe('3');
        expect(card.dataset.screenManagerKey).toBe('screen-3');
        expect(card.title).toBe('Screen: 3');
        expect(card.style.width).toBe('240px');
        expect(card.className).not.toContain('app-highlight-selected');
        const fit = card.querySelector<HTMLElement>(
            '.mini-screen-preview-fit',
        )!;
        expect(fit.style.aspectRatio).toBe('1920 / 1080');
        const previewer = card.querySelector(
            'mini-screen-previewer-custom-html',
        )!;
        expect(previewer.getAttribute('screenId')).toBe('3');
        expect(card.querySelector('[data-stub="footer"]')).not.toBe(null);
        // No "No rendering" face while the card draws.
        expect(card.querySelector('.mini-screen-no-rendering')).toBe(null);
    });

    test('a selected screen is highlighted', async () => {
        h.screenManager = createScreenManager({ isSelected: true });
        await renderItem();
        expect(getCard().className).toContain('app-highlight-selected');
    });

    test('with rendering off the card shows the static face', async () => {
        h.isNoRendering = true;
        await renderItem();
        expect(
            getCard().querySelector('.mini-screen-no-rendering')!.textContent,
        ).toBe('No rendering');
        // The previewer itself stays mounted: its slide layer plays the sound.
        expect(
            getCard().querySelector('mini-screen-previewer-custom-html'),
        ).not.toBe(null);
    });

    test('hands the manager a weak reference to its card', async () => {
        await renderItem();
        expect(h.screenManager.divRef).toBeInstanceOf(WeakRef);
        expect(h.screenManager.divRef.deref()).toBe(getCard());
    });

    test('follows a display change to the new aspect ratio', async () => {
        await renderItem();
        const registered = h.screenManager.registered[0];
        expect(registered.events).toEqual(['display-id']);

        h.screenManager.width = 1024;
        h.screenManager.height = 768;
        await act(async () => {
            registered.listener();
        });
        const fit = getCard().querySelector<HTMLElement>(
            '.mini-screen-preview-fit',
        )!;
        expect(fit.style.aspectRatio).toBe('1024 / 768');

        await act(async () => {
            root.render(<></>);
        });
        expect(h.screenManager.unregisterEventListener).toHaveBeenCalledWith(
            registered,
        );
    });

    test('a resize of the preview rescales, only when a dimension changed', async () => {
        await renderItem();
        const observer = h.observers[0];
        const fit = getCard().querySelector('.mini-screen-preview-fit')!;
        expect(observer.observed).toEqual([fit]);

        // Same size as at mount (0 x 0 in jsdom): nothing to recompute.
        await act(async () => {
            observer.callback();
        });
        expect(h.screenManager.fireScaleEvent).not.toHaveBeenCalled();

        // A pure-height change counts: full view is height-constrained.
        setSize(fit, 0, 200);
        await act(async () => {
            observer.callback();
        });
        expect(h.screenManager.fireScaleEvent).toHaveBeenCalledTimes(1);

        setSize(fit, 300, 200);
        await act(async () => {
            observer.callback();
        });
        expect(h.screenManager.fireScaleEvent).toHaveBeenCalledTimes(2);

        await act(async () => {
            root.render(<></>);
        });
        expect(observer.disconnect).toHaveBeenCalledTimes(1);
    });

    test('Escape removing the full-view class is reconciled into state', async () => {
        await renderItem();
        const header = container.querySelector<HTMLElement>(
            '[data-stub="header"]',
        )!;
        await act(async () => {
            header.click();
        });
        expect(getCard().className).toContain('app-full-view');
        expect(header.dataset.fullView).toBe('true');

        // While the class is still there a resize leaves full view alone.
        await act(async () => {
            h.observers[0].callback();
        });
        expect(getCard().className).toContain('app-full-view');

        // The global Escape handler strips the class from the DOM only.
        getCard().classList.remove('app-full-view');
        await act(async () => {
            h.observers[0].callback();
        });
        expect(header.dataset.fullView).toBe('false');
        // A later render must not put the card back into full view.
        await renderItem();
        expect(getCard().className).not.toContain('app-full-view');
    });

    test('skips the resize wiring where ResizeObserver does not exist', async () => {
        vi.stubGlobal('ResizeObserver', undefined);
        await renderItem();
        expect(h.observers).toHaveLength(0);
        expect(getCard()).not.toBe(null);
    });

    test('right click opens the screen context menu for this manager', async () => {
        await renderItem();
        await act(async () => {
            getCard().dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.openContextMenu).toHaveBeenCalledTimes(1);
        expect(h.openContextMenu.mock.calls[0][1]).toBe(h.screenManager);
    });

    test('marks itself while something is dragged over it', async () => {
        await renderItem();
        const card = getCard();
        const dragOver = new Event('dragover', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            card.dispatchEvent(dragOver);
        });
        expect(dragOver.defaultPrevented).toBe(true);
        expect(card.classList.contains('receiving-data-drop')).toBe(true);

        await act(async () => {
            card.dispatchEvent(
                new Event('dragleave', { bubbles: true, cancelable: true }),
            );
        });
        expect(card.classList.contains('receiving-data-drop')).toBe(false);
    });

    test('a drop hands recognised data to the screen', async () => {
        const droppedData = { type: 'background-color', item: '#ff0000' };
        h.extractDropData.mockReturnValue(droppedData);
        await renderItem();
        const card = getCard();
        card.classList.add('receiving-data-drop');
        await act(async () => {
            card.dispatchEvent(new Event('drop', { bubbles: true }));
        });
        expect(card.classList.contains('receiving-data-drop')).toBe(false);
        expect(h.screenManager.receiveScreenDropped).toHaveBeenCalledWith(
            droppedData,
        );
    });

    test('an unrecognised drop goes to whoever started the drag', async () => {
        h.extractDropData.mockReturnValue(null);
        const onDropped = vi.fn();
        h.dragStore.onDropped = onDropped;
        await renderItem();
        await act(async () => {
            getCard().dispatchEvent(new Event('drop', { bubbles: true }));
        });
        expect(onDropped).toHaveBeenCalledTimes(1);
        expect(h.screenManager.receiveScreenDropped).not.toHaveBeenCalled();

        // With no drag in progress there is nobody to tell.
        h.dragStore.onDropped = undefined;
        await act(async () => {
            getCard().dispatchEvent(new Event('drop', { bubbles: true }));
        });
        expect(h.screenManager.receiveScreenDropped).not.toHaveBeenCalled();
    });

    test('ctrl+wheel stays in the card only while long text is showing', async () => {
        const onParentWheel = vi.fn();
        await renderItem({ onParentWheel });
        const card = getCard();
        await act(async () => {
            card.dispatchEvent(
                new WheelEvent('wheel', { bubbles: true, ctrlKey: true }),
            );
        });
        expect(onParentWheel).toHaveBeenCalledTimes(1);

        h.screenManager.screenLongTextManager.isShowing = true;
        await act(async () => {
            card.dispatchEvent(
                new WheelEvent('wheel', { bubbles: true, ctrlKey: true }),
            );
        });
        expect(onParentWheel).toHaveBeenCalledTimes(1);

        // A plain wheel always passes through.
        await act(async () => {
            card.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        });
        expect(onParentWheel).toHaveBeenCalledTimes(2);
    });

    test('the preview body never stays scrolled', async () => {
        await renderItem();
        const body = getCard().querySelector<HTMLElement>(
            '.mini-screen-preview-body',
        )!;
        Object.defineProperty(body, 'scrollTop', {
            configurable: true,
            writable: true,
            value: 40,
        });
        await act(async () => {
            body.dispatchEvent(new Event('scroll'));
        });
        expect(body.scrollTop).toBe(0);
    });
});
