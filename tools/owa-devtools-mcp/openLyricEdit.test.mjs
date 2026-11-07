// @vitest-environment jsdom
//
// `openLyricEdit.mjs`: a song changed part by part from words. Every change
// is checked twice here -- by this package's validator, which the module
// itself refuses on, and by open-lyric's own `checkMarkdown` (the oracle the
// Lyric Editor uses), so a song this writes is one the editor opens.

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import {
    LYRIC_EDIT_ACTIONS,
    LYRIC_EDIT_WRITE_ACTIONS,
    applyLyricEdit,
    describeLyricDocument,
    parseLyricDocument,
    serializeLyricDocument,
    toCanonicalPart,
    toLyricKey,
    transposeChord,
} from './openLyricEdit.mjs';

document.queryCommandSupported ??= () => {
    return false;
};
document.execCommand ??= () => {
    return false;
};
const { EditorOpenLyricPlugin } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();

// The user's own song, as `Still.owl` holds it: a part with no blank line
// before it, an empty Instrumental, and repeats in its Structure.
const STILL = [
    '```ol:Config',
    '- Title: Still',
    '- Artist: Reuben Morgan',
    '- Key: C',
    '- Tempo: 120bpm',
    '- Time: 4/4',
    '- Structure: V1CV2Cx2IS1V2Cx3',
    '```',
    '',
    '```ol:Verse 1',
    'Hide me now',
    'Under Your wings',
    'Cover me',
    'Within Your mighty hand',
    '```',
    '',
    '```ol:Chorus',
    'When the oceans rise',
    'And thunders roar',
    'I will soar with You',
    'Above the storm',
    'Father You are King',
    'Over the flood',
    'I will be still and know',
    'You are God',
    '```',
    '',
    '```ol:Verse 2',
    'Find rest my soul',
    'In Christ alone',
    'Know His power',
    'In quietness and trust',
    '```',
    '```ol:Instrumental 1',
    '```',
    '',
].join('\n');

function edit(content, request) {
    const result = applyLyricEdit(content, request);
    if (result.isError) {
        throw new Error(result.reason);
    }
    return result;
}

function expectValid(content) {
    expect(validateOpenLyric(content).problems).toEqual([]);
    expect(openLyricApi.document.checkMarkdown(content)).toBe(true);
}

function readStructure(content) {
    return /- Structure: (\S+)/.exec(content)?.[1];
}

function readPart(content, partName) {
    return describeLyricDocument(content).parts.find((one) => {
        return one.part === partName;
    });
}

describe('reading a song', () => {
    test('a song read and written back untouched is the same bytes', () => {
        for (const text of [STILL, STILL.replace(/\n/g, '\r\n')]) {
            expect(serializeLyricDocument(parseLyricDocument(text))).toBe(text);
        }
    });

    test('read says its Config, play order and every part', () => {
        const described = describeLyricDocument(STILL);
        expect(described).toMatchObject({
            title: 'Still',
            key: 'C',
            structure: 'V1CV2Cx2IS1V2Cx3',
            playOrder: [
                'Verse 1',
                'Chorus',
                'Verse 2',
                'Chorus x2',
                'Instrumental 1',
                'Verse 2',
                'Chorus x3',
            ],
        });
        expect(described.parts.map((one) => one.part)).toEqual([
            'Verse 1',
            'Chorus',
            'Verse 2',
            'Instrumental 1',
        ]);
        expect(readPart(STILL, 'Instrumental 1')).toEqual({
            part: 'Instrumental 1',
            lines: [],
            holds: 'chords and bars only',
        });
    });

    test('a part is found the way a person says it', () => {
        expect(toCanonicalPart('verse 2')).toEqual({
            header: 'Verse',
            number: 2,
        });
        expect(toCanonicalPart('Verse2')).toEqual({
            header: 'Verse',
            number: 2,
        });
        expect(toCanonicalPart('pre chorus')).toEqual({
            header: 'Pre-Chorus',
            number: null,
        });
        expect(toCanonicalPart('Config')).toBeNull();
        expect(toCanonicalPart('Wibble')).toBeNull();
    });

    test('every action is listed, read being the one that writes nothing', () => {
        expect(LYRIC_EDIT_ACTIONS[0]).toBe('read');
        expect(LYRIC_EDIT_WRITE_ACTIONS).not.toContain('read');
        expect(LYRIC_EDIT_WRITE_ACTIONS).toHaveLength(
            LYRIC_EDIT_ACTIONS.length - 1,
        );
    });
});

