// @vitest-environment jsdom

// The resize actors end to end: the REAL `ResizeActorComp` with its pane
// renderer, divider, collapsed strip, size helpers and widget registry, over a
// settings store mocked in this file -- so every test reads what a layout
// change WROTE and what a remount reads back, not just what it drew.

import { Component, type ReactNode, act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    showAppContextMenu: vi.fn(),
    checkMediaPlaying: vi.fn(),
    handleError: vi.fn(),
    showAppConfirm: vi.fn(),
    setAppMenuItems: vi.fn(),
    registerAppMenuClicked: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => mocks.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        mocks.settings.set(key, value);
    },
    removeSettingsByPrefix: async (prefix: string) => {
        const removed = [...mocks.settings.keys()].filter((key) => {
            return key === prefix || key.startsWith(`${prefix}-`);
        });
        for (const key of removed) {
            mocks.settings.delete(key);
        }
        return removed;
    },
    toFilePathSettingName: (prefix: string, filePath: string) => {
        return `${prefix}-${filePath}`;
    },
}));
vi.mock('../helper/helpers', () => ({
    freezeObject: (value: any) => {
        Object.freeze(value);
    },
    parseJsonSafely: (json: any) => {
        if (!json) {
            return null;
        }
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    setAppMenuItems: mocks.setAppMenuItems,
    registerAppMenuClicked: mocks.registerAppMenuClicked,
}));
vi.mock('../helper/mediaControlHelpers', () => ({
    checkMediaPlaying: mocks.checkMediaPlaying,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: any) => children,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirm,
}));

import ResizeActorComp from './ResizeActorComp';
import ResizeActorDynamicComp from './ResizeActorDynamicComp';
import { WidgetMenuExcludedContext } from './widgetMenuContext';
import {
    getWidgetEntries,
    resetAllWidgets,
    toggleWidget,
} from './widgetRegistry';
import type { DataInputType, FlexSizeType } from './flexSizeHelpers';
// Loaded for its dev-only window hooks, the View menu a CDP run can reach.
import './widgetAppMenuHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NAME = 'harness';

function genDefaults(): FlexSizeType {
    return { a: ['1'], b: ['2'], c: ['1'] };
}

function BetaBodyComp() {
    return <span>beta body</span>;
}

function genDataInput(): DataInputType[] {
    return [
        {
            children: { render: () => <span>alpha body</span> },
            key: 'a',
            widgetName: 'Alpha',
            widgetKey: 'Alpha Pane',
            widgetIconName: 'list',
            className: 'pane-a',
        },
        {
            // A bare component, mounted as `<Children />` in a suspense
            // boundary, where the others go through `render()`.
            children: BetaBodyComp as any,
            key: 'b',
            widgetName: 'Beta',
            isOnScreen: true,
        },
        {
            children: { render: () => <span>gamma body</span> },
            key: 'c',
            widgetName: 'Gamma',
            extraStyle: { color: 'red' },
        },
    ];
}

let container: HTMLDivElement;
let root: Root;
let pendingFrames = new Map<number, FrameRequestCallback>();
let lastFrameId = 0;

