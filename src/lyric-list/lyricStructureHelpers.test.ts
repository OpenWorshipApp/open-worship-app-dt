import { describe, expect, test } from 'vitest';

import {
    expandLyricAtomSteps,
    genLyricLineSuffix,
    genLyricPlaySteps,
    MAX_LYRIC_REPEAT_SLIDES,
    toLyricRepeatCount,
} from './lyricStructureHelpers';

function genOpenLyric(sections: [string, string][] | null) {
    return {
        getInfo() {
            if (sections === null) {
                return null;
            }
            return {
                title: 'Song',
                secondaryText: '',
                key: 'C',
                metaLine: '',
                structureLine: '',
                attachments: [],
                sections: sections.map(([partName, repeatText]) => {
                    return { partName, repeatText, heading: partName };
                }),
            };
        },
    };
}

describe('toLyricRepeatCount', () => {
    test('reads the count open-lyric hands back for a Structure repeat', () => {
        expect(toLyricRepeatCount('3x')).toBe(3);
        expect(toLyricRepeatCount('(2x)')).toBe(2);
        expect(toLyricRepeatCount('12x')).toBe(12);
    });

    test('anything else is played once', () => {
        expect(toLyricRepeatCount('')).toBe(1);
        expect(toLyricRepeatCount('x3')).toBe(1);
        expect(toLyricRepeatCount('0x')).toBe(1);
        expect(toLyricRepeatCount('3X')).toBe(1);
    });
});

describe('genLyricPlaySteps', () => {
    test('a repeated step is that many slides in a row', () => {
        const steps = genLyricPlaySteps(
            genOpenLyric([
                ['Verse 1', ''],
                ['Chorus', '3x'],
                ['Verse 2', ''],
            ]),
        );
        expect(
            steps.map((step) => {
                return [step.key, step.structureIndex, step.repeat];
            }),
        ).toEqual([
            ['Verse 1', 0, null],
            ['Chorus', 1, { index: 0, count: 3 }],
            ['Chorus', 1, { index: 1, count: 3 }],
            ['Chorus', 1, { index: 2, count: 3 }],
            // The structure index is the STEP's, not the slide's.
            ['Verse 2', 2, null],
        ]);
    });

    test('a song with no repeat is one slide per step, as before', () => {
        const steps = genLyricPlaySteps(
            genOpenLyric([
                ['Intro', ''],
                ['Chorus', ''],
                ['Outro', ''],
            ]),
        );
        expect(steps).toEqual([
            { key: 'Intro', structureIndex: 0, repeat: null },
            { key: 'Chorus', structureIndex: 1, repeat: null },
            { key: 'Outro', structureIndex: 2, repeat: null },
        ]);
    });

    test('caps the slides one step can become, keeping the real count', () => {
        const steps = genLyricPlaySteps(genOpenLyric([['Vamp', '99x']]));
        expect(steps).toHaveLength(MAX_LYRIC_REPEAT_SLIDES);
        expect(steps.at(-1)?.repeat).toEqual({
            index: MAX_LYRIC_REPEAT_SLIDES - 1,
            count: 99,
        });
    });

    test('drops an unnamed section before counting, as getStructure does', () => {
        const steps = genLyricPlaySteps(
            genOpenLyric([
                ['', ''],
                ['Verse 1', ''],
                ['Chorus', '2x'],
            ]),
        );
        expect(
            steps.map((step) => {
                return step.structureIndex;
            }),
        ).toEqual([0, 1, 1]);
    });

    test('no Config means no slides', () => {
        expect(genLyricPlaySteps(genOpenLyric(null))).toEqual([]);
    });
});

describe('expandLyricAtomSteps (Atom Mode)', () => {
    test('a step is a slide per line of its part, each play of a repeat too', () => {
        const steps = genLyricPlaySteps(
            genOpenLyric([
                ['Verse 1', ''],
                ['Chorus', '2x'],
            ]),
        );
        const expanded = expandLyricAtomSteps(steps, {
            'Verse 1': 3,
            Chorus: 2,
        });
        expect(
            expanded.map(({ key, structureIndex, repeat, line }) => {
                return [key, structureIndex, repeat?.index ?? null, line];
            }),
        ).toEqual([
            ['Verse 1', 0, null, { index: 0, count: 3 }],
            ['Verse 1', 0, null, { index: 1, count: 3 }],
            ['Verse 1', 0, null, { index: 2, count: 3 }],
            ['Chorus', 1, 0, { index: 0, count: 2 }],
            ['Chorus', 1, 0, { index: 1, count: 2 }],
            ['Chorus', 1, 1, { index: 0, count: 2 }],
            ['Chorus', 1, 1, { index: 1, count: 2 }],
        ]);
    });

    test('a part of one line, none, or none known stays the whole part', () => {
        const steps = genLyricPlaySteps(
            genOpenLyric([
                ['Intro', ''],
                ['Tag', ''],
                ['Missing', ''],
            ]),
        );
        const expanded = expandLyricAtomSteps(steps, { Intro: 0, Tag: 1 });
        expect(expanded).toHaveLength(3);
        expect(
            expanded.map((step) => {
                return step.line;
            }),
        ).toEqual([null, null, null]);
    });
});

describe('genLyricLineSuffix', () => {
    test('names the line of the part, or nothing for a whole part', () => {
        expect(genLyricLineSuffix({ index: 1, count: 4 })).toBe(' · 2/4');
        expect(genLyricLineSuffix(null)).toBe('');
        expect(genLyricLineSuffix(undefined)).toBe('');
    });
});
