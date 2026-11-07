// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, varyManagerMock, screenManagerBaseMock } = vi.hoisted(() => {
    // A screen manager class as this module sees it: `registerEventListener`
    // on the class, and a `fire` for the test to play an `update` event.
    function genFakeEventHandler() {
        const registeredList = new Set<{
            events: string[];
            listener: () => void;
        }>();
        return {
            registeredList,
            registerEventListener(events: string[], listener: () => void) {
                const registered = { events, listener };
                registeredList.add(registered);
                return registered;
            },
            unregisterEventListener(registered: any) {
                registeredList.delete(registered);
            },
            fire() {
                for (const { listener } of Array.from(registeredList)) {
                    listener();
                }
            },
        };
    }
    type OnScreenEntryType = {
        filePath: string;
        itemJson: { id: number };
        note?: string;
    };
    const state = {
        onScreen: {} as Record<string, OnScreenEntryType>,
        readCount: 0,
    };
    return {
        state,
        // The persisted on-screen map, filtered like the real `getDataList`:
        // a NEW array on every call, which is what the cache has to absorb.
        varyManagerMock: {
            ...genFakeEventHandler(),
            getDataList(filePath?: string, id?: number) {
                state.readCount += 1;
                return Object.entries(state.onScreen).filter(([, data]) => {
                    return (
                        (filePath === undefined ||
                            data.filePath === filePath) &&
                        (id === undefined || data.itemJson.id === id)
                    );
                });
            },
        },
        screenManagerBaseMock: genFakeEventHandler(),
    };
});

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: varyManagerMock,
}));
vi.mock('./ScreenManagerBase', () => ({
    default: screenManagerBaseMock,
}));
// `appHooks` reads `systemUtils.isDev` at module load.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import {
    releaseVarySlideOnScreenCache,
    toVarySlideOnScreenKey,
    useVarySlideOnScreenChangeEffect,
    useVarySlideOnScreenList,
} from './varySlideOnScreenHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const slideA = { filePath: '/docs/a.slide', id: 1 } as any;
const slideB = { filePath: '/docs/a.slide', id: 2 } as any;

function OnScreenProbeComp({
    varySlide,
    renders,
}: Readonly<{ varySlide: any; renders: any[] }>) {
    const onScreenList = useVarySlideOnScreenList(varySlide);
    renders.push(onScreenList);
    return (
        <span data-probe={varySlide.id}>
            {onScreenList
                .map(([key]) => {
                    return key;
                })
                .join(',')}
        </span>
    );
}

function ChangeProbeComp({
    callback,
    renders,
}: Readonly<{ callback: () => void; renders: number[] }>) {
    useVarySlideOnScreenChangeEffect(callback);
    renders.push(renders.length);
    return null;
}

function readProbe(id: number) {
    return container.querySelector(`[data-probe="${id}"]`)?.textContent;
}

function countSubscriptions() {
    return (
        varyManagerMock.registeredList.size +
        screenManagerBaseMock.registeredList.size
    );
}

beforeEach(() => {
    state.onScreen = {};
    state.readCount = 0;
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
});

describe('toVarySlideOnScreenKey', () => {
    test('keys a slide by its file and id', () => {
        expect(toVarySlideOnScreenKey('/docs/a.slide', 3)).toBe(
            '/docs/a.slide-3',
        );
    });
});

