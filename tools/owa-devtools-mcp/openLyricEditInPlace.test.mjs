// @vitest-environment jsdom
//
// Words changed in place (2026-11-12, EC-511): a word fixed keeps the
// song's chords and the line under each line. Asked live to fix one typo,
// the chatbot retyped the verse through `set-lines` and the verse lost 11
// chords and 4 translation lines while the answer said "corrected". Every
// result here is checked by this package's validator AND by open-lyric's
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

// A second line under every line of Verse 1 (written in English so the
// test stays English; the tool reads any language's line alike), chords in
// both verses, and a misspelt "grase".
const SONG = [
    '```ol:Config',
    '- Title: Amazing Grace',
    '- Subtitle: My chains are gone',
    '- Key: G',
    '- Locales: en-US, en-GB',
    '- Structure: V1V2CV3C',
    '```',
    '',
    '```ol:Verse 1',
    '[G]Amazing grase how [C]sweet the [G]sound',
    '\tWonderful kindness, how sweet to hear',
    'That saved a [G]wretch like [D]me',
    '\tIt rescued someone as lost as me',
    'I [G]once was lost but [C]now am [G]found',
    '\tI was lost once, now I am found',
    'Was [G]blind but [D]now I [G]see',
    '\tI was blind, and now I can see',
    '```',
    '',
    '```ol:Verse 2',
    '[G]Twas grace that taught my [C]heart to [G]fear',
    'And grace my fears re[D]lieved',
    'How [G]precious did that [C]grace ap[G]pear',
    'The hour I [D]first be[G]lieved',
    '```',
    '',
    '```ol:Chorus',
    "[G]My chains are gone, I've been set free",
    'My God, my Savior has ransomed me',
    '```',
    '',
    '```ol:Verse 3',
    "When we've been there ten thousand years",
    'Bright shining as the sun',
    "We've no less days to sing God's praise",
    "Than when we'd first begun",
    '```',
    '',
].join('\n');

const VERSE_1_PLAIN = [
    'Amazing grace how sweet the sound',
    'That saved a wretch like me',
    'I once was lost but now am found',
    'Was blind but now I see',
];

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
    const end = lines.indexOf('```', start + 1);
    return lines.slice(start + 1, end);
}

function countChords(content) {
    return (content.match(/\[[A-G][^\]\s]*\]/g) ?? []).length;
}

function countUnder(content) {
    return (content.match(/^\t\S/gm) ?? []).length;
}

