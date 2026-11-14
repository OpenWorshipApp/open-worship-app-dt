// @vitest-environment jsdom
//
// Chords taken out and a part renamed (2026-11-12, EC-527). Asked live on a
// second song, _Take the chords out of the chorus._ went out as set-lines
// with the chorus's own words and no chords -- set-lines keeps a line's
// chords, nothing was written, and the answer said they were gone -- and
// _Rename the chorus to Refrain._ took four calls and four undo steps.
// Every result is checked by this package's validator AND by open-lyric's
// own `checkMarkdown`, so a song this writes is one the editor opens.

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import { applyLyricEdit, LYRIC_EDIT_ACTIONS } from './openLyricEdit.mjs';

document.queryCommandSupported ??= () => {
    return false;
};
document.execCommand ??= () => {
    return false;
};
const { EditorOpenLyricPlugin } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();

const SONG = [
    '```ol:Config',
    '- Title: It Is Well With My Soul',
    '- Key: C',
    '- Locales: en-US',
    '- Structure: V1CV2CISC',
    '```',
    '',
    '```ol:Verse 1',
    '[C]When peace like a [F]river at[C]tendeth my way,',
    '\tA line under the first line',
    'When [Am]sorrows like [D7]sea billows [G]roll;',
    '\tA line under the second line',
    '```',
    '',
    '```ol:Chorus',
    'It is [C]well (it is well) with my [G]soul (with my soul),',
    'It is [F]well, it is [G7]well with my [C]soul.',
    '```',
    '',
    '```ol:Verse 2',
    'Though Satan should buffet, though trials should come,',
    'Let this blest assurance control,',
    '```',
    '',
    '```ol:Instrumental',
    '| C | F | G | C |',
    '```',
    '',
].join('\n');

function edit(content, request) {
    const result = applyLyricEdit(content, request);
    if (result.isError) {
        throw new Error(result.reason);
    }
    expect(validateOpenLyric(result.content).problems).toEqual([]);
    expect(openLyricApi.document.checkMarkdown(result.content)).toBe(true);
    return result;
}

function bodyOf(content, partName) {
    const lines = content.split('\n');
    const start = lines.indexOf(`\`\`\`ol:${partName}`);
    if (start === -1) {
        return null;
    }
    const end = lines.indexOf('```', start + 1);
    return lines.slice(start + 1, end);
}

function readStructure(content) {
    return content.match(/^- Structure: (.*)$/m)?.[1];
}

test('both actions are offered', () => {
    expect(LYRIC_EDIT_ACTIONS).toContain('remove-chords');
    expect(LYRIC_EDIT_ACTIONS).toContain('rename-section');
});

describe('remove-chords', () => {
    test('one part loses its chords, its words and every other part kept', () => {
        const result = edit(SONG, { action: 'remove-chords', part: 'Chorus' });
        expect(bodyOf(result.content, 'Chorus')).toEqual([
            'It is well (it is well) with my soul (with my soul),',
            'It is well, it is well with my soul.',
        ]);
        expect(bodyOf(result.content, 'Verse 1')).toEqual(
            bodyOf(SONG, 'Verse 1'),
        );
        expect(result.changes).toEqual(['took out 5 chords (Chorus)']);
        expect(result.warnings).toEqual([]);
    });

    test('the whole song: sung parts emptied of chords, lines under kept, an Instrumental kept and said', () => {
        const result = edit(SONG, { action: 'remove-chords' });
        expect(bodyOf(result.content, 'Verse 1')).toEqual([
            'When peace like a river attendeth my way,',
            '\tA line under the first line',
            'When sorrows like sea billows roll;',
            '\tA line under the second line',
        ]);
        expect(bodyOf(result.content, 'Instrumental')).toEqual([
            '| C | F | G | C |',
        ]);
        expect(result.changes).toEqual([
            'took out 11 chords (Verse 1, Chorus)',
        ]);
        expect(result.warnings).toEqual([
            'Instrumental kept its chords: chords are what such a part ' +
                'plays -- take it out with remove-section if it should go.',
        ]);
    });

    test('a chord standing alone between words leaves one space, never a line under', () => {
        const song = SONG.replace(
            'Let this blest assurance control,',
            '[G] Let this [C] blest assurance control,',
        );
        const result = edit(song, { action: 'remove-chords', part: 'Verse 2' });
        expect(bodyOf(result.content, 'Verse 2')).toEqual([
            'Though Satan should buffet, though trials should come,',
            'Let this blest assurance control,',
        ]);
    });

    test('a part with no chords is refused, nothing written', () => {
        const result = applyLyricEdit(SONG, {
            action: 'remove-chords',
            part: 'Verse 2',
        });
        expect(result).toEqual({
            isError: true,
            reason: 'Verse 2 has no chords to take out.',
        });
    });
});

