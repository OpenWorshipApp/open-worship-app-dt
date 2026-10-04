import { describe, expect, test } from 'vitest';

import {
    addStopwatchHistoryEntry,
    genStopwatchHistorySettingName,
    parseStopwatchHistory,
    STOPWATCH_HISTORY_LIMIT,
    toStopwatchHistoryWhenText,
} from './stopwatchHistoryHelpers';

const NOW = new Date(2026, 9, 4, 10, 42).getTime();

describe('stopwatch history', () => {
    test('is one setting per session, the Default session unsuffixed', () => {
        expect(genStopwatchHistorySettingName('')).toBe(
            'foreground-stopwatch-history-setting',
        );
        expect(genStopwatchHistorySettingName('-abc')).toBe(
            'foreground-stopwatch-history-setting-abc',
        );
    });

    test('puts the newest time on top and keeps a short list', () => {
        let list = addStopwatchHistoryEntry([], {
            elapsedMillisecond: 65_000,
            endedAt: NOW,
        });
        list = addStopwatchHistoryEntry(list, {
            elapsedMillisecond: 462_000,
            endedAt: NOW + 1,
        });
        expect(list.map((entry) => entry.elapsedMillisecond)).toEqual([
            462_000, 65_000,
        ]);
        for (let i = 0; i < STOPWATCH_HISTORY_LIMIT + 5; i++) {
            list = addStopwatchHistoryEntry(list, {
                elapsedMillisecond: 1_000 + i,
                endedAt: NOW + i,
            });
        }
        expect(list).toHaveLength(STOPWATCH_HISTORY_LIMIT);
        expect(list[0].elapsedMillisecond).toBe(
            1_000 + STOPWATCH_HISTORY_LIMIT + 4,
        );
    });

    test('does not keep a reset that shows 00:00:00', () => {
        const list = [{ elapsedMillisecond: 5_000, endedAt: NOW }];
        expect(
            addStopwatchHistoryEntry(list, {
                elapsedMillisecond: 999,
                endedAt: NOW,
            }),
        ).toBe(list);
        expect(
            addStopwatchHistoryEntry(list, {
                elapsedMillisecond: Number.NaN,
                endedAt: NOW,
            }),
        ).toBe(list);
    });

    test('reads back only well-formed entries, and nothing from a bad file', () => {
        expect(parseStopwatchHistory(null)).toEqual([]);
        expect(parseStopwatchHistory('')).toEqual([]);
        expect(parseStopwatchHistory('{not json')).toEqual([]);
        expect(parseStopwatchHistory('{"a":1}')).toEqual([]);
        expect(
            parseStopwatchHistory(
                JSON.stringify([
                    { elapsedMillisecond: 5_000, endedAt: NOW, extra: 'x' },
                    { elapsedMillisecond: -1, endedAt: NOW },
                    { elapsedMillisecond: 'a', endedAt: NOW },
                    null,
                    { elapsedMillisecond: 7_000 },
                ]),
            ),
        ).toEqual([{ elapsedMillisecond: 5_000, endedAt: NOW }]);
        const tooMany = Array.from(
            { length: STOPWATCH_HISTORY_LIMIT + 3 },
            (_, i) => {
                return { elapsedMillisecond: 1_000 * (i + 1), endedAt: NOW };
            },
        );
        expect(parseStopwatchHistory(JSON.stringify(tooMany))).toHaveLength(
            STOPWATCH_HISTORY_LIMIT,
        );
    });

    test('says the time alone for today, and the date for another day', () => {
        const today = toStopwatchHistoryWhenText(NOW - 60_000, NOW);
        expect(today).toBe(
            new Date(NOW - 60_000).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
            }),
        );
        const yesterdayTime = new Date(NOW - 86_400_000).toLocaleTimeString(
            [],
            { hour: 'numeric', minute: '2-digit' },
        );
        const yesterday = toStopwatchHistoryWhenText(NOW - 86_400_000, NOW);
        expect(yesterday.endsWith(`, ${yesterdayTime}`)).toBe(true);
        expect(yesterday.length).toBeGreaterThan(yesterdayTime.length + 2);
    });
});
