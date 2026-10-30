// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { DataInputType, FlexSizeType } from './flexSizeHelpers';

const state = vi.hoisted(() => ({
    saved: new Map<string, unknown>(),
    writes: [] as [string, unknown][],
    itemProps: [] as any[],
    observers: [] as {
        callback: (entries: any[]) => void;
        disconnect: () => void;
    }[],
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../helper/helpers', () => ({
    freezeObject: (value: object) => Object.freeze(value),
}));
vi.mock('./flexSizeHelpers', () => ({
    getFlexSizeSetting: (name: string, defaultSize: FlexSizeType) =>
        (state.saved.get(name) as FlexSizeType | undefined) ?? defaultSize,
    setFlexSizeSetting: (name: string, size: FlexSizeType) => {
        state.writes.push([name, size]);
        state.saved.set(name, size);
    },
}));
vi.mock('./RenderResizeActorItemComp', () => ({
    renderResizerChildren: (children: { render: () => unknown }) =>
        children.render(),
    default: (props: any) => {
        state.itemProps.push(props);
        const [flex] = props.flexSize[props.data.key] ?? ['?'];
        return (
            <div
                data-fs={flex}
                data-fs-default={props.defaultFlexSize[props.data.key][0]}
                data-name={props.flexSizeName}
            >
                {props.data.key}
            </div>
        );
    },
}));

import ResizeActorComp from './ResizeActorComp';
import ResizeActorDynamicComp from './ResizeActorDynamicComp';
import { resetAllWidgets } from './widgetRegistry';

const DEFAULTS: FlexSizeType = { left: ['1'], right: ['2'] };

function genData(keys: string[]): DataInputType[] {
    return keys.map((key) => ({
        key,
        widgetName: key,
        children: { render: () => <span className="pane">{key}</span> },
    }));
}

let host: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
    act(() => {
        root.render(node);
    });
}

