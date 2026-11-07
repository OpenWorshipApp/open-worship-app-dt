// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The React hooks of the floating preview's stores: each one must re-render its
// component when — and only when — ITS answer changes, and stop listening once
// unmounted. The plain store functions are covered by the sibling
// `presentingFlowPreviewFloatingHelpers.coverage.test.ts`.

const { state, mocks } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
    mocks: {
        handleError: vi.fn(),
        notifySelectionChanged: vi.fn(),
        removeSetting: vi.fn(),
        setSetting: vi.fn(),
    },
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/domHelpers', () => ({
    findVerticalScrollingParent: () => null,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToCenterView: () => undefined,
    bringDomToNearestView: () => undefined,
    checkIsVerticalAtBottom: () => false,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
    removeSetting: mocks.removeSetting,
    setSetting: mocks.setSetting,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    notifyPresentingFlowRunSelectionChanged: mocks.notifySelectionChanged,
}));
vi.mock('./presentingFlowHelpers', () => ({
    toPresentingFlowSettingName: (...parts: string[]) => parts.join('::'),
}));

import {
    clearPresentingFlowPreviewSelectedItem,
    closePresentingFlowPreviewFilePath,
    getPresentingFlowPreviewFilePaths,
    openPresentingFlowPreviewFilePath,
    resolvePresentingFlowPreviewSelectedChildIndex,
    setAllPresentingFlowPreviewItemsCollapsed,
    setPresentingFlowPreviewItemCollapsed,
    setPresentingFlowPreviewSelectedChild,
    setPresentingFlowPreviewSelectedItem,
    usePresentingFlowPreviewCollapsedCount,
    usePresentingFlowPreviewFilePaths,
    usePresentingFlowPreviewIsChildSelected,
    usePresentingFlowPreviewIsItemSelected,
    usePresentingFlowPreviewItemExpanding,
    useIsPresentingFlowPreviewOpened,
} from './presentingFlowPreviewFloatingHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function readText(testId: string) {
    return container.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

