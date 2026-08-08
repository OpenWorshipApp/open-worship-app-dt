// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    applyOnScreenIdsMock,
    showDroppedDataOnScreenIdsMock,
    startPresentingFlowAutoNextMock,
} = vi.hoisted(() => ({
    applyOnScreenIdsMock: vi.fn(
        async (_screenIds: number[], _apply: unknown) => {},
    ),
    showDroppedDataOnScreenIdsMock: vi.fn(
        async (_screenIds: number[], _droppedData: unknown) => {},
    ),
    startPresentingFlowAutoNextMock: vi.fn(
        (_filePath: string, _mode: string, _seconds: number) => true,
    ),
}));

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES — see the note in `presentingFlowScreenIds.test.ts`.
vi.mock('../bible-list/Bible', () => ({
    default: class {
        static getDefault = vi.fn(async () => null);
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        static dragDeserialize = vi.fn(() => null);
    },
}));
// The screen layer is the thing under observation here: what matters is WHICH
// screens the followers were handed and that they never went back through
// `chooseScreenIds`, not what a screen manager did with them.
vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    applyOnScreenIds: applyOnScreenIdsMock,
    showDroppedDataOnScreenIds: showDroppedDataOnScreenIdsMock,
    applyOnChosenScreens: vi.fn(),
    showDroppedDataOnScreens: vi.fn(),
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    refreshOnScreenAfterPresenting: vi.fn(),
}));
// Only the ARMING is under observation here — the clock itself has its own
// tests. Partial, so `firePresentingFlowRunAction` (what this module calls) is the
// real one and still has to reach `start` on the registry entry.
vi.mock('./presentingFlowAutoNextHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('./presentingFlowAutoNextHelpers')
    >()),
    startPresentingFlowAutoNext: startPresentingFlowAutoNextMock,
}));

const { default: PresentingFlowItem } = await import('./PresentingFlowItem');
const { notifyChosenScreenIds } =
    await import('../_screen/managers/screenChoosingHelpers');
const {
    applyPresentingFlowCcItemsOnScreenIds,
    armPresentingFlowCcPropagation,
} = await import('./presentingFlowCcApplyHelpers');

function genCcItem(json: any) {
    return new (PresentingFlowItem as any)(
        '/presenting-flows/a.owpf',
        json,
    ) as InstanceType<typeof PresentingFlowItem>;
}

const MARQUEE = {
    type: 'foreground',
    data: { target: 'marquee-top', data: { text: 'Welcome' } },
    title: 'Marquee Top',
};

/**
 * The latch fires on the next macrotask, so the host's own content reaches its
 * screen manager first. Nothing shorter than a real timer sees it — flushing
 * microtasks is not enough (the note in CLAUDE.md's event section).
 */
async function flushLatch() {
    await new Promise((resolve) => {
        setTimeout(resolve, 25);
    });
}

