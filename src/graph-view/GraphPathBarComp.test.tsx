// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
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
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
// The picker's search runs at once rather than after its debounce.
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => {
        return (callback: () => void) => {
            callback();
        };
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('./graphFitHelpers', () => ({ fitGraphOnScreen: vi.fn() }));

import { handleError } from '../helper/errorHelpers';
import GraphPathBarComp, { genNoConnectionMessage } from './GraphPathBarComp';
import { GRAPH_MAX_PATH_HOP } from './core';
import type { GraphSourceType } from './core';
import { fitGraphOnScreen } from './graphFitHelpers';
import { getGraphEngine, useGraphView } from './graphViewStore';

const source: GraphSourceType<null> = {
    id: 'path-test',
    relationDefList: [],
    getNodeView: () => null,
    getNeighbours: () => [],
    countNeighbours: () => 0,
    getRelationLabel: () => '',
    searchNodes: () => [{ kind: 'name', recordId: 'far', name: 'Far Away' }],
    findPath: () => null,
};

const viewportRef = createRef<HTMLDivElement>();

function PathBarHostComp({ graphKey }: Readonly<{ graphKey: string }>) {
    const graph = useGraphView(graphKey);
    return (
        <>
            {graph === null ? null : (
                <GraphPathBarComp
                    graph={graph}
                    source={source}
                    context={null}
                    viewportRef={viewportRef}
                />
            )}
            <div ref={viewportRef} className="viewport" tabIndex={0} />
        </>
    );
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    );
    descriptor?.set?.call(input, value);
}

describe('genNoConnectionMessage', () => {
    test('says how far the search looked, from the constant', () => {
        expect(genNoConnectionMessage()).toBe(
            `No connection found within ${GRAPH_MAX_PATH_HOP} steps`,
        );
        expect(genNoConnectionMessage()).not.toContain('{count}');
    });
});

