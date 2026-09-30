// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        rowProps: null as any,
        slidesProps: null as any,
        payload: null as any,
        dropKind: 'cc' as 'cc' | 'position',
    },
    mocks: {
        showMenu: vi.fn(),
        openDocument: vi.fn(),
        screenDrop: vi.fn(),
        send: vi.fn(),
        refresh: vi.fn(),
        origin: vi.fn(),
        contextItems: vi.fn(() => [{ menuElement: 'menu' }]),
    },
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/dragHelpers', () => ({
    dragStore: { onDropped: null as any },
}));
vi.mock('../helper/settingHelpers', async () => {
    const React = await import('react');
    return {
        useStateSettingBoolean: (_key: string, initial: boolean) =>
            React.useState(initial),
    };
});
vi.mock('./PresentingFlowCcRowsComp', () => ({
    default: (props: any) => <div data-testid="cc">{props.ccItems.length}</div>,
}));
vi.mock('./PresentingFlowDocumentSlidesComp', () => ({
    default: (props: any) => {
        state.slidesProps = props;
        return <div data-testid="slides">{props.filePath}</div>;
    },
}));
vi.mock('./presentingFlowDocumentHelpers', () => ({
    useVaryAppDocumentOpener: () => mocks.openDocument,
}));
vi.mock('./presentingFlowHelpers', () => ({
    extractDropPayload: () => state.payload,
    handlePresentingFlowItemScreenDropping: mocks.screenDrop,
    presentingFlowDraggingStore: { current: null as any },
    toPresentingFlowRowDropKind: () => state.dropKind,
    sendPresentingFlowItemToScreens: mocks.send,
    toPresentingFlowSettingName: (...parts: string[]) => parts.join(':'),
    UNSUPPORTED_DROP_PAYLOAD: 'unsupported',
}));
vi.mock('./presentingFlowItemMenuHelpers', () => ({
    genPresentingFlowItemContextMenuItems: mocks.contextItems,
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    checkIsPresentingFlowItemOnScreen: vi.fn(),
    refreshOnScreenAfterPresenting: mocks.refresh,
    toPresentingFlowItemOnScreenKey: () => 'key',
    useIsOnScreenChecking: () => false,
}));
vi.mock('./presentingFlowOriginHelpers', () => ({
    notifyPresentingFlowItemOrigin: mocks.origin,
}));
vi.mock('./presentingFlowPreviewFloatingHelpers', () => ({
    toPresentingFlowPreviewItemKey: () => 'preview-key',
    usePresentingFlowPreviewIsItemSelected: () => true,
}));
vi.mock('./PresentingFlowRowComp', () => ({
    default: (props: any) => {
        state.rowProps = props;
        return (
            <button data-testid="row" onClick={props.onClick}>
                {props.label}
                {props.extraChild}
            </button>
        );
    },
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    default: ({ screenIds }: any) => <span>{screenIds.join(',')}</span>,
}));

import { dragStore } from '../helper/dragHelpers';
import {
    presentingFlowDraggingStore,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import PresentingFlowItemComp from './PresentingFlowItemComp';

function model() {
    return {
        filePath: '/run',
        moveItemToIndex: vi.fn(),
        addItemCcFromItemIndex: vi.fn(),
        addItem: vi.fn(),
        addItemCcFromDroppedData: vi.fn(),
        setItemSlideScreenIds: vi.fn(),
        setItemSlideDisabled: vi.fn(),
    } as any;
}

function item(overrides: Record<string, unknown> = {}) {
    return {
        isAppDocument: false,
        isDisabled: false,
        isAudio: false,
        isAction: false,
        itemFilePath: '/item',
        title: 'Item',
        uuid: 'uuid',
        idLabel: '#1',
        iconName: 'x',
        iconColor: undefined,
        colorNote: null,
        screenIds: [],
        isError: false,
        extraStyle: {},
        hasCcItems: false,
        ccItems: [],
        getSlideScreenIds: vi.fn(() => [1]),
        getOwnSlideScreenIds: vi.fn(() => []),
        checkIsVarySlideDisabled: vi.fn(() => false),
        checkIsOwnSlideDisabled: vi.fn(() => false),
        checkIsSlideDisabled: vi.fn(() => false),
        ...overrides,
    } as any;
}

async function render(itemValue = item(), modelValue = model()) {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
        root.render(
            <PresentingFlowItemComp
                presentingFlow={modelValue}
                presentingFlowItem={itemValue}
                index={1}
                itemCount={3}
            />,
        ),
    );
    return { root, container, itemValue, modelValue };
}

function event(overrides: Record<string, unknown> = {}) {
    return {
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
        dataTransfer: { setData: vi.fn() },
        currentTarget: {
            getBoundingClientRect: () => ({ top: 0, height: 30 }),
        },
        clientY: 15,
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.rowProps = null;
    state.slidesProps = null;
    state.payload = null;
    state.dropKind = 'cc';
    presentingFlowDraggingStore.current = null;
    dragStore.onDropped = null;
});

