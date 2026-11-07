import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        resolveSlideTransition: vi.fn(),
        handleError: vi.fn(),
    };
});

vi.mock('../../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        resolveSlideTransition: mocks.resolveSlideTransition,
    },
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

import { resolveSlideTransitionEffect } from './screenSlideTransitionHelpers';

beforeEach(() => {
    mocks.resolveSlideTransition.mockResolvedValue(undefined);
});

describe('resolveSlideTransitionEffect', () => {
    test("a slide's own transition, read from its sidecar", async () => {
        mocks.resolveSlideTransition.mockResolvedValue('zoom');

        await expect(
            resolveSlideTransitionEffect('/docs/talk.slide', 4),
        ).resolves.toBe('zoom');
        expect(mocks.resolveSlideTransition).toHaveBeenCalledWith(
            '/docs/talk.slide',
            4,
        );
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('no override means follow the screen', async () => {
        await expect(
            resolveSlideTransitionEffect('/docs/talk.slide', '4'),
        ).resolves.toBeUndefined();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a sidecar that cannot be read never keeps a slide off the screen', async () => {
        const error = new Error('broken sidecar');
        mocks.resolveSlideTransition.mockRejectedValue(error);

        await expect(
            resolveSlideTransitionEffect('/docs/talk.slide', 4),
        ).resolves.toBeUndefined();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });
});
