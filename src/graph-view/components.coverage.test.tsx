// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        managers: undefined as any,
        fontFamily: 'RecordFont' as string | undefined,
        widgetPropsList: [] as any[],
        surfacePropsList: [] as any[],
        source: { id: 'mock-lookup-source' },
    };
});

vi.mock('../lang/langHelpers', () => {
    return {
        tran: (key: string) => {
            return key;
        },
    };
});

vi.mock('../location-name-lookup/lookupLangHelpers', () => {
    return {
        useLookupLangPresentation: () => {
            return {
                fontFamily: h.fontFamily,
                translate: (key: string) => {
                    return `record:${key}`;
                },
            };
        },
    };
});

vi.mock('../location-name-lookup/bibleVerseHelpers', () => {
    return {
        useLookupVerseFontFamily: () => {
            return 'VerseFont';
        },
    };
});

vi.mock('../location-name-lookup/lookupManagersContext', () => {
    return {
        useLookupManagers: () => {
            return h.managers;
        },
    };
});

vi.mock('../others/LoadingComp', () => {
    return {
        default: () => {
            return <div className="mock-loading">Loading</div>;
        },
    };
});

vi.mock('../others/themeHelpers', () => {
    return {
        useThemeSource: () => {
            return { theme: 'dark' };
        },
    };
});

vi.mock('../app-modal/FloatingWidgetComp', () => {
    return {
        default: (props: any) => {
            h.widgetPropsList.push(props);
            return (
                <section
                    className="mock-widget"
                    data-widget-name={props.widgetName}
                    data-raise={props.raiseToken}
                    data-offset={props.options.initialOffset}
                >
                    <header className="mock-widget-title">{props.title}</header>
                    <button
                        type="button"
                        className="mock-widget-close"
                        onClick={props.onClose}
                    >
                        close
                    </button>
                    {props.children}
                </section>
            );
        },
    };
});

vi.mock('./GraphSurfaceComp', () => {
    return {
        default: (props: any) => {
            h.surfacePropsList.push(props);
            return (
                <div className="mock-surface">
                    {props.graph.title}|{props.fontFamily}|
                    {props.verseFontFamily}|{props.translate('Abraham')}
                </div>
            );
        },
    };
});

vi.mock('./lookupGraphSource', () => {
    return { lookupGraphSource: h.source };
});

vi.mock('../context-menu/appContextMenuHelpers', () => {
    return { showAppContextMenu: () => {} };
});

vi.mock('../context-menu/contextMenuIconHelpers', () => {
    return {
        genContextMenuItemIcon: () => {
            return null;
        },
    };
});

vi.mock('../context-menu/ContextMenuDotsButtonComp', () => {
    return {
        default: ({ onOpening }: any) => {
            return (
                <button
                    type="button"
                    className="mock-dots"
                    onClick={(event) => {
                        onOpening?.(event);
                    }}
                >
                    dots
                </button>
            );
        },
    };
});

vi.mock('../others/AppRangeComp', () => {
    return {
        default: ({ value, setValue, title }: any) => {
            return (
                <button
                    type="button"
                    className="mock-range"
                    data-value={value}
                    title={title}
                    onClick={() => {
                        setValue(150);
                    }}
                >
                    range
                </button>
            );
        },
    };
});

import type {
    GraphEdgeType,
    GraphNodeType,
    GraphRelationDefType,
    GraphViewType,
} from './core';
import { getEdgeLabelPoint, getWorldBounds } from './core';
import GraphDockComp from './GraphDockComp';
import GraphEdgeLayerComp from './GraphEdgeLayerComp';
import GraphNodeBoxComp from './GraphNodeBoxComp';
import type { GraphNodeCallbacksType } from './GraphNodeBoxComp';
import GraphViewPanelsComp from './GraphViewPanelsComp';
import GraphViewPanelsHostComp from './GraphViewPanelsHostComp';
import { getGraphEngine, openGraphPreview } from './graphViewStore';
import LookupGraphBodyComp from './LookupGraphBodyComp';
import OpenGraphPreviewButtonComp from './OpenGraphPreviewButtonComp';

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
    act(() => {
        root.render(node);
    });
}

function findGraph(graphKey: string) {
    return (
        getGraphEngine()
            .getSnapshot()
            .find((graph) => {
                return graph.key === graphKey;
            }) ?? null
    );
}

