// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    closeLyricStageStyleFloating,
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';

// The store is module state shared by every previewer, so each test takes
// owner ids of its own and closes what it opened.
let container: HTMLDivElement;
let root: Root;
const renders: Record<string, (number | null)[]> = {};

function ProbeComp({ ownerId }: { ownerId: string }) {
    renders[ownerId] ??= [];
    renders[ownerId].push(useLyricStageStyleFloatingStage(ownerId));
    return null;
}

async function mountProbes(...ownerIds: string[]) {
    await act(async () => {
        root.render(
            createElement(
                'div',
                null,
                ownerIds.map((ownerId) =>
                    createElement(ProbeComp, { key: ownerId, ownerId }),
                ),
            ),
        );
    });
}

function lastStage(ownerId: string) {
    return renders[ownerId].at(-1);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('genLyricStageStyleFloatingOwnerId', () => {
    test('hands every previewer an id of its own, safe in a selector', () => {
        const first = genLyricStageStyleFloatingOwnerId();
        const second = genLyricStageStyleFloatingOwnerId();
        expect(first).not.toBe(second);
        expect(first).toMatch(/^lyric-stage-style-owner-\d+$/);
    });
});

describe('the shared panel store', () => {
    test('a gear opens its stage, another stage retargets, the same closes', async () => {
        const ownerId = genLyricStageStyleFloatingOwnerId();
        await mountProbes(ownerId);
        expect(lastStage(ownerId)).toBeNull();

        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerId, 2);
        });
        expect(lastStage(ownerId)).toBe(2);
        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerId, 0);
        });
        expect(lastStage(ownerId)).toBe(0);
        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerId, 0);
        });
        expect(lastStage(ownerId)).toBeNull();
    });

    test('only the owner sees its panel open; another owner takes it over', async () => {
        const ownerA = genLyricStageStyleFloatingOwnerId();
        const ownerB = genLyricStageStyleFloatingOwnerId();
        await mountProbes(ownerA, ownerB);

        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerA, 1);
        });
        expect(lastStage(ownerA)).toBe(1);
        expect(lastStage(ownerB)).toBeNull();

        // B's gear on the SAME stage opens B's, not a toggle of A's.
        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerB, 1);
        });
        expect(lastStage(ownerA)).toBeNull();
        expect(lastStage(ownerB)).toBe(1);

        // A previewer going away cannot shut a panel another one owns...
        await act(async () => {
            closeLyricStageStyleFloating(ownerA);
        });
        expect(lastStage(ownerB)).toBe(1);
        // ...but its own owner can.
        await act(async () => {
            closeLyricStageStyleFloating(ownerB);
        });
        expect(lastStage(ownerB)).toBeNull();
    });

    test('closing a panel nobody here owns re-renders nobody', async () => {
        const ownerId = genLyricStageStyleFloatingOwnerId();
        await mountProbes(ownerId);
        await act(async () => {
            toggleLyricStageStyleFloatingStage(ownerId, 3);
        });
        const renderCount = renders[ownerId].length;

        await act(async () => {
            closeLyricStageStyleFloating(genLyricStageStyleFloatingOwnerId());
        });
        expect(renders[ownerId].length).toBe(renderCount);
        expect(lastStage(ownerId)).toBe(3);

        await act(async () => {
            closeLyricStageStyleFloating(ownerId);
        });
        expect(lastStage(ownerId)).toBeNull();
    });
});
