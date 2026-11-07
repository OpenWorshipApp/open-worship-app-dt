// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The badges mounted for real, so their subscription runs: the sibling test
// renders them to static markup, which runs no effect.
const h = vi.hoisted(() => ({
    tabEffects: {} as Record<string, string | undefined>,
    itemEffects: {} as Record<string, string | undefined>,
}));

vi.mock('../server/appProvider', () => ({
    default: { isPagePresenter: true },
}));
vi.mock('../_screen/managers/ScreenEffectManager', () => ({
    default: { getCommonEffectType: () => 'fade' },
}));
vi.mock('./backgroundTransitionHelpers', () => ({
    BACKGROUND_TRANSITION_CHANGED_EVENT: 'background-transition-changed',
    getBackgroundTabTransition: (type: string) => h.tabEffects[type],
    getBackgroundItemTransition: (src: string) => h.itemEffects[src],
    setBackgroundTabTransition: () => {},
    setBackgroundItemTransition: () => {},
}));
vi.mock('../others/TransitionOverrideComp', () => ({
    genTransitionMenuItem: () => ({}),
    getTransitionIconName: (effect: string) => `icon-${effect}`,
    showTransitionOverrideDialog: async () => null,
    toTransitionLabel: (effect: string) => effect.toUpperCase(),
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import EventHandler from '../event/EventHandler';
import {
    BackgroundTransitionBadgeComp,
    BackgroundTransitionTileBadgeComp,
} from './backgroundTransitionMenuHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function announceChange() {
    await act(async () => {
        EventHandler.addPropEvent('background-transition-changed');
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    h.tabEffects = {};
    h.itemEffects = {};
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('background transition badges', () => {
    test('a tab badge follows its tab’s own transition as it is set and cleared', async () => {
        await act(async () =>
            root.render(
                <BackgroundTransitionBadgeComp backgroundType="image" />,
            ),
        );
        expect(host.innerHTML).toBe('');

        h.tabEffects.image = 'zoom';
        await announceChange();
        const badge = host.querySelector('i')!;
        expect(badge.className).toBe('bi bi-icon-zoom ms-1');
        expect(badge.title).toBe('Transition: ZOOM');
        expect(badge.getAttribute('aria-hidden')).toBe('true');

        // Another tab's change leaves this one as it is.
        h.tabEffects.video = 'wipe';
        await announceChange();
        expect(host.querySelector('i')!.title).toBe('Transition: ZOOM');

        h.tabEffects.image = undefined;
        await announceChange();
        expect(host.innerHTML).toBe('');
    });

    test('a tile badge sits in its corner and shows the background’s OWN transition, not its tab’s', async () => {
        await act(async () =>
            root.render(
                <BackgroundTransitionTileBadgeComp
                    backgroundType="video"
                    src="file:///a.mp4"
                />,
            ),
        );
        const corner = host.firstElementChild as HTMLElement;
        expect(corner.className).toBe('position-absolute mx-1 text-white');
        expect(corner.style.bottom).toBe('0px');
        expect(corner.style.right).toBe('0px');
        expect(corner.style.pointerEvents).toBe('none');
        expect(corner.querySelector('i')).toBeNull();

        h.tabEffects.video = 'wipe';
        await announceChange();
        expect(corner.querySelector('i')).toBeNull();

        h.itemEffects['file:///a.mp4'] = 'slide';
        await announceChange();
        const badge = corner.querySelector('i')!;
        expect(badge.className.trim()).toBe('bi bi-icon-slide');
        expect(badge.title).toBe('Transition: SLIDE');
    });

    test('re-reads when pointed at another background, and stops listening once gone', async () => {
        h.itemEffects['file:///b.png'] = 'fade';
        await act(async () =>
            root.render(
                <BackgroundTransitionBadgeComp
                    backgroundType="image"
                    src="file:///a.png"
                />,
            ),
        );
        expect(host.querySelector('i')).toBeNull();
        await act(async () =>
            root.render(
                <BackgroundTransitionBadgeComp
                    backgroundType="image"
                    src="file:///b.png"
                />,
            ),
        );
        expect(host.querySelector('i')?.title).toBe('Transition: FADE');

        const unregister = vi.spyOn(EventHandler, 'unregisterEventListener');
        act(() => root.unmount());
        expect(unregister).toHaveBeenCalledWith([
            {
                eventName: 'background-transition-changed',
                listener: expect.any(Function),
            },
        ]);
        root = createRoot(host);
    });
});