function getButton(scope: ParentNode, title: string) {
    const button = Array.from(
        scope.querySelectorAll<HTMLButtonElement>('button'),
    ).find((item) => {
        return item.title === title;
    });
    if (button === undefined) {
        throw new Error(`no button titled ${title}`);
    }
    return button;
}

function click(element: Element) {
    act(() => {
        element.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
}

// Lazy bodies resolve through real dynamic imports; give them a few ticks.
async function waitFor(check: () => boolean) {
    for (let index = 0; index < 100; index++) {
        if (check()) {
            return;
        }
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });
        });
    }
    throw new Error('condition never became true');
}

function genNode(
    key: string,
    x: number,
    y: number,
    patch: Partial<GraphNodeType> = {},
): GraphNodeType {
    const [kind, recordId] = key.split(':');
    return {
        key,
        kind,
        recordId,
        name: recordId,
        x,
        y,
        isPinned: false,
        isCollapsed: false,
        originKey: null,
        isExpanded: false,
        ...patch,
    };
}

const RELATION_DEF_LIST: GraphRelationDefType[] = [
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin',
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
    {
        kind: 'spouse',
        canonicalKind: 'spouse',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Spouses',
        styleKey: 'spouse',
    },
];

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.managers = undefined;
    h.fontFamily = 'RecordFont';
    h.widgetPropsList = [];
    h.surfacePropsList = [];
    getGraphEngine().closeAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    act(() => {
        getGraphEngine().closeAll();
    });
    document.body.innerHTML = '';
});

describe('GraphEdgeLayerComp', () => {
    const nodeA = genNode('name:a', 0, 0);
    const nodeB = genNode('name:b', 400, 0);
    const nodeC = genNode('name:c', 0, 50);
    const edgeList: GraphEdgeType[] = [
        { key: 'e1', fromKey: 'name:a', toKey: 'name:b', relation: 'child' },
        { key: 'e2', fromKey: 'name:a', toKey: 'name:c', relation: 'spouse' },
        { key: 'e3', fromKey: 'name:a', toKey: 'name:gone', relation: 'child' },
        { key: 'e4', fromKey: 'name:b', toKey: 'name:a', relation: 'mystery' },
    ];
    const labelMap: Record<string, string> = {
        child: 'son',
        spouse: 'wife',
        mystery: 'friend',
    };
    const resolveLabel = (edge: GraphEdgeType) => {
        return {
            label: labelMap[edge.relation] ?? '',
            styleKey: '',
            isDirected: edge.relation === 'child',
        };
    };

    function renderLayer(
        nodeList: GraphNodeType[],
        layerEdgeList: GraphEdgeType[],
        pathEdgeKeySet = new Set<string>(),
        isLabelHidden = false,
    ) {
        const bounds = getWorldBounds(nodeList);
        render(
            <GraphEdgeLayerComp
                edgeList={layerEdgeList}
                nodeList={nodeList}
                bounds={bounds}
                pathEdgeKeySet={pathEdgeKeySet}
                relationDefList={RELATION_DEF_LIST}
                resolveLabel={resolveLabel}
                isLabelHidden={isLabelHidden}
            />,
        );
        return bounds;
    }

    test('draws one group per edge whose two boxes exist, styled by relation', () => {
        const bounds = renderLayer(
            [nodeA, nodeB, nodeC],
            edgeList,
            new Set(['e1']),
        );
        const svg = container.querySelector('svg') as SVGSVGElement;
        expect(svg.getAttribute('class')).toBe(
            'graph-view__edges graph-view__edges--has-path',
        );
        expect(svg.getAttribute('width')).toBe(`${bounds.width}`);
        expect(svg.getAttribute('height')).toBe(`${bounds.height}`);
        expect(svg.style.left).toBe(`${bounds.left}px`);
        expect(svg.style.top).toBe(`${bounds.top}px`);
        const groupList = Array.from(svg.querySelectorAll('g'));
        expect(
            groupList.map((group) => {
                return group.getAttribute('class');
            }),
        ).toEqual([
            'graph-view__edge-group graph-view__edge-group--parentage' +
                ' graph-view__edge-group--on-path',
            'graph-view__edge-group graph-view__edge-group--spouse',
            'graph-view__edge-group graph-view__edge-group--default',
        ]);
        // The missing box's edge draws nothing at all.
        expect(svg.querySelector('[data-edge-key="e3"]')).toBeNull();
        const line = svg.querySelector('[data-edge-key="e1"]') as Element;
        expect(line.getAttribute('data-edge-from')).toBe('name:a');
        expect(line.getAttribute('data-edge-to')).toBe('name:b');
        // Trimmed to the border of A's box, in the layer's local units.
        const startX = Number(
            (line.getAttribute('d') ?? '').match(/^M (-?[\d.]+) /)?.[1],
        );
        expect(startX).toBeGreaterThan(nodeA.x - bounds.left + 84);
        // Only the directed relation carries an arrowhead.
        expect(svg.querySelector('[data-edge-arrow-for="e1"]')).not.toBeNull();
        expect(svg.querySelector('[data-edge-arrow-for="e2"]')).toBeNull();
        expect(svg.querySelector('[data-edge-arrow-for="e4"]')).toBeNull();
    });

    test('labels long edges at their midpoint and skips short ones', () => {
        const bounds = renderLayer([nodeA, nodeB, nodeC], edgeList.slice(0, 2));
        const labelList = Array.from(container.querySelectorAll('text'));
        // A to C is 50 units, shorter than its own label would be.
        expect(
            labelList.map((label) => {
                return label.textContent;
            }),
        ).toEqual(['son']);
        const point = getEdgeLabelPoint(
            { x: nodeA.x - bounds.left, y: nodeA.y - bounds.top },
            { x: nodeB.x - bounds.left, y: nodeB.y - bounds.top },
            0,
        );
        expect(Number(labelList[0].getAttribute('x'))).toBeCloseTo(point.x);
        expect(Number(labelList[0].getAttribute('y'))).toBeCloseTo(point.y);
        expect(container.querySelector('svg')?.getAttribute('class')).toBe(
            'graph-view__edges',
        );
    });

    test('hides every label when asked, keeping the lines', () => {
        renderLayer([nodeA, nodeB, nodeC], edgeList, new Set(), true);
        expect(container.querySelectorAll('text')).toHaveLength(0);
        expect(
            container.querySelectorAll('path.graph-view__edge'),
        ).toHaveLength(3);
    });

    test('a collapsed pair is joined at the middle of the collapsed boxes', () => {
        const single = [edgeList[0]];
        renderLayer([nodeA, nodeB], single);
        const openArrow = container
            .querySelector('[data-edge-arrow-for="e1"]')
            ?.getAttribute('transform');
        // World top is -336, so the open boxes' centre line is at local 336.
        expect(openArrow).toMatch(/^translate\(-?[\d.]+ 336\.00\) rotate/);
        renderLayer(
            [
                { ...nodeA, isCollapsed: true },
                { ...nodeB, isCollapsed: true },
            ],
            single,
        );
        const collapsedArrow = container
            .querySelector('[data-edge-arrow-for="e1"]')
            ?.getAttribute('transform');
        // A collapsed box keeps its top and is 32 tall: its middle is 28 up.
        expect(collapsedArrow).toMatch(/^translate\(-?[\d.]+ 308\.00\) rotate/);
    });
});

