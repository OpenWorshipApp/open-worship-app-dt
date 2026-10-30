// @vitest-environment jsdom

import { act, use, type Context } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type RangePropsType = {
    value: number;
    title: string;
    id: string;
    setValue: (value: number) => void;
    defaultSize: { min: number; max: number; step: number; size: number };
};
type ZoomingOptionsType = {
    value: number;
    setValue: (value: number | ((oldValue: number) => number)) => void;
    defaultSize: unknown;
};

const h = vi.hoisted(() => ({
    fontSize: 30,
    fontSizeContext: null as null | Context<number>,
    nestedBibleItems: [] as unknown[],
    renderedFontSizes: [] as number[],
    hostNestedBibleItems: [] as unknown[],
    rangeProps: null as null | RangePropsType,
    zoomingContainer: null as null | { current: HTMLElement | null },
    zoomingOptions: null as null | ZoomingOptionsType,
    setBibleViewFontSize: vi.fn(),
    handleAutoHide: vi.fn(),
    showSimpleToast: vi.fn(),
    fullscreenElement: null as Element | null,
}));

vi.mock('../helper/appHooks', async () => {
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/bibleViewHelpers', async () => {
    const { createContext } = await import('react');
    h.fontSizeContext = createContext(35);
    return {
        BibleViewFontSizeContext: h.fontSizeContext,
        setBibleViewFontSize: h.setBibleViewFontSize,
        useBibleViewFontSize: () => h.fontSize,
    };
});
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemViewControllerUpdateEvent: () => h.nestedBibleItems,
}));
vi.mock('./BibleViewPaneHostComp', () => ({
    default: ({
        nestedBibleItems,
        children,
    }: {
        nestedBibleItems: unknown;
        children: React.ReactNode;
    }) => {
        h.hostNestedBibleItems.push(nestedBibleItems);
        return <div className="test-pane-host">{children}</div>;
    },
}));
vi.mock('./BibleViewRendererComp', () => ({
    default: ({ nestedBibleItems }: { nestedBibleItems: unknown[] }) => {
        h.renderedFontSizes.push(use(h.fontSizeContext!));
        return <div className="test-renderer">{nestedBibleItems.length}</div>;
    },
}));
vi.mock('../others/AppRangeComp', () => ({
    default: (props: RangePropsType) => {
        h.rangeProps = props;
        return <input className="test-range" readOnly value={props.value} />;
    },
    useZoomingRegistering: (
        containerRef: { current: HTMLElement | null },
        options: ZoomingOptionsType,
    ) => {
        h.zoomingContainer = containerRef;
        h.zoomingOptions = options;
    },
}));
vi.mock('../helper/domHelpers', () => ({
    handleAutoHide: h.handleAutoHide,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('./NewLineSettingComp', () => ({
    default: () => <span className="test-new-line-setting" />,
}));
vi.mock('./BibleModelInfoSettingComp', () => ({
    default: () => <span className="test-model-setting" />,
}));
vi.mock('./BibleSelectionToolbarComp', () => ({
    default: () => <span className="test-selection-toolbar" />,
}));

import BiblePreviewerRenderComp from './BiblePreviewerRenderComp';
import { defaultRangeSize } from './BibleViewSettingComp';

let host: HTMLDivElement;
let root: Root;
const requestFullscreen = vi.fn();
const exitFullscreen = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.fontSize = 30;
    h.nestedBibleItems = [{ id: 1 }, { id: 2 }];
    h.renderedFontSizes = [];
    h.hostNestedBibleItems = [];
    h.rangeProps = null;
    h.zoomingContainer = null;
    h.zoomingOptions = null;
    h.fullscreenElement = null;
    requestFullscreen.mockResolvedValue(undefined);
    exitFullscreen.mockResolvedValue(undefined);
    // jsdom has no Fullscreen API at all.
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => h.fullscreenElement,
    });
    Object.defineProperty(document, 'exitFullscreen', {
        configurable: true,
        value: exitFullscreen,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: requestFullscreen,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
    delete (document.documentElement as any).requestFullscreen;
    vi.unstubAllGlobals();
});

async function render(footerExtra?: React.ReactNode) {
    await act(async () => {
        root.render(<BiblePreviewerRenderComp footerExtra={footerExtra} />);
    });
}

function getFullScreenButton() {
    return host.querySelector<HTMLButtonElement>(
        '.card-footer button.btn-info',
    )!;
}

describe('the previewer', () => {
    test('lays the views out in the pane host, in the shared font size', async () => {
        await render(<span className="test-extra" />);
        const paneHost = host.querySelector('.test-pane-host')!;
        expect(paneHost.querySelector('.test-renderer')!.textContent).toBe('2');
        expect(h.hostNestedBibleItems.at(-1)).toBe(h.nestedBibleItems);
        expect(h.renderedFontSizes.at(-1)).toBe(30);
        expect(host.querySelector('.test-selection-toolbar')).not.toBeNull();
        expect(host.querySelector('.test-new-line-setting')).not.toBeNull();
        expect(host.querySelector('.test-model-setting')).not.toBeNull();
        // The caller's extra sits beside the full-screen button.
        const extra = host.querySelector('.test-extra')!;
        expect(extra.nextElementSibling).toBe(getFullScreenButton());
        // The footer hides itself until the pointer comes near.
        expect(h.handleAutoHide).toHaveBeenCalledWith(
            host.querySelector('.card-footer'),
        );
    });

    test('the font size range shows and sets the shared size', async () => {
        await render();
        expect(
            host.querySelector('.bible-view-setting .badge')!.textContent,
        ).toBe('30px');
        expect(h.rangeProps).toMatchObject({
            value: 30,
            title: 'Font Size',
            defaultSize: defaultRangeSize,
        });
        expect(defaultRangeSize).toEqual({
            size: 5,
            min: 5,
            max: 150,
            step: 2,
        });
        h.rangeProps!.setValue(42);
        expect(h.setBibleViewFontSize).toHaveBeenCalledWith(42);
    });

    test('ctrl + wheel zooms the whole card from the current size', async () => {
        await render();
        expect(h.zoomingContainer!.current).toBe(host.querySelector('.card'));
        expect(h.zoomingOptions).toMatchObject({
            value: 30,
            defaultSize: defaultRangeSize,
        });
        h.zoomingOptions!.setValue((oldValue) => oldValue + 2);
        expect(h.setBibleViewFontSize).toHaveBeenCalledWith(32);
        h.zoomingOptions!.setValue(12);
        expect(h.setBibleViewFontSize).toHaveBeenLastCalledWith(12);
    });
});

describe('full screen', () => {
    test('the button asks the window to go full screen', async () => {
        await render();
        const button = getFullScreenButton();
        expect(button.title).toBe('Full');
        expect(button.querySelector('i')!.className).toBe(
            'bi bi-arrows-fullscreen',
        );
        expect(host.querySelector('.card')!.className).not.toContain(
            'app-popup-full',
        );
        await act(async () => {
            button.click();
        });
        expect(requestFullscreen).toHaveBeenCalledOnce();
        expect(exitFullscreen).not.toHaveBeenCalled();
    });

    test('the card follows the window into full screen, and back out', async () => {
        await render();
        h.fullscreenElement = document.documentElement;
        await act(async () => {
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        expect(host.querySelector('.card')!.className).toContain(
            'app-popup-full',
        );
        const button = getFullScreenButton();
        expect(button.title).toBe('Exit Full');
        expect(button.querySelector('i')!.className).toBe(
            'bi bi-fullscreen-exit',
        );
        await act(async () => {
            button.click();
        });
        expect(exitFullscreen).toHaveBeenCalledOnce();

        h.fullscreenElement = null;
        await act(async () => {
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        expect(getFullScreenButton().title).toBe('Full');
    });

    test('a window that refuses full screen says why', async () => {
        requestFullscreen.mockRejectedValue(new Error('not allowed'));
        await render();
        await act(async () => {
            getFullScreenButton().click();
        });
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Toggle full screen failed',
            'Error: Error: not allowed',
        );
    });

    test('an unmounted previewer stops listening', async () => {
        const addSpy = vi.spyOn(document, 'addEventListener');
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        await render();
        const listener = addSpy.mock.calls.find(([type]) => {
            return type === 'fullscreenchange';
        })![1];
        expect(removeSpy).not.toHaveBeenCalledWith(
            'fullscreenchange',
            listener,
        );
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(removeSpy).toHaveBeenCalledWith('fullscreenchange', listener);
    });
});