describe('applying CC elements onto screens', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('a CC follows the host, and its own pin overrides it', async () => {
        await applyPresentingFlowCcItemsOnScreenIds(
            [genCcItem(MARQUEE), genCcItem({ ...MARQUEE, screenIds: [3] })],
            [1],
        );
        expect(showDroppedDataOnScreenIdsMock.mock.calls[0][0]).toEqual([1]);
        expect(showDroppedDataOnScreenIdsMock.mock.calls[1][0]).toEqual([3]);
    });

    test('a media control NARROWS the host screens instead of overriding them', async () => {
        const genMediaControl = (screenIds?: number[]) => {
            return genCcItem({
                type: 'action',
                data: 'slide-media-control',
                mediaControl: { mode: 'play' },
                ...(screenIds === undefined ? {} : { screenIds }),
            });
        };

        // Unpinned it rides its host, exactly as any other follower does.
        await applyPresentingFlowCcItemsOnScreenIds(
            [genMediaControl()],
            [1, 2],
        );
        expect(applyOnScreenIdsMock.mock.calls[0][0]).toEqual([1, 2]);

        // Pinned it runs only where the host ALSO landed...
        applyOnScreenIdsMock.mockClear();
        await applyPresentingFlowCcItemsOnScreenIds(
            [genMediaControl([2])],
            [1, 2],
        );
        expect(applyOnScreenIdsMock.mock.calls[0][0]).toEqual([2]);

        // ...and a pin naming a screen the host never reached names a screen with
        // no media on it, so it runs nowhere rather than everywhere.
        applyOnScreenIdsMock.mockClear();
        await applyPresentingFlowCcItemsOnScreenIds(
            [genMediaControl([3])],
            [1, 2],
        );
        expect(applyOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('a CC is never parked, so a stored flag cannot mute one', async () => {
        // `isDisabled` is stripped on read as well as on write, so a
        // hand-edited file cannot leave a follower that silently does nothing.
        await applyPresentingFlowCcItemsOnScreenIds(
            [
                genCcItem({ ...MARQUEE, isDisabled: true }),
                genCcItem({ type: 'bg-color', data: '#fff', title: '#fff' }),
            ],
            [1],
        );
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(2);
    });

    test('what reaches no screen at all is stepped over', async () => {
        await applyPresentingFlowCcItemsOnScreenIds(
            [
                genCcItem({ type: 'bg-audio', data: '/a.mp3', title: 'a.mp3' }),
                genCcItem({ type: 'bg-color', data: '#fff', title: '#fff' }),
            ],
            [1],
        );
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(1);
    });

    test('an action is RUN on the screens rather than shown on them', async () => {
        await applyPresentingFlowCcItemsOnScreenIds(
            [genCcItem({ type: 'action', data: 'clear-all' })],
            [2],
        );
        expect(applyOnScreenIdsMock).toHaveBeenCalledTimes(1);
        expect(applyOnScreenIdsMock.mock.calls[0][0]).toEqual([2]);
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('nowhere to go means nothing is applied', async () => {
        await applyPresentingFlowCcItemsOnScreenIds([genCcItem(MARQUEE)], []);
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
        expect(applyOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('a CC timeout arms the run and touches no screen', async () => {
        await applyPresentingFlowCcItemsOnScreenIds(
            [
                genCcItem({
                    type: 'action',
                    data: 'next-timeout',
                    actionNumber: 8,
                }),
            ],
            [1],
        );
        expect(startPresentingFlowAutoNextMock).toHaveBeenCalledWith(
            '/presenting-flows/a.owpf',
            'timeout',
            8,
        );
        expect(applyOnScreenIdsMock).not.toHaveBeenCalled();
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('a CC interval — a hand-edited one — is refused, not run', async () => {
        await applyPresentingFlowCcItemsOnScreenIds(
            [
                genCcItem({
                    type: 'action',
                    data: 'next-interval',
                    actionNumber: 8,
                }),
            ],
            [1],
        );
        expect(startPresentingFlowAutoNextMock).not.toHaveBeenCalled();
    });
});

describe('riding the screens one click resolved to', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('the followers land on exactly what the click resolved to', async () => {
        const event = {};
        armPresentingFlowCcPropagation(event, [genCcItem(MARQUEE)]);
        // Nothing before the resolution: a follower must never be interleaved
        // ahead of the thing the operator actually clicked.
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();

        notifyChosenScreenIds(event, [2]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(1);
        expect(showDroppedDataOnScreenIdsMock.mock.calls[0][0]).toEqual([2]);
    });

    test('another gesture’s resolution cannot consume this one’s arm', async () => {
        const event = {};
        const otherEvent = {};
        armPresentingFlowCcPropagation(event, [genCcItem(MARQUEE)]);

        notifyChosenScreenIds(otherEvent, [1]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();

        // Still armed for its own event.
        notifyChosenScreenIds(event, [1]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(1);
    });

    test('one arm answers one resolution', async () => {
        const event = {};
        armPresentingFlowCcPropagation(event, [genCcItem(MARQUEE)]);

        notifyChosenScreenIds(event, [1]);
        notifyChosenScreenIds(event, [2]);
        await flushLatch();

        // A gesture that resolves twice — the pin checklist reopening its menu —
        // must not replay its followers onto a screen the operator has left.
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(1);
    });

    test('a dismissed menu applies nothing at all', async () => {
        const event = {};
        armPresentingFlowCcPropagation(event, [genCcItem(MARQUEE)]);

        notifyChosenScreenIds(event, []);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
        expect(applyOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('an entry with no CCs registers nothing', async () => {
        const event = {};
        armPresentingFlowCcPropagation(event, []);

        notifyChosenScreenIds(event, [1]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
    });

    test('ONE click wrapped twice is still one gesture', async () => {
        // The regression guard for every follower of every document slide in
        // the floating preview going missing: a slide card renders into a shadow
        // root with its OWN React root, so the arm and the screen resolution are
        // handed two different wrappers around the same native click.
        const nativeEvent = {};
        armPresentingFlowCcPropagation({ nativeEvent }, [genCcItem(MARQUEE)]);

        notifyChosenScreenIds({ nativeEvent }, [2]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).toHaveBeenCalledTimes(1);
        expect(showDroppedDataOnScreenIdsMock.mock.calls[0][0]).toEqual([2]);
    });

    test('two clicks are still two gestures, however they are wrapped', async () => {
        armPresentingFlowCcPropagation({ nativeEvent: {} }, [
            genCcItem(MARQUEE),
        ]);

        // A different native click: keying on the wrapper's contents rather
        // than its identity would let this one consume the other's arm.
        notifyChosenScreenIds({ nativeEvent: {} }, [1]);
        await flushLatch();
        expect(showDroppedDataOnScreenIdsMock).not.toHaveBeenCalled();
    });
});
