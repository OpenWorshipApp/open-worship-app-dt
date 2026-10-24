// @vitest-environment jsdom

import { act, Fragment, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RunItem = {
    uuid: string;
    title: string;
    isDisabled?: boolean;
    isRunReachable?: boolean;
    isAppDocument?: boolean;
    runAction?: { movesRunAtOnce?: boolean };
};

const { state, mocks } = vi.hoisted(() => ({
    state: {
        paths: [] as string[],
        items: {} as Record<string, any>,
        selectedIndex: -1,
        selectedKey: null as string | null,
        collapsedCount: 0,
        autoNext: null as any,
        shortcuts: [] as string[],
        fileEvent: null as null | ((path: unknown) => void),
        keyboard: [] as Array<{
            eventMappers: unknown[];
            callback: (event: any) => void;
        }>,
    },
    mocks: {
        close: vi.fn(),
        select: vi.fn(),
        expand: vi.fn(),
        childStep: vi.fn(() => false),
        requestChild: vi.fn(),
        bringToView: vi.fn(),
        reveal: vi.fn(async () => null),
        send: vi.fn(async () => {}),
        refresh: vi.fn(),
        registerRun: vi.fn(() => vi.fn()),
        registerKeyingArea: vi.fn(() => vi.fn()),
        setCollapsed: vi.fn(),
        setPaused: vi.fn(),
        stopAutoNext: vi.fn(),
        handleAutoHide: vi.fn(),
        handleError: vi.fn(),
        getFileSource: vi.fn((path: string) => ({
            name: path.split('/').at(-1),
        })),
    },
}));

vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({ title, persistKey, options, onClose, children }: any) => (
        <section data-widget={persistKey} data-offset={options.initialOffset}>
            <h2>{title}</h2>
            <button data-testid="close" onClick={onClose}>
                Close
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../app-document-list/appDocumentTypeHelpers', () => ({
    DEFAULT_THUMBNAIL_SIZE_FACTOR: 3,
}));
vi.mock(
    '../app-document-presenter/items/AppDocumentPreviewerFooterComp',
    () => ({ defaultRangeSize: { size: 50 } }),
);
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: (x: number, y: number) =>
        new MouseEvent('click', { clientX: x, clientY: y }),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        eventMappers: unknown[],
        callback: (event: any) => void,
    ) => {
        state.keyboard.push({ eventMappers, callback });
    },
}));
vi.mock('../keyboard-shortcut/appShortcutMappers', () => ({
    presentingFlowNextEventMappers: ['next'],
}));
vi.mock('../keyboard-shortcut/keyingAreaHelpers', () => ({
    KEYING_AREA_PRIORITY: { presentingFlow: 7 },
    registerKeyingArea: mocks.registerKeyingArea,
}));
vi.mock('../event/VaryAppDocumentEventListener', () => ({
    useVarySlideThumbnailSizeScale: () => useState(50),
}));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title, setValue }: any) => (
        <input
            aria-label={title}
            type="range"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
        />
    ),
    useZoomingRegistering: () => {},
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: any) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
    useAppEffect: useEffect,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        _names: string[],
        callback: (path: unknown) => void,
    ) => {
        state.fileEvent = callback;
    },
}));
vi.mock('../helper/domHelpers', () => ({
    handleAutoHide: mocks.handleAutoHide,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: mocks.getFileSource },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/FileReadErrorComp', () => ({
    default: () => <span data-testid="read-error">Read error</span>,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span data-testid="loading">Loading</span>,
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: () => <span data-testid="scroll-top">Top</span>,
}));
vi.mock('./presentingFlowActionKeyHelpers', () => ({
    toPresentingFlowActionKeyEventMapper: (key: string) => `shortcut:${key}`,
}));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    registerPresentingFlowRunController: mocks.registerRun,
    setPresentingFlowAutoNextPaused: mocks.setPaused,
    stopPresentingFlowAutoNext: mocks.stopAutoNext,
    toPresentingFlowAutoNextCountdownLabel: (seconds: number) => `${seconds}s`,
    usePresentingFlowAutoNext: () => state.autoNext,
}));
vi.mock('./presentingFlowHelpers', () => ({
    sendPresentingFlowItemToScreens: mocks.send,
}));
vi.mock('./presentingFlowItemsHelpers', () => ({
    usePresentingFlowItems: (path: string) => state.items[path],
}));
vi.mock('./PresentingFlowItemPreviewComp', () => ({
    default: ({ presentingFlowItem, index, thumbnailWidth }: any) => (
        <button data-preview-index={index} data-width={thumbnailWidth}>
            {presentingFlowItem.title}
        </button>
    ),
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    refreshOnScreenAfterPresenting: mocks.refresh,
}));
vi.mock('./presentingFlowPreviewFloatingHelpers', () => ({
    PRESENTING_FLOW_PREVIEW_ITEM_INDEX_KEY: 'data-preview-index',
    bringPresentingFlowRunElementToView: mocks.bringToView,
    closePresentingFlowPreviewFilePath: mocks.close,
    collectPresentingFlowRunShortcutKeys: () => state.shortcuts,
    expandPresentingFlowPreviewItem: mocks.expand,
    findNextPresentingFlowPreviewIndex: (items: RunItem[], from: number) => {
        const next = items.findIndex(
            (entry, index) => index > from && !entry.isDisabled,
        );
        return next;
    },
    findPresentingFlowRunShortcutUuid: (items: RunItem[], key: string) =>
        items.find((entry) => entry.title === key)?.uuid ?? null,
    getPresentingFlowPreviewSelectedItemKey: () => state.selectedKey,
    requestPresentingFlowPreviewChildEntry: mocks.requestChild,
    resolvePresentingFlowPreviewSelectedIndex: () => state.selectedIndex,
    stepPresentingFlowPreviewChild: mocks.childStep,
    setAllPresentingFlowPreviewItemsCollapsed: mocks.setCollapsed,
    setPresentingFlowPreviewSelectedItem: (
        path: string,
        key: string,
        index: number,
    ) => {
        state.selectedIndex = index;
        state.selectedKey = key;
        mocks.select(path, key, index);
    },
    toPresentingFlowPreviewItemKey: (entry: RunItem) => `key:${entry.uuid}`,
    toPresentingFlowPreviewRectSettingName: (path: string) => `rect:${path}`,
    toPresentingFlowPreviewRevealKey: (
        _path: string,
        _entry: RunItem,
        index: number,
    ) => `reveal:${index}`,
    usePresentingFlowPreviewCollapsedCount: () => state.collapsedCount,
    usePresentingFlowPreviewFilePaths: () => state.paths,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../virtual-list/VirtualListComp', () => ({
    default: ({ items, renderItem }: any) => (
        <div data-testid="virtual-list">
            {items.map((value: any, index: number) => (
                <Fragment key={value.uuid}>{renderItem(value, index)}</Fragment>
            ))}
        </div>
    ),
}));
vi.mock('../virtual-list/virtualRevealHelpers', () => ({
    revealVirtualElement: mocks.reveal,
}));

