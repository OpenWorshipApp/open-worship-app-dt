// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    neighbours: [] as {
        kind: string;
        recordId: string;
        name: string;
        relation: string;
    }[],
    verses: [] as string[],
    menu: [] as any[],
    details: [] as unknown[],
    copies: [] as { text: string; title: string }[],
    toasts: [] as unknown[],
    imageSaves: [] as unknown[][],
    prints: [] as unknown[][],
    mermaid: [] as unknown[],
    fits: [] as unknown[][],
    graphSvgOptions: [] as unknown[],
    neighbourReads: 0,
    neighbourError: null as Error | null,
    handleError: vi.fn(),
    frames: new Map<number, FrameRequestCallback>(),
    nextFrameId: 0,
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../app-modal/floatingWidgetHelpers', () => ({
    isBlankDragArea: (target: Element) =>
        target.closest('button, input, textarea, select') === null,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/helpers', () => ({
    mapInYieldingBatches: async <T, R>(
        items: T[],
        read: (item: T) => Promise<R>,
    ) => Promise.all(items.map(read)),
}));
vi.mock('../helper/mermaidLiveHelpers', () => ({
    MERMAID_LIVE_LABEL: 'Open in Mermaid Live',
    openMermaidLiveEditor: async (text: string) => {
        h.mermaid.push(text);
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../location-name-lookup/detailPanelHelpers', () => ({
    openDetailPanel: (data: unknown) => h.details.push(data),
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => true,
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: (text: string, title: string) =>
        h.copies.push({ text, title }),
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({ elementDivider: null }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    APP_CONTEXT_MENU_ID: 'app-context-menu-container',
    showAppContextMenu: (_event: unknown, items: any[]) => {
        h.menu = items;
    },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: (...args: unknown[]) => h.toasts.push(args),
}));
vi.mock('./graphFitHelpers', () => ({
    fitGraphOnScreen: (...args: unknown[]) => h.fits.push(args),
}));
vi.mock('./graphExportHelpers', () => ({
    buildGraphSvg: (options: unknown) => {
        h.graphSvgOptions.push(options);
        return '<svg>graph</svg>';
    },
    COPY_MARKDOWN_LABEL: 'Copy as Markdown',
    genCanvasTextMeasure: () => () => 20,
    loadGraphExportFonts: async () => undefined,
    PRINT_PALETTE: {},
    printGraph: (...args: unknown[]) => h.prints.push(args),
    saveGraphImage: async (...args: unknown[]) => {
        h.imageSaves.push(args);
    },
}));
vi.mock('./graphTextExportHelpers', () => ({
    buildGraphDiagram: (_options: unknown, format: string) =>
        `diagram:${format}`,
    buildGraphMarkdown: () => '# Graph',
    GRAPH_DIAGRAM_FORMAT_LIST: [{ key: 'mermaid', title: 'Copy Mermaid' }],
}));
vi.mock('./GraphEdgeLayerComp', () => ({
    default: ({ edgeList, resolveLabel }: any) => (
        <svg className="graph-view__edges">
            {edgeList.map((edge: any) => {
                const resolved = resolveLabel(edge);
                return (
                    <g key={edge.key}>
                        <path data-edge-key={edge.key} d="initial-path" />
                        {resolved.label ? (
                            <text data-edge-label-for={edge.key} x="0" y="0">
                                {resolved.label}
                            </text>
                        ) : null}
                        {resolved.isDirected ? (
                            <path
                                data-edge-arrow-for={edge.key}
                                transform="initial-arrow"
                            />
                        ) : null}
                    </g>
                );
            })}
        </svg>
    ),
}));
vi.mock('./GraphNodeBoxComp', () => ({
    default: ({ node, callbacks }: any) => (
        <div
            className="graph-view__node"
            data-node-key={node.key}
            onPointerDown={(event) => callbacks.onPointerDown(event, node.key)}
        >
            <span>{node.name}</span>
            <button
                type="button"
                onClick={() =>
                    callbacks.onExpand(new MouseEvent('click'), node.key)
                }
            >
                Expand {node.name}
            </button>
            <button
                type="button"
                onClick={() => callbacks.onOpenDetail(node.key)}
            >
                Detail {node.name}
            </button>
            <button
                type="button"
                onClick={() =>
                    callbacks.onOpenVerses(new MouseEvent('click'), node.key)
                }
            >
                Verses {node.name}
            </button>
            <button
                type="button"
                onClick={() =>
                    callbacks.onContextMenu(
                        new MouseEvent('contextmenu'),
                        node.key,
                    )
                }
            >
                Menu {node.name}
            </button>
            <button
                type="button"
                onClick={() => callbacks.onToggleCollapsed(node.key)}
            >
                Collapse {node.name}
            </button>
        </div>
    ),
}));
vi.mock('./GraphDockComp', () => ({
    default: (props: any) => (
        <div className="graph-view__dock">
            <button type="button" onClick={() => props.onFitToView()}>
                Fit graph
            </button>
            <button type="button" onClick={props.onRelayout}>
                Relayout graph
            </button>
            <button type="button" onClick={props.onUndo}>
                Undo graph
            </button>
            <button type="button" onClick={props.onRedo}>
                Redo graph
            </button>
        </div>
    ),
}));
vi.mock('./GraphToolbarComp', () => ({
    default: (props: any) => (
        <div className="graph-view__toolbar">
            <button type="button" onClick={props.onSaveImage}>
                Save graph
            </button>
            <button type="button" onClick={props.onPrint}>
                Print graph
            </button>
            <button type="button" onClick={props.onCopyMarkdown}>
                Copy Markdown
            </button>
            <button
                type="button"
                onClick={() => props.onCopyDiagram('mermaid')}
            >
                Copy Diagram
            </button>
            <button
                type="button"
                onClick={() => props.onOpenMermaidLive('mermaid')}
            >
                Open Mermaid
            </button>
        </div>
    ),
}));

import GraphSurfaceComp from './GraphSurfaceComp';
import { getGraphEngine, useGraphView } from './graphViewStore';
import { GRAPH_NODE_LIMIT } from './core';
import type { GraphSourceType } from './core';

const source: GraphSourceType<null> = {
    id: 'coverage-graph',
    relationDefList: [
        {
            kind: 'friend',
            canonicalKind: 'friend',
            canonicalFrom: 'origin',
            isDirected: false,
            label: 'Friends',
            styleKey: 'friend',
        },
    ],
    getNodeView: (_context, node) => ({
        name: node.name,
        kjvName: '',
        title: 'A person',
        caption: '',
        iconClass: '',
        typeKey: 'person',
        verseList: h.verses,
        labelHint: '',
    }),
    getNeighbours: () => {
        h.neighbourReads += 1;
        if (h.neighbourError !== null) {
            throw h.neighbourError;
        }
        return h.neighbours;
    },
    countNeighbours: () => h.neighbours.length,
    getRelationLabel: () => 'friend',
    resolveVerseTitle: async (_context, verse) => `Title ${verse}`,
};

let root: Root;
let host: HTMLDivElement;
let graphKey: string;

function graph() {
    return getGraphEngine()
        .getSnapshot()
        .find((item) => item.key === graphKey)!;
}

function press(label: string) {
    const button = Array.from(host.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === label,
    );
    if (button === undefined) throw new Error(`Missing ${label}`);
    act(() => button.click());
}

function selectMenu(id: string) {
    const item = h.menu.find((entry) => entry.id === id);
    if (item === undefined) throw new Error(`Missing menu item ${id}`);
    act(() => item.onSelect());
}

function pointer(target: Element, type: string, x: number, y: number) {
    const event = new MouseEvent(type, {
        button: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    act(() => target.dispatchEvent(event));
}

function flushFrames() {
    const frames = [...h.frames.values()];
    h.frames.clear();
    act(() => frames.forEach((callback) => callback(0)));
}

function GraphHost() {
    const current = useGraphView(graphKey);
    if (current === null) return null;
    return (
        <GraphSurfaceComp
            graph={current}
            source={source}
            context={null}
            fontFamily="Noto Sans"
            verseFontFamily="Noto Serif"
            translate={(key) => `translated ${key}`}
        />
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.neighbours = [];
    h.verses = [];
    h.menu = [];
    h.details.length = 0;
    h.copies.length = 0;
    h.toasts.length = 0;
    h.imageSaves.length = 0;
    h.prints.length = 0;
    h.mermaid.length = 0;
    h.fits.length = 0;
    h.graphSvgOptions.length = 0;
    h.neighbourReads = 0;
    h.neighbourError = null;
    h.handleError.mockReset();
    h.frames.clear();
    h.nextFrameId = 0;
    source.relationDefList[0].isDirected = false;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = ++h.nextFrameId;
        h.frames.set(id, callback);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => h.frames.delete(id));
    vi.stubGlobal('CSS', { escape: (text: string) => text });
    Object.defineProperties(HTMLElement.prototype, {
        setPointerCapture: { value: () => {}, configurable: true },
        hasPointerCapture: { value: () => false, configurable: true },
        releasePointerCapture: { value: () => {}, configurable: true },
    });
    getGraphEngine().closeAll();
    graphKey = getGraphEngine().open({
        sourceId: source.id,
        root: { kind: 'name', recordId: 'root', name: 'Root' },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<GraphHost />));
});

afterEach(() => {
    act(() => root.unmount());
    getGraphEngine().closeAll();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('GraphSurfaceComp actions', () => {
    test('uses the dock to fit, relayout, undo and redo the graph', () => {
        press('Fit graph');
        expect(h.fits[0]?.[0]).toBe(graphKey);
        press('Relayout graph');
        expect(h.fits.length).toBeGreaterThan(1);
        press('Undo graph');
        press('Redo graph');
        expect(graph().nodeList).toHaveLength(1);
    });

    test('shows node detail and resolves verse titles only when opened', async () => {
        h.verses = ['GEN 1:1', 'GEN 1:2'];
        press('Detail Root');
        expect(h.details[0]).toEqual({
            kind: 'name',
            target: 'root',
            name: 'Root',
        });
        await act(async () => {
            press('Verses Root');
            await Promise.resolve();
        });
        expect(h.menu.map((item) => item.menuElement)).toEqual([
            'Title GEN 1:1',
            'Title GEN 1:2',
        ]);
        act(() => h.menu[0].onSelect());
        expect(h.details.at(-1)).toEqual({
            kind: 'verse',
            target: 'GEN 1:1',
            name: 'Title GEN 1:1',
        });
    });

    test('expands a chosen relation and offers node actions in its menu', async () => {
        h.neighbours = [
            {
                kind: 'name',
                recordId: 'friend',
                name: 'Friend',
                relation: 'friend',
            },
        ];
        vi.useFakeTimers();
        press('Expand Root');
        act(() => vi.runAllTimers());
        expect(h.neighbourReads).toBe(1);
        expect(h.menu.map((item) => item.id)).toEqual(['all', 'friend']);
        selectMenu('friend');
        expect(graph().nodeList.map((node) => node.name)).toContain('Friend');
        expect(h.fits).toHaveLength(1);
        press('Menu Friend');
        expect(h.menu.map((item) => item.id)).toContain('re-root');
        selectMenu('detail');
        expect(h.details.at(-1)).toMatchObject({ target: 'friend' });
        press('Menu Friend');
        selectMenu('remove');
        expect(graph().nodeList).toHaveLength(1);

        press('Expand Root');
        act(() => vi.runAllTimers());
        selectMenu('friend');
        press('Menu Friend');
        selectMenu('re-root');
        expect(graph().rootKey).toBe(
            graph().nodeList.find((node) => node.name === 'Friend')?.key,
        );
        press('Menu Root');
        selectMenu('use-as-root');
        expect(graph().rootKey).toBe(
            graph().nodeList.find((node) => node.name === 'Root')?.key,
        );
    });

    test('an empty expansion closes cleanly, and a failed neighbour read is reported', () => {
        vi.useFakeTimers();
        press('Expand Root');
        act(() => vi.runAllTimers());
        expect(h.neighbourReads).toBe(1);
        expect(h.menu).toEqual([]);

        const failure = new Error('lookup unavailable');
        h.neighbourError = failure;
        press('Expand Root');
        act(() => vi.runAllTimers());
        expect(h.neighbourReads).toBe(2);
        expect(h.handleError).toHaveBeenCalledWith(failure);
        expect(h.menu).toEqual([]);
    });

    test('exports the visible graph as image, print and text', async () => {
        press('Copy Markdown');
        press('Copy Diagram');
        await act(async () => {
            press('Open Mermaid');
            press('Save graph');
            press('Print graph');
            await Promise.resolve();
        });
        expect(h.copies).toEqual([
            { text: '# Graph', title: 'Copy as Markdown' },
            { text: 'diagram:mermaid', title: 'Copy Mermaid' },
        ]);
        expect(h.mermaid).toEqual(['diagram:mermaid']);
        expect(h.imageSaves[0]?.[0]).toBe('<svg>graph</svg>');
        expect(h.prints[0]?.[0]).toBe('<svg>graph</svg>');
        expect(h.graphSvgOptions.length).toBeGreaterThan(0);
    });

    test('pans on blank canvas and commits only after the gesture ends', () => {
        const viewport = host.querySelector('.graph-view__viewport')!;
        pointer(viewport, 'pointerdown', 10, 20);
        pointer(viewport, 'pointermove', 40, 60);
        expect(graph().panX).toBe(0);
        flushFrames();
        expect(
            host.querySelector<HTMLElement>('.graph-view__world')?.style
                .transform,
        ).toContain('30px, 40px');
        pointer(viewport, 'pointerup', 40, 60);
        expect(graph()).toMatchObject({ panX: 30, panY: 40 });
        press('Undo graph');
        expect(graph()).toMatchObject({ panX: 0, panY: 0 });
    });

    test('drags a node as one graph edit, with a live DOM preview', () => {
        const node = host.querySelector('.graph-view__node')!;
        const viewport = host.querySelector('.graph-view__viewport')!;
        const before = graph().nodeList[0];
        pointer(node, 'pointerdown', 10, 10);
        pointer(viewport, 'pointermove', 50, 30);
        expect(graph().nodeList[0].x).toBe(before.x);
        flushFrames();
        expect((node as HTMLElement).style.left).not.toBe('');
        pointer(viewport, 'pointerup', 50, 30);
        expect(graph().nodeList[0].x).toBe(before.x + 40);
        expect(graph().nodeList[0].y).toBe(before.y + 20);
    });

    test('dragging a relation node updates its cached path, label and arrow', async () => {
        h.neighbours = [
            {
                kind: 'name',
                recordId: 'friend',
                name: 'Friend',
                relation: 'friend',
            },
        ];
        source.relationDefList[0].isDirected = true;
        press('Expand Root');
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
        selectMenu('friend');

        const friend = graph().nodeList.find((node) => node.name === 'Friend')!;
        const node = host.querySelector<HTMLElement>(
            `[data-node-key="${friend.key}"]`,
        )!;
        const edge = graph().edgeList[0];
        const path = host.querySelector<SVGPathElement>(
            `[data-edge-key="${edge.key}"]`,
        )!;
        const label = host.querySelector<SVGTextElement>(
            `[data-edge-label-for="${edge.key}"]`,
        )!;
        const arrow = host.querySelector<SVGPathElement>(
            `[data-edge-arrow-for="${edge.key}"]`,
        )!;
        const before = { x: friend.x, y: friend.y };

        pointer(node, 'pointerdown', 10, 10);
        pointer(
            host.querySelector('.graph-view__viewport')!,
            'pointermove',
            50,
            30,
        );
        flushFrames();

        expect(path.getAttribute('d')).not.toBe('initial-path');
        expect(label.getAttribute('x')).not.toBe('0');
        expect(label.getAttribute('y')).not.toBe('0');
        expect(arrow.getAttribute('transform')).not.toBe('initial-arrow');
        pointer(
            host.querySelector('.graph-view__viewport')!,
            'pointerup',
            50,
            30,
        );
        expect(
            graph().nodeList.find((item) => item.key === friend.key),
        ).toMatchObject({
            x: before.x + 40,
            y: before.y + 20,
        });
    });

    test('node controls keep pointer gestures and text-entry undo for themselves', () => {
        const before = graph().nodeList[0];
        const expandButton = Array.from(host.querySelectorAll('button')).find(
            (button) => button.textContent?.trim() === 'Expand Root',
        )!;
        const viewport = host.querySelector('.graph-view__viewport')!;
        pointer(expandButton, 'pointerdown', 10, 10);
        pointer(viewport, 'pointermove', 80, 40);
        expect(h.frames.size).toBe(0);
        pointer(viewport, 'pointerup', 80, 40);
        expect(graph().nodeList[0]).toMatchObject({ x: before.x, y: before.y });

        const input = document.createElement('input');
        host.appendChild(input);
        input.focus();
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'z',
                    ctrlKey: true,
                    bubbles: true,
                }),
            );
        });
        expect(graph().nodeList).toHaveLength(1);
        input.remove();
    });

    test('a cancelled capture still finishes a small drag and releases its pointer', () => {
        const releasePointer = vi.fn();
        Object.defineProperties(HTMLElement.prototype, {
            setPointerCapture: {
                value: () => {
                    throw new Error('capture ended');
                },
                configurable: true,
            },
            hasPointerCapture: {
                value: () => true,
                configurable: true,
            },
            releasePointerCapture: {
                value: releasePointer,
                configurable: true,
            },
        });
        const node = host.querySelector('.graph-view__node')!;
        const viewport = host.querySelector('.graph-view__viewport')!;
        const before = graph().nodeList[0];
        pointer(node, 'pointerdown', 10, 10);
        pointer(viewport, 'pointermove', 10.5, 10.5);
        flushFrames();
        pointer(viewport, 'pointerup', 10.5, 10.5);

        expect(releasePointer).toHaveBeenCalledWith(1);
        expect(graph().nodeList[0]).toMatchObject({ x: before.x, y: before.y });
    });

    test('coalesces wheel ticks and zooms around a two-finger pinch', () => {
        const viewport = host.querySelector('.graph-view__viewport')!;
        const before = graph().zoomPercent;
        act(() => {
            viewport.dispatchEvent(
                new WheelEvent('wheel', {
                    deltaY: -100,
                    clientX: 60,
                    clientY: 50,
                    bubbles: true,
                }),
            );
            viewport.dispatchEvent(
                new WheelEvent('wheel', {
                    deltaY: -100,
                    clientX: 60,
                    clientY: 50,
                    bubbles: true,
                }),
            );
        });
        expect(h.frames.size).toBe(1);
        flushFrames();
        expect(graph().zoomPercent).toBeGreaterThan(before);
        const afterWheel = graph().zoomPercent;
        const touch = (type: string, secondX: number) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'touches', {
                value: [
                    { clientX: 20, clientY: 20 },
                    { clientX: secondX, clientY: 20 },
                ],
            });
            act(() => viewport.dispatchEvent(event));
        };
        touch('touchstart', 60);
        touch('touchmove', 100);
        expect(graph().zoomPercent).toBeGreaterThan(afterWheel);
        act(() =>
            viewport.dispatchEvent(new Event('touchend', { bubbles: true })),
        );
    });
});

