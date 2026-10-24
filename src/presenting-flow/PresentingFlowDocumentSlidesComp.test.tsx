// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    slides: undefined as any,
    rowProps: [] as any[],
    show: vi.fn(),
    arm: vi.fn(),
    refresh: vi.fn(),
    menu: vi.fn(),
    drag: vi.fn(),
    load: vi.fn(),
    payload: null as any,
    draggingStore: { current: null as any },
}));

vi.mock('../helper/appHooks', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: () => [fake.slides, vi.fn()],
    };
});
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: () => {},
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    showDroppedDataOnScreens: fake.show,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsVarySlideOnScreen: () => false,
}));
vi.mock('../helper/dragHelpers', () => ({ handleDragStart: fake.drag }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: fake.menu,
}));
vi.mock('./presentingFlowDocumentHelpers', () => ({
    loadVaryAppDocumentSlides: fake.load,
}));
vi.mock('./presentingFlowCcApplyHelpers', () => ({
    armPresentingFlowCcPropagation: fake.arm,
}));
vi.mock('./presentingFlowHelpers', () => ({
    extractDropPayload: () => fake.payload,
    presentingFlowDraggingStore: fake.draggingStore,
    toDragTypeIconName: () => 'file',
    UNSUPPORTED_DROP_PAYLOAD: 'unsupported',
}));
vi.mock('./presentingFlowItemMenuHelpers', () => ({
    genPresentingFlowVarySlideContextMenuItems: () => ['menu'],
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    refreshOnScreenAfterPresenting: fake.refresh,
    useIsOnScreenChecking: () => false,
}));
vi.mock('./PresentingFlowRowComp', () => ({
    default: (props: any) => {
        fake.rowProps.push(props);
        return (
            <button
                data-testid="slide-row"
                onClick={props.onClick}
                onContextMenu={props.onContextMenu}
                draggable
                onDragStart={props.onDragStart}
                onDragOver={props.onDragOver}
                onDragLeave={props.onDragLeave}
                onDrop={props.onDrop}
            >
                {props.label}
                {props.extraChild}
            </button>
        );
    },
}));
vi.mock('./PresentingFlowCcRowsComp', () => ({
    default: ({ ccItems }: any) => (
        <span data-testid="cc">{ccItems.length}</span>
    ),
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    default: ({ screenIds }: any) => <span>{screenIds.join(',')}</span>,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span>Loading slides</span>,
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: () => null, setItem: () => {} },
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import PresentingFlowDocumentSlidesComp from './PresentingFlowDocumentSlidesComp';

const slide = {
    id: 7,
    filePath: '/song',
    dragType: 'vary-slide',
    name: 'Opening song',
    isDisabled: false,
};

describe('presenting-flow document slides', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        fake.slides = undefined;
        fake.rowProps = [];
        fake.payload = null;
        fake.draggingStore.current = null;
        for (const fn of [
            fake.show,
            fake.arm,
            fake.refresh,
            fake.menu,
            fake.drag,
            fake.load,
        ]) {
            fn.mockReset();
        }
        fake.show.mockResolvedValue(undefined);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function render(extra: Record<string, unknown> = {}) {
        fake.rowProps = [];
        act(() =>
            root.render(
                <PresentingFlowDocumentSlidesComp
                    filePath="/song"
                    depth={2}
                    {...extra}
                />,
            ),
        );
    }

    test('shows distinct loading, read-error and empty states', () => {
        render();
        expect(container.textContent).toContain('Loading slides');
        fake.slides = null;
        render();
        expect(container.textContent).toContain('Fail to read file data');
        fake.slides = [];
        render();
        expect(container.textContent).toContain('No slides');
    });

    test('presents a slide on its resolved screens and marks only its own pin', async () => {
        fake.slides = [slide];
        render({
            resolveScreenIds: () => [2],
            resolveOwnScreenIds: () => [4],
        });
        expect(container.textContent).toContain('Opening song');
        expect(container.textContent).toContain('4');
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>('[data-testid="slide-row"]')!
                .click();
        });
        expect(fake.arm).toHaveBeenCalled();
        expect(fake.show).toHaveBeenCalledWith(
            expect.anything(),
            { type: 'vary-slide', item: slide },
            false,
            [2],
        );
        expect(fake.refresh).toHaveBeenCalledOnce();
    });

    test('parked slides cannot present or start a drag', async () => {
        fake.slides = [slide];
        render({ resolveIsSlideDisabled: () => true });
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>('[data-testid="slide-row"]')!
                .click();
        });
        expect(fake.show).not.toHaveBeenCalled();
        const event = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        });
        act(() =>
            container
                .querySelector('[data-testid="slide-row"]')!
                .dispatchEvent(event),
        );
        expect(event.defaultPrevented).toBe(true);
        expect(fake.drag).not.toHaveBeenCalled();
    });

    test('enabled slides drag and expose their scoped menu', () => {
        fake.slides = [slide];
        render();
        const row = container.querySelector('[data-testid="slide-row"]')!;
        act(() => row.dispatchEvent(new Event('dragstart', { bubbles: true })));
        expect(fake.drag).toHaveBeenCalledWith(expect.anything(), slide);
        act(() =>
            row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
        );
        expect(fake.menu).toHaveBeenCalledWith(expect.anything(), ['menu']);
    });

    test('drops a dragged entry and a file onto the slide as CCs', async () => {
        fake.slides = [slide];
        const addFromItem = vi.fn().mockResolvedValue(undefined);
        const addFromData = vi.fn().mockResolvedValue(undefined);
        render({
            slideCcHost: {
                presentingFlow: {
                    addItemCcFromItemIndex: addFromItem,
                    addItemCcFromDroppedData: addFromData,
                },
                index: 2,
                presentingFlowItem: {
                    hasSlideCcItems: true,
                    hasCcItems: true,
                    getSlideCcItems: () => [{ id: 'cc' }],
                    getEffectiveSlideCcItems: () => [{ id: 'cc' }],
                },
            },
        });
        expect(container.querySelector('[data-testid="cc"]')?.textContent).toBe(
            '1',
        );
        const row = container.querySelector('[data-testid="slide-row"]')!;
        fake.draggingStore.current = { filePath: '/other', index: 5 };
        await act(async () => {
            row.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
        });
        expect(addFromItem).toHaveBeenCalledWith(2, 7, '/other', 5);

        fake.draggingStore.current = null;
        fake.payload = { droppedData: { type: 'image' }, dragData: { id: 8 } };
        await act(async () => {
            row.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
        });
        expect(addFromData).toHaveBeenCalledWith(
            2,
            7,
            { type: 'image' },
            { id: 8 },
        );
    });
});
