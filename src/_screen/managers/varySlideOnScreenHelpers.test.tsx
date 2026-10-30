// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
    type ListenerEntryType = { events: string[]; listener: () => void };
    const genManager = () => {
        const entries: ListenerEntryType[] = [];
        return {
            entries,
            registerEventListener: (events: string[], listener: () => void) => {
                const entry = { events, listener };
                entries.push(entry);
                return entry;
            },
            unregisterEventListener: (entry: ListenerEntryType) => {
                const index = entries.indexOf(entry);
                if (index >= 0) {
                    entries.splice(index, 1);
                }
            },
        };
    };
    return {
        varyManager: genManager(),
        baseManager: genManager(),
        // What the persisted on-screen map answers, per `filePath-id`.
        dataByKey: new Map<string, [string, any][]>(),
        getDataList: (() => []) as (filePath: string, id: number) => any,
    };
});

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: {
        getDataList: (filePath: string, id: number) => {
            return state.getDataList(filePath, id);
        },
        registerEventListener: (events: string[], listener: () => void) => {
            return state.varyManager.registerEventListener(events, listener);
        },
        unregisterEventListener: (entry: any) => {
            state.varyManager.unregisterEventListener(entry);
        },
    },
}));
vi.mock('./ScreenManagerBase', () => ({
    default: {
        registerEventListener: (events: string[], listener: () => void) => {
            return state.baseManager.registerEventListener(events, listener);
        },
        unregisterEventListener: (entry: any) => {
            state.baseManager.unregisterEventListener(entry);
        },
    },
}));
vi.mock('../../helper/appHooks', async () => {
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

import {
    releaseVarySlideOnScreenCache,
    toVarySlideOnScreenKey,
    useVarySlideOnScreenChangeEffect,
    useVarySlideOnScreenList,
} from './varySlideOnScreenHelpers';

let container: HTMLDivElement;
let root: Root;
const renders: { key: string; list: any }[] = [];
const getDataListCalls: string[] = [];

function PreviewComp({ filePath, id }: { filePath: string; id: number }) {
    const list = useVarySlideOnScreenList({ filePath, id } as any);
    renders.push({ key: `${filePath}-${id}`, list });
    return (
        <span data-key={`${filePath}-${id}`}>
            {list
                .map(([screenKey]) => {
                    return screenKey;
                })
                .join(',')}
        </span>
    );
}

function ChangeEffectComp({ onChange }: { onChange: () => void }) {
    useVarySlideOnScreenChangeEffect(onChange);
    renders.push({ key: 'change', list: null });
    return null;
}

function fireUpdate(manager: typeof state.varyManager) {
    for (const entry of [...manager.entries]) {
        entry.listener();
    }
}

function readText(key: string) {
    return container.querySelector(`[data-key="${key}"]`)?.textContent;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    releaseVarySlideOnScreenCache();
    renders.length = 0;
    getDataListCalls.length = 0;
    state.dataByKey.clear();
    state.varyManager.entries.length = 0;
    state.baseManager.entries.length = 0;
    state.getDataList = (filePath: string, id: number) => {
        const key = `${filePath}-${id}`;
        getDataListCalls.push(key);
        // A fresh array on every call, exactly like the real filter: identity
        // must come from the cache, never from the source.
        return [...(state.dataByKey.get(key) ?? [])];
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    releaseVarySlideOnScreenCache();
    vi.unstubAllGlobals();
});

describe('toVarySlideOnScreenKey', () => {
    test('joins the file path and the slide id', () => {
        expect(toVarySlideOnScreenKey('/docs/a.slide', 7)).toBe(
            '/docs/a.slide-7',
        );
    });
});

describe('useVarySlideOnScreenList', () => {
    test('every preview shares ONE update subscription per manager', async () => {
        state.dataByKey.set('/a.slide-1', [['0', { itemJson: { id: 1 } }]]);
        await act(async () => {
            root.render(
                <>
                    <PreviewComp filePath="/a.slide" id={1} />
                    <PreviewComp filePath="/a.slide" id={2} />
                    <PreviewComp filePath="/b.slide" id={1} />
                </>,
            );
        });

        expect(state.varyManager.entries).toHaveLength(1);
        expect(state.varyManager.entries[0].events).toEqual(['update']);
        // Adding or removing a screen changes the answer without the document
        // manager firing, so the base manager is listened to as well.
        expect(state.baseManager.entries).toHaveLength(1);
        expect(readText('/a.slide-1')).toBe('0');
        expect(readText('/a.slide-2')).toBe('');
    });

    test('only the previews whose screen ids changed re-render', async () => {
        state.dataByKey.set('/a.slide-1', [['0', { itemJson: { id: 1 } }]]);
        await act(async () => {
            root.render(
                <>
                    <PreviewComp filePath="/a.slide" id={1} />
                    <PreviewComp filePath="/a.slide" id={2} />
                </>,
            );
        });
        const countFor = (key: string) => {
            return renders.filter((entry) => {
                return entry.key === key;
            }).length;
        };
        const before1 = countFor('/a.slide-1');
        const before2 = countFor('/a.slide-2');

        // Slide 1 leaves screen 0, slide 2 goes up on it.
        state.dataByKey.set('/a.slide-1', []);
        state.dataByKey.set('/a.slide-2', [['0', { itemJson: { id: 2 } }]]);
        await act(async () => {
            fireUpdate(state.varyManager);
        });
        expect(readText('/a.slide-1')).toBe('');
        expect(readText('/a.slide-2')).toBe('0');
        expect(countFor('/a.slide-1')).toBeGreaterThan(before1);
        expect(countFor('/a.slide-2')).toBeGreaterThan(before2);
    });

    test('a new payload behind the same screen ids keeps the previous array', async () => {
        state.dataByKey.set('/a.slide-1', [
            ['0', { itemJson: { id: 1, rev: 1 } }],
        ]);
        await act(async () => {
            root.render(<PreviewComp filePath="/a.slide" id={1} />);
        });
        const firstList = renders.at(-1)!.list;
        const renderCount = renders.length;

        // Same screen ids, a new itemJson (every present makes one).
        state.dataByKey.set('/a.slide-1', [
            ['0', { itemJson: { id: 1, rev: 2 } }],
        ]);
        await act(async () => {
            fireUpdate(state.varyManager);
        });
        // The snapshot is the SAME array, so React bailed out of re-rendering.
        expect(renders.length).toBe(renderCount);
        expect(renders.at(-1)!.list).toBe(firstList);

        // A second screen joining changes the ids: a new array this time.
        state.dataByKey.set('/a.slide-1', [
            ['0', { itemJson: { id: 1, rev: 2 } }],
            ['1', { itemJson: { id: 1, rev: 2 } }],
        ]);
        await act(async () => {
            fireUpdate(state.baseManager);
        });
        expect(readText('/a.slide-1')).toBe('0,1');
        expect(renders.at(-1)!.list).not.toBe(firstList);
    });

    test('reads the map once per screen change, not once per render', async () => {
        state.dataByKey.set('/a.slide-1', [['0', { itemJson: { id: 1 } }]]);
        await act(async () => {
            root.render(<PreviewComp filePath="/a.slide" id={1} />);
        });
        const callsAfterMount = getDataListCalls.length;
        expect(callsAfterMount).toBeGreaterThan(0);

        // Re-rendering with no screen change answers from the cache.
        await act(async () => {
            root.render(<PreviewComp filePath="/a.slide" id={1} />);
        });
        expect(getDataListCalls.length).toBe(callsAfterMount);

        await act(async () => {
            fireUpdate(state.varyManager);
        });
        expect(getDataListCalls.length).toBeGreaterThan(callsAfterMount);
    });

    test('the last preview to unmount releases the subscription and its cache', async () => {
        state.dataByKey.set('/a.slide-1', [['0', { itemJson: { id: 1 } }]]);
        await act(async () => {
            root.render(
                <>
                    <PreviewComp filePath="/a.slide" id={1} />
                    <PreviewComp filePath="/a.slide" id={1} />
                </>,
            );
        });
        await act(async () => {
            root.render(<PreviewComp filePath="/a.slide" id={1} />);
        });
        // One preview of that slide is still mounted.
        expect(state.varyManager.entries).toHaveLength(1);

        await act(async () => {
            root.render(<></>);
        });
        expect(state.varyManager.entries).toHaveLength(0);
        expect(state.baseManager.entries).toHaveLength(0);

        // Mounting it again must read the map afresh rather than answer from
        // a cache that outlived every preview of it.
        state.dataByKey.set('/a.slide-1', [['3', { itemJson: { id: 1 } }]]);
        getDataListCalls.length = 0;
        await act(async () => {
            root.render(<PreviewComp filePath="/a.slide" id={1} />);
        });
        expect(getDataListCalls).toContain('/a.slide-1');
        expect(readText('/a.slide-1')).toBe('3');
    });
});

describe('useVarySlideOnScreenChangeEffect', () => {
    test('runs the latest callback on every screen change without re-rendering', async () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        await act(async () => {
            root.render(<ChangeEffectComp onChange={firstCallback} />);
        });
        await act(async () => {
            root.render(<ChangeEffectComp onChange={secondCallback} />);
        });
        const renderCount = renders.length;

        await act(async () => {
            fireUpdate(state.varyManager);
        });
        await act(async () => {
            fireUpdate(state.baseManager);
        });

        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledTimes(2);
        expect(renders.length).toBe(renderCount);
    });

    test('unmounting removes the listener and the subscription', async () => {
        const callback = vi.fn();
        await act(async () => {
            root.render(<ChangeEffectComp onChange={callback} />);
        });
        expect(state.varyManager.entries).toHaveLength(1);

        await act(async () => {
            root.render(<></>);
        });
        expect(state.varyManager.entries).toHaveLength(0);
        expect(state.baseManager.entries).toHaveLength(0);
        expect(callback).not.toHaveBeenCalled();
    });

    test('shares the subscription with mounted previews', async () => {
        const callback = vi.fn();
        state.dataByKey.set('/a.slide-1', []);
        await act(async () => {
            root.render(
                <>
                    <PreviewComp filePath="/a.slide" id={1} />
                    <ChangeEffectComp onChange={callback} />
                </>,
            );
        });
        expect(state.varyManager.entries).toHaveLength(1);

        state.dataByKey.set('/a.slide-1', [['2', { itemJson: { id: 1 } }]]);
        await act(async () => {
            fireUpdate(state.varyManager);
        });
        expect(callback).toHaveBeenCalledTimes(1);
        expect(readText('/a.slide-1')).toBe('2');
    });
});

describe('releaseVarySlideOnScreenCache', () => {
    test('drops every subscription and listener', async () => {
        const callback = vi.fn();
        await act(async () => {
            root.render(
                <>
                    <PreviewComp filePath="/a.slide" id={1} />
                    <ChangeEffectComp onChange={callback} />
                </>,
            );
        });
        expect(state.varyManager.entries).toHaveLength(1);

        releaseVarySlideOnScreenCache();
        expect(state.varyManager.entries).toHaveLength(0);
        expect(state.baseManager.entries).toHaveLength(0);
    });
});