describe('GraphSurfaceComp edge cases', () => {
    const friendOf = (recordId: string) => {
        return {
            kind: 'name',
            recordId,
            name: recordId.toUpperCase(),
            relation: 'friend',
        };
    };

    function keyDown(target: EventTarget, init: KeyboardEventInit) {
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            ...init,
        });
        act(() => {
            target.dispatchEvent(event);
        });
        return event;
    }

    function getViewport() {
        return host.querySelector<HTMLElement>('.graph-view__viewport')!;
    }

    function remount() {
        act(() => root.unmount());
        root = createRoot(host);
        act(() => root.render(<GraphHost />));
    }

    async function settle() {
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
    }

    function addFriendOfRoot() {
        h.neighbours = [friendOf('friend')];
        vi.useFakeTimers();
        press('Expand Root');
        act(() => vi.runAllTimers());
        selectMenu('friend');
        return graph().nodeList.find((node) => node.name === 'FRIEND')!;
    }

    test('keys that are not undo or redo, and keys typed into text, leave the graph alone', () => {
        const rootKey = graph().rootKey;
        act(() => getGraphEngine().moveNode(graphKey, rootKey, 50, 0));
        const viewport = getViewport();
        const plain = keyDown(viewport, { key: 'z' });
        expect(plain.defaultPrevented).toBe(false);
        const other = keyDown(viewport, { key: 'a', ctrlKey: true });
        expect(other.defaultPrevented).toBe(false);
        const textarea = document.createElement('textarea');
        viewport.appendChild(textarea);
        const typed = keyDown(textarea, { key: 'z', ctrlKey: true });
        expect(typed.defaultPrevented).toBe(false);
        textarea.remove();
        expect(graph().nodeList[0].x).toBe(50);
        // An SVG target is not a text box: the graph takes the key.
        const svg = host.querySelector('.graph-view__edges')!;
        const undo = keyDown(svg, { key: 'z', metaKey: true });
        expect(undo.defaultPrevented).toBe(true);
        expect(graph().nodeList[0].x).toBe(0);
    });

    test('a key on the page body only steps the graph when it is a history key', () => {
        const rootKey = graph().rootKey;
        act(() => getGraphEngine().moveNode(graphKey, rootKey, 70, 0));
        (document.activeElement as HTMLElement | null)?.blur?.();
        // Working in this panel, with focus fallen to the body.
        act(() => {
            getViewport().dispatchEvent(
                new FocusEvent('focusin', { bubbles: true }),
            );
        });
        const other = keyDown(document.body, { key: 'x', ctrlKey: true });
        expect(other.defaultPrevented).toBe(false);
        expect(graph().nodeList[0].x).toBe(70);
        const undo = keyDown(document.body, { key: 'z', ctrlKey: true });
        expect(undo.defaultPrevented).toBe(true);
        expect(graph().nodeList[0].x).toBe(0);
        expect(document.activeElement).toBe(getViewport());
    });

    test('a drag redraws only its own lines, and skips one that is hidden', () => {
        const engine = getGraphEngine();
        act(() => {
            engine.addNeighbours(graphKey, {
                originKey: 'name:root',
                neighbourList: [friendOf('a')],
                relationDefList: source.relationDefList,
            });
            engine.addNeighbours(graphKey, {
                originKey: 'name:a',
                neighbourList: [friendOf('b')],
                relationDefList: source.relationDefList,
            });
        });
        const [rootEdge, farEdge] = graph().edgeList;
        expect(farEdge).toMatchObject({ fromKey: 'name:a', toKey: 'name:b' });
        const pathOf = (key: string) => {
            return host
                .querySelector(`[data-edge-key="${key}"]`)!
                .getAttribute('d');
        };
        const rootBox = host.querySelector('[data-node-key="name:root"]')!;
        pointer(rootBox, 'pointerdown', 10, 10);
        pointer(getViewport(), 'pointermove', 20, 10);
        pointer(getViewport(), 'pointermove', 30, 10);
        // Two moves before a paint still ask for ONE frame.
        expect(h.frames.size).toBe(1);
        flushFrames();
        expect(pathOf(rootEdge.key)).not.toBe('initial-path');
        expect(pathOf(farEdge.key)).toBe('initial-path');
        pointer(getViewport(), 'pointerup', 30, 10);
        expect(graph().nodeList[0]).toMatchObject({ x: 20, y: 0 });

        act(() => engine.toggleRelationHidden(graphKey, 'friend'));
        expect(host.querySelector(`[data-edge-key="${rootEdge.key}"]`)).toBe(
            null,
        );
        pointer(rootBox, 'pointerdown', 10, 10);
        pointer(getViewport(), 'pointermove', 10, 40);
        flushFrames();
        pointer(getViewport(), 'pointerup', 10, 40);
        expect(graph().nodeList[0]).toMatchObject({ x: 20, y: 30 });
    });

    test('letting go before the frame paints cancels the frame and still commits', () => {
        const rootBox = host.querySelector('.graph-view__node')!;
        pointer(rootBox, 'pointerdown', 0, 0);
        pointer(getViewport(), 'pointermove', 15, 25);
        expect(h.frames.size).toBe(1);
        pointer(getViewport(), 'pointerup', 15, 25);
        expect(h.frames.size).toBe(0);
        expect(graph().nodeList[0]).toMatchObject({ x: 15, y: 25 });
    });

    test('unmounting cancels a pending drag frame and a pending wheel frame', () => {
        const rootBox = host.querySelector('.graph-view__node')!;
        pointer(rootBox, 'pointerdown', 0, 0);
        pointer(getViewport(), 'pointermove', 15, 25);
        act(() => {
            getViewport().dispatchEvent(
                new WheelEvent('wheel', { deltaY: -100, bubbles: true }),
            );
        });
        expect(h.frames.size).toBe(2);
        act(() => root.unmount());
        expect(h.frames.size).toBe(0);
        root = createRoot(host);
    });

    test('a touch move that is not a started pinch does not zoom', () => {
        const before = graph().zoomPercent;
        const touch = (type: string, touchList: object[]) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'touches', { value: touchList });
            act(() => getViewport().dispatchEvent(event));
            return event;
        };
        const two = [
            { clientX: 0, clientY: 0 },
            { clientX: 80, clientY: 0 },
        ];
        // Two fingers, but no touchstart measured where the pinch began.
        expect(touch('touchmove', two).defaultPrevented).toBe(false);
        touch('touchstart', two);
        expect(touch('touchmove', [two[0]]).defaultPrevented).toBe(false);
        expect(graph().zoomPercent).toBe(before);
    });

    test('a measured viewport centres the graph once, not as an undo step', () => {
        const sizeOf = (size: number) => {
            return {
                configurable: true,
                get(this: HTMLElement) {
                    return this.classList.contains('graph-view__viewport')
                        ? size
                        : 0;
                },
            };
        };
        Object.defineProperty(
            HTMLElement.prototype,
            'clientWidth',
            sizeOf(800),
        );
        Object.defineProperty(
            HTMLElement.prototype,
            'clientHeight',
            sizeOf(600),
        );
        try {
            remount();
        } finally {
            delete (HTMLElement.prototype as any).clientWidth;
            delete (HTMLElement.prototype as any).clientHeight;
        }
        expect(graph()).toMatchObject({ panX: 400, panY: 300 });
        expect(getGraphEngine().canUndo(graphKey)).toBe(false);
    });

    test('a large "All" asks first, then fills up to the node limit and says so', async () => {
        h.neighbours = Array.from({ length: 130 }, (_unused, index) => {
            return friendOf(`n${index}`);
        });
        vi.useFakeTimers();
        press('Expand Root');
        act(() => vi.runAllTimers());
        expect(h.menu[0].menuElement).toBe('All (130)');
        await act(async () => {
            h.menu[0].onSelect();
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(graph().nodeList).toHaveLength(GRAPH_NODE_LIMIT);
        expect(h.toasts).toEqual([
            ['Graph Preview', 'Graph node limit reached'],
        ]);
        expect(h.fits).toHaveLength(1);
    });

    test('a small "All" adds every neighbour straight away', () => {
        h.neighbours = [friendOf('a'), friendOf('b')];
        vi.useFakeTimers();
        press('Expand Root');
        act(() => vi.runAllTimers());
        selectMenu('all');
        expect(
            graph()
                .nodeList.map((node) => node.name)
                .sort(),
        ).toEqual(['A', 'B', 'Root']);
        expect(h.toasts).toEqual([]);
    });

    test('a menu left open on a box that is gone does nothing', () => {
        h.verses = ['GEN 1:1'];
        const friend = addFriendOfRoot();
        press('Menu FRIEND');
        const staleMenu = h.menu;
        expect(staleMenu.map((item) => item.id)).toEqual(
            expect.arrayContaining(['detail', 'verses', 'expand']),
        );
        act(() => getGraphEngine().removeNode(graphKey, friend.key));
        const detailCount = h.details.length;
        const readCount = h.neighbourReads;
        for (const id of ['detail', 'verses', 'expand']) {
            const item = staleMenu.find((entry) => entry.id === id);
            act(() => item.onSelect());
        }
        act(() => vi.runAllTimers());
        expect(h.details).toHaveLength(detailCount);
        expect(h.menu).toBe(staleMenu);
        expect(h.neighbourReads).toBe(readCount);
    });

    test('a menu action after the panel closed fits nothing', () => {
        addFriendOfRoot();
        press('Menu FRIEND');
        const resetItem = h.menu.find((entry) => entry.id === 'use-as-root');
        const fitCount = h.fits.length;
        act(() => getGraphEngine().close(graphKey));
        expect(host.querySelector('.graph-view')).toBeNull();
        expect(() => act(() => resetItem.onSelect())).not.toThrow();
        expect(h.fits).toHaveLength(fitCount);
    });

    test('verse menus: none without verses, keys for unknown titles or no resolver', async () => {
        press('Verses Root');
        await settle();
        expect(h.menu).toEqual([]);

        h.verses = ['GEN 1:1', 'BAD 9:9'];
        const original = source.resolveVerseTitle;
        try {
            source.resolveVerseTitle = async (_context, verse) => {
                if (verse === 'BAD 9:9') {
                    throw new Error('unknown book');
                }
                return `Title ${verse}`;
            };
            press('Verses Root');
            await settle();
            expect(h.menu.map((item) => item.menuElement)).toEqual([
                'Title GEN 1:1',
                'BAD 9:9',
            ]);
            delete (source as any).resolveVerseTitle;
            h.menu = [];
            press('Verses Root');
            // No titles to look up: the menu opens at once, with the keys.
            expect(h.menu.map((item) => item.menuElement)).toEqual([
                'GEN 1:1',
                'BAD 9:9',
            ]);
        } finally {
            source.resolveVerseTitle = original;
        }
    });

    test('the box menu collapses, opens verses and expands', async () => {
        h.verses = ['GEN 1:1'];
        const friend = addFriendOfRoot();
        press('Menu FRIEND');
        expect(h.menu.find((item) => item.id === 'collapse').menuElement).toBe(
            'Collapse',
        );
        selectMenu('collapse');
        expect(
            graph().nodeList.find((node) => node.key === friend.key)
                ?.isCollapsed,
        ).toBe(true);
        press('Menu FRIEND');
        expect(h.menu.find((item) => item.id === 'collapse').menuElement).toBe(
            'Expand',
        );

        selectMenu('verses');
        await settle();
        expect(h.menu.map((item) => item.menuElement)).toEqual([
            'Title GEN 1:1',
        ]);

        press('Menu FRIEND');
        const readCount = h.neighbourReads;
        selectMenu('expand');
        act(() => vi.runAllTimers());
        expect(h.neighbourReads).toBe(readCount + 1);
        expect(h.menu.map((item) => item.id)).toEqual(['all', 'friend']);
    });

    test('an export reads each line as its label and direction only', async () => {
        addFriendOfRoot();
        await act(async () => {
            press('Save graph');
            await Promise.resolve();
            await Promise.resolve();
        });
        const options = h.graphSvgOptions.at(-1) as any;
        expect(options.resolveEdge(graph().edgeList[0])).toEqual({
            label: 'translated friend',
            isDirected: false,
        });
    });
});
