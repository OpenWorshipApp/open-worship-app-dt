// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const getDataListMock = vi.fn();
const varyRegisterMock = vi.fn(() => ['vary-registered']);
const varyUnregisterMock = vi.fn();
const baseRegisterMock = vi.fn(() => ['base-registered']);
const baseUnregisterMock = vi.fn();

let varyListener: (() => void) | null = null;
let baseListener: (() => void) | null = null;

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: class ScreenVaryAppDocumentManager {
        static getDataList = getDataListMock;
        static registerEventListener = (_events: string[], listener: any) => {
            varyListener = listener;
            return varyRegisterMock();
        };

        static unregisterEventListener = varyUnregisterMock;
    },
}));

vi.mock('./ScreenManagerBase', () => ({
    default: class ScreenManagerBase {
        static registerEventListener = (_events: string[], listener: any) => {
            baseListener = listener;
            return baseRegisterMock();
        };

        static unregisterEventListener = baseUnregisterMock;
    },
}));

function toVarySlide(filePath: string, id: number) {
    return { filePath, id } as any;
}

describe('varySlideOnScreenHelpers', () => {
    let container: HTMLDivElement;
    let root: Root;
    let renderCountMapper: Map<string, number>;

    beforeEach(async () => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);
        root = createRoot(container);
        renderCountMapper = new Map();
        varyListener = null;
        baseListener = null;
        vi.clearAllMocks();
        getDataListMock.mockReturnValue([]);
        const { releaseVarySlideOnScreenCache } =
            await import('./varySlideOnScreenHelpers');
        releaseVarySlideOnScreenCache();
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    async function renderSlides(filePathIdPairs: [string, number][]) {
        const { useVarySlideOnScreenList } =
            await import('./varySlideOnScreenHelpers');
        function SlideProbeComp({
            label,
            varySlide,
        }: Readonly<{ label: string; varySlide: any }>) {
            const onScreenList = useVarySlideOnScreenList(varySlide);
            renderCountMapper.set(
                label,
                (renderCountMapper.get(label) ?? 0) + 1,
            );
            return (
                <div data-testid={label}>
                    {onScreenList
                        .map(([key]: any) => {
                            return key;
                        })
                        .join('|')}
                </div>
            );
        }
        await act(async () => {
            root.render(
                <>
                    {filePathIdPairs.map(([filePath, id]) => {
                        return (
                            <SlideProbeComp
                                key={`${filePath}-${id}`}
                                label={`${filePath}-${id}`}
                                varySlide={toVarySlide(filePath, id)}
                            />
                        );
                    })}
                </>,
            );
        });
    }

    function readMark(label: string) {
        return container.querySelector(`[data-testid="${label}"]`)?.textContent;
    }

    test('subscribes to the managers once for the whole window', async () => {
        getDataListMock.mockReturnValue([]);
        await renderSlides([
            ['/a.slide', 1],
            ['/a.slide', 2],
            ['/a.slide', 3],
        ]);

        // Three slides, one registration each on the two handlers — NOT one per
        // slide per handler, which is what the per-component subscription did.
        expect(varyRegisterMock).toHaveBeenCalledTimes(1);
        expect(baseRegisterMock).toHaveBeenCalledTimes(1);
    });

    test('re-renders ONLY the slides whose answer changed', async () => {
        getDataListMock.mockReturnValue([]);
        await renderSlides([
            ['/a.slide', 1],
            ['/a.slide', 2],
            ['/a.slide', 3],
        ]);
        const before = new Map(renderCountMapper);

        // Slide 2 goes on screen 0; nothing about slides 1 and 3 changed.
        getDataListMock.mockImplementation((filePath: string, id: number) => {
            return filePath === '/a.slide' && id === 2
                ? [['0', { filePath, itemJson: { id } }]]
                : [];
        });
        await act(async () => {
            varyListener?.();
        });

        expect(readMark('/a.slide-2')).toBe('0');
        expect(renderCountMapper.get('/a.slide-2')).toBeGreaterThan(
            before.get('/a.slide-2') as number,
        );
        // The whole point: an unchanged snapshot must be the SAME array, so
        // React bails out and these two never re-render.
        expect(renderCountMapper.get('/a.slide-1')).toBe(
            before.get('/a.slide-1'),
        );
        expect(renderCountMapper.get('/a.slide-3')).toBe(
            before.get('/a.slide-3'),
        );
    });

    test('ignores a payload change that keeps the same screens', async () => {
        getDataListMock.mockReturnValue([
            ['0', { filePath: '/a.slide', itemJson: { id: 1, revision: 1 } }],
        ]);
        await renderSlides([['/a.slide', 1]]);
        const before = renderCountMapper.get('/a.slide-1') as number;

        // Same screen, different payload — re-rendering for this would put the
        // cascade straight back, since every present rewrites the payload.
        getDataListMock.mockReturnValue([
            ['0', { filePath: '/a.slide', itemJson: { id: 1, revision: 2 } }],
        ]);
        await act(async () => {
            varyListener?.();
        });

        expect(renderCountMapper.get('/a.slide-1')).toBe(before);
    });

    test('answers a screen being added or removed', async () => {
        getDataListMock.mockReturnValue([]);
        await renderSlides([['/a.slide', 1]]);
        expect(readMark('/a.slide-1')).toBe('');

        // The on-screen map is filtered against the MANAGERS setting, so a
        // screen appearing changes the answer without the document manager
        // firing at all.
        getDataListMock.mockReturnValue([
            ['1', { filePath: '/a.slide', itemJson: { id: 1 } }],
        ]);
        await act(async () => {
            baseListener?.();
        });

        expect(readMark('/a.slide-1')).toBe('1');
    });

    test('reads the map once per event however many slides ask', async () => {
        getDataListMock.mockReturnValue([]);
        await renderSlides([
            ['/a.slide', 1],
            ['/a.slide', 1],
            ['/a.slide', 1],
        ]);
        getDataListMock.mockClear();

        await act(async () => {
            varyListener?.();
        });

        // Three subscribers on ONE key share one read of the map.
        expect(getDataListMock).toHaveBeenCalledTimes(1);
    });

    test('notifies a change effect WITHOUT re-rendering its component', async () => {
        const { useVarySlideOnScreenChangeEffect } =
            await import('./varySlideOnScreenHelpers');
        const refresh = vi.fn();
        let renderCount = 0;
        function ListComp() {
            renderCount += 1;
            useVarySlideOnScreenChangeEffect(refresh);
            return <div />;
        }
        await act(async () => {
            root.render(<ListComp />);
        });
        const before = renderCount;

        await act(async () => {
            varyListener?.();
            baseListener?.();
        });

        // This is the whole reason the hook exists: `useScreenEvents` holds a
        // `useState(Date.now())` it always sets, so the subscribing component —
        // here the parent of every slide preview — re-rendered on every screen
        // event whatever its callback found.
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(renderCount).toBe(before);
    });

    test('releases listeners and cached answers on unmount', async () => {
        getDataListMock.mockReturnValue([]);
        await renderSlides([['/a.slide', 1]]);

        await act(async () => {
            root.render(<></>);
        });

        expect(varyUnregisterMock).toHaveBeenCalledWith(['vary-registered']);
        expect(baseUnregisterMock).toHaveBeenCalledWith(['base-registered']);
    });
});
