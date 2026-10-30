// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    screenManagerBase: null as any,
    instanceCallback: null as null | (() => void),
    instanceEventArgs: null as any[] | null,
    renderingScreenIds: [] as number[],
    pressElementLikeButton: vi.fn(),
}));

vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <span data-stub="dots" />,
}));
vi.mock('./ShowHideScreen', () => ({
    default: () => <span data-stub="show-hide" />,
}));
vi.mock('./MiniScreenClearControlComp', () => ({
    default: () => <span data-stub="clear" />,
}));
vi.mock('../../others/ItemColorNoteComp', () => ({
    default: ({ item }: { item: any }) => (
        <span data-stub="color-note" data-screen-id={item.screenId} />
    ),
}));
vi.mock('./ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span data-stub="showing" data-screen-id={screenId} />
    ),
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerBaseContext: () => h.screenManagerBase,
    useScreenManagerEvents: (
        eventNames: string[],
        target: unknown,
        callback: () => void,
    ) => {
        h.instanceEventArgs = [eventNames, target];
        h.instanceCallback = callback;
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('./miniScreenRenderingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useIsMiniScreenNoRendering: (screenId: number) => {
            h.renderingScreenIds.push(screenId);
            return useState(false);
        },
    };
});

import ScreenPreviewerHeaderComp from './ScreenPreviewerHeaderComp';

let container: HTMLDivElement;
let root: Root;

function createBase(isLocked = false) {
    return {
        screenId: 8,
        isLocked,
        setIsLockedWithSyncGroup: vi.fn(function (this: any, value: boolean) {
            this.isLocked = value;
        }),
    };
}

async function renderHeader(
    isFullView = false,
    setIsFullView: (value: boolean) => void = vi.fn(),
) {
    await act(async () => {
        root.render(
            <ScreenPreviewerHeaderComp
                isFullView={isFullView}
                setIsFullView={setIsFullView}
            />,
        );
    });
}

function getControl(label: string) {
    return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.screenManagerBase = createBase();
    h.instanceCallback = null;
    h.renderingScreenIds.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ScreenPreviewerHeaderComp', () => {
    test('carries this screen into every control', async () => {
        await renderHeader();
        expect(
            container
                .querySelector('[data-stub="showing"]')!
                .getAttribute('data-screen-id'),
        ).toBe('8');
        expect(
            container
                .querySelector('[data-stub="color-note"]')!
                .getAttribute('data-screen-id'),
        ).toBe('8');
        expect(h.renderingScreenIds).toContain(8);
        expect(h.instanceEventArgs).toEqual([
            ['instance'],
            h.screenManagerBase,
        ]);
    });

    test('lock toggles through the sync group and says what it will do', async () => {
        await renderHeader();
        const lock = getControl('Lock')!;
        expect(lock.getAttribute('aria-pressed')).toBe('false');
        expect(lock.style.color).toBe('green');

        await act(async () => {
            lock.click();
        });
        expect(
            h.screenManagerBase.setIsLockedWithSyncGroup,
        ).toHaveBeenCalledWith(true);
        const unlock = getControl('Unlock')!;
        expect(unlock.getAttribute('aria-pressed')).toBe('true');
        expect(unlock.className).toContain('bi-lock-fill');
        expect(unlock.style.color).toBe('red');

        await act(async () => {
            unlock.click();
        });
        expect(
            h.screenManagerBase.setIsLockedWithSyncGroup,
        ).toHaveBeenLastCalledWith(false);
        expect(getControl('Lock')).not.toBe(null);
    });

    test('a lock set from a group sibling is picked up on the instance event', async () => {
        await renderHeader();
        h.screenManagerBase.isLocked = true;
        await act(async () => {
            h.instanceCallback!();
        });
        expect(getControl('Unlock')).not.toBe(null);
        expect(
            h.screenManagerBase.setIsLockedWithSyncGroup,
        ).not.toHaveBeenCalled();
    });

    test('full view asks the card to flip it', async () => {
        const setIsFullView = vi.fn();
        await renderHeader(false, setIsFullView);
        const fullView = getControl('Full view')!;
        expect(fullView.className).toContain('bi-arrows-fullscreen');
        await act(async () => {
            fullView.click();
        });
        expect(setIsFullView).toHaveBeenCalledWith(true);

        await renderHeader(true, setIsFullView);
        const exit = getControl('Exit full view')!;
        expect(exit.getAttribute('aria-pressed')).toBe('true');
        expect(exit.className).toContain('bi-fullscreen-exit');
        await act(async () => {
            exit.click();
        });
        expect(setIsFullView).toHaveBeenLastCalledWith(false);
    });

    test('stopping the preview rendering flips its eye and label', async () => {
        await renderHeader();
        const stop = getControl('Stop rendering preview')!;
        expect(stop.className).toContain('bi-eye ');
        await act(async () => {
            stop.click();
        });
        const resume = getControl('Resume rendering preview')!;
        expect(resume.getAttribute('aria-pressed')).toBe('true');
        expect(resume.className).toContain('bi-eye-slash');
        expect(resume.style.color).toBe('var(--bs-warning)');

        await act(async () => {
            resume.click();
        });
        expect(getControl('Stop rendering preview')).not.toBe(null);
    });

    test('every icon control answers the keyboard', async () => {
        await renderHeader();
        for (const label of ['Stop rendering preview', 'Lock', 'Full view']) {
            const control = getControl(label)!;
            expect(control.getAttribute('role')).toBe('button');
            expect(control.tabIndex).toBe(0);
            await act(async () => {
                control.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    }),
                );
            });
        }
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(3);
    });
});