describe('GraphPathBarComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    const getInput = () => {
        return container.querySelector<HTMLInputElement>(
            'input[aria-label="Path to"]',
        );
    };
    const getFindButton = () => {
        return Array.from(container.querySelectorAll('button')).find(
            (button) => {
                return button.textContent === 'Find Connection';
            },
        )!;
    };
    const pickFarAway = () => {
        const input = getInput()!;
        input.focus();
        act(() => {
            setNativeInputValue(input, 'Far');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const row = container.querySelector<HTMLButtonElement>(
            '.graph-view__picker-list button',
        )!;
        row.focus();
        act(() => {
            row.click();
        });
    };

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.showSimpleToastMock.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        getGraphEngine().closeAll();
        const graphKey = getGraphEngine().open({
            sourceId: source.id,
            root: { kind: 'name', recordId: 'root', name: 'Root' },
        });
        root = createRoot(container);
        act(() => {
            root.render(<PathBarHostComp graphKey={graphKey} />);
        });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        getGraphEngine().closeAll();
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    // The row pressed and the chip's ✕ are both gone once they have done
    // their job; focus left on neither falls to <body>, where Ctrl+Z is the
    // browser's undo of the Reader's reference box (RD-102).
    test('a pick hands focus to Find, and clearing it to the search box', () => {
        pickFarAway();
        expect(getInput()).toBeNull();
        expect(document.activeElement).toBe(getFindButton());

        const clear = container.querySelector<HTMLButtonElement>(
            '[aria-label="Clear search"]',
        )!;
        clear.focus();
        act(() => {
            clear.click();
        });
        expect(document.activeElement).toBe(getInput());
    });

    test('a search that finds nothing says how far it looked', async () => {
        pickFarAway();
        await act(async () => {
            getFindButton().click();
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
        const expected = `No connection found within ${GRAPH_MAX_PATH_HOP} steps`;
        expect(
            container.querySelector('.graph-view__path-message')?.textContent,
        ).toBe(expected);
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Find Connection',
            expected,
        );
        // Find is disabled while it searches: the canvas holds the focus.
        expect(document.activeElement).toBe(viewportRef.current);
    });
});

describe('GraphPathBarComp with other sources', () => {
    let container: HTMLDivElement;
    let root: Root;
    let graphKey: string;
    const barViewportRef = createRef<HTMLDivElement>();

    const farRef = { kind: 'name', recordId: 'far', name: 'Far Away' };
    const genSource = (
        patch: Partial<GraphSourceType<null>>,
    ): GraphSourceType<null> => {
        return { ...source, id: 'path-test', ...patch };
    };

    function OtherPathBarHostComp({
        barSource,
        isViewportShown,
    }: Readonly<{
        barSource: GraphSourceType<null>;
        isViewportShown: boolean;
    }>) {
        const graph = useGraphView(graphKey);
        return (
            <>
                {graph === null ? null : (
                    <GraphPathBarComp
                        graph={graph}
                        source={barSource}
                        context={null}
                        viewportRef={barViewportRef}
                    />
                )}
                {isViewportShown ? (
                    <div
                        ref={barViewportRef}
                        className="viewport"
                        tabIndex={0}
                    />
                ) : null}
            </>
        );
    }

    function renderBar(
        barSource: GraphSourceType<null>,
        isViewportShown = true,
    ) {
        act(() => {
            root.render(
                <OtherPathBarHostComp
                    barSource={barSource}
                    isViewportShown={isViewportShown}
                />,
            );
        });
    }

    function getGraph() {
        return getGraphEngine()
            .getSnapshot()
            .find((graph) => {
                return graph.key === graphKey;
            })!;
    }

    const getInput = () => {
        return container.querySelector<HTMLInputElement>(
            'input[aria-label="Path to"]',
        );
    };
    const getFindButton = () => {
        return Array.from(container.querySelectorAll('button')).find(
            (button) => {
                return button.textContent === 'Find Connection';
            },
        )!;
    };
    const typeQuery = (value: string) => {
        const input = getInput()!;
        act(() => {
            setNativeInputValue(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };
    const pickFirstRow = () => {
        typeQuery('Far');
        const row = container.querySelector<HTMLButtonElement>(
            '.graph-view__picker-list button',
        )!;
        act(() => {
            row.click();
        });
    };
    const pressFind = async () => {
        await act(async () => {
            getFindButton().click();
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    };
    const threeBoxPath = () => {
        return [
            { kind: 'name', recordId: 'root', name: 'Root' },
            { kind: 'name', recordId: 'mid', name: 'Middle' },
            farRef,
        ];
    };

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        getGraphEngine().closeAll();
        graphKey = getGraphEngine().open({
            sourceId: 'path-test',
            root: { kind: 'name', recordId: 'root', name: 'Root' },
        });
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        getGraphEngine().closeAll();
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('a blank query empties the list; a source with no search lists nothing', () => {
        renderBar(genSource({}));
        typeQuery('Far');
        expect(
            container.querySelectorAll('.graph-view__picker-list button'),
        ).toHaveLength(1);
        typeQuery('   ');
        expect(container.querySelector('.graph-view__picker-list')).toBeNull();

        renderBar(genSource({ searchNodes: undefined }));
        typeQuery('Far');
        expect(container.querySelector('.graph-view__picker-list')).toBeNull();
    });

    test('picking the centre itself leaves Find disabled and the canvas focused', () => {
        renderBar(
            genSource({
                searchNodes: () => {
                    return [{ kind: 'name', recordId: 'root', name: 'Root' }];
                },
            }),
        );
        pickFirstRow();
        expect(getFindButton().disabled).toBe(true);
        expect(document.activeElement).toBe(barViewportRef.current);
    });

    test('a found path is laid out to the width of the viewport', async () => {
        const findPath = vi.fn(threeBoxPath);
        renderBar(
            genSource({
                searchNodes: () => {
                    return [farRef];
                },
                findPath,
                getPathHopList: () => {
                    return [
                        { relation: 'child', isReversed: false },
                        { relation: 'child', isReversed: true },
                    ];
                },
            }),
        );
        Object.defineProperty(barViewportRef.current, 'clientWidth', {
            configurable: true,
            value: 2400,
        });
        pickFirstRow();
        await pressFind();
        expect(findPath).toHaveBeenCalledWith(null, 'root', 'far');
        const graph = getGraph();
        expect(graph.pathNodeKeyList).toEqual([
            'name:root',
            'name:mid',
            'name:far',
        ]);
        expect(graph).toMatchObject({ pathFromId: 'root', pathToId: 'far' });
        // 2400 wide holds ten boxes a row: the three sit on one line.
        expect(
            graph.nodeList.map((node) => {
                return [node.x, node.y];
            }),
        ).toEqual([
            [0, 0],
            [240, 0],
            [480, 0],
        ]);
        // The reversed hop stores the canonical edge pointing back.
        expect(graph.edgeList[1]).toMatchObject({
            fromKey: 'name:far',
            toKey: 'name:mid',
        });
        expect(fitGraphOnScreen).toHaveBeenCalledWith(
            graphKey,
            barViewportRef.current,
            undefined,
            false,
        );
        expect(getFindButton().disabled).toBe(false);
    });

    test('with no viewport a path wraps at four boxes of width', async () => {
        renderBar(
            genSource({
                searchNodes: () => {
                    return [farRef];
                },
                findPath: threeBoxPath,
            }),
            false,
        );
        pickFirstRow();
        await pressFind();
        // 672 units hold two boxes a row, and the next row runs back.
        expect(
            getGraph().nodeList.map((node) => {
                return [node.x, node.y];
            }),
        ).toEqual([
            [0, 0],
            [240, 0],
            [240, 150],
        ]);
    });

    test('a search that throws is reported and Find comes back', async () => {
        renderBar(
            genSource({
                searchNodes: () => {
                    return [farRef];
                },
                findPath: () => {
                    throw new Error('walk failed');
                },
            }),
        );
        pickFirstRow();
        await pressFind();
        expect(handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'walk failed' }),
        );
        expect(getFindButton().disabled).toBe(false);
        expect(getGraph().pathNodeKeyList).toEqual([]);
    });

    test('a source that cannot find paths ignores Find', async () => {
        renderBar(
            genSource({
                searchNodes: () => {
                    return [farRef];
                },
                findPath: undefined,
            }),
        );
        pickFirstRow();
        await pressFind();
        expect(handleError).not.toHaveBeenCalled();
        expect(container.querySelector('.graph-view__path-message')).toBeNull();
        expect(getFindButton().disabled).toBe(false);
        expect(getGraph().pathNodeKeyList).toEqual([]);
    });

    test('a centre the source cannot path from shows only the reason', () => {
        act(() => {
            getGraphEngine().closeAll();
            graphKey = getGraphEngine().open({
                sourceId: 'path-test',
                root: { kind: 'location', recordId: 'ur', name: 'Ur' },
            });
        });
        renderBar(
            genSource({
                getPathBlockedReason: (node) => {
                    return node.kind === 'location'
                        ? 'Paths connect people only'
                        : '';
                },
            }),
        );
        expect(
            container.querySelector('.graph-view__path-bar')?.textContent,
        ).toBe('Paths connect people only');
        expect(getInput()).toBeNull();
    });
});