beforeEach(() => {
    state.settings.clear();
    for (const filePath of [...getPresentingFlowPreviewFilePaths()]) {
        closePresentingFlowPreviewFilePath(filePath);
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('opened preview hooks', () => {
    function OpenedListComp() {
        const filePaths = usePresentingFlowPreviewFilePaths();
        return <span data-testid="list">{filePaths.join(',')}</span>;
    }
    function OpenedFlagComp({
        filePath,
        onRender,
    }: Readonly<{ filePath: string; onRender: () => void }>) {
        onRender();
        const isOpened = useIsPresentingFlowPreviewOpened(filePath);
        return (
            <span data-testid={`flag-${filePath}`}>
                {isOpened ? 'open' : 'closed'}
            </span>
        );
    }

    test('re-renders the list and the one row whose answer changed', async () => {
        const onRenderOne = vi.fn();
        const onRenderTwo = vi.fn();
        await act(async () => {
            root.render(
                <>
                    <OpenedListComp />
                    <OpenedFlagComp filePath="/one" onRender={onRenderOne} />
                    <OpenedFlagComp filePath="/two" onRender={onRenderTwo} />
                </>,
            );
        });
        expect(readText('list')).toBe('');
        expect(readText('flag-/one')).toBe('closed');
        const twoRendersBefore = onRenderTwo.mock.calls.length;

        await act(async () => {
            openPresentingFlowPreviewFilePath('/one');
        });
        expect(readText('list')).toBe('/one');
        expect(readText('flag-/one')).toBe('open');
        expect(readText('flag-/two')).toBe('closed');
        // `/two`'s boolean never flipped, so it was not re-rendered.
        expect(onRenderTwo.mock.calls.length).toBe(twoRendersBefore);

        await act(async () => {
            openPresentingFlowPreviewFilePath('/two');
        });
        expect(readText('list')).toBe('/one,/two');
        await act(async () => {
            closePresentingFlowPreviewFilePath('/one');
        });
        expect(readText('list')).toBe('/two');
        expect(readText('flag-/one')).toBe('closed');
        expect(readText('flag-/two')).toBe('open');
    });

    test('stops listening once unmounted', async () => {
        const onRender = vi.fn();
        await act(async () => {
            root.render(
                <OpenedFlagComp filePath="/gone" onRender={onRender} />,
            );
        });
        await act(async () => {
            root.render(<span>empty</span>);
        });
        const renders = onRender.mock.calls.length;
        await act(async () => {
            openPresentingFlowPreviewFilePath('/gone');
        });
        expect(onRender.mock.calls.length).toBe(renders);
        expect(container.textContent).toBe('empty');
    });
});

describe('cursor hooks', () => {
    function ItemCursorComp({
        filePath,
        itemKey,
        index,
    }: Readonly<{ filePath: string; itemKey: string; index: number }>) {
        const isSelected = usePresentingFlowPreviewIsItemSelected(
            filePath,
            itemKey,
            index,
        );
        return (
            <span data-testid={`item-${index}`}>
                {isSelected ? 'on' : 'off'}
            </span>
        );
    }
    function ChildCursorComp({
        filePath,
        itemKey,
        index,
        childId,
    }: Readonly<{
        filePath: string;
        itemKey: string | null;
        index: number;
        childId: number;
    }>) {
        const isSelected = usePresentingFlowPreviewIsChildSelected(
            filePath,
            itemKey,
            index,
            childId,
        );
        return (
            <span data-testid={`child-${itemKey}-${childId}`}>
                {isSelected ? 'on' : 'off'}
            </span>
        );
    }

    test('marks only the element at the cursor position, never its twin', async () => {
        await act(async () => {
            root.render(
                <>
                    <ItemCursorComp filePath="/run" itemKey="song" index={0} />
                    <ItemCursorComp filePath="/run" itemKey="song" index={1} />
                </>,
            );
        });
        expect(readText('item-0')).toBe('off');
        await act(async () => {
            setPresentingFlowPreviewSelectedItem('/run', 'song', 1);
        });
        expect(readText('item-0')).toBe('off');
        expect(readText('item-1')).toBe('on');
        await act(async () => {
            clearPresentingFlowPreviewSelectedItem('/run');
        });
        expect(readText('item-1')).toBe('off');
    });

    test('marks the selected slide of the selected element only', async () => {
        await act(async () => {
            root.render(
                <>
                    <ChildCursorComp
                        filePath="/slides"
                        itemKey="doc"
                        index={2}
                        childId={10}
                    />
                    <ChildCursorComp
                        filePath="/slides"
                        itemKey="doc"
                        index={2}
                        childId={11}
                    />
                    <ChildCursorComp
                        filePath="/slides"
                        itemKey={null}
                        index={2}
                        childId={11}
                    />
                </>,
            );
        });
        await act(async () => {
            setPresentingFlowPreviewSelectedItem('/slides', 'doc', 2);
        });
        // Landing on the element selects no slide of it yet.
        expect(readText('child-doc-10')).toBe('off');
        expect(readText('child-doc-11')).toBe('off');
        expect(
            resolvePresentingFlowPreviewSelectedChildIndex(
                '/slides',
                'doc',
                2,
                [{ id: 10 }, { id: 11 }],
            ),
        ).toBe(-1);

        await act(async () => {
            setPresentingFlowPreviewSelectedChild('/slides', 'doc', 2, 11);
        });
        expect(readText('child-doc-10')).toBe('off');
        expect(readText('child-doc-11')).toBe('on');
        // A card with no cursor of its own (`itemKey` null) is never marked.
        expect(readText('child-null-11')).toBe('off');

        await act(async () => {
            setPresentingFlowPreviewSelectedChild('/slides', 'doc', 2, 10);
        });
        expect(readText('child-doc-10')).toBe('on');
        expect(readText('child-doc-11')).toBe('off');
    });
});

describe('folding hooks', () => {
    function CollapsedCountComp({
        filePath,
        itemKeys,
    }: Readonly<{ filePath: string; itemKeys: string[] }>) {
        const count = usePresentingFlowPreviewCollapsedCount(
            filePath,
            itemKeys,
        );
        return <span data-testid="count">{count}</span>;
    }
    function ExpandingComp({
        filePath,
        itemKey,
    }: Readonly<{ filePath: string; itemKey: string }>) {
        const [isExpanded, toggle] = usePresentingFlowPreviewItemExpanding(
            filePath,
            itemKey,
        );
        return (
            <button
                type="button"
                data-testid={`toggle-${itemKey}`}
                onClick={toggle}
            >
                {isExpanded ? 'expanded' : 'collapsed'}
            </button>
        );
    }

    test('counts the listed keys that are folded, duplicates included', async () => {
        state.settings.set(
            'presenting-flow-preview-collapsed::/count',
            JSON.stringify(['a', 'gone']),
        );
        await act(async () => {
            root.render(
                <CollapsedCountComp
                    filePath="/count"
                    itemKeys={['a', 'a', 'b']}
                />,
            );
        });
        // `gone` is stored but not listed, `a` is listed twice.
        expect(readText('count')).toBe('2');
        await act(async () => {
            setPresentingFlowPreviewItemCollapsed('/count', 'b', true);
        });
        expect(readText('count')).toBe('3');
        await act(async () => {
            setAllPresentingFlowPreviewItemsCollapsed(
                '/count',
                ['a', 'b'],
                false,
            );
        });
        expect(readText('count')).toBe('0');
        expect(mocks.removeSetting).toHaveBeenCalledWith(
            'presenting-flow-preview-collapsed::/count',
        );
    });

    test('a chevron folds and unfolds its own element and persists it', async () => {
        await act(async () => {
            root.render(
                <>
                    <ExpandingComp filePath="/fold" itemKey="first" />
                    <ExpandingComp filePath="/fold" itemKey="second" />
                    <CollapsedCountComp
                        filePath="/fold"
                        itemKeys={['first', 'second']}
                    />
                </>,
            );
        });
        const first = container.querySelector<HTMLButtonElement>(
            '[data-testid="toggle-first"]',
        )!;
        expect(first.textContent).toBe('expanded');
        expect(readText('count')).toBe('0');

        await act(async () => {
            first.click();
        });
        expect(first.textContent).toBe('collapsed');
        expect(readText('toggle-second')).toBe('expanded');
        expect(readText('count')).toBe('1');
        expect(mocks.setSetting).toHaveBeenLastCalledWith(
            'presenting-flow-preview-collapsed::/fold',
            '["first"]',
        );

        // The toggle reads the CURRENT state through its ref, so a second press
        // unfolds rather than folding again.
        await act(async () => {
            first.click();
        });
        expect(first.textContent).toBe('expanded');
        expect(readText('count')).toBe('0');
        expect(mocks.removeSetting).toHaveBeenCalledWith(
            'presenting-flow-preview-collapsed::/fold',
        );
    });
});