beforeEach(() => {
    mocks.settings.clear();
    mocks.checkMediaPlaying.mockReturnValue(false);
    mocks.registerAppMenuClicked.mockReturnValue(() => {});
    pendingFrames = new Map();
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
        lastFrameId += 1;
        pendingFrames.set(lastFrameId, frame);
        return lastFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (frameId: number) => {
        pendingFrames.delete(frameId);
    });
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

function toStored(name = NAME) {
    const text = mocks.settings.get(`widget-size-${name}`);
    return text === undefined ? undefined : JSON.parse(text);
}

function renderActor(
    overrides: Partial<Parameters<typeof ResizeActorComp>[0]> = {},
) {
    const props = {
        isHorizontal: true,
        flexSizeName: NAME,
        flexSizeDefault: genDefaults(),
        dataInput: genDataInput(),
        ...overrides,
    };
    act(() => {
        root.render(<ResizeActorComp {...props} />);
    });
    return props;
}

// The multi-pane row, wherever it sits; a lone pane is the first child.
function getActorNode() {
    return (container.querySelector('.flex.h, .flex.v') ??
        container.firstElementChild) as HTMLElement;
}

// The actor's row as words: a pane by its key, a divider as `|`, a strip
// by its name in brackets.
function describeRow(name = NAME) {
    return Array.from(getActorNode().children).map((node) => {
        const element = node as HTMLElement;
        if (element.classList.contains('flex-resize-actor')) {
            return '|';
        }
        if (element.dataset['fs'] !== undefined) {
            return element.dataset['fs'].replace(`${name}-`, '');
        }
        return `[${element.textContent}]`;
    });
}

function getPane(key: string, name = NAME) {
    return container.querySelector(`[data-fs="${name}-${key}"]`) as HTMLElement;
}

function getDividers() {
    return Array.from(
        container.querySelectorAll<HTMLElement>('.flex-resize-actor'),
    );
}

function getStrip(text: string) {
    return Array.from(
        container.querySelectorAll<HTMLElement>('[role="button"]'),
    ).find((node) => node.textContent === text) as HTMLElement;
}

function toGrows(name = NAME) {
    return Object.fromEntries(
        Array.from(
            getActorNode().querySelectorAll<HTMLElement>(':scope > [data-fs]'),
        ).map((node) => {
            return [
                node.dataset['fs']!.replace(`${name}-`, ''),
                node.style.flexGrow,
            ];
        }),
    );
}

// jsdom lays nothing out: every pane answers with the same fixed size.
function setPaneSizes(size = 300) {
    for (const node of getActorNode().children) {
        for (const property of ['offsetWidth', 'offsetHeight']) {
            Object.defineProperty(node, property, {
                value: size,
                configurable: true,
            });
        }
    }
}

function drag(divider: HTMLElement, from: number, to: number) {
    act(() => {
        divider.dispatchEvent(
            new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: from,
            }),
        );
        document.body.dispatchEvent(
            new MouseEvent('mousemove', { bubbles: true, clientX: to }),
        );
    });
    act(() => {
        document.body.dispatchEvent(
            new MouseEvent('mouseup', { bubbles: true }),
        );
    });
}

function openDividerMenu(divider: HTMLElement) {
    act(() => {
        divider.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });
    const menuItems = mocks.showAppContextMenu.mock.calls.at(-1)?.[1];
    return (label: string) => {
        const item = menuItems.find((menuItem: any) => {
            return menuItem.menuElement === label;
        });
        act(() => {
            item.onSelect();
        });
    };
}

