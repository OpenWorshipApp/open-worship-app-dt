// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
    isBlankDragArea: () => true,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/helpers', () => ({ mapInYieldingBatches: vi.fn() }));
vi.mock('../helper/mermaidLiveHelpers', () => ({
    MERMAID_LIVE_LABEL: 'Open in Mermaid Live',
    openMermaidLiveEditor: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../location-name-lookup/detailPanelHelpers', () => ({
    openDetailPanel: vi.fn(),
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(),
}));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: vi.fn() }));
vi.mock('../context-menu/AppContextMenuComp', () => ({ elementDivider: null }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    APP_CONTEXT_MENU_ID: 'app-context-menu-container',
    showAppContextMenu: vi.fn(),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button type="button" aria-label="More Options" />,
}));
vi.mock('../others/AppRangeComp', () => ({ default: () => null }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('./graphFitHelpers', () => ({ fitGraphOnScreen: vi.fn() }));
vi.mock('./graphExportHelpers', () => ({
    buildGraphSvg: vi.fn(() => ''),
    COPY_MARKDOWN_LABEL: 'Copy as Markdown',
    genCanvasTextMeasure: vi.fn(),
    loadGraphExportFonts: vi.fn(async () => undefined),
    PRINT_PALETTE: {},
    printGraph: vi.fn(),
    saveGraphImage: vi.fn(async () => undefined),
}));
vi.mock('./graphTextExportHelpers', () => ({
    buildGraphDiagram: vi.fn(),
    buildGraphMarkdown: vi.fn(),
    GRAPH_DIAGRAM_FORMAT_LIST: [],
}));
// The real toolbar draws chips and the path finder; what matters here is
// that it holds a button and a text box OUTSIDE the canvas.
vi.mock('./GraphToolbarComp', () => ({
    default: () => (
        <div className="graph-view__toolbar">
            <button type="button" data-testid="chip">
                chip
            </button>
            <input type="text" aria-label="Path to" />
        </div>
    ),
}));

import GraphSurfaceComp from './GraphSurfaceComp';
import { getGraphEngine, useGraphView } from './graphViewStore';
import type { GraphSourceType } from './core';

const source: GraphSourceType<null> = {
    id: 'focus-test',
    relationDefList: [],
    getNodeView: (_context, node) => ({
        name: node.name,
        kjvName: '',
        title: 'A title',
        caption: '',
        iconClass: '',
        typeKey: 'person',
        verseList: [],
        labelHint: '',
    }),
    getNeighbours: () => [],
    countNeighbours: () => 0,
    getRelationLabel: () => '',
};

function GraphHostComp({ graphKey }: Readonly<{ graphKey: string }>) {
    const graph = useGraphView(graphKey);
    if (graph === null) {
        return null;
    }
    return (
        <GraphSurfaceComp
            graph={graph}
            source={source}
            context={null}
            fontFamily={undefined}
            translate={(key) => key}
        />
    );
}

function pressKey(
    target: EventTarget,
    init: { key: string; shiftKey?: boolean },
) {
    const event = new KeyboardEvent('keydown', {
        key: init.key,
        ctrlKey: true,
        shiftKey: init.shiftKey ?? false,
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

describe('GraphSurfaceComp undo keys', () => {
    let container: HTMLDivElement;
    let outside: HTMLDivElement;
    let root: Root;
    let graphKey: string;

    const getRootNode = () => {
        const graph = getGraphEngine()
            .getSnapshot()
            .find((item) => {
                return item.key === graphKey;
            })!;
        return graph.nodeList.find((node) => {
            return node.key === graph.rootKey;
        })!;
    };

    const collapseRoot = () => {
        act(() => {
            getGraphEngine().setNodeCollapsed(
                graphKey,
                getRootNode().key,
                true,
            );
        });
    };

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        outside = document.createElement('div');
        outside.tabIndex = 0;
        document.body.appendChild(outside);
        container = document.createElement('div');
        document.body.appendChild(container);
        getGraphEngine().closeAll();
        graphKey = getGraphEngine().open({
            sourceId: source.id,
            root: { kind: 'name', recordId: 'root', name: 'Root' },
        });
        root = createRoot(container);
        act(() => {
            root.render(<GraphHostComp graphKey={graphKey} />);
        });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        getGraphEngine().closeAll();
        container.remove();
        outside.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    // Measured live (RD-102): the Collapse button is gone once its box
    // collapses, focus fell to <body>, and the next Ctrl+Z ran the browser's
    // undo on the Reader's reference box instead of the graph's.
    test('Collapse keeps focus in the graph, so Ctrl+Z undoes it there', () => {
        const collapse = container.querySelector<HTMLButtonElement>(
            '[aria-label="Collapse"]',
        )!;
        collapse.focus();
        act(() => {
            collapse.click();
        });
        expect(getRootNode().isCollapsed).toBe(true);
        expect(container.querySelector('[aria-label="Collapse"]')).toBeNull();

        const viewport = container.querySelector('.graph-view__viewport');
        expect(document.activeElement).toBe(viewport);

        const event = pressKey(document.activeElement!, { key: 'z' });
        expect(event.defaultPrevented).toBe(true);
        expect(getRootNode().isCollapsed).toBe(false);

        pressKey(document.activeElement!, { key: 'y' });
        expect(getRootNode().isCollapsed).toBe(true);

        pressKey(document.activeElement!, { key: 'z' });
        pressKey(document.activeElement!, { key: 'Z', shiftKey: true });
        expect(getRootNode().isCollapsed).toBe(true);
    });

    test("the dock's Undo greying out does not strand focus on it", () => {
        collapseRoot();
        const undo = container.querySelector<HTMLButtonElement>(
            '[aria-label="Undo"]',
        )!;
        expect(undo.disabled).toBe(false);
        undo.focus();
        act(() => {
            undo.click();
        });
        expect(undo.disabled).toBe(true);
        expect(document.activeElement).toBe(
            container.querySelector('.graph-view__viewport'),
        );
    });

    test('a toolbar button focused still sends Ctrl+Z to the graph', () => {
        collapseRoot();
        const chip = container.querySelector<HTMLButtonElement>(
            '[data-testid="chip"]',
        )!;
        chip.focus();

        const event = pressKey(chip, { key: 'z' });
        expect(event.defaultPrevented).toBe(true);
        expect(getRootNode().isCollapsed).toBe(false);
    });

    test('a text box in the panel keeps its own Ctrl+Z', () => {
        collapseRoot();
        const input = container.querySelector<HTMLInputElement>(
            '[aria-label="Path to"]',
        )!;
        input.focus();

        const event = pressKey(input, { key: 'z' });
        expect(event.defaultPrevented).toBe(false);
        expect(getRootNode().isCollapsed).toBe(true);
    });

    test('focus that fell to <body> after working here still undoes the graph', () => {
        collapseRoot();
        const viewport = container.querySelector<HTMLElement>(
            '.graph-view__viewport',
        )!;
        act(() => {
            viewport.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        // What a context menu closing, or a removed control, leaves behind.
        (document.activeElement as HTMLElement | null)?.blur();
        expect(document.activeElement).toBe(document.body);

        const event = pressKey(document.body, { key: 'z' });
        expect(event.defaultPrevented).toBe(true);
        expect(getRootNode().isCollapsed).toBe(false);
    });

    // A box's right-click menu is a portal outside the panel; picking from it
    // is still working in the graph, and closing it leaves focus nowhere.
    test('a pick from a context menu keeps the keys with the graph', () => {
        collapseRoot();
        const viewport = container.querySelector<HTMLElement>(
            '.graph-view__viewport',
        )!;
        act(() => {
            viewport.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        const menu = document.createElement('div');
        menu.id = 'app-context-menu-container';
        const item = document.createElement('div');
        menu.appendChild(item);
        document.body.appendChild(menu);
        act(() => {
            item.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        menu.remove();
        (document.activeElement as HTMLElement | null)?.blur();

        const event = pressKey(document.body, { key: 'z' });
        expect(event.defaultPrevented).toBe(true);
        expect(getRootNode().isCollapsed).toBe(false);
        expect(document.activeElement).toBe(viewport);
    });

    test('after a press elsewhere, Ctrl+Z on <body> is not the graph’s', () => {
        collapseRoot();
        act(() => {
            outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        (document.activeElement as HTMLElement | null)?.blur();

        const event = pressKey(document.body, { key: 'z' });
        expect(event.defaultPrevented).toBe(false);
        expect(getRootNode().isCollapsed).toBe(true);
    });
});