describe('words', () => {
    test('set-lines replaces the words of the parts named, and only those', () => {
        const result = edit(STILL, {
            action: 'set-lines',
            sections: [
                { part: 'Verse 1', lines: ['One', 'Two', 'Three', 'Four'] },
            ],
            locales: ['es-es'],
        });
        expectValid(result.content);
        expect(readPart(result.content, 'Verse 1').lines).toEqual([
            'One',
            'Two',
            'Three',
            'Four',
        ]);
        expect(readPart(result.content, 'Chorus')).toEqual(
            readPart(STILL, 'Chorus'),
        );
        expect(result.content).toContain('- Locales: es-ES');
        expect(readStructure(result.content)).toBe('V1CV2Cx2IS1V2Cx3');
        expect(result.changes).toEqual([
            'new words for Verse 1',
            'Locales: es-ES',
        ]);
    });

    test('a line never becomes a translation, a fence or a comment', () => {
        const result = edit(STILL, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['   indented', '// not a comment', 'two\nlines'],
        });
        expect(readPart(result.content, 'Verse 1').lines).toEqual([
            'indented',
            'not a comment',
            'two',
            'lines',
        ]);
        const refused = applyLyricEdit(STILL, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['```ol:Chorus'],
        });
        expect(refused.isError).toBe(true);
        expect(refused.reason).toMatch(/words only/);
    });

    test('dropped chords and translations are said', () => {
        const chorded = edit(STILL, {
            action: 'set-chords',
            part: 'Verse 1',
            lines: [
                '[C]Hide me now',
                'Under Your [F]wings',
                '[Am]Cover me',
                'Within Your [G]mighty hand',
            ],
        }).content;
        const result = edit(chorded, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['Plain words'],
        });
        expect(result.warnings.join(' ')).toMatch(/chords were not carried/);
    });

    test('an unknown part is refused with the parts the song has', () => {
        const refused = applyLyricEdit(STILL, {
            action: 'set-lines',
            part: 'Bridge',
            lines: ['x'],
        });
        expect(refused).toEqual({
            isError: true,
            reason:
                'There is no part called "Bridge". The song has: Verse 1, ' +
                'Chorus, Verse 2, Instrumental 1.',
        });
    });

    test('words in an Instrumental are refused by the grammar, nothing written', () => {
        const refused = applyLyricEdit(STILL, {
            action: 'set-lines',
            part: 'Instrumental 1',
            lines: ['hello words'],
        });
        expect(refused.isError).toBe(true);
        expect(refused.reason).toMatch(/would break the song/);
        expect(refused.reason).toMatch(/Instrumental/);
    });
});

describe('translating', () => {
    test('a translation carries its Title and Subtitle in the same change', () => {
        const replaced = edit(STILL, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['Uno', 'Dos', 'Tres', 'Cuatro'],
            locales: ['es-ES'],
            config: { Title: 'Quieto', Subtitle: 'Un canto' },
        });
        expectValid(replaced.content);
        expect(describeLyricDocument(replaced.content)).toMatchObject({
            title: 'Quieto',
            subtitle: 'Un canto',
            locales: 'es-ES',
        });
        expect(replaced.changes).toEqual([
            'new words for Verse 1',
            'Title: Quieto',
            'Subtitle: Un canto',
            'Locales: es-ES',
        ]);
        const bilingual = edit(STILL, {
            action: 'add-translation',
            part: 'Verse 1',
            lines: ['a', 'b', 'c', 'd'],
            config: { Title: 'Still / Quieto' },
        });
        expect(bilingual.content).toContain('- Title: Still / Quieto');
        expect(
            applyLyricEdit(STILL, {
                action: 'set-lines',
                part: 'Verse 1',
                lines: ['x'],
                config: 'Quieto',
            }).reason,
        ).toMatch(/Give `config` as an object/);
    });

    test('add-translation puts one line under each sung line, the words kept', () => {
        const result = edit(STILL, {
            action: 'add-translation',
            part: 'Verse 1',
            lines: ['t1', 't2', '', 't4'],
            locales: 'en-US, es-ES',
        });
        expectValid(result.content);
        expect(result.content).toContain(
            '```ol:Verse 1\nHide me now\n\tt1\nUnder Your wings\n\tt2\n' +
                'Cover me\nWithin Your mighty hand\n\tt4\n```',
        );
        expect(result.content).toContain('- Locales: en-US, es-ES');
        expect(readPart(result.content, 'Verse 1').translations).toEqual([
            't1',
            't2',
            null,
            't4',
        ]);
    });

    test('a second translation replaces the first, one line under each', () => {
        const once = edit(STILL, {
            action: 'add-translation',
            part: 'Verse 1',
            lines: ['a', 'b', 'c', 'd'],
        }).content;
        const twice = edit(once, {
            action: 'add-translation',
            part: 'Verse 1',
            lines: ['A', 'B', 'C', 'D'],
        }).content;
        expect(readPart(twice, 'Verse 1').translations).toEqual([
            'A',
            'B',
            'C',
            'D',
        ]);
    });

    test('a count that does not match the sung lines is refused', () => {
        const refused = applyLyricEdit(STILL, {
            action: 'add-translation',
            part: 'Verse 1',
            lines: ['only one'],
        });
        expect(refused.reason).toMatch(/4 sung lines and 1 translations/);
    });

    test('an Instrumental takes no translation, and an unknown locale is refused', () => {
        expect(
            applyLyricEdit(STILL, {
                action: 'add-translation',
                part: 'Instrumental 1',
                lines: [],
            }).reason,
        ).toMatch(/takes no translation/);
        expect(
            applyLyricEdit(STILL, {
                action: 'set-lines',
                part: 'Verse 1',
                lines: ['x'],
                locales: ['zz-ZZ'],
            }).reason,
        ).toMatch(/not a locale tag/);
    });
});