describe('set-lines handed the same words without their chords', () => {
    test('is refused and names remove-chords, so no answer says they went', () => {
        const result = applyLyricEdit(SONG, {
            action: 'set-lines',
            part: 'Chorus',
            lines: [
                'It is well (it is well) with my soul (with my soul),',
                'It is well, it is well with my soul.',
            ],
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('remove-chords');
        expect(result.reason).toContain('Chorus');
    });

    test('beside a part really changed, it is no refusal', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            sections: [
                {
                    part: 'Chorus',
                    lines: [
                        'It is well (it is well) with my soul (with my soul),',
                        'It is well, it is well with my soul.',
                    ],
                },
                {
                    part: 'Verse 2',
                    lines: [
                        'Though Satan should buffet, though trials should come,',
                        'Let this blest assurance control my soul,',
                    ],
                },
            ],
        });
        expect(bodyOf(result.content, 'Chorus')).toEqual(
            bodyOf(SONG, 'Chorus'),
        );
        expect(bodyOf(result.content, 'Verse 2')[1]).toBe(
            'Let this blest assurance control my soul,',
        );
    });
});

describe('rename-section', () => {
    test('the chorus becomes the Refrain: its lines, chords and every place it plays kept', () => {
        const result = edit(SONG, {
            action: 'rename-section',
            part: 'chorus',
            to: 'Refrain',
        });
        expect(bodyOf(result.content, 'Chorus')).toBeNull();
        expect(bodyOf(result.content, 'Refrain')).toEqual(
            bodyOf(SONG, 'Chorus'),
        );
        expect(readStructure(result.content)).toBe('V1RV2RISR');
        expect(result.changes).toEqual(['renamed Chorus to Refrain']);
        // Where it stood: still between the two verses.
        expect(result.content.indexOf('```ol:Refrain')).toBeLessThan(
            result.content.indexOf('```ol:Verse 2'),
        );
    });

    test('a bare kind takes its next free number', () => {
        const result = edit(SONG, {
            action: 'rename-section',
            part: 'Chorus',
            to: 'Verse',
        });
        expect(bodyOf(result.content, 'Verse 3')).toEqual(
            bodyOf(SONG, 'Chorus'),
        );
        expect(readStructure(result.content)).toBe('V1V3V2V3ISV3');
    });

    test('a name the song has, its own name, or a kind that holds something else is refused', () => {
        expect(
            applyLyricEdit(SONG, {
                action: 'rename-section',
                part: 'Chorus',
                to: 'Verse 2',
            }).reason,
        ).toContain('Verse 2 is already in the song');
        expect(
            applyLyricEdit(SONG, {
                action: 'rename-section',
                part: 'Chorus',
                to: 'Chorus',
            }).reason,
        ).toBe('Chorus is already called that.');
        expect(
            applyLyricEdit(SONG, {
                action: 'rename-section',
                part: 'Verse 1',
                to: 'Instrumental',
            }).reason,
        ).toContain('add-section');
        expect(
            applyLyricEdit(SONG, {
                action: 'rename-section',
                part: 'Chorus',
                to: 'Hook',
            }).reason,
        ).toContain('is not a part a song can have');
    });
});