describe('GraphNodeBoxComp', () => {
    function genCallbacks() {
        return {
            onPointerDown: vi.fn(),
            onExpand: vi.fn(),
            onContextMenu: vi.fn(),
            onToggleCollapsed: vi.fn(),
            onOpenDetail: vi.fn(),
            onOpenVerses: vi.fn(),
            onRemove: vi.fn(),
            onReRoot: vi.fn(),
            onResetToNode: vi.fn(),
        } satisfies GraphNodeCallbacksType;
    }

    const view = {
        name: 'Abraham of Ur',
        kjvName: 'Abram',
        title: 'Father of many',
        iconClass: 'bi bi-person',
        typeKey: 'person',
        verseList: ['GEN 12:1', 'GEN 17:5'],
    } as any;

    test('an open box draws its record and routes every button', () => {
        const callbacks = genCallbacks();
        const node = genNode('name:abraham', 200, 100, { isExpanded: true });
        render(
            <GraphNodeBoxComp
                node={node}
                view={view}
                neighbourCount={3}
                isRoot={false}
                isOnPath
                isBusy={false}
                callbacks={callbacks}
            />,
        );
        const box = container.querySelector('.graph-view__node') as HTMLElement;
        expect(box.className).toBe(
            'graph-view__node graph-view__node--on-path' +
                ' graph-view__node--expanded',
        );
        expect(box.dataset.typeKey).toBe('person');
        expect(box.dataset.nodeKind).toBe('name');
        expect(box.style.left).toBe(`${200 - 84}px`);
        expect(box.style.top).toBe(`${100 - 44}px`);
        expect(box.style.width).toBe('168px');
        expect(box.querySelector('.graph-view__node-name')?.textContent).toBe(
            'Abraham of Ur(Abram)',
        );
        expect(box.querySelector('.graph-view__node-icon')?.className).toBe(
            'bi bi-person graph-view__node-icon',
        );
        expect(box.querySelector('.graph-view__node-title')?.textContent).toBe(
            'Father of many',
        );

        const expandButton = getButton(box, 'Open all Related');
        expect(expandButton.disabled).toBe(false);
        expect(expandButton.textContent).toBe('3');
        click(expandButton);
        expect(callbacks.onExpand).toHaveBeenCalledWith(
            expect.any(MouseEvent),
            'name:abraham',
        );
        click(getButton(box, 'Open detail'));
        expect(callbacks.onOpenDetail).toHaveBeenCalledWith('name:abraham');
        const verseButton = getButton(box, 'Verses');
        expect(verseButton.textContent).toBe('2');
        click(verseButton);
        expect(callbacks.onOpenVerses).toHaveBeenCalledWith(
            expect.any(MouseEvent),
            'name:abraham',
        );
        click(getButton(box, 'Collapse'));
        expect(callbacks.onToggleCollapsed).toHaveBeenCalledWith(
            'name:abraham',
        );
        click(getButton(box, 'Remove'));
        expect(callbacks.onRemove).toHaveBeenCalledWith('name:abraham');
        click(box.querySelector('.mock-dots') as Element);
        expect(callbacks.onContextMenu).toHaveBeenCalledWith(
            expect.any(MouseEvent),
            'name:abraham',
        );
        expect(callbacks.onReRoot).not.toHaveBeenCalled();
        expect(callbacks.onPointerDown).toHaveBeenCalledTimes(0);
    });

    test('the box itself answers a press, a double-click and a right-click', () => {
        const callbacks = genCallbacks();
        render(
            <GraphNodeBoxComp
                node={genNode('location:ur', 0, 0)}
                view={null}
                neighbourCount={-1}
                isRoot={false}
                isOnPath={false}
                isBusy={false}
                callbacks={callbacks}
            />,
        );
        const box = container.querySelector('.graph-view__node') as HTMLElement;
        act(() => {
            box.dispatchEvent(
                new MouseEvent('pointerdown', { bubbles: true, button: 0 }),
            );
        });
        expect(callbacks.onPointerDown).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'pointerdown' }),
            'location:ur',
        );
        const doubleClick = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            box.dispatchEvent(doubleClick);
        });
        expect(doubleClick.defaultPrevented).toBe(true);
        expect(callbacks.onReRoot).toHaveBeenCalledWith('location:ur');
        act(() => {
            box.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(callbacks.onContextMenu).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'contextmenu' }),
            'location:ur',
        );
        // Not counted yet: the badge stays quiet but the button is live.
        const expandButton = getButton(box, 'Open all Related');
        expect(expandButton.textContent).toBe('');
        expect(expandButton.disabled).toBe(false);
    });

    test('a box with nothing related, busy, or the root, drops those actions', () => {
        const callbacks = genCallbacks();
        render(
            <GraphNodeBoxComp
                node={genNode('name:root', 0, 0)}
                view={null}
                neighbourCount={0}
                isRoot
                isOnPath={false}
                isBusy
                callbacks={callbacks}
            />,
        );
        const box = container.querySelector('.graph-view__node') as HTMLElement;
        expect(box.className).toBe('graph-view__node graph-view__node--root');
        expect(box.dataset.typeKey).toBe('unknown');
        expect(box.querySelector('.graph-view__node-icon')?.className).toBe(
            'bi bi-question-circle graph-view__node-icon',
        );
        expect(box.querySelector('.graph-view__node-name')?.textContent).toBe(
            'root',
        );
        const expandButton = getButton(box, 'No related records');
        expect(expandButton.disabled).toBe(true);
        expect(expandButton.querySelector('i')?.className).toBe(
            'bi bi-arrow-repeat graph-view__spin',
        );
        expect(box.querySelector('[title="Remove"]')).toBeNull();
        expect(box.querySelector('[title="Verses"]')).toBeNull();
        expect(box.querySelector('.graph-view__node-title')).toBeNull();
    });

    test('a collapsed box keeps only its head and an expand button', () => {
        const callbacks = genCallbacks();
        render(
            <GraphNodeBoxComp
                node={genNode('name:isaac', 0, 0, { isCollapsed: true })}
                view={view}
                neighbourCount={2}
                isRoot={false}
                isOnPath={false}
                isBusy={false}
                callbacks={callbacks}
            />,
        );
        const box = container.querySelector('.graph-view__node') as HTMLElement;
        expect(box.classList.contains('graph-view__node--collapsed')).toBe(
            true,
        );
        expect(box.querySelector('.graph-view__node-actions')).toBeNull();
        click(getButton(box, 'Expand'));
        expect(callbacks.onToggleCollapsed).toHaveBeenCalledWith('name:isaac');
        // The head's menu button is still there for a collapsed box.
        click(box.querySelector('.mock-dots') as Element);
        expect(callbacks.onContextMenu).toHaveBeenCalledTimes(1);
    });
});