describe('chords and keys', () => {
    test('set-chords adds chords and refuses a word changed', () => {
        const result = edit(STILL, {
            action: 'set-chords',
            sections: [
                {
                    part: 'Verse 1',
                    lines: [
                        '[C]Hide me now',
                        'Under Your [F]wings',
                        '[Am]Cover me',
                        'Within Your [G/B]mighty hand',
                    ],
                },
                { part: 'Instrumental 1', lines: ['| C | F | Am | G |'] },
            ],
        });
        expectValid(result.content);
        const refused = applyLyricEdit(STILL, {
            action: 'set-chords',
            part: 'Verse 1',
            lines: [
                '[C]Hide me',
                'Under Your wings',
                'Cover me',
                'Within Your mighty hand',
            ],
        });
        expect(refused.reason).toMatch(/Line 1 of Verse 1 changes the words/);
    });

    test('transpose moves every chord, spelled for the new key', () => {
        const chorded = edit(STILL, {
            action: 'set-chords',
            sections: [
                {
                    part: 'Verse 1',
                    lines: [
                        '[C]Hide me now',
                        'Under Your [F]wings',
                        '[Am]Cover me',
                        'Within Your [G/B]mighty hand',
                    ],
                },
                {
                    part: 'Instrumental 1',
                    lines: ['{c: Piano + Pads} | C | F | Am | G |'],
                },
            ],
        }).content;
        const inD = edit(chorded, { action: 'transpose', key: 'd' });
        expectValid(inD.content);
        expect(inD.content).toContain('- Key: D');
        expect(inD.content).toContain('Within Your [A/C#]mighty hand');
        expect(inD.content).toContain('{c: Piano + Pads} | D | G | Bm | A |');
        expect(inD.changes).toEqual(['moved 8 chords from C to D']);
        const inF = edit(chorded, { action: 'transpose', key: 'F' });
        expect(inF.content).toContain('Under Your [Bb]wings');
        expect(inF.content).toContain('[C/E]mighty');
    });

    test('a chord moves its root and its bass, the quality kept', () => {
        expect(transposeChord('Am7', 2, 'Bm')).toBe('Bm7');
        expect(transposeChord('D/F#', 2, 'E')).toBe('E/G#');
        expect(transposeChord('Cmaj7', -2, 'Bb')).toBe('Bbmaj7');
        expect(transposeChord('Bb', 2, 'C')).toBe('C');
        expect(transposeChord('G', 3, 'C')).toBe('Bb');
    });

    test('a key is read as a person writes it', () => {
        expect(toLyricKey('g')).toBe('G');
        expect(toLyricKey('A minor')).toBe('Am');
        expect(toLyricKey('C#')).toBe('Db');
        expect(toLyricKey('Abm')).toBe('G#m');
        expect(toLyricKey('H')).toBeNull();
    });

    test('a song with no Key needs fromKey, and the kind of key is kept', () => {
        const keyless = STILL.replace('- Key: C\n', '');
        expect(
            applyLyricEdit(keyless, { action: 'transpose', key: 'D' }).reason,
        ).toMatch(/fromKey/);
        expect(
            applyLyricEdit(STILL, { action: 'transpose', key: 'Am' }).reason,
        ).toMatch(/major\s+and minor/);
        const warned = edit(keyless, {
            action: 'transpose',
            key: 'D',
            fromKey: 'C',
        });
        expect(warned.content).toContain('- Key: D\n- Structure');
        expect(warned.warnings).toContain(
            'The song has no chords, so only its Key line changed.',
        );
    });

    test('set-config sets the fields, the Key alone with a word about chords', () => {
        const result = edit(STILL, {
            action: 'set-config',
            config: { key: 'g', tempo: '72', Title: 'Still (again)' },
        });
        expectValid(result.content);
        expect(result.content).toContain('- Key: G');
        expect(result.content).toContain('- Tempo: 72bpm');
        expect(result.content).toContain('- Title: Still (again)');
        expect(
            applyLyricEdit(STILL, {
                action: 'set-config',
                config: { Key: 'H' },
            }).reason,
        ).toMatch(/Key must be one of/);
        expect(
            applyLyricEdit(STILL, {
                action: 'set-config',
                config: { Structure: 'V1' },
            }).reason,
        ).toMatch(/set-order/);
    });
});

