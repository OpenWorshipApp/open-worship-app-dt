import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isPresenter: true,
    getCommonEffectType: vi.fn(),
    getBackgroundTabTransition: vi.fn(),
    getBackgroundItemTransition: vi.fn(),
    setBackgroundTabTransition: vi.fn(),
    setBackgroundItemTransition: vi.fn(),
    showTransitionOverrideDialog: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPresenter;
        },
    },
}));
vi.mock('../_screen/managers/ScreenEffectManager', () => ({
    default: { getCommonEffectType: h.getCommonEffectType },
}));
vi.mock('./backgroundTransitionHelpers', () => ({
    BACKGROUND_TRANSITION_CHANGED_EVENT: 'background-transition-changed',
    getBackgroundTabTransition: h.getBackgroundTabTransition,
    getBackgroundItemTransition: h.getBackgroundItemTransition,
    setBackgroundTabTransition: h.setBackgroundTabTransition,
    setBackgroundItemTransition: h.setBackgroundItemTransition,
}));
vi.mock('../others/TransitionOverrideComp', () => ({
    genTransitionMenuItem: (options: unknown) => ({
        menuElement: 'Transition',
        ...(options as object),
    }),
    getTransitionIconName: () => 'magic',
    showTransitionOverrideDialog: h.showTransitionOverrideDialog,
    toTransitionLabel: () => 'Zoom',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../event/EventHandler', () => ({
    default: {
        registerEventListener: vi.fn(),
        unregisterEventListener: vi.fn(),
    },
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import {
    BackgroundTransitionBadgeComp,
    genBackgroundItemInherited,
    genBackgroundItemTransitionMenuItems,
    genBackgroundTabInherited,
    genBackgroundTabTransitionMenuItems,
    openBackgroundItemTransitionDialog,
    openBackgroundTabTransitionDialog,
} from './backgroundTransitionMenuHelpers';

beforeEach(() => {
    vi.resetAllMocks();
    h.isPresenter = true;
    h.getCommonEffectType.mockReturnValue('fade');
    h.getBackgroundTabTransition.mockReturnValue(undefined);
    h.getBackgroundItemTransition.mockReturnValue(undefined);
    h.showTransitionOverrideDialog.mockResolvedValue({ value: 'zoom' });
});

describe('background transition controls', () => {
    it('inherits the screen effect until a tab defines one', () => {
        expect(genBackgroundTabInherited()).toEqual({
            effect: 'fade',
            sourceLabel: 'Screen setting',
        });
        expect(genBackgroundItemInherited('image')).toEqual({
            effect: 'fade',
            sourceLabel: 'Screen setting',
        });
        h.getBackgroundTabTransition.mockReturnValue('wipe');
        expect(genBackgroundItemInherited('image')).toEqual({
            effect: 'wipe',
            sourceLabel: 'Images',
        });
    });

    it('saves a tab or item choice and respects cancellation', async () => {
        await openBackgroundTabTransitionDialog('video');
        expect(h.showTransitionOverrideDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Transition: Videos',
                inherited: {
                    effect: 'fade',
                    sourceLabel: 'Screen setting',
                },
            }),
        );
        expect(h.setBackgroundTabTransition).toHaveBeenCalledWith(
            'video',
            'zoom',
        );
        await openBackgroundItemTransitionDialog(
            'image',
            'file:///picture.png',
        );
        expect(h.setBackgroundItemTransition).toHaveBeenCalledWith(
            'file:///picture.png',
            'zoom',
        );
        h.showTransitionOverrideDialog.mockResolvedValue(null);
        await openBackgroundTabTransitionDialog('video');
        await openBackgroundItemTransitionDialog(
            'image',
            'file:///picture.png',
        );
        expect(h.setBackgroundTabTransition).toHaveBeenCalledTimes(1);
        expect(h.setBackgroundItemTransition).toHaveBeenCalledTimes(1);
    });

    it('offers menus only in the presenter and routes selection to the dialog', async () => {
        const [tabMenu] = genBackgroundTabTransitionMenuItems('image');
        const [itemMenu] = genBackgroundItemTransitionMenuItems(
            'image',
            'file:///picture.png',
        );
        expect(tabMenu.menuElement).toBe('Transition');
        tabMenu.onSelect?.({} as never);
        itemMenu.onSelect?.({} as never);
        await Promise.resolve();
        expect(h.setBackgroundTabTransition).toHaveBeenCalledWith(
            'image',
            'zoom',
        );
        expect(h.setBackgroundItemTransition).toHaveBeenCalledWith(
            'file:///picture.png',
            'zoom',
        );
        h.isPresenter = false;
        expect(genBackgroundTabTransitionMenuItems('image')).toEqual([]);
        expect(
            genBackgroundItemTransitionMenuItems(
                'image',
                'file:///picture.png',
            ),
        ).toEqual([]);
    });

    it('marks only backgrounds with their own transition', () => {
        expect(
            renderToStaticMarkup(
                createElement(BackgroundTransitionBadgeComp, {
                    backgroundType: 'image',
                }),
            ),
        ).toBe('');
        h.getBackgroundTabTransition.mockReturnValue('zoom');
        expect(
            renderToStaticMarkup(
                createElement(BackgroundTransitionBadgeComp, {
                    backgroundType: 'image',
                }),
            ),
        ).toContain('title="Transition: Zoom"');
        expect(
            renderToStaticMarkup(
                createElement(BackgroundTransitionBadgeComp, {
                    backgroundType: 'image',
                }),
            ),
        ).toContain('aria-hidden="true"');
    });
});
