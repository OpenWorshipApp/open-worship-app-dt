// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const showAppContextMenuMock = vi.fn();

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../helper/debuggerHelpers', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
    };
});

describe('transitionEffectHelpers', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        showAppContextMenuMock.mockReset();
        globalThis.requestAnimationFrame = vi.fn(
            (callback: FrameRequestCallback) => {
                return setTimeout(() => {
                    callback(Date.now());
                }, 16) as unknown as number;
            },
        ) as any;
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        vi.useRealTimers();
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('animates none, fade, move, and zoom effects', async () => {
        const { ANIM_END_DELAY_MILLISECOND, styleAnimList } =
            await import('./transitionEffectHelpers');

        const none = styleAnimList.none('background');
        const noneParent = document.createElement('div');
        const noneTarget = document.createElement('div');
        await none.animIn(noneTarget, noneParent);
        expect(noneParent.contains(noneTarget)).toBe(true);

        const noneOutPromise = none.animOut(noneTarget);
        expect(noneTarget.style.animationName).toContain(
            'background-animation-fade-',
        );
        await vi.advanceTimersByTimeAsync(
            none.duration + ANIM_END_DELAY_MILLISECOND + 32,
        );
        await noneOutPromise;
        expect(noneTarget.style.opacity).toBe('0');

        const noneZoomContainer = document.createElement('div');
        noneZoomContainer.className = 'zoom-container';
        await expect(none.animOut(noneZoomContainer)).resolves.toBeUndefined();

        const fade = styleAnimList.fade('foreground');
        const fadeParent = document.createElement('div');
        const fadeTarget = document.createElement('div');
        const fadeInPromise = fade.animIn(fadeTarget, fadeParent);
        expect(fadeParent.contains(fadeTarget)).toBe(true);
        await vi.advanceTimersByTimeAsync(
            fade.duration + ANIM_END_DELAY_MILLISECOND + 32,
        );
        await fadeInPromise;
        expect(fadeTarget.style.opacity).toBe('1');

        const fadeOutPromise = fade.animOut(fadeTarget);
        expect(fadeTarget.style.animationName).toContain(
            'foreground-animation-fade-',
        );
        await vi.advanceTimersByTimeAsync(
            fade.duration + ANIM_END_DELAY_MILLISECOND + 32,
        );
        await fadeOutPromise;
        expect(fadeTarget.style.opacity).toBe('0');

        const fadeZoomContainer = document.createElement('div');
        fadeZoomContainer.className = 'zoom-container';
        await expect(fade.animOut(fadeZoomContainer)).resolves.toBeUndefined();

        const move = styleAnimList.move();
        const moveParent = document.createElement('div');
        moveParent.getBoundingClientRect = () =>
            ({
                width: 320,
            }) as DOMRect;
        const sibling = document.createElement('div');
        moveParent.appendChild(sibling);
        const moveTarget = document.createElement('div');
        const moveInPromise = move.animIn(moveTarget, moveParent);
        await vi.advanceTimersByTimeAsync(move.duration + 160);
        await moveInPromise;
        expect(moveTarget.style.left).toBe('0px');
        expect(sibling.style.left).toBe('320px');

        const moveOutPromise = move.animOut(moveTarget);
        await vi.advanceTimersByTimeAsync(move.duration + 160);
        await moveOutPromise;
        expect(moveTarget.style.left).toBe('320px');

        const moveZoomContainer = document.createElement('div');
        moveZoomContainer.className = 'zoom-container';
        await expect(move.animOut(moveZoomContainer)).resolves.toBeUndefined();

        const zoom = styleAnimList.zoom('verse');
        const zoomParent = document.createElement('div');
        const zoomTarget = document.createElement('div');
        const zoomInPromise = zoom.animIn(zoomTarget, zoomParent);
        const zoomContainer = zoomParent.querySelector(
            '.zoom-container',
        ) as HTMLDivElement | null;
        expect(zoomContainer).not.toBeNull();
        expect(zoomContainer?.firstElementChild).toBe(zoomTarget);
        await vi.advanceTimersByTimeAsync(
            zoom.duration + ANIM_END_DELAY_MILLISECOND + 32,
        );
        await zoomInPromise;
        expect(zoomContainer?.style.opacity).toBe('1');

        if (zoomContainer === null) {
            throw new Error('zoom container is missing');
        }
        const zoomOutPromise = zoom.animOut(zoomContainer);
        expect(zoomContainer?.style.animationName).toContain(
            'verse-animation-zoom-',
        );
        await vi.advanceTimersByTimeAsync(
            zoom.duration + ANIM_END_DELAY_MILLISECOND + 32,
        );
        await zoomOutPromise;
        expect(zoomContainer?.style.opacity).toBe('0');

        const plainDiv = document.createElement('div');
        await expect(zoom.animOut(plainDiv)).resolves.toBeUndefined();
    });

    test('subscribes to screen-effect updates and cleans listeners up', async () => {
        const { useScreenEffectEvents } =
            await import('./transitionEffectHelpers');

        const updateCallbacks: Array<() => void> = [];
        const screenEffectManager = {
            registerEventListener: vi.fn((_events: string[], callback) => {
                updateCallbacks.push(callback);
                return ['effect-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };
        const onUpdate = vi.fn();

        function Host() {
            const count = useScreenEffectEvents(
                ['update'],
                screenEffectManager as any,
                onUpdate,
            );
            return <output data-count={`${count}`} />;
        }

        await act(async () => {
            root.render(<Host />);
        });
        expect(screenEffectManager.registerEventListener).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(container.querySelector('output')?.dataset.count).toBe('0');

        await act(async () => {
            updateCallbacks[0]?.();
        });
        expect(onUpdate).toHaveBeenCalledOnce();
        expect(container.querySelector('output')?.dataset.count).toBe('1');

        await act(async () => {
            root.unmount();
        });
        expect(
            screenEffectManager.unregisterEventListener,
        ).toHaveBeenCalledWith(['effect-listener']);
        root = createRoot(container);
    });

    test('renders the selected transition icon and opens the context menu', async () => {
        const { default: RenderTransitionEffectComp } =
            await import('./RenderTransitionEffectComp');

        let updateCallback: (() => void) | undefined;
        const screenEffectManager = {
            effectType: 'move',
            registerEventListener: vi.fn((_events: string[], callback) => {
                updateCallback = callback;
                return ['menu-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };

        await act(async () => {
            root.render(
                <RenderTransitionEffectComp
                    title="Transition"
                    domTitle="Slide transition"
                    screenEffectManager={screenEffectManager as any}
                />,
            );
        });

        const button = container.querySelector('button');
        expect(button?.title).toBe('Slide transition');
        expect(button?.textContent).toContain('Transition');
        expect(container.innerHTML).toContain('bi bi-align-end');

        await act(async () => {
            updateCallback?.();
        });

        await act(async () => {
            button?.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(showAppContextMenuMock).toHaveBeenCalledOnce();
        const [, menuItems] = showAppContextMenuMock.mock.calls[0] as [
            MouseEvent,
            Array<{
                menuElement: string;
                onSelect: () => void;
                childAfter: { props: { className: string } };
            }>,
        ];
        expect(menuItems.map(({ menuElement }) => menuElement)).toEqual([
            'none',
            'fade',
            'move',
            'zoom',
        ]);
        expect(menuItems[2]?.childAfter.props.className).toContain(
            'app-highlight-selected',
        );

        menuItems[0]?.onSelect();
        expect(screenEffectManager.effectType).toBe('none');
    });
});