function pressKey(target: HTMLElement, key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

describe('ResizeActorComp reads and writes its layout setting', () => {
    test('nothing stored: the defaults are written and the panes laid out from them', () => {
        renderActor();
        expect(toStored()).toEqual(genDefaults());
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(getActorNode().className).toBe(
            'w-100 h-100 flex h app-overflow-hidden',
        );
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
        const paneA = getPane('a');
        expect(paneA.dataset['widgetName']).toBe('Alpha Pane');
        expect(paneA.dataset['fsDefault']).toBe('1');
        expect(paneA.dataset['minSize']).toBe('50');
        expect(paneA.className).toBe('pane-a app-overflow-hidden');
        expect(getPane('b').dataset['widgetName']).toBe('Beta');
        expect(getPane('c').style.color).toBe('red');
        expect(getActorNode().textContent).toBe(
            'alpha bodybeta bodygamma body',
        );
        expect(
            getDividers().map((node) => node.getAttribute('aria-label')),
        ).toEqual([
            'Divider between Alpha Pane and Beta',
            'Divider between Beta and Gamma',
        ]);
    });

    test('a stored layout is read back, with grows summing under one doubled', () => {
        const stored = JSON.stringify({
            a: ['0.2'],
            b: ['0.2'],
            c: ['0.1'],
        });
        mocks.settings.set(`widget-size-${NAME}`, stored);
        renderActor();
        expect(toGrows()).toEqual({ a: '0.4', b: '0.4', c: '0.2' });
        // Reading repairs what it hands the panes, not what is stored.
        expect(mocks.settings.get(`widget-size-${NAME}`)).toBe(stored);
    });

    test('a stored layout of other panes is replaced by the defaults', () => {
        mocks.settings.set(
            `widget-size-${NAME}`,
            JSON.stringify({ x: ['1'], y: ['1'] }),
        );
        renderActor();
        expect(toStored()).toEqual(genDefaults());
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
    });

    test('a drag stores the dragged sizes and a remount reads them back', () => {
        renderActor();
        setPaneSizes();
        drag(getDividers()[0], 100, 250);
        // 300/300 of a combined grow of 3 -> 450/150.
        expect(toStored()).toEqual({
            a: ['2.25 1 0%'],
            b: ['0.75 1 0%'],
            c: ['1 1 0%'],
        });
        act(() => {
            root.render(<div />);
        });
        renderActor();
        expect(toGrows()).toEqual({ a: '2.25', b: '0.75', c: '1' });
    });

    test('isNotSaveSetting lays out from the defaults and stores no drag', () => {
        const stored = JSON.stringify({ a: ['3'], b: ['3'], c: ['3'] });
        mocks.settings.set(`widget-size-${NAME}`, stored);
        renderActor({ isNotSaveSetting: true });
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
        setPaneSizes();
        drag(getDividers()[0], 100, 250);
        expect(toGrows()).toEqual({ a: '2.25', b: '0.75', c: '1' });
        expect(mocks.settings.get(`widget-size-${NAME}`)).toBe(stored);
    });

    test('a new flexSizeName re-reads that name during the same render', () => {
        mocks.settings.set(
            'widget-size-doc-two',
            JSON.stringify({ a: ['3'], b: ['1'], c: ['1'] }),
        );
        renderActor({ flexSizeName: 'doc-one' });
        expect(toGrows('doc-one')).toEqual({ a: '1', b: '2', c: '1' });
        renderActor({ flexSizeName: 'doc-two' });
        expect(describeRow('doc-two')).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows('doc-two')).toEqual({ a: '3', b: '1', c: '1' });
        expect(toStored('doc-one')).toEqual(genDefaults());
    });

    test('a pane renamed in place gets its default and the stale key is dropped', () => {
        renderActor();
        const renamed = genDataInput();
        renamed[2] = { ...renamed[2], key: 'd' };
        renderActor({
            flexSizeDefault: { a: ['1'], b: ['2'], d: ['4'] },
            dataInput: renamed,
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'd']);
        expect(toGrows()).toEqual({ a: '1', b: '2', d: '4' });
        expect(toStored()).toEqual({ a: ['1'], b: ['2'], d: ['4'] });
    });

    test('no pane renders nothing, and one pane renders alone with no divider', () => {
        renderActor({ dataInput: [] });
        expect(container.innerHTML).toBe('');
        renderActor({
            dataInput: [genDataInput()[0]],
            containerStyle: { backgroundColor: 'black' },
        });
        const single = getActorNode();
        expect(single.className).toBe('w-100 h-100 app-overflow-hidden');
        expect(single.style.backgroundColor).toBe('black');
        expect(single.textContent).toBe('alpha body');
        expect(container.querySelectorAll('[data-fs]')).toHaveLength(0);
        expect(getDividers()).toHaveLength(0);
    });

    test('a pane whose key has no default is refused while rendering', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        class CatchComp extends Component<
            { children: ReactNode },
            { message: string | null }
        > {
            state = { message: null as string | null };
            static getDerivedStateFromError(error: Error) {
                return { message: error.message };
            }
            render() {
                return this.state.message ?? this.props.children;
            }
        }
        const dataInput = genDataInput();
        dataInput[1] = { ...dataInput[1], key: 'z' };
        act(() => {
            root.render(
                <CatchComp>
                    <ResizeActorComp
                        isHorizontal
                        flexSizeName={NAME}
                        flexSizeDefault={genDefaults()}
                        dataInput={dataInput}
                    />
                </CatchComp>,
            );
        });
        expect(container.textContent).toBe(
            'key z not found in flexSizeDefault:' +
                JSON.stringify(genDefaults()),
        );
    });
});

