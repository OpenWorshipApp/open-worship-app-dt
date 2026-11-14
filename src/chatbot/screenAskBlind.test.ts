import { describe, expect, it } from 'vitest';

import blindSetMap from './screenAskBlindSets.json';
import { readScreenControlAsk } from './screenChatHelpers';

// 2026-11-14 (EC-619): sets of English lines written BLIND -- each by a
// reader shown nothing of the reader's words, told only what the screens'
// controls are -- 100 asks for a screen's own control (ten each: the Bible
// text's look, its versions, Line Sync, a transition, a display, a group,
// the lock, a stage, the ticked screens, a clear) and 48 look-alikes (a
// how-to, a screen turned on or off, a verse put up, a foreground extra, a
// song's or a slide's own words, the Reader, the app, small talk). Each set
// was read once before anything was fitted to it, then the reader was put
// right against it: A 69 / 47 first, B 65 / 47 -> 82 / 47 after A, C
// 86 / 47 after B, D 79 / 41 after C (74 / 41 by the reader before C), E
// 80 / 45 after D. Each figure below is a floor: a change that loses one of
// these lines fails. The one ask left in A and B is "lok", a typo fitted to
// nothing; the one in E, _get rid of the countdown overlay on the stage
// monitor_, is the foreground's -- the window's foreground route reads its
// countdown first and takes it off.
const SCREEN_TOPIC_SET = new Set([
    'style',
    'versions',
    'lineSync',
    'transition',
    'display',
    'group',
    'lock',
    'stage',
    'select',
    'clear',
]);

const FLOOR_MAP: Record<string, { asks: number; others: number }> = {
    A: { asks: 99, others: 48 },
    B: { asks: 99, others: 48 },
    C: { asks: 100, others: 48 },
    D: { asks: 100, others: 48 },
    E: { asks: 99, others: 48 },
};

type RowType = { text: string; topic: string };

function measure(rows: RowType[]) {
    let asks = 0;
    let others = 0;
    for (const row of rows) {
        const kind = readScreenControlAsk(row.text, 'presenter');
        if (SCREEN_TOPIC_SET.has(row.topic)) {
            asks += kind !== null ? 1 : 0;
        } else {
            others += kind === null ? 1 : 0;
        }
    }
    return { asks, others };
}

describe('the screen asks of sets written blind', () => {
    for (const [name, rows] of Object.entries(
        blindSetMap as Record<string, RowType[]>,
    )) {
        it(`set ${name}: routes its asks and leaves its look-alikes alone`, () => {
            expect(rows).toHaveLength(148);
            const floor = FLOOR_MAP[name];
            const result = measure(rows);
            expect(result.asks).toBeGreaterThanOrEqual(floor.asks);
            expect(result.others).toBeGreaterThanOrEqual(floor.others);
        });
    }
});
