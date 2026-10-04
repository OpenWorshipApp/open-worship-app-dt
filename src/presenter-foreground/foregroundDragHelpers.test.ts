import { describe, expect, test, vi } from 'vitest';

vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: vi.fn(async (text: string) => ({ html: `<p>${text}</p>` })),
}));

import {
    applyForegroundDragData,
    foregroundDragDeserialize,
    genForegroundDragInf,
    toForegroundDragIconName,
    toForegroundDragLabel,
    toForegroundRowKey,
} from './foregroundDragHelpers';

function genManager() {
    return {
        addMessageData: vi.fn(),
        setCountdownData: vi.fn(),
        setStopwatchData: vi.fn(),
        addTimeData: vi.fn(),
        setMarqueeTopData: vi.fn(),
        setMarqueeBottomData: vi.fn(),
        setQuickTextData: vi.fn(),
        addCameraData: vi.fn(),
        addWebData: vi.fn(),
        addVideoData: vi.fn(),
        addImageData: vi.fn(),
    };
}

describe('foreground drag helpers', () => {
    test('serializes only valid persisted targets and gives people useful labels', () => {
        expect(
            genForegroundDragInf('time', () => ({
                timezoneMinuteOffset: 0,
            })).dragSerialize(),
        ).toMatchObject({
            data: { target: 'time', data: { timezoneMinuteOffset: 0 } },
        });
        expect(
            foregroundDragDeserialize({ target: 'video', data: {} }),
        ).toEqual({ target: 'video', data: {} });
        expect(
            foregroundDragDeserialize({ target: 'unknown', data: {} }),
        ).toBeNull();
        expect(
            foregroundDragDeserialize({ target: 'video', data: null }),
        ).toBeNull();
        expect(toForegroundDragIconName('web')).toBe('globe2');
        expect(
            toForegroundDragLabel({
                target: 'message',
                data: { textList: ['Hello'] },
            }),
        ).toBe('Messages: Hello');
        // `durationSecond` carries the panel's one-second lead, which a row
        // saved before seconds existed has too -- `301` still reads `5m`.
        expect(
            toForegroundDragLabel({
                target: 'countdown',
                data: { durationSecond: 91 },
            }),
        ).toBe('Countdown: 1m 30s');
        expect(
            toForegroundDragLabel({
                target: 'countdown',
                data: { durationSecond: 301 },
            }),
        ).toBe('Countdown: 5m');
        expect(
            toForegroundDragLabel({
                target: 'countdown',
                data: { durationSecond: 3946 },
            }),
        ).toBe('Countdown: 1h 5m 45s');
        expect(
            toForegroundDragLabel({
                target: 'countdown',
                data: { durationSecond: 1 },
            }),
        ).toBe('Countdown: 0s');
        expect(
            toForegroundDragLabel(
                { target: 'quick-text', data: { markdownText: 'Hi' } },
                (key) => `t:${key}`,
            ),
        ).toBe('t:Quick Text: Hi');
    });

    test('replays each foreground onto the manager and refreshes relative timers', async () => {
        const manager = genManager();
        await applyForegroundDragData(manager as any, {
            target: 'message',
            data: { textList: ['A'] },
        });
        await applyForegroundDragData(manager as any, {
            target: 'countdown',
            data: { durationSecond: 60 },
        });
        await applyForegroundDragData(manager as any, {
            target: 'stopwatch',
            data: {},
        });
        await applyForegroundDragData(manager as any, {
            target: 'quick-text',
            data: { markdownText: 'Bold', timeSecondDelay: 2 },
        });
        await applyForegroundDragData(manager as any, {
            target: 'video',
            data: { id: 'v' },
        });
        expect(manager.addMessageData).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'message-all', textList: ['A'] }),
        );
        expect(
            manager.setCountdownData.mock.calls[0][0].dateTime,
        ).toBeInstanceOf(Date);
        expect(
            manager.setStopwatchData.mock.calls[0][0].dateTime,
        ).toBeInstanceOf(Date);
        // A row saved before Auto-start existed starts at once, as it always
        // did -- and a stored row's lead second comes back off its length.
        expect(manager.setCountdownData.mock.calls[0][0]).toMatchObject({
            durationMillisecond: 59_000,
        });
        expect(
            manager.setCountdownData.mock.calls[0][0].pausedMillisecond,
        ).toBeUndefined();
        expect(
            manager.setStopwatchData.mock.calls[0][0].pausedMillisecond,
        ).toBeUndefined();
        expect(manager.setQuickTextData).toHaveBeenCalledWith(
            expect.objectContaining({
                htmlText: '<p>Bold</p>',
                timeSecondDelay: 2,
            }),
        );
        expect(manager.addVideoData).toHaveBeenCalledWith({ id: 'v' });
    });

    test('a row dragged with Auto-start off goes up stopped', async () => {
        const manager = genManager();
        await applyForegroundDragData(manager as any, {
            target: 'countdown',
            data: { durationSecond: 301, isAutoStart: false },
        });
        await applyForegroundDragData(manager as any, {
            target: 'stopwatch',
            data: { isAutoStart: false },
        });
        expect(manager.setCountdownData.mock.calls[0][0]).toMatchObject({
            durationMillisecond: 300_000,
            pausedMillisecond: 300_000,
        });
        expect(manager.setStopwatchData.mock.calls[0][0]).toMatchObject({
            pausedMillisecond: 0,
        });
    });

    test('stamps the row that put a slot widget up, so the run sheet can tell rows apart', async () => {
        const manager = genManager();
        const fiveMinutes = { durationSecond: 300 };
        await applyForegroundDragData(manager as any, {
            target: 'countdown',
            data: fiveMinutes,
        });
        await applyForegroundDragData(manager as any, {
            target: 'stopwatch',
            data: {},
        });
        await applyForegroundDragData(manager as any, {
            target: 'quick-text',
            data: { markdownText: 'Hi' },
        });
        expect(manager.setCountdownData.mock.calls[0][0].rowKey).toBe(
            toForegroundRowKey(fiveMinutes),
        );
        expect(manager.setStopwatchData.mock.calls[0][0].rowKey).toBe(
            toForegroundRowKey({}),
        );
        expect(manager.setQuickTextData.mock.calls[0][0].rowKey).toBe(
            toForegroundRowKey({ markdownText: 'Hi' }),
        );
        // Two rows that differ only in their numbers are two different keys.
        expect(toForegroundRowKey({ durationSecond: 300 })).not.toBe(
            toForegroundRowKey({ durationSecond: 600 }),
        );
    });
});
