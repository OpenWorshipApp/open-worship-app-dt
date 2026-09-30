import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { capture: null as null | ((ids: number[]) => void) },
    mocks: {
        capture: vi.fn(),
        applyIds: vi.fn(),
        showIds: vi.fn(),
        handleError: vi.fn(),
        fireRun: vi.fn(),
        refresh: vi.fn(),
    },
}));

vi.mock('../_screen/managers/screenChoosingHelpers', () => ({
    captureChosenScreenIds: (
        event: unknown,
        callback: (ids: number[]) => void,
    ) => {
        mocks.capture(event, callback);
        state.capture = callback;
    },
}));
vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    applyOnScreenIds: mocks.applyIds,
    showDroppedDataOnScreenIds: mocks.showIds,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    firePresentingFlowRunAction: mocks.fireRun,
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    refreshOnScreenAfterPresenting: mocks.refresh,
}));

import {
    applyPresentingFlowCcItemsOnScreenIds,
    armPresentingFlowCcPropagation,
} from './presentingFlowCcApplyHelpers';

function cc(overrides: Record<string, unknown> = {}) {
    return {
        runAction: null,
        isScreenReachable: true,
        screenAction: null,
        screenIds: [],
        isAction: false,
        toDroppedData: vi.fn(async () => ({ type: 'slide' })),
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.capture = null;
    mocks.applyIds.mockImplementation(async (_ids, callback) =>
        callback({ screen: 1 }),
    );
});

describe('presenting-flow CC propagation', () => {
    test('fires supported run followers and skips unreachable ones', async () => {
        const supported = cc({ runAction: { canBeCcItem: true } });
        const refused = cc({ runAction: { canBeCcItem: false } });
        await applyPresentingFlowCcItemsOnScreenIds(
            [supported, refused, cc({ isScreenReachable: false })],
            [1],
        );
        expect(mocks.fireRun).toHaveBeenCalledWith(supported);
        expect(mocks.fireRun).toHaveBeenCalledTimes(1);
        expect(mocks.refresh).toHaveBeenCalled();
    });

    test('honors required screen ids, host filters, and action overrides', async () => {
        const requiredApply = vi.fn();
        const filteredApply = vi.fn();
        const overrideApply = vi.fn();
        const required = cc({
            isAction: true,
            screenIds: [3],
            screenAction: {
                requiresScreenIds: true,
                filtersHostScreenIds: false,
                apply: requiredApply,
            },
        });
        const requiredEmpty = cc({
            isAction: true,
            screenIds: [],
            screenAction: { requiresScreenIds: true, apply: vi.fn() },
        });
        const filtered = cc({
            isAction: true,
            screenIds: [2, 4],
            screenAction: {
                requiresScreenIds: false,
                filtersHostScreenIds: true,
                apply: filteredApply,
            },
        });
        const override = cc({
            isAction: true,
            screenIds: [5],
            screenAction: {
                requiresScreenIds: false,
                filtersHostScreenIds: false,
                apply: overrideApply,
            },
        });
        const noAction = cc({ isAction: true, screenAction: null });
        await applyPresentingFlowCcItemsOnScreenIds(
            [required, requiredEmpty, filtered, override, noAction],
            [1, 2],
        );
        expect(mocks.applyIds).toHaveBeenCalledWith([3], expect.any(Function));
        expect(mocks.applyIds).toHaveBeenCalledWith([2], expect.any(Function));
        expect(mocks.applyIds).toHaveBeenCalledWith([5], expect.any(Function));
        expect(requiredApply).toHaveBeenCalledWith({ screen: 1 }, required);
        expect(filteredApply).toHaveBeenCalledWith({ screen: 1 }, filtered);
        expect(overrideApply).toHaveBeenCalledWith({ screen: 1 }, override);
    });

    test('shows content on inherited screens and skips unreadable or empty targets', async () => {
        const inherited = cc();
        const own = cc({ screenIds: [7] });
        const unreadable = cc({ toDroppedData: vi.fn(async () => null) });
        const filteredEmpty = cc({
            isAction: false,
            screenIds: [8],
            screenAction: {
                requiresScreenIds: false,
                filtersHostScreenIds: true,
            },
        });
        await applyPresentingFlowCcItemsOnScreenIds(
            [inherited, own, unreadable, filteredEmpty],
            [1, 2],
        );
        expect(mocks.showIds).toHaveBeenCalledWith([1, 2], { type: 'slide' });
        expect(mocks.showIds).toHaveBeenCalledWith([7], { type: 'slide' });
        expect(mocks.showIds).toHaveBeenCalledTimes(2);
    });

    test('arms one callback, ignores dismissal, applies ids, and reports failures', async () => {
        armPresentingFlowCcPropagation({}, []);
        expect(mocks.capture).not.toHaveBeenCalled();
        const items = [cc()];
        const event = { type: 'click' };
        armPresentingFlowCcPropagation(event, items);
        expect(mocks.capture).toHaveBeenCalledWith(event, expect.any(Function));
        state.capture?.([]);
        expect(mocks.showIds).not.toHaveBeenCalled();
        state.capture?.([4]);
        await vi.waitFor(() =>
            expect(mocks.showIds).toHaveBeenCalledWith([4], { type: 'slide' }),
        );

        mocks.showIds.mockRejectedValueOnce(new Error('failed'));
        state.capture?.([5]);
        await vi.waitFor(() => expect(mocks.handleError).toHaveBeenCalled());
    });
});
