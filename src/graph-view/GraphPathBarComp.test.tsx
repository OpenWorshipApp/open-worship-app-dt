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

import GraphPathBarComp, { genNoConnectionMessage } from './GraphPathBarComp';
import { GRAPH_MAX_PATH_HOP } from './core';
import type { GraphSourceType } from './core';
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
