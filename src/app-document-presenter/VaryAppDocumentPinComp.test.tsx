// @vitest-environment jsdom

import { act, createContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    selectedContextMock,
    useIsVaryAppDocumentPinnedMock,
    toggleIsVaryAppDocumentPinnedMock,
} = vi.hoisted(() => ({
    selectedContextMock: { current: null as any },
    useIsVaryAppDocumentPinnedMock: vi.fn(() => false),
    toggleIsVaryAppDocumentPinnedMock: vi.fn(),
}));

const PIN_ELEMENT_ID = 'app-vary-app-document-pin';

vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));

vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext: createContext1 } = await import('react');
    return {
        SelectedVaryAppDocumentContext: createContext1<any>(null),
    };
});

vi.mock('../app-document-list/varyAppDocumentLockHelpers', () => ({
    useIsVaryAppDocumentPinned: useIsVaryAppDocumentPinnedMock,
    toggleIsVaryAppDocumentPinned: toggleIsVaryAppDocumentPinnedMock,
    VARY_APP_DOCUMENT_PIN_ELEMENT_ID: PIN_ELEMENT_ID,
}));

describe('VaryAppDocumentPinComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        useIsVaryAppDocumentPinnedMock.mockReturnValue(false);
        selectedContextMock.current = null;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    async function renderPin(
        selectedVaryAppDocument: any,
        onOuterEvent?: () => void,
    ) {
        const { SelectedVaryAppDocumentContext } =
            (await import('../app-document-list/appDocumentHelpers')) as unknown as {
                SelectedVaryAppDocumentContext: ReturnType<
                    typeof createContext
                >;
            };
        const { default: VaryAppDocumentPinComp } =
            await import('./VaryAppDocumentPinComp');
        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext
                    value={{ selectedVaryAppDocument } as any}
                >
                    {/* Stands in for the tab button the pin renders inside. */}
                    <div
                        onClick={onOuterEvent}
                        onContextMenu={onOuterEvent}
                        data-testid="tab-button"
                    >
                        <VaryAppDocumentPinComp />
                    </div>
                </SelectedVaryAppDocumentContext>,
            );
        });
        return container.querySelector(
            `#${PIN_ELEMENT_ID}`,
        ) as HTMLSpanElement | null;
    }

    test('renders nothing when no document is previewed', async () => {
        expect(await renderPin(null)).toBeNull();
    });

    test('renders an open lock while unpinned', async () => {
        const pin = await renderPin({ filePath: '/docs/a1.ows' });

        expect(pin).not.toBeNull();
        // A `span`, not a `button`: it renders inside the tab's own button and
        // the parser would drop a nested one.
        expect(pin?.tagName).toBe('SPAN');
        expect(pin?.getAttribute('aria-pressed')).toBe('false');
        expect(pin?.title).toBe('Pin document');
        expect(pin?.className).not.toContain('app-pinned');
        expect(pin?.querySelector('i')?.className).toBe('bi bi-unlock');
    });

    test('renders a closed lock while pinned and toggles on click', async () => {
        useIsVaryAppDocumentPinnedMock.mockReturnValue(true);
        const pin = await renderPin({ filePath: '/docs/a1.ows' });

        expect(pin?.getAttribute('aria-pressed')).toBe('true');
        expect(pin?.title).toBe('Unpin document');
        expect(pin?.className).toContain('app-pinned');
        expect(pin?.querySelector('i')?.className).toBe('bi bi-lock-fill');

        await act(async () => {
            pin?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(toggleIsVaryAppDocumentPinnedMock).toHaveBeenCalledTimes(1);
    });

    test('swallows the events the enclosing tab button listens for', async () => {
        const outerClick = vi.fn();
        const pin = await renderPin({ filePath: '/docs/a1.ows' }, outerClick);

        await act(async () => {
            pin?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            pin?.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });

        // Otherwise clicking the pin would also toggle the Documents tab, and
        // right-clicking it would solo the tab.
        expect(outerClick).not.toHaveBeenCalled();
        expect(toggleIsVaryAppDocumentPinnedMock).toHaveBeenCalledTimes(2);
    });
});
