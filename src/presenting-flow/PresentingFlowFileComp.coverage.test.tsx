// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        handlerProps: null as any,
        items: [] as any,
        payload: null as any,
        previewOpen: false,
    },
    mocks: {
        addItem: vi.fn(),
        addAction: vi.fn(),
        fireUpdate: vi.fn(),
        setOpened: vi.fn(),
        showMenu: vi.fn(),
        createEvent: vi.fn(),
        askArming: vi.fn(),
        askScreens: vi.fn(),
        exportFlow: vi.fn(),
        openPreview: vi.fn(),
        togglePreview: vi.fn(),
        toast: vi.fn(),
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
        useAppEffect: React.useEffect,
    };
});
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: (path: string) => ({ name: `name:${path}` }) },
}));
vi.mock('../helper/settingHelpers', async () => {
    const React = await import('react');
    return {
        useStateSettingBoolean: () => {
            const [value, setValue] = React.useState(true);
            return [
                value,
                (next: boolean) => {
                    mocks.setOpened(next);
                    setValue(next);
                },
            ] as const;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/FileItemHandlerComp', () => ({
    default: (props: any) => {
        state.handlerProps = props;
        return (
            <article>
                {props.fileData === undefined
                    ? null
                    : props.renderChild?.(props.fileData)}
            </article>
        );
    },
}));
vi.mock('../others/FileReadErrorComp', () => ({
    default: () => <span>read-error</span>,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span>loading</span>,
}));
vi.mock('./PresentingFlow', () => ({
    default: {
        getInstance: (path: string) => ({
            filePath: path,
            fileSource: { fireUpdateEvent: mocks.fireUpdate },
            addItem: mocks.addItem,
            addActionItem: mocks.addAction,
        }),
    },
}));
vi.mock('./presentingFlowActionHelpers', () => {
    const screen = {
        id: 'screen-show',
        label: 'Screen',
        iconName: 'screen',
        color: 'green',
        target: 'screen',
        requiresScreenIds: true,
    };
    const run = {
        id: 'next-timeout',
        label: 'Timeout',
        iconName: 'clock',
        color: 'orange',
        target: 'run',
        number: {},
        canBeKeyArmed: false,
    };
    const jump = {
        id: 'jump-to',
        label: 'Jump',
        iconName: 'jump',
        color: 'purple',
        target: 'run',
        number: null,
        canBeKeyArmed: false,
    };
    return {
        checkIsPresentingFlowActionGroup: (entry: any) =>
            Array.isArray(entry.actionList),
        presentingFlowActionMenuList: [
            {
                label: 'Group',
                iconName: 'folder',
                color: 'gray',
                actionList: [
                    screen,
                    {
                        label: 'Nested',
                        iconName: 'folder',
                        color: 'gray',
                        actionList: [run],
                    },
                ],
            },
            jump,
        ],
    };
});
vi.mock('./presentingFlowActionArmingHelpers', () => ({
    askForPresentingFlowActionArming: mocks.askArming,
    askForPresentingFlowActionScreenIds: mocks.askScreens,
}));
vi.mock('./presentingFlowArchiveHelpers', () => ({
    exportPresentingFlow: mocks.exportFlow,
}));
vi.mock('./presentingFlowItemsHelpers', () => ({
    usePresentingFlowItems: () => state.items,
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    checkIsPresentingFlowFilePathOnScreen: vi.fn(),
}));
vi.mock('./PresentingFlowItemComp', () => ({
    default: ({ presentingFlowItem }: any) => (
        <div>{presentingFlowItem.title}</div>
    ),
}));
vi.mock('./presentingFlowHelpers', () => ({
    extractDropPayload: () => state.payload,
    presentingFlowDraggingStore: { current: null as any },
    toPresentingFlowSettingName: (...parts: string[]) => parts.join(':'),
    UNSUPPORTED_DROP_PAYLOAD: 'unsupported',
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./presentingFlowPreviewFloatingHelpers', () => ({
    openPresentingFlowPreviewFilePath: mocks.openPreview,
    togglePresentingFlowPreviewFilePath: mocks.togglePreview,
    toPresentingFlowPreviewRevealKey: (
        _path: string,
        item: any,
        index: number,
    ) => item.uuid ?? `fallback-${index}`,
    useIsPresentingFlowPreviewOpened: () => state.previewOpen,
}));
vi.mock('../virtual-list/VirtualListComp', () => ({
    default: ({ items, renderItem, getItemKey }: any) => (
        <div>
            {items.map((one: any, index: number) => (
                <div key={getItemKey(one, index)}>{renderItem(one, index)}</div>
            ))}
        </div>
    ),
}));

import {
    presentingFlowDraggingStore,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import PresentingFlowFileComp from './PresentingFlowFileComp';

async function render() {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
        root.render(<PresentingFlowFileComp index={2} filePath="/run.owpf" />),
    );
    await act(async () => {
        await Promise.resolve();
    });
    return { root, container };
}

beforeEach(() => {
    vi.clearAllMocks();
    state.handlerProps = null;
    state.items = [];
    state.payload = null;
    state.previewOpen = false;
    presentingFlowDraggingStore.current = null;
    mocks.addItem.mockResolvedValue(true);
    mocks.addAction.mockResolvedValue(true);
    mocks.askArming.mockResolvedValue({ actionNumber: 5 });
    mocks.askScreens.mockResolvedValue([2]);
    mocks.createEvent.mockReturnValue({ synthetic: true });
});

describe('PresentingFlowFileComp', () => {
    test('loads the model, renders empty and populated sheets, and reloads without replacing it', async () => {
        state.items = [];
        const rendered = await render();
        expect(rendered.container.textContent).toContain('Drop items here');
        expect(state.handlerProps).toMatchObject({
            index: 2,
            filePath: '/run.owpf',
            isSelected: true,
        });
        state.handlerProps.reload();
        expect(mocks.fireUpdate).toHaveBeenCalled();
        state.items = [
            { uuid: 'u', title: 'First' },
            { uuid: null, title: 'Second' },
        ];
        await act(async () =>
            rendered.root.render(
                <PresentingFlowFileComp index={2} filePath="/run.owpf" />,
            ),
        );
        expect(rendered.container.textContent).toContain('First');
        expect(rendered.container.textContent).toContain('Second');
        await act(async () => rendered.root.unmount());
    });

    test('toggles the tree and floating preview from the rendered header', async () => {
        const rendered = await render();
        const header = rendered.container.querySelector(
            '.app-presenting-flow-header',
        ) as HTMLElement;
        header.click();
        expect(mocks.setOpened).toHaveBeenCalledWith(false);
        const preview = rendered.container.querySelector(
            '.bi-window-stack',
        ) as HTMLElement;
        preview.click();
        expect(mocks.togglePreview).toHaveBeenCalledWith('/run.owpf');
        await act(async () => rendered.root.unmount());
    });

    test('handles external drops and rejects unsupported or internal drags', async () => {
        const rendered = await render();
        const event = {};
        await state.handlerProps.onDrop(event);
        state.payload = UNSUPPORTED_DROP_PAYLOAD;
        await state.handlerProps.onDrop(event);
        expect(mocks.toast).toHaveBeenCalled();
        state.payload = {
            droppedData: { type: 'slide' },
            dragData: { raw: true },
        };
        presentingFlowDraggingStore.current = { filePath: '/run', index: 0 };
        await state.handlerProps.onDrop(event);
        expect(mocks.addItem).not.toHaveBeenCalled();
        presentingFlowDraggingStore.current = null;
        await state.handlerProps.onDrop(event);
        expect(mocks.addItem).toHaveBeenCalledWith(
            state.payload.droppedData,
            state.payload.dragData,
        );
        expect(mocks.setOpened).toHaveBeenCalledWith(true);
        mocks.addItem.mockResolvedValueOnce(false);
        await state.handlerProps.onDrop(event);
        await act(async () => rendered.root.unmount());
    });

    test('opens preview, exports, and recursively builds all action menus', async () => {
        const rendered = await render();
        const menu = state.handlerProps.contextMenuItems;
        menu[0].onSelect();
        menu[2].onSelect();
        expect(mocks.openPreview).toHaveBeenCalledWith('/run.owpf');
        expect(mocks.exportFlow).toHaveBeenCalled();
        const event = { stopPropagation: vi.fn(), clientX: 5, clientY: 6 };
        menu[1].onSelect(event);
        const topActions = mocks.showMenu.mock.calls.at(-1)![1];
        topActions[0].onSelect(event);
        expect(mocks.createEvent).toHaveBeenCalledWith(5, 6);
        const groupActions = mocks.showMenu.mock.calls.at(-1)![1];
        await groupActions[0].onSelect();
        expect(mocks.askScreens).toHaveBeenCalled();
        expect(mocks.addAction).toHaveBeenCalledWith(
            'screen-show',
            undefined,
            undefined,
            [2],
        );
        groupActions[1].onSelect(event);
        const nestedActions = mocks.showMenu.mock.calls.at(-1)![1];
        await nestedActions[0].onSelect();
        expect(mocks.askArming).toHaveBeenCalled();
        expect(mocks.addAction).toHaveBeenCalledWith(
            'next-timeout',
            { actionNumber: 5 },
            undefined,
            undefined,
        );
        await topActions[1].onSelect();
        expect(mocks.addAction).toHaveBeenCalledWith(
            'jump-to',
            undefined,
            undefined,
            undefined,
        );
        await act(async () => rendered.root.unmount());
    });

    test('cancellation prevents adding armed actions', async () => {
        const rendered = await render();
        state.handlerProps.contextMenuItems[1].onSelect({
            stopPropagation: vi.fn(),
        });
        const topActions = mocks.showMenu.mock.calls.at(-1)![1];
        topActions[0].onSelect({
            stopPropagation: vi.fn(),
            clientX: 0,
            clientY: 0,
        });
        const groupActions = mocks.showMenu.mock.calls.at(-1)![1];
        mocks.askScreens.mockResolvedValueOnce(null);
        await groupActions[0].onSelect();
        groupActions[1].onSelect({
            stopPropagation: vi.fn(),
            clientX: 0,
            clientY: 0,
        });
        const nested = mocks.showMenu.mock.calls.at(-1)![1];
        mocks.askArming.mockResolvedValueOnce(null);
        await nested[0].onSelect();
        expect(mocks.addAction).not.toHaveBeenCalled();
        await act(async () => rendered.root.unmount());
    });
});