describe('parts and the play order', () => {
    test('add-section takes the next number and plays where it is put', () => {
        const result = edit(STILL, {
            action: 'add-section',
            part: 'verse',
            lines: ['New one', 'New two'],
            after: 'Verse 2',
        });
        expectValid(result.content);
        expect(readStructure(result.content)).toBe('V1CV2V3Cx2IS1V2Cx3');
        expect(result.changes).toEqual(['added Verse 3, played after Verse 2']);
        expect(readPart(result.content, 'Verse 3').lines).toEqual([
            'New one',
            'New two',
        ]);
    });

    test('a band note is written and never played unless placed', () => {
        const result = edit(STILL, {
            action: 'add-section',
            part: 'Note',
            lines: ['Soft start'],
        });
        expectValid(result.content);
        expect(readStructure(result.content)).toBe('V1CV2Cx2IS1V2Cx3');
        expect(result.warnings).toContain(
            'Note is written but Structure never plays it.',
        );
    });

    test('a part the song has, or one there is only one of, is refused', () => {
        expect(
            applyLyricEdit(STILL, {
                action: 'add-section',
                part: 'Verse 1',
                lines: ['x'],
            }).reason,
        ).toMatch(/already in the song/);
        const withIntro = edit(STILL, {
            action: 'add-section',
            part: 'Intro',
            lines: ['Come'],
        }).content;
        expect(
            applyLyricEdit(withIntro, {
                action: 'add-section',
                part: 'Intro',
                lines: ['Again'],
            }).reason,
        ).toMatch(/only ever one/);
        expect(
            applyLyricEdit(STILL, {
                action: 'add-section',
                part: 'Wibble',
                lines: ['x'],
            }).reason,
        ).toMatch(/not a part a song can have/);
    });

    test('remove-section takes the part and every play of it, repeats joined', () => {
        const result = edit(STILL, {
            action: 'remove-section',
            part: 'Verse 2',
        });
        expectValid(result.content);
        expect(readStructure(result.content)).toBe('V1Cx3IS1Cx3');
        expect(result.content).not.toContain('Verse 2');
        expect(
            applyLyricEdit(
                edit(STILL, { action: 'set-order', order: ['Chorus'] }).content,
                { action: 'remove-section', part: 'Chorus' },
            ).reason,
        ).toMatch(/all the song plays/);
    });

    test('set-order writes the play order, repeats as counts', () => {
        const result = edit(STILL, {
            action: 'set-order',
            order: ['Verse 1', 'Chorus x2', 'verse 2', 'Chorus'],
        });
        expectValid(result.content);
        expect(readStructure(result.content)).toBe('V1Cx2V2C');
        expect(result.warnings).toContain(
            'Instrumental 1 is written but Structure never plays it.',
        );
    });

    test('a change that leaves the song as it was says so', () => {
        const result = edit(STILL, {
            action: 'set-config',
            config: { Key: 'C' },
        });
        expect(result.isChanged).toBe(false);
    });

    test('a song with no Config cannot be changed part by part', () => {
        expect(
            applyLyricEdit('```ol:Verse 1\nx\n```', {
                action: 'set-lines',
                part: 'Verse 1',
                lines: ['y'],
            }).reason,
        ).toMatch(/no ol:Config/);
        expect(applyLyricEdit(STILL, { action: 'wibble' }).reason).toMatch(
            /Unknown action/,
        );
    });
});