describe('set-lines keeps what goes with a line', () => {
    test('a typo fixed with the lines given plain keeps every chord and line under', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: VERSE_1_PLAIN,
        });
        expect(bodyOf(result.content, 'Verse 1')).toEqual([
            '[G]Amazing grace how [C]sweet the [G]sound',
            '\tWonderful kindness, how sweet to hear',
            'That saved a [G]wretch like [D]me',
            '\tIt rescued someone as lost as me',
            'I [G]once was lost but [C]now am [G]found',
            '\tI was lost once, now I am found',
            'Was [G]blind but [D]now I [G]see',
            '\tI was blind, and now I can see',
        ]);
        expect(result.warnings).toEqual([]);
        expect(result.changes).toEqual([
            'new words for Verse 1 (kept the chords of 4 lines and the ' +
                'translation under 4 lines)',
        ]);
    });

    test('lines given back with the lines under them as lines stay lines under', () => {
        const given = bodyOf(SONG, 'Verse 1').map((line) => {
            return line.replace('grase', 'grace').trim();
        });
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: given,
        });
        expect(bodyOf(result.content, 'Verse 1')).toEqual(
            bodyOf(SONG, 'Verse 1').map((line) => {
                return line.replace('grase', 'grace');
            }),
        );
        expect(countUnder(result.content)).toBe(4);
    });

    test('lines swapped keep their own chords and their own line under', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: [
                VERSE_1_PLAIN[1],
                VERSE_1_PLAIN[0],
                ...VERSE_1_PLAIN.slice(2),
            ],
        });
        expect(bodyOf(result.content, 'Verse 1').slice(0, 4)).toEqual([
            'That saved a [G]wretch like [D]me',
            '\tIt rescued someone as lost as me',
            '[G]Amazing grace how [C]sweet the [G]sound',
            '\tWonderful kindness, how sweet to hear',
        ]);
    });

    test('a word changed takes the chord that stood on the old word', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: [
                'Amazing grace how lovely the sound',
                'That saved a soul like me',
                ...VERSE_1_PLAIN.slice(2),
            ],
        });
        expect(bodyOf(result.content, 'Verse 1').slice(0, 3)).toEqual([
            '[G]Amazing grace how [C]lovely the [G]sound',
            '\tWonderful kindness, how sweet to hear',
            'That saved a [G]soul like [D]me',
        ]);
    });

    test('a line rewritten whole loses its own chords and line under, and says so', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['Totally new words here', ...VERSE_1_PLAIN.slice(1)],
        });
        expect(bodyOf(result.content, 'Verse 1')[0]).toBe(
            'Totally new words here',
        );
        expect(countChords(result.content)).toBe(18);
        expect(countUnder(result.content)).toBe(3);
        expect(result.warnings).toEqual([
            'Verse 1: the chords were not carried onto 1 line rewritten or ' +
                'taken out -- add them back with set-chords if the band ' +
                'needs them.',
            'Verse 1: the translation under 1 line rewritten or taken out ' +
                'went with the old words.',
        ]);
    });

    test('a line given with chords of its own keeps those', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: [
                '[D]Amazing grace how sweet the sound',
                ...VERSE_1_PLAIN.slice(1),
            ],
        });
        expect(bodyOf(result.content, 'Verse 1')[0]).toBe(
            '[D]Amazing grace how sweet the sound',
        );
    });

    test('chords on fewer words keep their order and none is lost', () => {
        const result = edit(SONG, {
            action: 'set-lines',
            part: 'Verse 1',
            lines: ['Amazing grace the sound', ...VERSE_1_PLAIN.slice(1)],
        });
        const line = bodyOf(result.content, 'Verse 1')[0];
        expect(line.match(/\[[A-G]\]/g)).toEqual(['[G]', '[C]', '[G]']);
        expect(line.replace(/\[[A-G]\]/g, '')).toBe('Amazing grace the sound');
    });
});

