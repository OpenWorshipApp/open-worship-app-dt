// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    slides: undefined as any,
    rowProps: [] as any[],
    show: vi.fn(),
    arm: vi.fn(),
    refresh: vi.fn(),
    menu: vi.fn(),
    drag: vi.fn(),
    load: vi.fn(),
    payload: null as any,
    draggingStore: { current: null as any },
    setSlides: vi.fn(),
    loader: null as null | (() => unknown),
    loaderDeps: [] as unknown[],
    fileEvents: [] as {
        events: string[];
        callback: () => void;
        filePath: string;
    }[],
    onScreenIds: new Set<number>(),
    onScreenKeys: [] as string[],
}));

vi.mock('../helper/appHooks', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        // Records what it was asked to read; the value is the test's to set.
        useAppStateAsync: (loader: () => unknown, deps: unknown[]) => {
            fake.loader = loader;
            fake.loaderDeps = deps;
            return [fake.slides, fake.setSlides];
        },
    };
});
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => void,
        _deps: unknown[],
        filePath: string,
    ) => {
        fake.fileEvents.push({ events, callback, filePath });
    },
}));
// `genTimeoutAttempt` is the real one (a leaf module): the refresh's debounce
// is part of what is under test.
vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    showDroppedDataOnScreens: fake.show,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsVarySlideOnScreen: (varySlide: any) =>
        fake.onScreenIds.has(varySlide.id),
}));
vi.mock('../helper/dragHelpers', () => ({ handleDragStart: fake.drag }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: fake.menu,
}));
vi.mock('./presentingFlowDocumentHelpers', () => ({
    loadVaryAppDocumentSlides: fake.load,
}));
vi.mock('./presentingFlowCcApplyHelpers', () => ({
    armPresentingFlowCcPropagation: fake.arm,
}));
vi.mock('./presentingFlowHelpers', () => ({
    extractDropPayload: () => fake.payload,
    presentingFlowDraggingStore: fake.draggingStore,
    toDragTypeIconName: () => 'file',
    UNSUPPORTED_DROP_PAYLOAD: 'unsupported',
}));
vi.mock('./presentingFlowItemMenuHelpers', () => ({
    genPresentingFlowVarySlideContextMenuItems: () => ['menu'],
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    refreshOnScreenAfterPresenting: fake.refresh,
    useIsOnScreenChecking: (check: () => boolean, depsKey: string) => {
        fake.onScreenKeys.push(depsKey);
        return check();
    },
}));
vi.mock('./PresentingFlowRowComp', () => ({
    default: (props: any) => {
        fake.rowProps.push(props);
        return (
            <button
                data-testid="slide-row"
                className={props.extraClassName}
                onClick={props.onClick}
                onContextMenu={props.onContextMenu}
                draggable
                onDragStart={props.onDragStart}
                onDragOver={props.onDragOver}
                onDragLeave={props.onDragLeave}
                onDrop={props.onDrop}
            >
                {props.label}
                {props.extraChild}
            </button>
        );
    },
}));
vi.mock('./PresentingFlowCcRowsComp', () => ({
    default: ({ ccItems }: any) => (
        <span data-testid="cc">{ccItems.length}</span>
    ),
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    default: ({ screenIds }: any) => <span>{screenIds.join(',')}</span>,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span>Loading slides</span>,
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: () => null, setItem: () => {} },
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import PresentingFlowDocumentSlidesComp from './PresentingFlowDocumentSlidesComp';

const slide = {
    id: 7,
    filePath: '/song',
    dragType: 'vary-slide',
    name: 'Opening song',
    isDisabled: false,
};

describe('presenting-flow document slides', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        fake.slides = undefined;
        fake.rowProps = [];
        fake.payload = null;
        fake.draggingStore.current = null;
        fake.loader = null;
        fake.loaderDeps = [];
        fake.fileEvents = [];
        fake.onScreenIds = new Set();
        fake.onScreenKeys = [];
        for (const fn of [
            fake.setSlides,
            fake.show,
            fake.arm,
            fake.refresh,
            fake.menu,
            fake.drag,
            fake.load,
        ]) {
            fn.mockReset();
        }
        fake.show.mockResolvedValue(undefined);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.useRealTimers();
    });

    function render(extra: Record<string, unknown> = {}) {
        fake.rowProps = [];
        act(() =>
            root.render(
                <PresentingFlowDocumentSlidesComp
                    filePath="/song"
                    depth={2}
                    {...extra}
                />,
            ),
        );
    }

    test('shows distinct loading, read-error and empty states', () => {
        render();
        expect(container.textContent).toContain('Loading slides');
        fake.slides = null;
        render();
        expect(container.textContent).toContain('Fail to read file data');
        fake.slides = [];
        render();
        expect(container.textContent).toContain('No slides');
    });

    test('presents a slide on its resolved screens and marks only its own pin', async () => {
        fake.slides = [slide];
        render({
            resolveScreenIds: () => [2],
            resolveOwnScreenIds: () => [4],
        });
        expect(container.textContent).toContain('Opening song');
        expect(container.textContent).toContain('4');
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>('[data-testid="slide-row"]')!
                .click();
        });
        expect(fake.arm).toHaveBeenCalled();
        expect(fake.show).toHaveBeenCalledWith(
            expect.anything(),
            { type: 'vary-slide', item: slide },
            false,
            [2],
        );
        expect(fake.refresh).toHaveBeenCalledOnce();
    });

    test('parked slides cannot present or start a drag', async () => {
        fake.slides = [slide];
        render({ resolveIsSlideDisabled: () => true });
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>('[data-testid="slide-row"]')!
                .click();
        });
        expect(fake.show).not.toHaveBeenCalled();
        const event = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        });
        act(() =>
            container
                .querySelector('[data-testid="slide-row"]')!
                .dispatchEvent(event),
        );
        expect(event.defaultPrevented).toBe(true);
        expect(fake.drag).not.toHaveBeenCalled();
    });

    test('enabled slides drag and expose their scoped menu', () => {
        fake.slides = [slide];
        render();
        const row = container.querySelector('[data-testid="slide-row"]')!;
        act(() => row.dispatchEvent(new Event('dragstart', { bubbles: true })));
        expect(fake.drag).toHaveBeenCalledWith(expect.anything(), slide);
        act(() =>
            row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
        );
        expect(fake.menu).toHaveBeenCalledWith(expect.anything(), ['menu']);
    });

    test('drops a dragged entry and a file onto the slide as CCs', async () => {
        fake.slides = [slide];
        const addFromItem = vi.fn().mockResolvedValue(undefined);
        const addFromData = vi.fn().mockResolvedValue(undefined);
        render({
            slideCcHost: {
                presentingFlow: {
                    addItemCcFromItemIndex: addFromItem,
                    addItemCcFromDroppedData: addFromData,
                },
                index: 2,
                presentingFlowItem: {
                    hasSlideCcItems: true,
                    hasCcItems: true,
                    getSlideCcItems: () => [{ id: 'cc' }],
                    getEffectiveSlideCcItems: () => [{ id: 'cc' }],
                },
            },
        });
        expect(container.querySelector('[data-testid="cc"]')?.textContent).toBe(
            '1',
        );
        const row = container.querySelector('[data-testid="slide-row"]')!;
        fake.draggingStore.current = { filePath: '/other', index: 5 };
        await act(async () => {
            row.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
        });
        expect(addFromItem).toHaveBeenCalledWith(2, 7, '/other', 5);

        fake.draggingStore.current = null;
        fake.payload = { droppedData: { type: 'image' }, dragData: { id: 8 } };
        await act(async () => {
            row.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
        });
        expect(addFromData).toHaveBeenCalledWith(
            2,
            7,
            { type: 'image' },
            { id: 8 },
        );
    });

    function genCcHost() {
        return {
            presentingFlow: {
                addItemCcFromItemIndex: vi.fn().mockResolvedValue(undefined),
                addItemCcFromDroppedData: vi.fn().mockResolvedValue(undefined),
            },
            index: 2,
            presentingFlowItem: {
                hasSlideCcItems: false,
                hasCcItems: false,
                getSlideCcItems: () => [],
                getEffectiveSlideCcItems: () => [],
            },
        };
    }

    async function flushMicrotasks() {
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
        }
    }

    function getRow() {
        return container.querySelector<HTMLElement>(
            '[data-testid="slide-row"]',
        )!;
    }

    test('reads its slides from the file it is given, and again once re-pointed', async () => {
        render();
        expect(fake.loaderDeps).toEqual(['/song']);
        fake.load.mockResolvedValue([slide]);
        await expect(fake.loader!()).resolves.toEqual([slide]);
        expect(fake.load).toHaveBeenLastCalledWith('/song');

        render({ filePath: '/hymn' });
        expect(fake.loaderDeps).toEqual(['/hymn']);
        await fake.loader!();
        expect(fake.load).toHaveBeenLastCalledWith('/hymn');
    });

    test('follows its document on update, with rapid updates collapsed into one read', async () => {
        vi.useFakeTimers();
        fake.slides = [slide];
        render();
        const subscription = fake.fileEvents.at(-1)!;
        expect(subscription.events).toEqual(['update']);
        expect(subscription.filePath).toBe('/song');

        const edited = { ...slide, name: 'Opening song (edited)' };
        fake.load.mockResolvedValue([edited]);
        subscription.callback();
        subscription.callback();
        await vi.advanceTimersByTimeAsync(499);
        expect(fake.load).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await flushMicrotasks();
        expect(fake.load).toHaveBeenCalledExactlyOnceWith('/song');
        expect(fake.setSlides).toHaveBeenCalledExactlyOnceWith([edited]);
    });

    test('two lists of the same document each refresh on one update', async () => {
        vi.useFakeTimers();
        fake.slides = [slide];
        act(() =>
            root.render(
                <>
                    <PresentingFlowDocumentSlidesComp
                        filePath="/song"
                        depth={2}
                    />
                    <PresentingFlowDocumentSlidesComp
                        filePath="/song"
                        depth={2}
                    />
                </>,
            ),
        );
        const [first, second] = fake.fileEvents.slice(-2);
        expect(first.callback).not.toBe(second.callback);
        fake.load.mockResolvedValue([slide]);
        // One `update` on the file reaches both lists; a shared timer would
        // let the second cancel the first.
        first.callback();
        second.callback();
        await vi.advanceTimersByTimeAsync(500);
        await flushMicrotasks();
        expect(fake.load).toHaveBeenCalledTimes(2);
        expect(fake.setSlides).toHaveBeenCalledTimes(2);
    });

    test('re-pointed mid-read, it reads the new file and never applies the old one', async () => {
        vi.useFakeTimers();
        fake.slides = [slide];
        render();
        const subscription = fake.fileEvents.at(-1)!;
        let resolveFirstRead: (value: unknown) => void = () => {};
        const staleSlides = [{ ...slide, name: 'Previous song' }];
        const newSlides = [{ ...slide, id: 9, filePath: '/hymn' }];
        fake.load
            .mockImplementationOnce(() => {
                return new Promise((resolve) => {
                    resolveFirstRead = resolve;
                });
            })
            .mockResolvedValueOnce(newSlides);

        subscription.callback();
        await vi.advanceTimersByTimeAsync(500);
        expect(fake.load).toHaveBeenNthCalledWith(1, '/song');

        render({ filePath: '/hymn' });
        resolveFirstRead(staleSlides);
        await flushMicrotasks();
        expect(fake.setSlides).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(500);
        await flushMicrotasks();
        expect(fake.load).toHaveBeenNthCalledWith(2, '/hymn');
        expect(fake.setSlides).toHaveBeenCalledExactlyOnceWith(newSlides);
    });

    test('a slide row lights while that very slide is on a screen', () => {
        fake.onScreenIds = new Set([7]);
        fake.slides = [slide, { ...slide, id: 8, name: 'Second verse' }];
        render();
        expect(fake.rowProps.map((props) => props.isOnScreen)).toEqual([
            true,
            false,
        ]);
        expect(fake.onScreenKeys).toEqual(['/song-7', '/song-8']);
    });

    test('a slide row is a CC drop target only under a presenting flow entry', () => {
        const reachedDocument = vi.fn();
        document.addEventListener('dragover', reachedDocument);
        try {
            fake.slides = [slide];
            render();
            const looseOver = new Event('dragover', {
                bubbles: true,
                cancelable: true,
            });
            act(() => getRow().dispatchEvent(looseOver));
            expect(looseOver.defaultPrevented).toBe(false);
            expect(reachedDocument).toHaveBeenCalledTimes(1);
            expect(getRow().className).toBe('');

            render({ slideCcHost: genCcHost() });
            const over = new Event('dragover', {
                bubbles: true,
                cancelable: true,
            });
            act(() => getRow().dispatchEvent(over));
            expect(over.defaultPrevented).toBe(true);
            // Stopped here: neither the document row nor the card above it
            // takes it as their own drop.
            expect(reachedDocument).toHaveBeenCalledTimes(1);
            expect(getRow().className).toBe(
                'app-presenting-flow-row-dragging-over-cc',
            );

            act(() =>
                getRow().dispatchEvent(
                    new Event('dragleave', { bubbles: true }),
                ),
            );
            expect(getRow().className).toBe('');
        } finally {
            document.removeEventListener('dragover', reachedDocument);
        }
    });

    test('a drop the slide row cannot hold is left for the card above it', async () => {
        fake.slides = [slide];
        fake.draggingStore.current = { filePath: '/other', index: 5 };
        render();
        const looseDrop = new Event('drop', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            getRow().dispatchEvent(looseDrop);
        });
        expect(looseDrop.defaultPrevented).toBe(false);

        fake.draggingStore.current = null;
        const ccHost = genCcHost();
        render({ slideCcHost: ccHost });
        for (const payload of [null, 'unsupported']) {
            fake.payload = payload;
            const drop = new Event('drop', { bubbles: true, cancelable: true });
            await act(async () => {
                getRow().dispatchEvent(drop);
            });
            expect(drop.defaultPrevented).toBe(false);
        }
        expect(
            ccHost.presentingFlow.addItemCcFromDroppedData,
        ).not.toHaveBeenCalled();
        expect(
            ccHost.presentingFlow.addItemCcFromItemIndex,
        ).not.toHaveBeenCalled();
    });
});