describe('PresentingFlowItemComp interactions', () => {
    test('renders pins, CCs, document slides, and toggles expansion', async () => {
        const rendered = await render(
            item({
                isAppDocument: true,
                screenIds: [2],
                hasCcItems: true,
                ccItems: [{ uuid: 'c' }],
            }),
        );
        expect(rendered.container.textContent).toContain('2');
        expect(
            rendered.container.querySelector('[data-testid="cc"]'),
        ).not.toBeNull();
        expect(
            rendered.container.querySelector('[data-testid="slides"]'),
        ).toBeNull();
        await act(async () => state.rowProps.onToggleExpanding());
        expect(
            rendered.container.querySelector('[data-testid="slides"]'),
        ).not.toBeNull();
        expect(state.slidesProps.resolveScreenIds(3)).toEqual([1]);
        expect(state.slidesProps.resolveOwnScreenIds(3)).toEqual([]);
        state.slidesProps.setSlideScreenIds(3, [2]);
        expect(rendered.modelValue.setItemSlideScreenIds).toHaveBeenCalledWith(
            1,
            3,
            [2],
        );
        expect(state.slidesProps.resolveIsSlideDisabled({ id: 3 })).toBe(false);
        expect(state.slidesProps.resolveIsOwnSlideDisabled(3)).toBe(false);
        expect(state.slidesProps.resolveIsPresentingFlowSlideDisabled(3)).toBe(
            false,
        );
        state.slidesProps.setSlideDisabled(3, true);
        expect(rendered.modelValue.setItemSlideDisabled).toHaveBeenCalledWith(
            1,
            3,
            true,
        );
        await act(async () => rendered.root.unmount());
    });

    test('routes clicks for parked, document, audio, and presentable entries', async () => {
        for (const [value, expected] of [
            [item({ isDisabled: true }), 'parked'],
            [item({ isAppDocument: true }), 'document'],
            [item({ isAudio: true }), 'audio'],
            [item(), 'screen'],
        ] as const) {
            const rendered = await render(value);
            await state.rowProps.onClick(event());
            if (expected === 'document')
                expect(mocks.openDocument).toHaveBeenCalledWith('/item');
            if (expected === 'audio')
                expect(mocks.origin).toHaveBeenCalledWith(value);
            if (expected === 'screen') {
                expect(mocks.send).toHaveBeenCalledWith(
                    value,
                    expect.anything(),
                );
                expect(mocks.refresh).toHaveBeenCalled();
            }
            await act(async () => rendered.root.unmount());
            vi.clearAllMocks();
        }
    });

    test('starts and ends drags while preserving reorder identity', async () => {
        const entry = item();
        const rendered = await render(entry);
        const start = event();
        state.rowProps.onDragStart(start);
        expect(presentingFlowDraggingStore.current).toEqual({
            filePath: '/run',
            index: 1,
        });
        expect(dragStore.onDropped).toEqual(expect.any(Function));
        expect(start.dataTransfer.setData).toHaveBeenCalledWith('text', 'Item');
        state.rowProps.onDragEnd();
        expect(presentingFlowDraggingStore.current).toBeNull();
        expect(dragStore.onDropped).toBeNull();
        await act(async () => rendered.root.unmount());

        const parked = await render(item({ isDisabled: true }));
        state.rowProps.onDragStart(event());
        expect(dragStore.onDropped).toBeNull();
        await act(async () => parked.root.unmount());
    });

    test('moves or attaches another listed item and ignores invalid row drags', async () => {
        const rendered = await render();
        const e = event();
        presentingFlowDraggingStore.current = { filePath: '/other', index: 0 };
        await state.rowProps.onDragOver(e);
        await state.rowProps.onDrop(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
        presentingFlowDraggingStore.current = { filePath: '/run', index: 1 };
        await state.rowProps.onDragOver(e);
        await state.rowProps.onDrop(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
        presentingFlowDraggingStore.current = { filePath: '/run', index: 0 };
        await state.rowProps.onDragOver(e);
        state.rowProps.onDragLeave();
        state.dropKind = 'position';
        await state.rowProps.onDrop(e);
        expect(rendered.modelValue.moveItemToIndex).toHaveBeenCalledWith(0, 1);
        state.dropKind = 'cc';
        await state.rowProps.onDrop(e);
        expect(rendered.modelValue.addItemCcFromItemIndex).toHaveBeenCalledWith(
            1,
            null,
            '/run',
            0,
        );
        await act(async () => rendered.root.unmount());
    });

    test('inserts or attaches external payloads and lets unreadable drops bubble', async () => {
        const rendered = await render();
        const e = event();
        state.payload = null;
        await state.rowProps.onDrop(e);
        state.payload = UNSUPPORTED_DROP_PAYLOAD;
        await state.rowProps.onDrop(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
        state.payload = {
            dragData: { raw: true },
            droppedData: { type: 'slide' },
        };
        state.dropKind = 'position';
        await state.rowProps.onDrop(e);
        expect(rendered.modelValue.addItem).toHaveBeenCalledWith(
            state.payload.droppedData,
            state.payload.dragData,
            1,
        );
        state.dropKind = 'cc';
        await state.rowProps.onDrop(e);
        expect(
            rendered.modelValue.addItemCcFromDroppedData,
        ).toHaveBeenCalledWith(
            1,
            null,
            state.payload.droppedData,
            state.payload.dragData,
        );
        await act(async () => rendered.root.unmount());
    });

    test('opens the shared context menu with current values', async () => {
        const rendered = await render();
        const e = event();
        state.rowProps.onContextMenu(e);
        expect(mocks.contextItems).toHaveBeenCalledWith(
            rendered.modelValue,
            rendered.itemValue,
            1,
            3,
        );
        expect(mocks.showMenu).toHaveBeenCalledWith(e, [
            { menuElement: 'menu' },
        ]);
        await act(async () => rendered.root.unmount());
    });
});