function panes() {
    return [...host.querySelectorAll<HTMLElement>('[data-fs]')].map(
        (pane) => `${pane.textContent}:${pane.dataset.fs}`,
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.saved.clear();
    state.writes = [];
    state.itemProps = [];
    state.observers = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('a resizable group of panes', () => {
    test('refuses a pane that has no default size', () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        expect(() =>
            render(
                <ResizeActorComp
                    isHorizontal
                    flexSizeName="group"
                    flexSizeDefault={{ left: ['1'] }}
                    dataInput={genData(['left', 'ghost'])}
                />,
            ),
        ).toThrow('key ghost not found in flexSizeDefault');
        consoleError.mockRestore();
    });

    test('draws nothing for no pane and a single pane alone, with the container style', () => {
        render(
            <ResizeActorComp
                isHorizontal
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={[]}
            />,
        );
        expect(host.innerHTML).toBe('');

        render(
            <ResizeActorComp
                isHorizontal
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left'])}
                containerStyle={{ padding: '3px' }}
            />,
        );
        const single = host.firstElementChild as HTMLElement;
        expect(single.style.padding).toBe('3px');
        expect(single.querySelector('.pane')?.textContent).toBe('left');
        expect(panes()).toEqual([]);
    });

    test('restores the saved layout, and saves a resize under its own name', () => {
        state.saved.set('group', { left: ['3'], right: ['4'] });

        render(
            <ResizeActorComp
                isHorizontal
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left', 'right'])}
            />,
        );
        expect(panes()).toEqual(['left:3', 'right:4']);
        expect(host.firstElementChild?.className).toContain('flex h');

        act(() => {
            state.itemProps.at(-1).setFlexSize({ left: ['5'], right: ['1'] });
        });
        expect(state.writes.at(-1)).toEqual([
            'group',
            { left: ['5'], right: ['1'] },
        ]);
        expect(panes()).toEqual(['left:5', 'right:1']);
    });

    test('a group that keeps no setting starts from its defaults and writes nothing', () => {
        state.saved.set('group', { left: ['3'], right: ['4'] });

        render(
            <ResizeActorComp
                isHorizontal={false}
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left', 'right'])}
                isNotSaveSetting
            />,
        );
        expect(panes()).toEqual(['left:1', 'right:2']);
        expect(host.firstElementChild?.className).toContain('flex v');

        act(() => {
            state.itemProps.at(-1).setFlexSize({ left: ['2'], right: ['2'] });
        });
        expect(state.writes).toEqual([]);
        expect(panes()).toEqual(['left:2', 'right:2']);
    });

    test('repairs a saved layout that lost a pane or kept one that is gone', () => {
        state.saved.set('group', { left: ['3'], old: ['9'] });

        render(
            <ResizeActorComp
                isHorizontal
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left', 'right'])}
            />,
        );

        expect(state.writes).toEqual([
            ['group', { left: ['3'], right: ['2'] }],
        ]);
        expect(panes()).toEqual(['left:3', 'right:2']);
    });

    test('reads the new document’s layout as soon as the name changes', () => {
        state.saved.set('doc-a', { left: ['3'], right: ['1'] });
        state.saved.set('doc-b', { left: ['1'], right: ['6'] });
        const draw = (name: string) => (
            <ResizeActorComp
                isHorizontal
                flexSizeName={name}
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left', 'right'])}
            />
        );

        render(draw('doc-a'));
        expect(panes()).toEqual(['left:3', 'right:1']);
        state.itemProps = [];
        render(draw('doc-b'));

        expect(panes()).toEqual(['left:1', 'right:6']);
        // The old document's panes never painted under the new name.
        expect(
            state.itemProps.every(
                (props) =>
                    props.flexSizeName !== 'doc-b' ||
                    props.flexSize.right[0] === '6',
            ),
        ).toBe(true);
    });

    test('Reset puts every pane back to its default, dragged widths included, until it unmounts', () => {
        state.saved.set('group', { left: ['3'], right: ['4'] });
        render(
            <ResizeActorComp
                isHorizontal
                flexSizeName="group"
                flexSizeDefault={DEFAULTS}
                dataInput={genData(['left', 'right'])}
            />,
        );
        const [left] = host.querySelectorAll<HTMLElement>('[data-fs]');
        // A drag writes the grow straight onto the pane.
        left.style.flexGrow = '7';

        act(() => {
            resetAllWidgets();
        });

        expect(state.writes.at(-1)).toEqual(['group', DEFAULTS]);
        expect(panes()).toEqual(['left:1', 'right:2']);
        // The dragged grow is gone: the pane is back on its default flex.
        expect(left.style.flexGrow).toBe('1');
        expect(left.style.flexGrow).not.toBe('7');

        act(() => root.unmount());
        root = createRoot(host);
        const writeCount = state.writes.length;
        resetAllWidgets();
        expect(state.writes).toHaveLength(writeCount);
    });
});

describe('a group that turns with the space it has', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: (entries: any[]) => void) {
                    state.observers.push({
                        callback,
                        disconnect: () => {
                            state.observers = state.observers.filter(
                                (one) => one.callback !== callback,
                            );
                        },
                    });
                }
                observe() {}
                disconnect() {
                    state.observers.at(-1)?.disconnect();
                }
            },
        );
    });

    test('lays the panes side by side once wide enough, each way under its own setting', () => {
        render(
            <ResizeActorDynamicComp
                flexSizeName="lookup"
                data={{
                    minWidth: 600,
                    horizontal: {
                        flexSizeDefault: DEFAULTS,
                        dataInput: genData(['left', 'right']),
                    },
                    vertical: {
                        flexSizeDefault: { left: ['2'], right: ['1'] },
                        dataInput: genData(['left', 'right']),
                    },
                }}
            />,
        );
        const container = host.firstElementChild as HTMLElement;
        expect(container.style.visibility).toBe('visible');
        // A fresh element has no width: it starts stacked.
        expect(panes()).toEqual(['left:2', 'right:1']);
        expect(state.itemProps.at(-1).flexSizeName).toBe('lookup-dyn-v');

        act(() => {
            state.observers[0].callback([{ contentRect: { width: 800 } }]);
        });
        expect(panes()).toEqual(['left:1', 'right:2']);
        expect(state.itemProps.at(-1).flexSizeName).toBe('lookup-dyn-h');
        expect(state.itemProps.at(-1).anotherDefaultFlexSize).toEqual({
            left: ['2'],
            right: ['1'],
        });

        // An empty report changes nothing.
        act(() => {
            state.observers[0].callback([]);
        });
        expect(state.itemProps.at(-1).flexSizeName).toBe('lookup-dyn-h');

        act(() => root.unmount());
        root = createRoot(host);
        expect(state.observers).toHaveLength(0);
    });
});