describe('useVarySlideOnScreenList', () => {
    test('reads the screens a slide is on and follows a screen change', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
            1: { filePath: '/docs/a.slide', itemJson: { id: 2 } },
        };
        const renders: any[] = [];
        await act(async () => {
            root.render(
                <OnScreenProbeComp varySlide={slideA} renders={renders} />,
            );
        });
        expect(readProbe(1)).toBe('0');

        state.onScreen[1] = { filePath: '/docs/a.slide', itemJson: { id: 1 } };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(readProbe(1)).toBe('0,1');

        // Removing a screen changes the answer without the document manager
        // ever firing: the base manager's event is what refreshes it.
        delete state.onScreen[0];
        await act(async () => {
            screenManagerBaseMock.fire();
        });
        expect(readProbe(1)).toBe('1');
    });

    test('a new payload on the same screens hands back the same array', async () => {
        state.onScreen = {
            3: { filePath: '/docs/a.slide', itemJson: { id: 1 }, note: 'a' },
        };
        const renders: any[] = [];
        await act(async () => {
            root.render(
                <OnScreenProbeComp varySlide={slideA} renders={renders} />,
            );
        });
        const renderCount = renders.length;
        const firstList = renders.at(-1);

        // Same screen id, a fresh itemJson behind it: nothing here renders the
        // payload, so the preview must not re-render for it.
        state.onScreen[3] = {
            filePath: '/docs/a.slide',
            itemJson: { id: 1 },
            note: 'b',
        };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(renders).toHaveLength(renderCount);
        expect(readProbe(1)).toBe('3');

        state.onScreen[4] = { filePath: '/docs/a.slide', itemJson: { id: 1 } };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(renders.length).toBeGreaterThan(renderCount);
        expect(renders.at(-1)).not.toBe(firstList);
        expect(readProbe(1)).toBe('3,4');
    });

    test('a snapshot is read once per screen change, not once per render', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        const renders: any[] = [];
        await act(async () => {
            root.render(
                <OnScreenProbeComp varySlide={slideA} renders={renders} />,
            );
        });
        const readCount = state.readCount;

        // A parent re-render with no screen change asks the cache only.
        await act(async () => {
            root.render(
                <OnScreenProbeComp varySlide={slideA} renders={renders} />,
            );
        });
        expect(state.readCount).toBe(readCount);

        await act(async () => {
            varyManagerMock.fire();
        });
        expect(state.readCount).toBeGreaterThan(readCount);
    });

    test('every preview shares one subscription per manager', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
            1: { filePath: '/docs/a.slide', itemJson: { id: 2 } },
        };
        await act(async () => {
            root.render(
                <>
                    <OnScreenProbeComp varySlide={slideA} renders={[]} />
                    <OnScreenProbeComp varySlide={slideB} renders={[]} />
                </>,
            );
        });
        expect(varyManagerMock.registeredList.size).toBe(1);
        expect(screenManagerBaseMock.registeredList.size).toBe(1);
        expect(readProbe(1)).toBe('0');
        expect(readProbe(2)).toBe('1');

        // One event updates BOTH previews.
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 2 } },
            1: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(readProbe(1)).toBe('1');
        expect(readProbe(2)).toBe('0');

        // Nothing mounted: an idle window holds no screen listeners at all.
        await act(async () => {
            root.render(<></>);
        });
        expect(countSubscriptions()).toBe(0);
    });

    test('two previews of one slide both follow, and one leaving keeps the other', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        const keptRenders: any[] = [];
        const renderBoth = (isSecondShown: boolean) => {
            root.render(
                <>
                    <OnScreenProbeComp
                        varySlide={slideA}
                        renders={keptRenders}
                    />
                    {isSecondShown ? (
                        <div data-second="">
                            <OnScreenProbeComp
                                varySlide={slideA}
                                renders={[]}
                            />
                        </div>
                    ) : null}
                </>,
            );
        };
        await act(async () => {
            renderBoth(true);
        });
        expect(container.querySelectorAll('[data-probe="1"]')).toHaveLength(2);

        state.onScreen[5] = { filePath: '/docs/a.slide', itemJson: { id: 1 } };
        await act(async () => {
            varyManagerMock.fire();
        });
        for (const probe of Array.from(
            container.querySelectorAll('[data-probe="1"]'),
        )) {
            expect(probe.textContent).toBe('0,5');
        }
        const [registration] = Array.from(varyManagerMock.registeredList);

        await act(async () => {
            renderBoth(false);
        });
        // The preview still mounted kept the window's subscription: it was
        // never dropped and taken out again.
        expect(Array.from(varyManagerMock.registeredList)).toEqual([
            registration,
        ]);
        delete state.onScreen[0];
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(container.querySelectorAll('[data-probe="1"]')).toHaveLength(1);
        expect(readProbe(1)).toBe('5');
    });

    test('an unmounted slide leaves no cached answer behind', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            root.render(<OnScreenProbeComp varySlide={slideA} renders={[]} />);
        });
        expect(readProbe(1)).toBe('0');
        await act(async () => {
            root.render(<></>);
        });

        // Changed with no event in between: a cache entry that outlived the
        // preview would still answer '0' at the same version.
        state.onScreen = {
            2: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            root.render(<OnScreenProbeComp varySlide={slideA} renders={[]} />);
        });
        expect(readProbe(1)).toBe('2');
    });

    test('StrictMode double subscription still releases everything', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            root.render(
                <StrictMode>
                    <OnScreenProbeComp varySlide={slideA} renders={[]} />
                </StrictMode>,
            );
        });
        expect(varyManagerMock.registeredList.size).toBe(1);

        state.onScreen[1] = { filePath: '/docs/a.slide', itemJson: { id: 1 } };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(readProbe(1)).toBe('0,1');

        await act(async () => {
            root.render(<StrictMode>{null}</StrictMode>);
        });
        expect(countSubscriptions()).toBe(0);
    });
});