import PresentingFlowPreviewFloatingComp from './PresentingFlowPreviewFloatingComp';

let root: Root;
let container: HTMLDivElement;

function entry(
    uuid: string,
    title = uuid,
    overrides: Partial<RunItem> = {},
): RunItem {
    return {
        uuid,
        title,
        isDisabled: false,
        isRunReachable: true,
        ...overrides,
    };
}

async function render() {
    await act(async () => root.render(<PresentingFlowPreviewFloatingComp />));
}

function widget(path = '/one') {
    const element = document.querySelector<HTMLElement>(
        `[data-widget="rect:${path}"]`,
    );
    if (element === null) throw new Error(`Missing widget ${path}`);
    return element;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.paths = ['/one'];
    state.items = { '/one': [entry('a', 'Opening'), entry('b', 'Reading')] };
    state.selectedIndex = -1;
    state.selectedKey = null;
    state.collapsedCount = 0;
    state.autoNext = null;
    state.shortcuts = [];
    state.fileEvent = null;
    state.keyboard = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('presenting flow floating preview', () => {
    it('opens independent widgets, staggers their first position, and closes only the chosen file', async () => {
        state.paths = ['/one', '/two'];
        state.items['/two'] = [entry('c')];
        await render();
        expect(widget('/one').getAttribute('data-offset')).toBe('0');
        expect(widget('/two').getAttribute('data-offset')).toBe('24');
        expect(widget('/two').textContent).toContain('Presenting Flow: two');
        expect(widget('/one').getAttribute('data-bs-theme')).toBeNull();
        expect(
            widget('/one')
                .querySelector('[data-preview-index="0"]')
                ?.getAttribute('data-width'),
        ).toBe('150');
        await act(async () =>
            widget('/two')
                .querySelector<HTMLButtonElement>('[data-testid="close"]')!
                .click(),
        );
        expect(mocks.close).toHaveBeenCalledWith('/two');
        expect(mocks.close).not.toHaveBeenCalledWith('/one');
        expect(mocks.registerKeyingArea).toHaveBeenCalledWith(
            expect.objectContaining({ priority: 7 }),
        );
    });

    it('closes a deleted open file but ignores unrelated and malformed delete events', async () => {
        await render();
        expect(state.fileEvent).toBeTypeOf('function');
        state.fileEvent?.('/unrelated');
        state.fileEvent?.(123);
        expect(mocks.close).not.toHaveBeenCalled();
        state.fileEvent?.('/one');
        expect(mocks.close).toHaveBeenCalledExactlyOnceWith('/one');
    });

    it('steps forward only while focused, follows child slides first, and stops at the end', async () => {
        await render();
        const controller = (mocks.registerRun.mock.calls as any[][])[0][1];
        const keyboard = state.keyboard.find(
            (registration) => registration.eventMappers[0] === 'next',
        )!;
        expect(controller.stepForward()).toBe(true);
        expect(mocks.select).toHaveBeenCalledWith('/one', 'key:a', 0);
        expect(mocks.expand).toHaveBeenCalledWith('/one', 'key:a');
        await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
        expect(mocks.send).toHaveBeenCalledWith(
            state.items['/one'][0],
            expect.any(MouseEvent),
        );

        mocks.childStep.mockReturnValueOnce(true);
        expect(controller.stepForward()).toBe(true);
        expect(mocks.select).toHaveBeenCalledTimes(1);
        expect(controller.stepForward()).toBe(true);
        expect(mocks.select).toHaveBeenLastCalledWith('/one', 'key:b', 1);
        expect(controller.stepForward()).toBe(false);

        const outside = document.createElement('button');
        document.body.append(outside);
        outside.focus();
        const preventDefault = vi.fn();
        keyboard.callback({ preventDefault });
        expect(preventDefault).not.toHaveBeenCalled();
        widget()
            .querySelector<HTMLElement>('.app-presenting-flow-preview')!
            .focus();
        keyboard.callback({ preventDefault });
        expect(preventDefault).toHaveBeenCalledOnce();
        outside.remove();
    });

    it('lands a jump by UUID, skips parked targets and avoids recursive jump actions', async () => {
        state.items['/one'] = [
            entry('a', 'Opening'),
            entry('b', 'Jump', { runAction: { movesRunAtOnce: true } }),
            entry('c', 'Parked', { isDisabled: true }),
        ];
        await render();
        const controller = (mocks.registerRun.mock.calls as any[][])[0][1];
        expect(controller.jumpToUuid('missing')).toBe(false);
        expect(controller.jumpToUuid('c')).toBe(false);
        expect(controller.jumpToUuid('b')).toBe(true);
        expect(mocks.select).toHaveBeenCalledWith('/one', 'key:b', 1);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(controller.jumpToUuid('a')).toBe(true);
        await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    });

    it('shows loading, file errors and empty sheets without rendering run rows', async () => {
        state.items['/one'] = undefined;
        await render();
        expect(
            widget().querySelector('[data-testid="loading"]'),
        ).not.toBeNull();
        state.items['/one'] = null;
        await render();
        expect(
            widget().querySelector('[data-testid="read-error"]'),
        ).not.toBeNull();
        state.items['/one'] = [];
        await render();
        expect(widget().textContent).toContain(
            'No items in this presenting flow',
        );
        expect(
            widget().querySelector('[data-testid="virtual-list"]'),
        ).toBeNull();
    });

    it('collapses the sheet, resumes an interval, and stops the auto-next clock', async () => {
        state.autoNext = {
            mode: 'interval',
            remainingSeconds: 5,
            isPaused: false,
        };
        await render();
        expect(widget().textContent).toContain('5s');
        expect(
            widget().querySelector(
                '.app-presenting-flow-preview-auto-next-interval',
            ),
        ).not.toBeNull();
        expect(
            widget().querySelector<HTMLButtonElement>(
                '[aria-label="Expand All"]',
            )?.disabled,
        ).toBe(true);
        await act(async () =>
            widget()
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Collapse All"]',
                )!
                .click(),
        );
        expect(mocks.setCollapsed).toHaveBeenCalledWith(
            '/one',
            ['key:a', 'key:b'],
            true,
        );
        state.collapsedCount = 2;
        state.autoNext = {
            mode: 'interval',
            remainingSeconds: 4,
            isPaused: true,
        };
        await render();
        await act(async () =>
            widget()
                .querySelector<HTMLButtonElement>('[aria-label="Expand All"]')!
                .click(),
        );
        expect(mocks.setCollapsed).toHaveBeenCalledWith(
            '/one',
            ['key:a', 'key:b'],
            false,
        );
        await act(async () =>
            widget()
                .querySelector<HTMLButtonElement>('[title="Resume Auto Next"]')!
                .click(),
        );
        expect(mocks.setPaused).toHaveBeenCalledWith('/one', false);
        await act(async () =>
            widget()
                .querySelector<HTMLButtonElement>('[title="Stop Auto Next"]')!
                .click(),
        );
        expect(mocks.stopAutoNext).toHaveBeenCalledWith('/one');
    });
});
