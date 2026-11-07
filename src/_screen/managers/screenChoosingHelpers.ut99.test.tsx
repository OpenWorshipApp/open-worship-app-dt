// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
    return { bases: [] as { screenId: number }[] };
});

vi.mock('./screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => state.bases,
}));

import {
    captureChosenScreenIds,
    genScreenIdMenuItems,
    notifyChosenScreenIds,
    PresetScreenIdsContext,
    usePresetScreenIds,
} from './screenChoosingHelpers';
import { genColorFromScreenId } from '../preview/screenIdColorHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
    vi.useFakeTimers();
    state.bases = [];
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('genScreenIdMenuItems', () => {
    test('one row per screen, labelled by id and tinted with its colour', () => {
        state.bases = [{ screenId: 0 }, { screenId: 2 }];
        const selected: number[] = [];

        const items = genScreenIdMenuItems((screenId) => {
            selected.push(screenId);
        });

        expect(items.map((item) => item.menuElement)).toEqual([
            'Screen id: 0',
            'Screen id: 2',
        ]);
        const icon = items[1].childBefore as any;
        expect(icon.props.className).toBe('bi bi-display');
        expect(icon.props.style.color).toBe(genColorFromScreenId(2));
        items[1].onSelect?.({} as any);
        expect(selected).toEqual([2]);
    });

    test('a chosen check turns the rows into a checklist', () => {
        state.bases = [{ screenId: 1 }, { screenId: 3 }];

        const items = genScreenIdMenuItems(
            () => {},
            (screenId) => screenId === 3,
        );

        expect(
            items.map((item) => (item.childBefore as any).props.className),
        ).toEqual(['bi bi-square', 'bi bi-check-square-fill']);
    });
});

describe('captureChosenScreenIds / notifyChosenScreenIds', () => {
    test('the follower hears the answer on the next macrotask', () => {
        const event = { type: 'click' };
        const heard: number[][] = [];
        captureChosenScreenIds(event, (screenIds) => {
            heard.push(screenIds);
        });

        notifyChosenScreenIds(event, [1, 2]);
        // The thing the operator clicked reaches its screen first.
        expect(heard).toEqual([]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual([[1, 2]]);
    });

    test('keyed by the native event, so both React wrappers of a click match', () => {
        const nativeEvent = { type: 'click' };
        const heard: number[][] = [];
        captureChosenScreenIds({ nativeEvent, outer: true }, (screenIds) => {
            heard.push(screenIds);
        });

        // The shadow root's own React tree wraps the same click again.
        notifyChosenScreenIds({ nativeEvent, inner: true }, [4]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual([[4]]);
    });

    test('one arm answers one resolution', () => {
        const event = { type: 'click' };
        const heard: number[][] = [];
        captureChosenScreenIds(event, (screenIds) => {
            heard.push(screenIds);
        });

        notifyChosenScreenIds(event, [1]);
        notifyChosenScreenIds(event, [2]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual([[1]]);
    });

    test('one gesture never consumes another one’s answer', () => {
        const firstEvent = { type: 'click' };
        const secondEvent = { type: 'keydown' };
        const heard: string[] = [];
        captureChosenScreenIds(firstEvent, () => {
            heard.push('first');
        });
        captureChosenScreenIds(secondEvent, () => {
            heard.push('second');
        });

        notifyChosenScreenIds(secondEvent, [0]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual(['second']);

        notifyChosenScreenIds(firstEvent, [0]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual(['second', 'first']);
    });

    test('a released arm hears nothing, and an old release keeps a newer arm', () => {
        const event = { type: 'click' };
        const heard: string[] = [];
        const releaseOld = captureChosenScreenIds(event, () => {
            heard.push('old');
        });
        captureChosenScreenIds(event, () => {
            heard.push('new');
        });

        // The first arm was replaced; releasing it must not drop the second.
        releaseOld();
        notifyChosenScreenIds(event, [1]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual(['new']);

        const release = captureChosenScreenIds(event, () => {
            heard.push('released');
        });
        release();
        notifyChosenScreenIds(event, [1]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual(['new']);
    });

    test('no event means no arm at all', () => {
        const heard: unknown[] = [];
        const release = captureChosenScreenIds(null, () => {
            heard.push(null);
        });
        captureChosenScreenIds(undefined, () => {
            heard.push(undefined);
        });

        expect(release).toBeTypeOf('function');
        release();
        notifyChosenScreenIds(null, [1]);
        notifyChosenScreenIds(undefined, [1]);
        vi.advanceTimersByTime(0);
        expect(heard).toEqual([]);
    });
});

describe('usePresetScreenIds', () => {
    function PresetProbeComp() {
        return <span>{JSON.stringify(usePresetScreenIds())}</span>;
    }

    test('empty outside a provider, the preset ids inside one', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <>
                    <PresetProbeComp />
                    <PresetScreenIdsContext value={[2, 3]}>
                        <PresetProbeComp />
                    </PresetScreenIdsContext>
                </>,
            );
        });
        expect(
            Array.from(container.querySelectorAll('span')).map(
                (span) => span.textContent,
            ),
        ).toEqual(['[]', '[2,3]']);

        act(() => {
            root.unmount();
        });
        container.remove();
    });
});