describe('useVarySlideOnScreenChangeEffect', () => {
    test('runs the latest callback on every screen change without re-rendering', async () => {
        const calls: string[] = [];
        const renders: number[] = [];
        await act(async () => {
            root.render(
                <ChangeProbeComp
                    callback={() => {
                        calls.push('first');
                    }}
                    renders={renders}
                />,
            );
        });
        const renderCount = renders.length;
        expect(countSubscriptions()).toBe(2);

        await act(async () => {
            varyManagerMock.fire();
            screenManagerBaseMock.fire();
        });
        expect(calls).toEqual(['first', 'first']);
        expect(renders).toHaveLength(renderCount);

        // A re-render hands in a new callback; the subscription is kept and
        // the NEW callback is the one called.
        await act(async () => {
            root.render(
                <ChangeProbeComp
                    callback={() => {
                        calls.push('second');
                    }}
                    renders={renders}
                />,
            );
        });
        expect(countSubscriptions()).toBe(2);
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(calls).toEqual(['first', 'first', 'second']);

        await act(async () => {
            root.render(<></>);
        });
        expect(countSubscriptions()).toBe(0);
        varyManagerMock.fire();
        expect(calls).toHaveLength(3);
    });

    test('shares the subscription with the slide previews', async () => {
        const calls: number[] = [];
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            root.render(
                <>
                    <ChangeProbeComp
                        callback={() => {
                            calls.push(calls.length);
                        }}
                        renders={[]}
                    />
                    <OnScreenProbeComp varySlide={slideA} renders={[]} />
                </>,
            );
        });
        expect(varyManagerMock.registeredList.size).toBe(1);

        state.onScreen[7] = { filePath: '/docs/a.slide', itemJson: { id: 1 } };
        await act(async () => {
            varyManagerMock.fire();
        });
        expect(calls).toHaveLength(1);
        expect(readProbe(1)).toBe('0,7');
    });
});

describe('releaseVarySlideOnScreenCache', () => {
    test('drops every subscription and cached answer', async () => {
        state.onScreen = {
            0: { filePath: '/docs/a.slide', itemJson: { id: 1 } },
        };
        await act(async () => {
            root.render(<OnScreenProbeComp varySlide={slideA} renders={[]} />);
        });
        expect(countSubscriptions()).toBe(2);

        releaseVarySlideOnScreenCache();
        expect(countSubscriptions()).toBe(0);
    });
});