describe('GraphDockComp', () => {
    function renderDock(graphKey: string, onFitToView = vi.fn()) {
        const graph = findGraph(graphKey) as GraphViewType;
        render(
            <GraphDockComp
                graph={graph}
                onFitToView={onFitToView}
                onRelayout={vi.fn()}
                onUndo={vi.fn()}
                onRedo={vi.fn()}
                visibleCount={1}
            />,
        );
        return container.querySelector('.graph-view__dock') as HTMLElement;
    }

    function openWithChildren() {
        const graphKey = openGraphPreview('location-name', {
            kind: 'name',
            recordId: 'abraham',
            name: 'Abraham',
        });
        getGraphEngine().addNeighbours(graphKey, {
            originKey: 'name:abraham',
            neighbourList: ['isaac', 'ishmael'].map((recordId) => {
                return {
                    kind: 'name',
                    recordId,
                    name: recordId,
                    relation: 'child',
                };
            }),
            relationDefList: RELATION_DEF_LIST,
        });
        return graphKey;
    }

    test('collapses and expands every box through the engine', () => {
        const graphKey = openWithChildren();
        let dock = renderDock(graphKey);
        expect(dock.dataset.graphDock).toBe('true');
        // Filtered: one of three boxes is showing.
        expect(dock.querySelector('.graph-view__count')?.textContent).toBe(
            '1 / 3',
        );
        click(getButton(dock, 'Collapse all'));
        expect(
            findGraph(graphKey)?.nodeList.every((node) => {
                return node.isCollapsed;
            }),
        ).toBe(true);
        dock = renderDock(graphKey);
        const expandAll = getButton(dock, 'Expand all');
        expect(expandAll.querySelector('i')?.className).toBe(
            'bi bi-chevron-down',
        );
        // The collapse was a step, so undo is live now.
        expect(getButton(dock, 'Undo (Ctrl+Z)').disabled).toBe(false);
        click(expandAll);
        expect(
            findGraph(graphKey)?.nodeList.some((node) => {
                return node.isCollapsed;
            }),
        ).toBe(false);
    });

    test('fits without handing the click event on, and zooms the engine', () => {
        const graphKey = openWithChildren();
        const onFitToView = vi.fn();
        const dock = renderDock(graphKey, onFitToView);
        click(getButton(dock, 'Fit to view'));
        expect(onFitToView).toHaveBeenCalledTimes(1);
        expect(onFitToView).toHaveBeenCalledWith();
        const range = dock.querySelector('.mock-range') as HTMLElement;
        expect(range.dataset.value).toBe('100');
        expect(range.title).toBe('Zoom');
        click(range);
        expect(findGraph(graphKey)?.zoomPercent).toBe(150);
    });
});

