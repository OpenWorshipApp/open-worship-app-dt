import { describe, expect, test, vi } from 'vitest';

// A run-sheet row of every kind: what it reads as in the run sheet, and what
// replaying it days later puts up -- onto that kind's own slot and no other.

const { mocks } = vi.hoisted(() => ({
    mocks: { renderMarkdown: vi.fn() },
}));

vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: mocks.renderMarkdown,
}));

import {
    applyForegroundDragData,
    toForegroundDragLabel,
    toForegroundRowKey,
} from './foregroundDragHelpers';

const MANAGER_METHOD_LIST = [
    'addMessageData',
    'setCountdownData',
    'setStopwatchData',
    'addTimeData',
    'setMarqueeTopData',
    'setMarqueeBottomData',
    'setQuickTextData',
    'addCameraData',
    'addScreenData',
    'addWebData',
    'addVideoData',
    'addImageData',
] as const;

function genManager() {
    return Object.fromEntries(
        MANAGER_METHOD_LIST.map((methodName) => {
            return [methodName, vi.fn()];
        }),
    ) as Record<(typeof MANAGER_METHOD_LIST)[number], ReturnType<typeof vi.fn>>;
}

// Which of the manager's methods a replay reached.
function readCalledMethods(manager: ReturnType<typeof genManager>) {
    return MANAGER_METHOD_LIST.filter((methodName) => {
        return manager[methodName].mock.calls.length > 0;
    });
}

const translate = (key: string) => {
    return `t(${key})`;
};

describe('a foreground row in the run sheet', () => {
    test('a marquee reads as its first sixty letters, or as nothing typed', () => {
        const text = 'A'.repeat(59) + 'BC';
        expect(
            toForegroundDragLabel(
                { target: 'marquee-top', data: { text } },
                translate,
            ),
        ).toBe(`t(Marquee Top): ${'A'.repeat(59)}B`);
        expect(
            toForegroundDragLabel({ target: 'marquee-bottom', data: {} }),
        ).toBe('Marquee Bottom: ');
    });

    test('several messages read as how many there are', () => {
        expect(
            toForegroundDragLabel({
                target: 'message',
                data: { textList: ['One', 'Two', 'Three'] },
            }),
        ).toBe('Messages: 3');
        expect(toForegroundDragLabel({ target: 'message', data: {} })).toBe(
            'Messages: 0',
        );
    });

    test('a clock reads as its title, or as its offset from UTC without one', () => {
        expect(
            toForegroundDragLabel(
                {
                    target: 'time',
                    data: { title: 'Phnom Penh', timezoneMinuteOffset: 420 },
                },
                translate,
            ),
        ).toBe('t(Time): Phnom Penh');
        expect(
            toForegroundDragLabel({
                target: 'time',
                data: { title: '', timezoneMinuteOffset: -300 },
            }),
        ).toBe('Time: UTC-300');
    });

    test('a countdown to a date reads as that date', () => {
        expect(
            toForegroundDragLabel({
                target: 'countdown',
                data: { dateTime: '2026-11-08T09:00' },
            }),
        ).toBe('Countdown: 2026-11-08T09:00');
        expect(toForegroundDragLabel({ target: 'countdown', data: {} })).toBe(
            'Countdown: ',
        );
    });

    test('the rest read as their component, and a kind the app does not know as itself', () => {
        expect(
            toForegroundDragLabel(
                { target: 'video', data: { id: 'v' } },
                translate,
            ),
        ).toBe('t(Video Show)');
        expect(toForegroundDragLabel({ target: 'stopwatch', data: {} })).toBe(
            'Stopwatch',
        );
        // Not a dictionary key: translating it would throw in a Khmer window.
        const translateKnown = vi.fn(translate);
        expect(
            toForegroundDragLabel(
                { target: 'hologram' as any, data: {} },
                translateKnown,
            ),
        ).toBe('hologram');
        expect(translateKnown).not.toHaveBeenCalled();
    });
});

describe('replaying a foreground row', () => {
    test('a countdown to a date keeps its date, its layer and its transition', async () => {
        const manager = genManager();
        const data = {
            dateTime: '2026-11-08T09:00:00.000Z',
            isBehind: true,
            transitionEffect: 'fade',
            extraStyle: { color: 'red' },
        };
        await applyForegroundDragData(manager as any, {
            target: 'countdown',
            data,
        });
        expect(readCalledMethods(manager)).toEqual(['setCountdownData']);
        const countdownData = manager.setCountdownData.mock.calls[0][0];
        expect(countdownData).toEqual({
            transitionEffect: 'fade',
            dateTime: new Date('2026-11-08T09:00:00.000Z'),
            extraStyle: { color: 'red' },
            rowKey: toForegroundRowKey(data),
            isBehind: true,
        });
    });

    test('a transition the app does not know is not carried, and an in-front row has no layer key', async () => {
        const manager = genManager();
        await applyForegroundDragData(manager as any, {
            target: 'countdown',
            data: {
                dateTime: '2026-11-08T09:00:00.000Z',
                transitionEffect: 'spin',
            },
        });
        const countdownData = manager.setCountdownData.mock.calls[0][0];
        expect(countdownData).not.toHaveProperty('transitionEffect');
        expect(countdownData).not.toHaveProperty('isBehind');
    });

    test.each([
        ['time', 'addTimeData', { timezoneMinuteOffset: 420, title: 'PP' }],
        ['marquee-top', 'setMarqueeTopData', { text: 'Welcome' }],
        ['marquee-bottom', 'setMarqueeBottomData', { text: 'Offering' }],
        ['camera', 'addCameraData', { id: 'cam-1', extraStyle: {} }],
        ['web', 'addWebData', { url: 'https://example.org' }],
        ['image', 'addImageData', { id: 'img-1', isBehind: true }],
    ] as const)(
        'a %s row is replayed whole onto its own slot',
        async (target, methodName, data) => {
            const manager = genManager();
            await applyForegroundDragData(manager as any, { target, data });
            expect(readCalledMethods(manager)).toEqual([methodName]);
            // The very payload the row stored, layer and all.
            expect(manager[methodName]).toHaveBeenCalledWith(data);
        },
    );
});