describe('collapsing a pane and opening it again', () => {
    test('dragging a pane closed swaps it for its strip and stores who took its space', () => {
        renderActor();
        setPaneSizes();
        drag(getDividers()[0], 300, -100);
        expect(toStored()).toEqual({
            a: ['0 1 0%', ['first', 1]],
            b: ['3 1 0%'],
            c: ['1 1 0%'],
        });
        expect(describeRow()).toEqual(['[Alpha]', 'b', '|', 'c']);
        const strip = getStrip('Alpha');
        expect(strip.tabIndex).toBe(0);
        expect(strip.title).toBe('Enable Alpha');
        expect(strip.dataset['widgetName']).toBe('Alpha Pane');
        expect(strip.className).toBe(
            'active-app-hidden-widget app-hidden-widget bar-type-h',
        );
        expect(strip.querySelector('i')?.className).toBe('bi bi-list px-1');
        expect(
            getWidgetEntries().map(({ id, isHidden }) => [id, isHidden]),
        ).toEqual([
            [`${NAME}::a`, true],
            [`${NAME}::b`, false],
            [`${NAME}::c`, false],
        ]);
    });

    test("the divider's Close First Widget, then Enter on the strip, puts the grows back", () => {
        renderActor();
        setPaneSizes();
        openDividerMenu(getDividers()[0])('Close First Widget');
        expect(toStored()).toEqual({
            a: ['1 1 0%', ['first', 1]],
            b: ['3 1 0%'],
            c: ['1 1 0%'],
        });
        const strip = getStrip('Alpha');
        expect(pressKey(strip, 'a').defaultPrevented).toBe(false);
        expect(describeRow()).toEqual(['[Alpha]', 'b', '|', 'c']);

        const event = pressKey(strip, 'Enter');
        expect(event.defaultPrevented).toBe(true);
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
        expect(toStored()).toEqual({
            a: ['1 1 0%', null],
            b: ['2 1 0%'],
            c: ['1 1 0%'],
        });
    });

    test('an arrow on the divider collapses the second pane and Space on its strip reopens it', () => {
        renderActor();
        setPaneSizes();
        const arrows = getDividers()[1].querySelectorAll('img');
        expect(Array.from(arrows).map((img) => img.title)).toEqual([
            'Collapse left panel',
            'Collapse right panel',
        ]);
        act(() => {
            arrows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '[Gamma]']);
        expect(toStored().c).toEqual(['1 1 0%', ['second', 1]]);
        expect(toGrows()).toEqual({ a: '1', b: '3' });

        pressKey(getStrip('Gamma'), ' ');
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
    });

    test('reopening never shrinks the sibling below a tenth of its grow', () => {
        renderActor();
        setPaneSizes();
        openDividerMenu(getDividers()[0])('Close First Widget');
        // Shrunk by hand since: giving back the closed pane's 1 would leave
        // it at -0.5.
        getPane('b').style.flexGrow = '0.5';
        act(() => {
            getStrip('Alpha').click();
        });
        expect(toGrows()).toEqual({ a: '1', b: '0.5', c: '1' });
    });

    test('a divider beside a collapsed strip resizes the panes beyond it', () => {
        renderActor();
        setPaneSizes();
        // The menu closes the middle pane onto the one after it.
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        expect(describeRow()).toEqual(['a', '[Beta]', '|', 'c']);
        expect(toStored().b).toEqual(['2 1 0%', ['first', 2]]);
        expect(toGrows()).toEqual({ a: '1', c: '3' });
        setPaneSizes();
        drag(getDividers()[0], 100, 250);
        // a and c share 1 + 3 over 600px: 450/150.
        expect(toGrows()).toEqual({ a: '3', c: '1' });
    });

    // 2026-11-04: reopened, a middle pane took its space back from the
    // strip's own neighbour -- the divider -- so the pane after it kept what
    // it had been given, and grew again at every reopening.
    test('a middle pane reopened takes its space back from the pane that took it', () => {
        renderActor({ flexSizeDefault: { a: ['1'], b: ['3'], c: ['2'] } });
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        expect(describeRow()).toEqual(['a', '[Beta]', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', c: '5' });
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        expect(toGrows()).toEqual({ a: '1', b: '3', c: '2' });
        // Closed and opened again, by the menu and by the strip: the same.
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        act(() => {
            getStrip('Beta').click();
        });
        expect(toGrows()).toEqual({ a: '1', b: '3', c: '2' });
    });

    // 2026-11-04: a pane dragged shut was stored at the size it was dragged
    // to and opened again at it -- flex 0, open and nowhere to be seen.
    test('a pane dragged shut opens again at the size it had before the drag', () => {
        renderActor();
        setPaneSizes();
        drag(getDividers()[0], 300, -100);
        expect(describeRow()).toEqual(['[Alpha]', 'b', '|', 'c']);
        act(() => {
            getStrip('Alpha').click();
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
    });

    // 2026-11-04: with the first of four panes collapsed, a divider stood
    // after its strip with no pane before it, and pressing it threw.
    test('no divider stands between a collapsed first pane and the rest', () => {
        renderActor({
            flexSizeDefault: { a: ['1'], b: ['1'], c: ['1'], d: ['1'] },
            dataInput: [
                ...genDataInput(),
                {
                    children: { render: () => <span>delta body</span> },
                    key: 'd',
                    widgetName: 'Delta',
                },
            ],
        });
        act(() => {
            toggleWidget(`${NAME}::a`);
        });
        expect(describeRow()).toEqual(['[Alpha]', 'b', '|', 'c', '|', 'd']);
    });

    // 2026-11-04: a divider taken away in the middle of a drag left its
    // window listeners behind, and every move after it threw.
    test('a divider unmounted mid-drag lets go of the window', () => {
        renderActor();
        setPaneSizes();
        act(() => {
            getDividers()[0].dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 100,
                }),
            );
        });
        act(() => {
            root.render(<div />);
        });
        const errorList: string[] = [];
        const listenError = (event: ErrorEvent) => {
            errorList.push(event.message);
            event.preventDefault();
        };
        globalThis.addEventListener('error', listenError);
        try {
            document.body.dispatchEvent(
                new MouseEvent('mousemove', { bubbles: true, clientX: 150 }),
            );
            document.body.dispatchEvent(
                new MouseEvent('mouseup', { bubbles: true }),
            );
        } finally {
            globalThis.removeEventListener('error', listenError);
        }
        expect(errorList).toEqual([]);
    });

    // 2026-11-04: a fixed group's divider still offered Close First / Second
    // Widget, and the pane closed with no strip to open it again -- only View
    // → Reset Widgets Size brought it back.
    test("a fixed group's divider offers Reset Size alone", () => {
        renderActor({ isDisableQuickResize: true });
        act(() => {
            getDividers()[0].dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const menuItems = mocks.showAppContextMenu.mock.calls.at(-1)?.[1];
        expect(
            menuItems.map((item: { menuElement: string }) => {
                return item.menuElement;
            }),
        ).toEqual(['Reset Size']);
    });

    test('a strip says when its pane is on screen', () => {
        renderActor();
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        const strip = getStrip('Beta');
        expect(strip.classList.contains('app-hidden-widget-on-screen')).toBe(
            true,
        );
        expect(strip.firstElementChild?.className).toBe(
            'hidden-context app-on-screen',
        );
        expect(strip.querySelector('i')).toBeNull();
    });
});

describe('the View → Widgets menu drives the same panes', () => {
    test('each pane is listed and toggles closed and back open', () => {
        renderActor();
        expect(
            getWidgetEntries().map(({ id, widgetName, isHidden }) => {
                return [id, widgetName, isHidden];
            }),
        ).toEqual([
            [`${NAME}::a`, 'Alpha', false],
            [`${NAME}::b`, 'Beta', false],
            [`${NAME}::c`, 'Gamma', false],
        ]);
        act(() => {
            toggleWidget(`${NAME}::c`);
        });
        // The last pane hands its grow BACK to the one before it.
        expect(describeRow()).toEqual(['a', '|', 'b', '[Gamma]']);
        expect(toStored().c).toEqual(['1 1 0%', ['second', 1]]);
        expect(toGrows()).toEqual({ a: '1', b: '3' });
        act(() => {
            toggleWidget(`${NAME}::c`);
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
    });

    test('a pane playing media stays open', () => {
        renderActor();
        mocks.checkMediaPlaying.mockReturnValue(true);
        act(() => {
            toggleWidget(`${NAME}::a`);
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(mocks.checkMediaPlaying).toHaveBeenCalledWith({
            targetElement: getPane('a'),
            includeYouTube: true,
        });
        expect(toStored()).toEqual(genDefaults());
    });

    test('the last pane standing has nowhere to go and stays', () => {
        renderActor();
        act(() => {
            toggleWidget(`${NAME}::a`);
        });
        act(() => {
            toggleWidget(`${NAME}::c`);
        });
        expect(describeRow()).toEqual(['[Alpha]', 'b', '[Gamma]']);
        const stored = mocks.settings.get(`widget-size-${NAME}`);
        act(() => {
            toggleWidget(`${NAME}::b`);
        });
        expect(describeRow()).toEqual(['[Alpha]', 'b', '[Gamma]']);
        expect(mocks.settings.get(`widget-size-${NAME}`)).toBe(stored);
    });

    test('panes in a floating widget or a fixed group are not listed', () => {
        act(() => {
            root.render(
                <WidgetMenuExcludedContext value={true}>
                    <ResizeActorComp
                        isHorizontal
                        flexSizeName={NAME}
                        flexSizeDefault={genDefaults()}
                        dataInput={genDataInput()}
                    />
                </WidgetMenuExcludedContext>,
            );
        });
        expect(getWidgetEntries()).toEqual([]);
        renderActor({ isDisableQuickResize: true });
        expect(getWidgetEntries()).toEqual([]);
        // No arrows either: a fixed group never collapses by a press.
        expect(container.querySelectorAll('img')).toHaveLength(0);
    });

    test('a fixed group keeps a pane stored as closed on screen, with no strip', () => {
        mocks.settings.set(
            `widget-size-${NAME}`,
            JSON.stringify({ a: ['1', ['first', 1]], b: ['2'], c: ['1'] }),
        );
        renderActor({ isDisableQuickResize: true });
        expect(getPane('a').textContent).toBe('alpha body');
        expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    });

    test('the dev hooks list the menu and toggle a pane by id', () => {
        renderActor();
        const items = (globalThis as any).getViewWidgetMenuItems();
        expect(items[0].submenu.map((item: any) => item.label)).toEqual([
            'Alpha',
            'Beta',
            'Gamma',
        ]);
        act(() => {
            expect((globalThis as any).tryToggleWidget(`${NAME}::a`)).toBe(
                true,
            );
        });
        expect(describeRow()).toEqual(['[Alpha]', 'b', '|', 'c']);
        expect((globalThis as any).tryToggleWidget('nobody::x')).toBe(false);
    });
});

describe('resetting every widget', () => {
    test('a reset puts the dragged panes and the stored layout back to the defaults', () => {
        renderActor();
        setPaneSizes();
        drag(getDividers()[0], 100, 250);
        act(() => {
            toggleWidget(`${NAME}::c`);
        });
        act(() => {
            resetAllWidgets();
        });
        expect(describeRow()).toEqual(['a', '|', 'b', '|', 'c']);
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
        expect(toStored()).toEqual(genDefaults());
    });

    test('Reset Widgets Size clears every stored size once confirmed', async () => {
        mocks.settings.set('widget-size-other-page', '{"x":["1"]}');
        mocks.settings.set('unrelated', 'kept');
        renderActor();
        setPaneSizes();
        drag(getDividers()[0], 100, 250);

        mocks.showAppConfirm.mockResolvedValue(false);
        await act(async () => {
            await (globalThis as any).tryResetWidgetsSize();
        });
        expect(mocks.settings.has('widget-size-other-page')).toBe(true);
        expect(toGrows()).toEqual({ a: '2.25', b: '0.75', c: '1' });

        mocks.showAppConfirm.mockResolvedValue(true);
        await act(async () => {
            await (globalThis as any).tryResetWidgetsSize();
        });
        expect(mocks.showAppConfirm).toHaveBeenLastCalledWith(
            'Reset Widgets Size',
            'Are you sure to reset every widget size and reopen the widgets?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(mocks.settings.has('widget-size-other-page')).toBe(false);
        expect(mocks.settings.get('unrelated')).toBe('kept');
        expect(toStored()).toEqual(genDefaults());
        expect(toGrows()).toEqual({ a: '1', b: '2', c: '1' });
    });

    test('an unmounted actor answers no reset and lists no widget', () => {
        renderActor();
        act(() => {
            root.render(<div />);
        });
        expect(getWidgetEntries()).toEqual([]);
        mocks.settings.clear();
        act(() => {
            resetAllWidgets();
        });
        expect(mocks.settings.size).toBe(0);
    });
});

describe('ResizeActorDynamicComp', () => {
    let observerCallback: ResizeObserverCallback | null = null;
    const disconnect = vi.fn();
    const observe = vi.fn();

    beforeEach(() => {
        observerCallback = null;
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: ResizeObserverCallback) {
                    observerCallback = callback;
                }
                observe = observe;
                disconnect = disconnect;
            },
        );
    });

    function genDynamicData() {
        const toInput = (keys: string[]): DataInputType[] => {
            return keys.map((key) => {
                return {
                    children: { render: () => <span>{key} body</span> },
                    key,
                    widgetName: `Pane ${key}`,
                };
            });
        };
        return {
            minWidth: 500,
            horizontal: {
                flexSizeDefault: { h1: ['1'], h2: ['1'] } as FlexSizeType,
                dataInput: toInput(['h1', 'h2']),
            },
            vertical: {
                flexSizeDefault: { v1: ['1'], v2: ['1'] } as FlexSizeType,
                dataInput: toInput(['v1', 'v2']),
            },
        };
    }

    function resizeTo(width: number) {
        act(() => {
            observerCallback?.(
                width < 0
                    ? []
                    : ([
                          { contentRect: { width } },
                      ] as any as ResizeObserverEntry[]),
                {} as ResizeObserver,
            );
        });
    }

    test('lays out across when wide enough and down when not, each under its own name', () => {
        act(() => {
            root.render(
                <ResizeActorDynamicComp
                    flexSizeName="dyn"
                    data={genDynamicData()}
                />,
            );
        });
        const host = container.firstElementChild as HTMLElement;
        // jsdom measures 0px wide: below the 500px minimum.
        expect(host.style.visibility).toBe('visible');
        expect(observe).toHaveBeenCalledWith(host);
        expect(container.querySelector('.flex.v')).not.toBeNull();
        expect(describeRow('dyn-dyn-v')).toEqual(['v1', '|', 'v2']);
        expect(toStored('dyn-dyn-v')).toEqual({ v1: ['1'], v2: ['1'] });

        resizeTo(800);
        expect(container.querySelector('.flex.h')).not.toBeNull();
        expect(getPane('h1', 'dyn-dyn-h')).not.toBeNull();
        expect(getPane('v1', 'dyn-dyn-v')).toBeNull();

        // An empty report changes nothing.
        resizeTo(-1);
        expect(container.querySelector('.flex.h')).not.toBeNull();

        const disconnectCount = disconnect.mock.calls.length;
        act(() => {
            root.render(<div />);
        });
        expect(disconnect).toHaveBeenCalledTimes(disconnectCount + 1);
    });

    test('a pane closed across is closed down as well, and opening it opens both', () => {
        mocks.settings.set(
            'widget-size-dyn-dyn-h',
            JSON.stringify({ h1: ['1', ['first', 1]], h2: ['2'] }),
        );
        act(() => {
            root.render(
                <ResizeActorDynamicComp
                    flexSizeName="dyn"
                    data={genDynamicData()}
                />,
            );
        });
        // Down, the first pane closes at mount to match.
        expect(describeRow('dyn-dyn-v')).toEqual(['[Pane v1]', 'v2']);
        expect(toStored('dyn-dyn-v').v1[1]).toEqual(['first', 1]);

        act(() => {
            getStrip('Pane v1').click();
        });
        expect(describeRow('dyn-dyn-v')).toEqual(['v1', '|', 'v2']);
        // ... and the pane it stood for across is opened in the setting.
        expect(toStored('dyn-dyn-h').h1[1]).toBeNull();
    });

    test('a second pane closed across closes the second pane down', () => {
        mocks.settings.set(
            'widget-size-dyn-dyn-h',
            JSON.stringify({ h1: ['1'], h2: ['1', ['second', 1]] }),
        );
        act(() => {
            root.render(
                <ResizeActorDynamicComp
                    flexSizeName="dyn"
                    data={genDynamicData()}
                    isNotSaveSetting
                />,
            );
        });
        expect(describeRow('dyn-dyn-v')).toEqual(['v1', '[Pane v2]']);
    });
});