describe('OpenGraphPreviewButtonComp', () => {
    test('opens the record graph without the press reaching the title bar', () => {
        const onParentClick = vi.fn();
        render(
            <div onClick={onParentClick}>
                <OpenGraphPreviewButtonComp
                    kind="location"
                    recordId="bethel"
                    name="Bethel"
                />
            </div>,
        );
        const button = getButton(container, 'Open Graph Preview');
        expect(button.getAttribute('aria-label')).toBe('Open Graph Preview');
        expect(button.querySelector('i')?.className).toBe('bi bi-diagram-3');
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            button.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(onParentClick).not.toHaveBeenCalled();
        expect(findGraph('location-name:location:bethel')).toMatchObject({
            title: 'Bethel',
        });
    });
});

describe('LookupGraphBodyComp', () => {
    function genGraphView() {
        getGraphEngine().open({
            sourceId: 'location-name',
            root: { kind: 'name', recordId: 'sarah', name: 'Sarah' },
        });
        return findGraph('location-name:name:sarah') as GraphViewType;
    }

    test('shows loading while the lookup data is being read', () => {
        h.managers = undefined;
        render(<LookupGraphBodyComp graph={genGraphView()} />);
        expect(container.querySelector('.mock-loading')).not.toBeNull();
        expect(container.querySelector('.mock-surface')).toBeNull();
    });

    test('says so when the lookup data failed to load', () => {
        h.managers = null;
        render(<LookupGraphBodyComp graph={genGraphView()} />);
        expect(container.textContent).toBe('Failed to load lookup data');
    });

    test('hands the managers, both fonts and the record wording to the surface', () => {
        const managers = { namesLookupManager: {} };
        h.managers = managers;
        const graph = genGraphView();
        render(<LookupGraphBodyComp graph={graph} />);
        expect(container.querySelector('.mock-surface')?.textContent).toBe(
            'Sarah|RecordFont|VerseFont|record:Abraham',
        );
        const props = h.surfacePropsList.at(-1);
        expect(props.graph).toBe(graph);
        expect(props.context).toBe(managers);
        expect(props.source).toBe(h.source);
    });
});

