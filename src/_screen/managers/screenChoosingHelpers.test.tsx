// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    screenIds: [] as number[],
}));

vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string, style: object) => ({ name, style }),
}));
vi.mock('../preview/screenIdColorHelpers', () => ({
    genColorFromScreenId: (screenId: number) => `color-${screenId}`,
}));
vi.mock('./screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => {
        return h.screenIds.map((screenId) => {
            return { screenId };
        });
    },
}));

import {
    PresetScreenIdsContext,
    captureChosenScreenIds,
    genScreenIdMenuItems,
    notifyChosenScreenIds,
    usePresetScreenIds,
} from './screenChoosingHelpers';

beforeEach(() => {
    h.screenIds = [0, 2];
});

afterEach(() => {
    vi.useRealTimers();
});

describe('genScreenIdMenuItems', () => {
    test('one row per screen, labelled by id and tinted with its colour', () => {
        const onSelect = vi.fn();
        const items = genScreenIdMenuItems(onSelect);
        expect(
            items.map((item) => {
                return [item.menuElement, item.childBefore];
            }),
        ).toEqual([
            ['Screen id: 0', { name: 'display', style: { color: 'color-0' } }],
            ['Screen id: 2', { name: 'display', style: { color: 'color-2' } }],
        ]);
        items[1].onSelect!({} as any);
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    test('a checklist marks the chosen screens', () => {
        const items = genScreenIdMenuItems(vi.fn(), (screenId) => {
            return screenId === 2;
        });
        expect(
            items.map((item) => {
                return (item.childBefore as any).name;
            }),
        ).toEqual(['square', 'check-square-fill']);
    });
});

describe('captureChosenScreenIds / notifyChosenScreenIds', () => {
    test('a follower gets the answer one macrotask after the resolution', async () => {
        vi.useFakeTimers();
        const event = { type: 'click' };
        const onChosen = vi.fn();
        captureChosenScreenIds(event, onChosen);

        notifyChosenScreenIds(event, [1, 3]);
        expect(onChosen).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(0);
        expect(onChosen).toHaveBeenCalledWith([1, 3]);
    });

    test('one arm answers one resolution', async () => {
        vi.useFakeTimers();
        const event = { type: 'click' };
        const onChosen = vi.fn();
        captureChosenScreenIds(event, onChosen);
        notifyChosenScreenIds(event, [1]);
        notifyChosenScreenIds(event, [2]);
        await vi.advanceTimersByTimeAsync(0);
        expect(onChosen).toHaveBeenCalledTimes(1);
        expect(onChosen).toHaveBeenCalledWith([1]);
    });

    test('keyed by the native event, so two React wrappers of one click meet', async () => {
        vi.useFakeTimers();
        const nativeEvent = new MouseEvent('click');
        const onChosen = vi.fn();
        // The outer tree arms from its wrapper...
        captureChosenScreenIds({ nativeEvent }, onChosen);
        // ...and the shadow root's own tree resolves from another one.
        notifyChosenScreenIds({ nativeEvent }, [4]);
        await vi.advanceTimersByTimeAsync(0);
        expect(onChosen).toHaveBeenCalledWith([4]);
    });

    test('another gesture never consumes this one’s answer', async () => {
        vi.useFakeTimers();
        const first = { type: 'click' };
        const second = { type: 'keydown' };
        const onFirst = vi.fn();
        captureChosenScreenIds(first, onFirst);
        notifyChosenScreenIds(second, [9]);
        await vi.advanceTimersByTimeAsync(0);
        expect(onFirst).not.toHaveBeenCalled();

        notifyChosenScreenIds(first, [1]);
        await vi.advanceTimersByTimeAsync(0);
        expect(onFirst).toHaveBeenCalledWith([1]);
    });

    test('released before the answer, the follower is never called', async () => {
        vi.useFakeTimers();
        const event = { type: 'click' };
        const onChosen = vi.fn();
        const release = captureChosenScreenIds(event, onChosen);
        release();
        notifyChosenScreenIds(event, [1]);
        await vi.advanceTimersByTimeAsync(0);
        expect(onChosen).not.toHaveBeenCalled();
    });

    test('a stale release cannot drop a newer arm on the same gesture', async () => {
        vi.useFakeTimers();
        const event = { type: 'click' };
        const older = vi.fn();
        const newer = vi.fn();
        const releaseOlder = captureChosenScreenIds(event, older);
        captureChosenScreenIds(event, newer);
        releaseOlder();
        notifyChosenScreenIds(event, [5]);
        await vi.advanceTimersByTimeAsync(0);
        expect(older).not.toHaveBeenCalled();
        expect(newer).toHaveBeenCalledWith([5]);
    });

    test('no event, nothing to arm', () => {
        const onChosen = vi.fn();
        const release = captureChosenScreenIds(null, onChosen);
        expect(release).toBeTypeOf('function');
        release();
        captureChosenScreenIds(undefined, onChosen)();
        expect(onChosen).not.toHaveBeenCalled();
    });
});

describe('usePresetScreenIds', () => {
    test('empty by default, the provided ids inside a preset subtree', async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const seen: number[][] = [];
        function ProbeComp() {
            seen.push(usePresetScreenIds());
            return null;
        }
        const root = createRoot(document.createElement('div'));
        await act(async () => {
            root.render(
                <>
                    <ProbeComp />
                    <PresetScreenIdsContext value={[2, 5]}>
                        <ProbeComp />
                    </PresetScreenIdsContext>
                </>,
            );
        });
        expect(seen).toEqual([[], [2, 5]]);
        act(() => {
            root.unmount();
        });
        vi.unstubAllGlobals();
    });
});
