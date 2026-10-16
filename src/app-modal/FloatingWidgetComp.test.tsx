// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, setSetting } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    setSetting: vi.fn((key: string, value: string) => {
        settings.set(key, value);
    }),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting,
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('./modalLayerContext', () => ({
    useIsInModalLayer: () => false,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import FloatingWidgetComp from './FloatingWidgetComp';

let host: HTMLDivElement;
let root: Root;
let onClose: () => void;

function widget() {
    return host.querySelector<HTMLDivElement>('.floating-widget')!;
}

function button(label: string) {
    const result = host.querySelector<HTMLButtonElement>(
        `[aria-label="${label}"]`,
    );
    expect(result).not.toBeNull();
    return result!;
}

function renderWidget(
    overrides: { isBodyHidden?: boolean; raiseToken?: number } = {},
) {
    return act(async () =>
        root.render(
            <FloatingWidgetComp
                title="Notes"
                widgetName="Service Notes"
                persistKey="notes-widget-rect"
                options={{ width: 360, height: 240 }}
                collapsedChildren={<span>Collapsed notes</span>}
                onClose={onClose}
                {...overrides}
            >
                <span>Full notes</span>
            </FloatingWidgetComp>,
        ),
    );
}

function pointer(
    target: Element,
    type: string,
    pointerId: number,
    clientX = 0,
    clientY = 0,
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
        clientY,
    });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    target.dispatchEvent(event);
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    settings.clear();
    setSetting.mockClear();
    onClose = vi.fn<() => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('floating widget', () => {
    test('restores a saved rect and fits it again when the viewport shrinks', async () => {
        settings.set(
            'notes-widget-rect',
            JSON.stringify({ left: 400, top: 80, width: 360, height: 240 }),
        );
        await renderWidget();
        expect(widget().style.left).toBe('400px');
        vi.stubGlobal('innerWidth', 600);
        await act(async () => window.dispatchEvent(new Event('resize')));
        expect(widget().style.left).toBe('232px');
        await act(async () => button('Full view').click());
        expect(widget().style.width).toBe('584px');
        vi.stubGlobal('innerWidth', 700);
        await act(async () => window.dispatchEvent(new Event('resize')));
        expect(widget().style.width).toBe('684px');
    });

    test('collapse, full view and close keep their visible actions in sync', async () => {
        await renderWidget();
        expect(widget().getAttribute('data-widget-name')).toBe('Service Notes');
        expect(widget().textContent).toContain('Full notes');
        expect(
            widget().querySelectorAll('.floating-widget__resize-handle'),
        ).toHaveLength(8);

        await act(async () => button('Collapse floating widget').click());
        expect(widget().classList.contains('floating-widget--collapsed')).toBe(
            true,
        );
        expect(widget().textContent).toContain('Collapsed notes');
        expect(
            widget().querySelectorAll('.floating-widget__resize-handle'),
        ).toHaveLength(0);
        await act(async () => button('Expand floating widget').click());
        expect(widget().textContent).toContain('Full notes');

        const originalLeft = widget().style.left;
        await act(async () => button('Full view').click());
        expect(widget().style.left).toBe('8px');
        expect(button('Exit full view')).toBeDefined();
        await act(async () => button('Exit full view').click());
        expect(widget().style.left).toBe(originalLeft);
        await act(async () => button('Close floating widget').click());
        expect(onClose).toHaveBeenCalledOnce();
    });

    test('body hiding is temporary and keeps the user collapse choice', async () => {
        await renderWidget({ isBodyHidden: true });
        expect(widget().textContent).toContain('Collapsed notes');
        expect(
            host.querySelector('[aria-label="Collapse floating widget"]'),
        ).toBeNull();
        await renderWidget({ isBodyHidden: false });
        expect(widget().textContent).toContain('Full notes');
        await act(async () => button('Collapse floating widget').click());
        await renderWidget({ isBodyHidden: true });
        await renderWidget({ isBodyHidden: false });
        expect(widget().textContent).toContain('Collapsed notes');
        expect(button('Expand floating widget')).toBeDefined();
    });

    test('a pointer move persists once when released by the same pointer', async () => {
        await renderWidget();
        const element = widget();
        element.setPointerCapture = vi.fn();
        element.hasPointerCapture = vi.fn(() => false);
        const header = element.querySelector('.floating-widget__header')!;
        const initialLeft = Number.parseInt(element.style.left, 10);
        await act(async () => pointer(header, 'pointerdown', 7));
        await act(async () => pointer(element, 'pointermove', 8, -50, 20));
        expect(Number.parseInt(element.style.left, 10)).toBe(initialLeft);
        await act(async () => pointer(element, 'pointermove', 7, -50, 20));
        expect(Number.parseInt(element.style.left, 10)).toBe(initialLeft - 50);
        await act(async () => pointer(element, 'pointerup', 8, -50, 20));
        expect(setSetting).not.toHaveBeenCalled();
        await act(async () => pointer(element, 'pointerup', 7, -50, 20));
        expect(setSetting).toHaveBeenCalledOnce();
        expect(JSON.parse(settings.get('notes-widget-rect')!)).toMatchObject({
            left: initialLeft - 50,
        });
    });

    test('resizing a maximized widget returns it to a resizable saved rect', async () => {
        await renderWidget();
        const element = widget();
        element.setPointerCapture = vi.fn();
        element.hasPointerCapture = vi.fn(() => false);
        await act(async () => button('Full view').click());
        const fullWidth = Number.parseInt(element.style.width, 10);
        const fullHeight = Number.parseInt(element.style.height, 10);
        const handle = element.querySelector(
            '.floating-widget__resize-handle--bottom-right',
        )!;
        await act(async () => pointer(handle, 'pointerdown', 9));
        expect(button('Full view')).toBeDefined();
        await act(async () => pointer(element, 'pointermove', 9, -100, -100));
        expect(Number.parseInt(element.style.width, 10)).toBe(fullWidth - 100);
        expect(Number.parseInt(element.style.height, 10)).toBe(
            fullHeight - 100,
        );
        await act(async () => pointer(element, 'pointerup', 9, -100, -100));
        expect(JSON.parse(settings.get('notes-widget-rect')!)).toMatchObject({
            width: fullWidth - 100,
            height: fullHeight - 100,
        });
    });

    test('two nearby header presses toggle full view without a click event', async () => {
        await renderWidget();
        const element = widget();
        element.setPointerCapture = vi.fn();
        element.hasPointerCapture = vi.fn(() => false);
        const header = element.querySelector('.floating-widget__header')!;
        const originalLeft = element.style.left;
        await act(async () => pointer(header, 'pointerdown', 1));
        await act(async () => pointer(element, 'pointerup', 1));
        await act(async () => pointer(header, 'pointerdown', 2));
        expect(button('Exit full view')).toBeDefined();
        expect(element.style.left).toBe('8px');
        await act(async () => pointer(header, 'pointerdown', 3));
        await act(async () => pointer(element, 'pointerup', 3));
        await act(async () => pointer(header, 'pointerdown', 4));
        expect(element.style.left).toBe(originalLeft);
    });

    // A title longer than the header used to be cut off, taking any button a
    // host put at its end with it (the Lookup Detail's "open in lookup").
    test('a long title scrolls sideways and its bar is not a double-press surface', async () => {
        await renderWidget();
        const element = widget();
        element.setPointerCapture = vi.fn();
        element.hasPointerCapture = vi.fn(() => false);
        const title = element.querySelector<HTMLElement>(
            '.floating-widget__title',
        )!;
        // jsdom lays nothing out: 221px of title in a 150px box, with the bar
        // under a 20px line.
        Object.defineProperty(title, 'scrollWidth', { value: 221 });
        Object.defineProperty(title, 'clientWidth', { value: 150 });
        Object.defineProperty(title, 'clientHeight', { value: 20 });

        const wheel = new WheelEvent('wheel', { cancelable: true, deltaY: 40 });
        title.dispatchEvent(wheel);
        expect(title.scrollLeft).toBe(40);
        expect(wheel.defaultPrevented).toBe(true);

        const originalLeft = element.style.left;
        await act(async () => pointer(title, 'pointerdown', 1, 10, 22));
        await act(async () => pointer(element, 'pointerup', 1, 10, 22));
        await act(async () => pointer(title, 'pointerdown', 2, 10, 22));
        expect(button('Full view')).toBeDefined();
        expect(element.style.left).toBe(originalLeft);

        // The text above the bar still is one.
        await act(async () => pointer(title, 'pointerdown', 3, 10, 10));
        await act(async () => pointer(element, 'pointerup', 3, 10, 10));
        await act(async () => pointer(title, 'pointerdown', 4, 10, 10));
        expect(button('Exit full view')).toBeDefined();
    });
});
