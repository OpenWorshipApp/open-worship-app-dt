// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        rows: [] as any[],
        payload: null as any,
        mediaAnswer: null as any,
        arming: null as any,
    },
    mocks: {
        showMenu: vi.fn(),
        createEvent: vi.fn(),
        handleError: vi.fn(),
        origin: vi.fn(),
        askArming: vi.fn(),
        askMedia: vi.fn(),
    },
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: mocks.createEvent,
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon-${name}`,
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
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/FileItemHandlerComp', () => ({
    genRevealOriginal: (callback: () => void) => ({
        menuElement: 'Reveal Original',
        onSelect: callback,
    }),
}));
vi.mock('./PresentingFlowItem', () => ({
    default: {
        checkIsCcTargetHost: (json: any) => json.target === true,
        resolveCcItemJson: (json: any, isTarget: boolean) =>
            json.refused && !isTarget ? null : json,
    },
}));
vi.mock('./presentingFlowActionArmingHelpers', () => ({
    askForPresentingFlowActionArming: (...args: any[]) =>
        mocks.askArming(...args),
}));
vi.mock('./presentingFlowHelpers', () => ({
    extractDropPayload: () => state.payload,
    presentingFlowDraggingStore: { current: null as any },
    UNSUPPORTED_DROP_PAYLOAD: 'unsupported',
}));
vi.mock('./presentingFlowMediaControlDialogHelpers', () => ({
    askForPresentingFlowMediaControl: (...args: any[]) =>
        mocks.askMedia(...args),
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    checkIsPresentingFlowItemOnScreen: vi.fn(),
    toPresentingFlowItemOnScreenKey: () => 'key',
    useIsOnScreenChecking: () => false,
}));
vi.mock('./presentingFlowOriginHelpers', () => ({
    notifyPresentingFlowCcOrigin: mocks.origin,
}));
vi.mock('./PresentingFlowRowComp', () => ({
    default: (props: any) => {
        state.rows.push(props);
        return (
            <div data-testid="cc-row" onClick={props.onClick}>
                {props.label}
                {props.extraChild}
            </div>
        );
    },
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    default: ({ screenIds }: any) => <span>{screenIds.join(',')}</span>,
    genSetSpecificScreenContextMenu: (
        _ids: number[],
        set: (ids: number[]) => void,
    ) => [{ menuElement: 'Set Specific Screen', onSelect: () => set([3]) }],
}));

import {
    presentingFlowDraggingStore,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import PresentingFlowCcRowsComp, {
    genAddCcElementsContextMenu,
    genAddMediaControlContextMenu,
    genCcItemContextMenuItems,
} from './PresentingFlowCcRowsComp';

function model() {
    return {
        filePath: '/run',
        getItems: vi.fn(),
        addItemCcFromItemIndex: vi.fn(async () => true),
        addItemCcAction: vi.fn(async () => true),
        setItemCcItemActionArming: vi.fn(async () => true),
        setItemCcItemMediaControl: vi.fn(async () => true),
        setItemCcItemScreenIds: vi.fn(async () => true),
        moveItemCcItemToIndex: vi.fn(async () => true),
        removeItemCcItemAtIndex: vi.fn(async () => true),
        addItemCcFromDroppedData: vi.fn(async () => true),
    } as any;
}

function item(overrides: Record<string, unknown> = {}) {
    return {
        uuid: 'uuid',
        isError: false,
        iconName: 'x',
        iconColor: undefined,
        title: 'Item',
        idLabel: '#1',
        action: null,
        runAction: null,
        canBeCcArmed: false,
        hasOwnActionArming: false,
        isScreenPinnable: false,
        screenIds: [],
        mediaControl: null,
        actionArming: {},
        extraStyle: {},
        toJson: () => ({}),
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.rows = [];
    state.payload = null;
    mocks.createEvent.mockReturnValue({ synthetic: true });
    mocks.askMedia.mockResolvedValue(null);
    mocks.askArming.mockResolvedValue(null);
    presentingFlowDraggingStore.current = null;
});

describe('CC menus and rows', () => {
    test('builds the add submenu, filters invalid/self rows, and attaches by index', async () => {
        const presentingFlow = model();
        presentingFlow.getItems.mockResolvedValue([
            item({ uuid: 'host', title: 'Host' }),
            item({ uuid: 'bad', isError: true }),
            item({
                uuid: 'refused',
                title: 'Refused',
                toJson: () => ({ refused: true }),
            }),
            item({ uuid: 'valid', title: 'Valid' }),
        ]);
        const host = { presentingFlow, index: 0, slideId: null };
        const event = { stopPropagation: vi.fn(), clientX: 4, clientY: 5 };
        genAddCcElementsContextMenu(host, 'host')[0].onSelect?.(event as any);
        await vi.waitFor(() => expect(mocks.showMenu).toHaveBeenCalled());
        expect(mocks.createEvent).toHaveBeenCalledWith(4, 5);
        const submenu = mocks.showMenu.mock.calls.at(-1)![1];
        expect(submenu.map((one: any) => one.menuElement)).toEqual([
            '4. Valid',
        ]);
        submenu[0].onSelect();
        expect(presentingFlow.addItemCcFromItemIndex).toHaveBeenCalledWith(
            0,
            null,
            '/run',
            3,
        );

        presentingFlow.getItems.mockResolvedValue([]);
        genAddCcElementsContextMenu(host, null)[0].onSelect?.(event as any);
        await vi.waitFor(() => expect(mocks.showMenu).toHaveBeenCalledTimes(2));
        expect(mocks.showMenu.mock.calls.at(-1)![1][0]).toMatchObject({
            menuElement: 'No other elements',
            disabled: true,
        });
    });

    test('adds and edits media controls with optional screen pins', async () => {
        const presentingFlow = model();
        const host = { presentingFlow, index: 2, slideId: 7 };
        mocks.askMedia.mockResolvedValueOnce({
            mediaControl: { mode: 'play' },
            screenIds: [3],
        });
        genAddMediaControlContextMenu(host)[0].onSelect?.({
            stopPropagation: vi.fn(),
        } as any);
        await vi.waitFor(() =>
            expect(presentingFlow.addItemCcAction).toHaveBeenCalledWith(
                2,
                7,
                'slide-media-control',
                { mediaControl: { mode: 'play' }, screenIds: [3] },
            ),
        );
        mocks.askMedia.mockResolvedValueOnce({
            mediaControl: { mode: 'pause' },
            screenIds: [],
        });
        genAddMediaControlContextMenu(host)[0].onSelect?.({
            stopPropagation: vi.fn(),
        } as any);
        await vi.waitFor(() =>
            expect(presentingFlow.addItemCcAction).toHaveBeenLastCalledWith(
                2,
                7,
                'slide-media-control',
                { mediaControl: { mode: 'pause' } },
            ),
        );
    });

    test('builds and executes the full CC item menu', async () => {
        const presentingFlow = model();
        const host = { presentingFlow, index: 2, slideId: null };
        const cc = item({
            action: { id: 'slide-media-control' },
            runAction: { canBeTimeArmed: true },
            canBeCcArmed: true,
            hasOwnActionArming: true,
            isScreenPinnable: true,
            screenIds: [1],
        });
        mocks.askMedia.mockResolvedValueOnce({
            mediaControl: { mode: 'stop' },
            screenIds: [2],
        });
        mocks.askArming.mockResolvedValueOnce({ actionNumber: 6 });
        const menu = genCcItemContextMenuItems(host, cc, 1, 3);
        expect(menu.map((one) => one.menuElement)).toEqual([
            'Reveal Original',
            'Media Control Settings',
            'Change Timing',
            'Use Element Timing',
            'Set Specific Screen',
            'Move up',
            'Move down',
            'Remove CC Element',
        ]);
        for (const one of menu) one.onSelect?.({} as any);
        await vi.waitFor(() =>
            expect(presentingFlow.setItemCcItemMediaControl).toHaveBeenCalled(),
        );
        await vi.waitFor(() =>
            expect(
                presentingFlow.setItemCcItemActionArming,
            ).toHaveBeenCalledWith(2, null, 1, { actionNumber: 6 }),
        );
        expect(presentingFlow.setItemCcItemActionArming).toHaveBeenCalledWith(
            2,
            null,
            1,
            null,
        );
        expect(presentingFlow.setItemCcItemScreenIds).toHaveBeenCalledWith(
            2,
            null,
            1,
            [3],
        );
        expect(presentingFlow.moveItemCcItemToIndex).toHaveBeenCalledWith(
            2,
            null,
            1,
            0,
        );
        expect(presentingFlow.moveItemCcItemToIndex).toHaveBeenCalledWith(
            2,
            null,
            1,
            2,
        );
        expect(presentingFlow.removeItemCcItemAtIndex).toHaveBeenCalledWith(
            2,
            null,
            1,
        );
        expect(mocks.origin).toHaveBeenCalledWith(cc);
    });

    test('renders rows and handles clicks, context menus, settings, and drops', async () => {
        const presentingFlow = model();
        const host = { presentingFlow, index: 2, slideId: 9 };
        const cc = item({
            title: 'Follower',
            action: { id: 'slide-media-control' },
            runAction: { canBeTimeArmed: false },
            canBeCcArmed: true,
            hasOwnActionArming: true,
            screenIds: [2],
            isScreenPinnable: true,
        });
        const container = document.createElement('div');
        const root = createRoot(container);
        await act(async () =>
            root.render(
                <PresentingFlowCcRowsComp
                    host={host}
                    ccItems={[cc]}
                    depth={2}
                />,
            ),
        );
        const props = state.rows[0];
        const clickEvent = {
            stopPropagation: vi.fn(),
            preventDefault: vi.fn(),
        };
        props.onClick(clickEvent);
        props.onContextMenu(clickEvent);
        expect(mocks.showMenu).toHaveBeenCalled();
        const icons = container.querySelectorAll(
            '.app-presenting-flow-row-settings-icon',
        );
        (icons[0] as HTMLElement).click();
        (icons[1] as HTMLElement).click();
        props.onDragOver(clickEvent);
        props.onDragLeave();

        presentingFlowDraggingStore.current = { filePath: '/other', index: 4 };
        await props.onDrop(clickEvent);
        expect(presentingFlow.addItemCcFromItemIndex).toHaveBeenCalledWith(
            2,
            9,
            '/other',
            4,
        );
        presentingFlowDraggingStore.current = null;
        state.payload = null;
        await props.onDrop(clickEvent);
        state.payload = UNSUPPORTED_DROP_PAYLOAD;
        await props.onDrop(clickEvent);
        state.payload = {
            droppedData: { type: 'slide' },
            dragData: { raw: true },
        };
        await props.onDrop(clickEvent);
        expect(presentingFlow.addItemCcFromDroppedData).toHaveBeenCalledWith(
            2,
            9,
            state.payload.droppedData,
            state.payload.dragData,
        );
        await act(async () => root.unmount());
    });

    test('renders nothing for an empty follower list', async () => {
        const container = document.createElement('div');
        const root = createRoot(container);
        await act(async () =>
            root.render(
                <PresentingFlowCcRowsComp
                    host={{ presentingFlow: model(), index: 0, slideId: null }}
                    ccItems={[]}
                    depth={1}
                />,
            ),
        );
        expect(container.innerHTML).toBe('');
        await act(async () => root.unmount());
    });
});
