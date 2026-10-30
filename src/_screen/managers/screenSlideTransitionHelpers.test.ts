import { describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    handleError: vi.fn(),
    resolveSlideTransition: vi.fn(),
}));

vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        resolveSlideTransition: h.resolveSlideTransition,
    },
}));

import { resolveSlideTransitionEffect } from './screenSlideTransitionHelpers';

describe('resolveSlideTransitionEffect', () => {
    test('answers with the slide own transition from its sidecar', async () => {
        const effect = { type: 'zoom', duration: 400 };
        h.resolveSlideTransition.mockResolvedValue(effect);
        await expect(
            resolveSlideTransitionEffect('/docs/a.slide', 3),
        ).resolves.toBe(effect);
        expect(h.resolveSlideTransition).toHaveBeenCalledWith(
            '/docs/a.slide',
            3,
        );
    });

    test('no override follows the screen', async () => {
        h.resolveSlideTransition.mockResolvedValue(undefined);
        await expect(
            resolveSlideTransitionEffect('/docs/a.slide', 'x'),
        ).resolves.toBeUndefined();
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('an unreadable sidecar never keeps the slide off the screen', async () => {
        const failure = new Error('sidecar is broken');
        h.resolveSlideTransition.mockRejectedValue(failure);
        await expect(
            resolveSlideTransitionEffect('/docs/a.slide', 1),
        ).resolves.toBeUndefined();
        expect(h.handleError).toHaveBeenCalledWith(failure);
    });
});