describe('GraphViewPanelsComp and its host', () => {
    test('render nothing while no graph is open', () => {
        render(
            <>
                <GraphViewPanelsHostComp />
                <GraphViewPanelsComp />
            </>,
        );
        expect(container.innerHTML).toBe('');
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();
    });

    test('the host lazily mounts one cascading panel per open graph', async () => {
        h.managers = { namesLookupManager: {} };
        render(<GraphViewPanelsHostComp />);
        act(() => {
            openGraphPreview('location-name', {
                kind: 'name',
                recordId: 'abraham',
                name: 'Abraham',
            });
            openGraphPreview('other-source', {
                kind: 'name',
                recordId: 'noah',
                name: 'Noah',
            });
        });
        await waitFor(() => {
            return document.querySelectorAll('.mock-widget').length === 2;
        });
        await waitFor(() => {
            return document.querySelector('.mock-surface') !== null;
        });
        const portal = document.querySelector(
            '.app-floating-widget-portal',
        ) as HTMLElement;
        expect(portal.parentElement).toBe(document.body);
        expect(portal.dataset.bsTheme).toBe('dark');
        const widgetList = Array.from(
            portal.querySelectorAll<HTMLElement>('.mock-widget'),
        );
        expect(
            widgetList.map((widget) => {
                return [widget.dataset.widgetName, widget.dataset.offset];
            }),
        ).toEqual([
            ['Graph Preview', '0'],
            ['Graph Preview', '28'],
        ]);
        const options = h.widgetPropsList.at(-1).options;
        expect(options).toMatchObject({
            width: 940,
            height: 620,
            isAboveModal: true,
            isBodyDraggable: false,
            extraClassName: 'graph-view-widget',
        });
        // The lookup panel's title carries the record font; the other has none.
        const [lookupTitle, otherTitle] = widgetList.map((widget) => {
            return widget.querySelector(
                '.mock-widget-title > span',
            ) as HTMLElement;
        });
        expect(lookupTitle.textContent).toBe('Abraham');
        expect(lookupTitle.style.fontFamily).toBe('RecordFont');
        expect(otherTitle.textContent).toBe('Noah');
        expect(otherTitle.style.fontFamily).toBe('');
        expect(widgetList[0].querySelector('.mock-surface')?.textContent).toBe(
            'Abraham|RecordFont|VerseFont|record:Abraham',
        );
        expect(widgetList[1].textContent).toContain('Record not found');
    });

    test('raising and closing a panel go through the engine', async () => {
        h.managers = { namesLookupManager: {} };
        render(<GraphViewPanelsComp />);
        let graphKey = '';
        act(() => {
            graphKey = openGraphPreview('location-name', {
                kind: 'location',
                recordId: 'ur',
                name: 'Ur',
            });
        });
        await waitFor(() => {
            return document.querySelector('.mock-widget') !== null;
        });
        const widget = document.querySelector('.mock-widget') as HTMLElement;
        expect(widget.dataset.raise).toBe('0');
        act(() => {
            openGraphPreview('location-name', {
                kind: 'location',
                recordId: 'ur',
                name: 'Ur',
            });
        });
        expect(
            (document.querySelector('.mock-widget') as HTMLElement).dataset
                .raise,
        ).toBe('1');
        click(document.querySelector('.mock-widget-close') as Element);
        expect(findGraph(graphKey)).toBeNull();
        expect(document.querySelector('.mock-widget')).toBeNull();
    });
});
