// @vitest-environment jsdom

// `FloatingWidgetComp.test.tsx` mocks `useIsInModalLayer` module-wide, so the
// widget's own read of the modal layer lives here, against the REAL context:
// a widget a modal opens must stack above the modal stack, one opened outside
// every modal must not.

import { act, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: vi.fn(),
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import FloatingWidgetComp from './FloatingWidgetComp';
import { ModalLayerContext } from './modalLayerContext';

const ABOVE_MODAL_CLASS = 'floating-widget--above-modal';

let host: HTMLDivElement;
let root: Root;

// The way its hosts mount it (`BibleSlidesPopupComp` and the rest): portaled
// to `document.body`, so its DOM sits outside the modal that opened it and
// only the React tree can say where it belongs.
function renderPortaledWidget(wrap: (widget: ReactNode) => ReactNode) {
    return act(async () =>
        root.render(
            wrap(
                <div className="test-modal-body">
                    {createPortal(
                        <FloatingWidgetComp
                            title="Notes"
                            widgetName="Service Notes"
                            options={{ width: 360, height: 240 }}
                            onClose={vi.fn()}
                        >
                            <span>Full notes</span>
                        </FloatingWidgetComp>,
                        document.body,
                    )}
                </div>,
            ),
        ),
    );
}

function widget() {
    const elements = document.body.querySelectorAll<HTMLDivElement>(
        '[data-widget-name="Service Notes"]',
    );
    expect(elements).toHaveLength(1);
    return elements[0];
}

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

describe('floating widget modal layer', () => {
    test('a widget opened inside a modal stacks above it though its DOM is outside', async () => {
        await renderPortaledWidget((widgetHost) => (
            <ModalLayerContext value={true}>{widgetHost}</ModalLayerContext>
        ));
        const element = widget();
        expect(host.contains(element)).toBe(false);
        expect(element.parentElement).toBe(document.body);
        expect(element.classList.contains('floating-widget')).toBe(true);
        expect(element.classList.contains(ABOVE_MODAL_CLASS)).toBe(true);
    });

    test('a widget opened outside every modal stays below the modal stack', async () => {
        await renderPortaledWidget((widgetHost) => widgetHost);
        expect(widget().classList.contains('floating-widget')).toBe(true);
        expect(widget().classList.contains(ABOVE_MODAL_CLASS)).toBe(false);

        await renderPortaledWidget((widgetHost) => (
            <ModalLayerContext value={false}>{widgetHost}</ModalLayerContext>
        ));
        expect(widget().classList.contains('floating-widget')).toBe(true);
        expect(widget().classList.contains(ABOVE_MODAL_CLASS)).toBe(false);
    });
});