describe('replace', () => {
    test('is a listed action', () => {
        expect(LYRIC_EDIT_ACTIONS).toContain('replace');
        expect(LYRIC_EDIT_ACTIONS).toContain('remove-translations');
    });

    test('a typo fixed changes that word and nothing else', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'grase', with: 'grace' }],
        });
        expect(result.content).toBe(SONG.replace('grase', 'grace'));
        expect(result.changes).toEqual(['"grase" -> "grace" 1 time (Verse 1)']);
    });

    test('a word changed everywhere keeps each capital, and the title is said', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'grace', with: 'mercy' }],
        });
        expect(bodyOf(result.content, 'Verse 2')).toEqual([
            '[G]Twas mercy that taught my [C]heart to [G]fear',
            'And mercy my fears re[D]lieved',
            'How [G]precious did that [C]mercy ap[G]pear',
            'The hour I [D]first be[G]lieved',
        ]);
        expect(result.content).toContain('- Title: Amazing Grace');
        expect(result.warnings).toEqual([
            'The Title still says "Amazing Grace" -- change it with ' +
                'set-config if it should change too.',
        ]);
    });

    test('small letters match any case; a capital matches only as written', () => {
        const song = [
            '```ol:Config',
            '- Title: X',
            '- Structure: V1',
            '```',
            '',
            '```ol:Verse 1',
            'GRACE and Grace and grace',
            '```',
            '',
        ].join('\n');
        expect(
            bodyOf(
                edit(song, {
                    action: 'replace',
                    replacements: [{ find: 'grace', with: 'mercy' }],
                }).content,
                'Verse 1',
            ),
        ).toEqual(['MERCY and Mercy and mercy']);
        expect(
            bodyOf(
                edit(song, {
                    action: 'replace',
                    replacements: [{ find: 'Grace', with: 'Mercy' }],
                }).content,
                'Verse 1',
            ),
        ).toEqual(['GRACE and Mercy and grace']);
    });

    test('a chord inside the word stays as far in', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'relieved', with: 'released' }],
        });
        expect(bodyOf(result.content, 'Verse 2')[1]).toBe(
            'And grace my fears re[D]leased',
        );
    });

    test('a find copied with its chords is the same find', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 're[D]lieved', with: 'released' }],
        });
        expect(bodyOf(result.content, 'Verse 2')[1]).toBe(
            'And grace my fears re[D]leased',
        );
    });

    test('a possessive is still the word', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'God', with: 'Lord' }],
        });
        expect(bodyOf(result.content, 'Verse 3')[2]).toBe(
            "We've no less days to sing Lord's praise",
        );
        expect(bodyOf(result.content, 'Chorus')[1]).toBe(
            'My Lord, my Savior has ransomed me',
        );
    });

    test('a word taken out takes one space with it', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'ten thousand', with: '' }],
        });
        expect(bodyOf(result.content, 'Verse 3')[0]).toBe(
            "When we've been there years",
        );
    });

    test('one part only, when named', () => {
        const result = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'grace', with: 'love', part: 'verse 2' }],
        });
        expect(result.changes).toEqual(['"grace" -> "love" 3 times (Verse 2)']);
        expect(result.warnings).toEqual([]);
    });

    test('the lines under are changed only when asked for', () => {
        const words = edit(SONG, {
            action: 'replace',
            replacements: [{ find: 'lost', with: 'gone' }],
        });
        expect(bodyOf(words.content, 'Verse 1')[5]).toBe(
            '\tI was lost once, now I am found',
        );
        const under = edit(SONG, {
            action: 'replace',
            replacements: [
                { find: 'kindness', with: 'grace', in: 'translations' },
            ],
        });
        expect(bodyOf(under.content, 'Verse 1')[1]).toBe(
            '\tWonderful grace, how sweet to hear',
        );
        expect(bodyOf(under.content, 'Verse 1')[0]).toBe(
            '[G]Amazing grase how [C]sweet the [G]sound',
        );
    });

    test('part of a longer word is refused, naming the word', () => {
        expect(
            applyLyricEdit(SONG, {
                action: 'replace',
                replacements: [{ find: 'gras', with: 'x' }],
            }),
        ).toEqual({
            isError: true,
            reason:
                'Nothing was changed: "gras" is not a word sung in the song ' +
                '(only inside "grase" -- give the whole word). Read the song ' +
                'for the words exactly as it has them, then call again with ' +
                'only the replacements it has.',
        });
    });

    test('one replacement that finds nothing writes none of them', () => {
        const refused = applyLyricEdit(SONG, {
            action: 'replace',
            replacements: [
                { find: 'grase', with: 'grace' },
                { find: 'nowhere', with: 'x' },
            ],
        });
        expect(refused.isError).toBe(true);
        expect(refused.reason).toMatch(/^Nothing was changed: "nowhere"/);
    });

    test('notation and an empty find are refused', () => {
        for (const [replacements, pattern] of [
            [[], /Give replacements/],
            [[{ find: '', with: 'x' }], /needs the words to find/],
            [[{ find: '```ol:Chorus', with: 'x' }], /words only/],
            [[{ find: 'grace', with: 'a\nb' }], /spans lines/],
            [[{ find: 'grace', with: 'x', in: 'chords' }], /"in" is one of/],
            [[{ find: 'grace', with: 'x', part: 'Bridge' }], /no part called/],
        ]) {
            const refused = applyLyricEdit(SONG, {
                action: 'replace',
                replacements,
            });
            expect(refused.isError).toBe(true);
            expect(refused.reason).toMatch(pattern);
        }
    });
});

describe('remove-translations', () => {
    test('takes every line under out, with the languages left named', () => {
        const result = edit(SONG, {
            action: 'remove-translations',
            locales: ['en-US'],
        });
        expect(countUnder(result.content)).toBe(0);
        expect(countChords(result.content)).toBe(countChords(SONG));
        expect(result.content).toContain('- Locales: en-US\n');
        expect(result.changes).toEqual([
            'took out 4 translation lines (Verse 1)',
            'Locales: en-US',
        ]);
    });

    test('a part with none is refused', () => {
        expect(
            applyLyricEdit(SONG, {
                action: 'remove-translations',
                part: 'Verse 2',
            }),
        ).toEqual({
            isError: true,
            reason: 'Verse 2 has no translation lines to take out.',
        });
    });
});