describe('replace given a chord in brackets', () => {
    test('changes that chord wherever it is played, an Instrumental too, words untouched', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: '[F]', with: '[Fmaj7]' }],
        });
        expect(bodyOf(result.content, 'Verse 1')[0]).toBe(
            '[C]When peace like a [Fmaj7]river at[C]tendeth my way,',
        );
        expect(bodyOf(result.content, 'Chorus')[1]).toBe(
            'It is [Fmaj7]well, it is [G7]well with my [C]soul.',
        );
        expect(bodyOf(result.content, 'Instrumental')).toEqual([
            '| C | Fmaj7 | G | C |',
        ]);
        expect(result.changes).toEqual([
            'chord F -> Fmaj7 3 times (Verse 1, Chorus, Instrumental)',
        ]);
    });

    test('in one part only, and never a longer chord that starts the same', () => {
        const song = SONG.replace(
            'It is [F]well, it is [G7]well',
            'It is [F]well, it [F#]is [F/A]well',
        );
        const result = edit(song, {
            action: 'replace',
            replacements: [{ find: '[F]', with: '[Fmaj7]', part: 'Chorus' }],
        });
        expect(bodyOf(result.content, 'Chorus')[1]).toBe(
            'It is [Fmaj7]well, it [F#]is [F/A]well with my [C]soul.',
        );
        expect(bodyOf(result.content, 'Verse 1')).toEqual(
            bodyOf(song, 'Verse 1'),
        );
    });

    test('a chord the song does not play, or a chord into words, is refused', () => {
        expect(
            applyLyricEdit(SONG, {
                action: 'replace',
                replacements: [{ find: '[Bb]', with: '[Bbmaj7]' }],
            }).reason,
        ).toContain('[Bb] is not a chord played in the song');
        expect(
            applyLyricEdit(SONG, {
                action: 'replace',
                replacements: [{ find: '[F]', with: 'well' }],
            }).reason,
        ).toContain('a chord is changed into a chord');
    });
});

describe('set-chords adds and moves, never takes away', () => {
    test('one chord moved, the verse given with that chord alone: every other chord stays', () => {
        const result = edit(SONG, {
            action: 'set-chords',
            part: 'Verse 1',
            lines: [
                'When peace like a river attendeth my way,',
                'When sorrows like sea [D7]billows roll;',
            ],
        });
        expect(bodyOf(result.content, 'Verse 1')).toEqual([
            '[C]When peace like a [F]river at[C]tendeth my way,',
            '\tA line under the first line',
            'When [Am]sorrows like sea [D7]billows [G]roll;',
            '\tA line under the second line',
        ]);
        expect(result.changes).toEqual([
            'the chords of Verse 1 (5 chords not given kept where they were)',
        ]);
    });

    test('a chord given in the place of another takes its place; a repeat left out stays', () => {
        const result = edit(SONG, {
            action: 'set-chords',
            part: 'Verse 1',
            lines: [
                '[C]When peace like a [F]river attendeth my way,',
                'When [Am7]sorrows like [D7]sea billows [G]roll;',
            ],
        });
        expect(bodyOf(result.content, 'Verse 1')[0]).toBe(
            '[C]When peace like a [F]river at[C]tendeth my way,',
        );
        expect(bodyOf(result.content, 'Verse 1')[2]).toBe(
            'When [Am7]sorrows like [D7]sea billows [G]roll;',
        );
    });

    test('every chord given where it goes is written as given', () => {
        const result = edit(SONG, {
            action: 'set-chords',
            part: 'Chorus',
            lines: [
                '[C]It is well (it is well) with my [G]soul (with my soul),',
                'It is [F]well, it is [G7]well with my [C]soul.',
            ],
        });
        expect(bodyOf(result.content, 'Chorus')[0]).toBe(
            '[C]It is well (it is well) with my [G]soul (with my soul),',
        );
        expect(result.changes).toEqual(['the chords of Chorus']);
    });
});

test('replace takes a part given beside its list for each replacement naming none', () => {
    const result = edit(SONG, {
        action: 'replace',
        part: 'Chorus',
        replacements: [{ find: 'with my soul', with: 'with my heart' }],
    });
    expect(bodyOf(result.content, 'Chorus')).toEqual([
        'It is [C]well (it is well) with my [G]heart (with my heart),',
        'It is [F]well, it is [G7]well with my [C]heart.',
    ]);
    expect(bodyOf(result.content, 'Verse 1')).toEqual(bodyOf(SONG, 'Verse 1'));
});
