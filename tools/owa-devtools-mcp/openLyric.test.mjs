// Two jobs, and the first is the important one.
//
// 1. DRIFT. `openLyric.mjs` writes out a grammar that belongs to another
//    package. open-lyric ships that grammar as data in `schema.md` §8.1, so
//    this reads it back and fails when a table here disagrees -- which is what
//    an `npm i` that bumps open-lyric looks like. A validator that quietly
//    lags the editor tells a volunteer their song is fine when the editor is
//    refusing it, which is worse than having no validator at all.
//
// 2. The messages, which the oracle test cannot check: `checkMarkdown`
//    answers a boolean, and the whole value of this tool is the sentence.
//
// Plain node, no jsdom, no open-lyric import -- `openLyricOracle.test.mjs` is
// the one that pays for those.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

import {
    OPEN_LYRIC_CHORD_SOURCE,
    OPEN_LYRIC_CONFIG_FIELD_ALIAS_MAP,
    OPEN_LYRIC_CONFIG_FIELD_LIST,
    OPEN_LYRIC_FENCE_LIST,
    OPEN_LYRIC_KEY_LIST,
    OPEN_LYRIC_LOCALE_LIST,
    OPEN_LYRIC_MAX_CHARS,
    OPEN_LYRIC_MULTILINE_CONFIG_FIELD_LIST,
    OPEN_LYRIC_REPEAT_SUFFIX_SOURCE,
    OPEN_LYRIC_REQUIRED_CONFIG_FIELD_LIST,
    OPEN_LYRIC_TIME_LIST,
    checkOpenLyricText,
    validateOpenLyric,
} from './openLyric.mjs';

const REQUIRED_CONFIG_LINES = [
    '- Title: T',
    '- Artist: A',
    '- Copyright: C',
    '- Key: C',
    '- Tempo: 68bpm',
    '- Time: 4/4',
];

function genDoc(configExtraList, sectionList) {
    return [
        '```ol:Config',
        ...REQUIRED_CONFIG_LINES,
        ...configExtraList,
        '```',
        ...sectionList,
    ].join('\n');
}

function genLyricDoc(...bodyList) {
    return genDoc(['- Structure: V1'], ['```ol:Verse 1', ...bodyList, '```']);
}

function toMessages(markdown) {
    return validateOpenLyric(markdown).problems.map((one) => {
        return one.message;
    });
}

// ---------------------------------------------------------------------------
// 1. Drift against the grammar open-lyric ships
// ---------------------------------------------------------------------------

function readShippedGrammar() {
    const require = createRequire(import.meta.url);
    let schemaPath = null;
    try {
        schemaPath = require.resolve('open-lyric/schema.md');
    } catch {
        return null;
    }
    if (!existsSync(schemaPath)) {
        return null;
    }
    const text = readFileSync(schemaPath, 'utf8');
    // §8.1's block is fenced with FOUR backticks, because the grammar quotes
    // three-backtick fences inside itself.
    const match = text.match(/````json\r?\n([\s\S]*?)\r?\n````/);
    if (match === null) {
        return null;
    }
    return JSON.parse(match[1]);
}

const grammar = readShippedGrammar();

describe('the grammar written out here still matches the one open-lyric ships', () => {
    test('schema.md §8.1 was found and parsed', () => {
        // Not `skipIf`: a silent skip is how this stops guarding anything.
        // A checkout with no `node_modules` is the only excuse, and CI has one.
        expect(
            grammar,
            'open-lyric/schema.md §8.1 could not be read — install dependencies',
        ).not.toBeNull();
    });

    test('every fence, with its numbering, structure code and body rule', () => {
        const shipped = grammar.fences.map((one) => {
            return {
                header: one.header,
                allowsNumbering: one.allowsNumbering,
                structureCode: one.structureCode,
                bodyRule: one.bodyRule,
            };
        });
        const sortByHeader = (list) => {
            return [...list].sort((left, right) => {
                return left.header.localeCompare(right.header);
            });
        };
        expect(sortByHeader(OPEN_LYRIC_FENCE_LIST)).toEqual(
            sortByHeader(shipped),
        );
    });

    test('the structure codes match the fence table both ways', () => {
        const shipped = [...grammar.structure.codes]
            .map((one) => {
                return `${one.code}=${one.header}:${one.allowsNumbering}`;
            })
            .sort();
        const ours = OPEN_LYRIC_FENCE_LIST.filter((one) => {
            return one.structureCode !== null;
        })
            .map((one) => {
                return `${one.structureCode}=${one.header}:${one.allowsNumbering}`;
            })
            .sort();
        expect(ours).toEqual(shipped);
    });

    test('the Config fields, required set, multiline set and alias', () => {
        expect(OPEN_LYRIC_CONFIG_FIELD_LIST).toEqual(grammar.config.fields);
        expect(OPEN_LYRIC_REQUIRED_CONFIG_FIELD_LIST).toEqual(
            grammar.config.required,
        );
        expect(OPEN_LYRIC_MULTILINE_CONFIG_FIELD_LIST).toEqual(
            grammar.config.multiline,
        );
        expect(OPEN_LYRIC_CONFIG_FIELD_ALIAS_MAP).toEqual(
            grammar.config.aliases,
        );
    });

    test('the Key and Time enums', () => {
        expect(OPEN_LYRIC_KEY_LIST).toEqual(grammar.config.enums.Key);
        expect(OPEN_LYRIC_TIME_LIST).toEqual(grammar.config.enums.Time);
    });

    test('the closed locale set, entry for entry', () => {
        expect(OPEN_LYRIC_LOCALE_LIST).toEqual(grammar.config.locales.values);
    });

    test('the chord symbol pattern, character for character', () => {
        expect(OPEN_LYRIC_CHORD_SOURCE).toBe(grammar.inline.chordSymbol.source);
    });

    test('the repeat suffix pattern', () => {
        expect(`^${OPEN_LYRIC_REPEAT_SUFFIX_SOURCE}`).toBe(
            grammar.inline.repeatSuffix.pattern,
        );
    });

    test("every chord schema.md calls valid is valid here, and invalid invalid", () => {
        for (const chord of grammar.inline.chordSymbol.valid) {
            expect(validateOpenLyric(genLyricDoc(`[${chord}]hi`)).ok, chord).toBe(
                true,
            );
        }
        for (const entry of grammar.inline.chordSymbol.invalid) {
            const chord = entry.split(' ')[0];
            expect(
                validateOpenLyric(genLyricDoc(`[${chord}]hi`)).ok,
                chord,
            ).toBe(false);
        }
    });

    test('every repeat suffix schema.md rejects is rejected here', () => {
        for (const suffix of grammar.inline.repeatSuffix.rejected) {
            const markdown = genDoc(
                ['- Structure: IS1'],
                ['```ol:Instrumental 1', `| C | ${suffix}`, '```'],
            );
            expect(validateOpenLyric(markdown).ok, suffix).toBe(false);
        }
        for (const suffix of grammar.inline.repeatSuffix.examples) {
            const markdown = genDoc(
                ['- Structure: IS1'],
                ['```ol:Instrumental 1', `| C | ${suffix}`, '```'],
            );
            expect(validateOpenLyric(markdown).ok, suffix).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// 2. The sentences
// ---------------------------------------------------------------------------

describe('what a problem says', () => {
    test('names the line, the section and what to write instead', () => {
        const { problems } = validateOpenLyric(
            genDoc(
                ['- Structure: V1'],
                ['```ol:Verse 1', 'ok line', '[Cm7b5]bad line', '```'],
            ),
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatchObject({
            line: 12,
            part: 'Verse 1',
            message: 'Invalid chord annotation. Try [Cm7].',
        });
        expect(problems[0].hint).toContain('[Cm7]');
        expect(problems[0].excerpt).toBe('[Cm7b5]bad line');
    });

    test('suggests the capitalised chord for a lower-case root', () => {
        expect(toMessages(genLyricDoc('[bm7]hi'))).toEqual([
            'Invalid chord annotation. Try [Bm7].',
        ]);
    });

    test('offers no suggestion when there is no honest one', () => {
        const [problem] = validateOpenLyric(genLyricDoc('[wibble]hi')).problems;
        expect(problem.message).toBe('Invalid chord annotation. Try [<chord>].');
        expect(problem.hint).toContain('A root is A-G');
    });

    test('reports one problem per lyric line, not one per bad chord', () => {
        expect(toMessages(genLyricDoc('[H]a [H]b [H]c'))).toHaveLength(1);
    });

    test('reports every bad line', () => {
        expect(toMessages(genLyricDoc('[H]a', '[H]b'))).toHaveLength(2);
    });

    test('an unclosed bracket and a stray one read differently', () => {
        expect(toMessages(genLyricDoc('[C hi'))).toEqual([
            'Unclosed chord annotation.',
        ]);
        expect(toMessages(genLyricDoc('hi]'))).toEqual([
            'Unexpected closing bracket in lyric line.',
        ]);
    });

    test('a sung word in a progression names the section', () => {
        const [problem] = validateOpenLyric(
            genDoc(
                ['- Structure: IS1'],
                ['```ol:Instrumental 1', '| C | hello |', '```'],
            ),
        ).problems;
        expect(problem.message).toBe('Invalid Instrumental token.');
        expect(problem.hint).toContain('Breakdown, Vamp or Solo');
    });

    test('a {p:} in an Instrumental says where {p:} does belong', () => {
        const [problem] = validateOpenLyric(
            genDoc(
                ['- Structure: IS1'],
                ['```ol:Instrumental 1', '{p: #1} | C |', '```'],
            ),
        ).problems;
        expect(problem.message).toBe(
            'Invalid Instrumental directive. Expected {c: Piano + Pads }.',
        );
        expect(problem.hint).toContain('Intro, Outro and Turnaround');
    });

    test('a mistyped section name is told the spelling, not just refused', () => {
        const { problems } = validateOpenLyric(
            genDoc(['- Structure: V1'], ['```ol:verse 1', 'hi', '```']),
        );
        const problem = problems.find((one) => {
            return one.message.startsWith('Unsupported ol part.');
        });
        expect(problem).toBeDefined();
        expect(problem.hint).toContain('"Verse"');
    });

    test('an unreadable fence header does not also complain about its body', () => {
        const messages = toMessages(
            genDoc(
                ['- Structure: V1'],
                [
                    '```ol:Verse 1',
                    'hi',
                    '```',
                    '```ol:Wibble',
                    '] a stray bracket',
                    '```',
                ],
            ),
        );
        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain('Unsupported ol part.');
    });

    test('a duplicate part names the line the first one is on', () => {
        expect(
            toMessages(
                genDoc(
                    ['- Structure: V1'],
                    ['```ol:Verse 1', 'a', '```', '```ol:Verse 1', 'b', '```'],
                ),
            ),
        ).toContain('Duplicate ol part. Verse 1 is already declared on line 10.');
    });

    test('the missing-fields message lists them', () => {
        const messages = toMessages(
            ['```ol:Config', '- Title: T', '```'].join('\n'),
        );
        expect(messages).toContain(
            'Missing required config fields: Artist, Copyright, Key, Tempo, ' +
                'Time, Structure.',
        );
    });

    test('Structure stops at the first token it cannot read', () => {
        expect(
            toMessages(genDoc(['- Structure: ZZZZ'], ['```ol:Verse 1', 'a', '```'])),
        ).toHaveLength(1);
    });

    test('problems come back in line order', () => {
        const { problems } = validateOpenLyric(
            genDoc(['- Structure: V1'], ['```ol:Verse 1', '[H]bad', '```']).replace(
                '- Key: C',
                '- Key: H',
            ),
        );
        expect(
            problems.map((one) => {
                return one.line;
            }),
        ).toEqual([5, 11]);
    });
});

describe('what a warning says', () => {
    test('a section Structure never plays', () => {
        const { ok, warnings } = validateOpenLyric(
            genDoc(
                ['- Structure: V1'],
                ['```ol:Verse 1', 'a', '```', '```ol:Chorus', 'b', '```'],
            ),
        );
        expect(ok).toBe(true);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toBe(
            'Chorus is written but Structure never plays it.',
        );
    });

    test('a {p: #N} pointing past the patterns Config lists', () => {
        const { ok, warnings } = validateOpenLyric(
            genDoc(['- Structure: I'], ['```ol:Intro', '{p: #9}', '```']),
        );
        expect(ok).toBe(true);
        expect(warnings[0].message).toContain('{p: #9}');
        expect(warnings[0].hint).toContain('Strumming Patterns');
    });

    test('a {p: #N} with a progression after it is still read', () => {
        // It used to be matched against the whole trimmed LINE, so the only
        // directive ever warned about was one sitting on its own -- which is
        // the rarer way to write it.
        const { warnings } = validateOpenLyric(
            genDoc(
                ['- Structure: I'],
                ['```ol:Intro', '{p: #4} | G | D/F# | Em7 | (2x)', '```'],
            ),
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain('{p: #4}');
    });

    test('a {p: #N} inside the list raises nothing', () => {
        const { ok, warnings } = validateOpenLyric(
            genDoc(
                [
                    '- Structure: I',
                    '- Strumming Patterns:',
                    '\td--u--',
                    '\tdd-u',
                ],
                ['```ol:Intro', '{p: #2}', '```'],
            ),
        );
        expect(ok).toBe(true);
        expect(warnings).toHaveLength(0);
    });
});

describe('the song summary', () => {
    test('reads the metadata, the sections and the play order', () => {
        const { song } = validateOpenLyric(
            genDoc(
                ['- Structure: IV1x2CV1'],
                [
                    '```ol:Intro',
                    '| C | G |',
                    '```',
                    '```ol:Verse 1',
                    'a',
                    'b',
                    '```',
                    '```ol:Chorus',
                    'c',
                    '```',
                ],
            ),
        );
        expect(song).toMatchObject({
            title: 'T',
            artist: 'A',
            key: 'C',
            tempo: '68bpm',
            time: '4/4',
        });
        expect(song.sections).toEqual([
            { partName: 'Intro', lineCount: 1 },
            { partName: 'Verse 1', lineCount: 2 },
            { partName: 'Chorus', lineCount: 1 },
        ]);
        expect(song.playOrder).toEqual([
            { partName: 'Intro', repeat: 1 },
            { partName: 'Verse 1', repeat: 2 },
            { partName: 'Chorus', repeat: 1 },
            { partName: 'Verse 1', repeat: 1 },
        ]);
    });

    test('a Structure that broke mid-way says its play order is partial', () => {
        const { song, warnings } = validateOpenLyric(
            genDoc(
                ['- Structure: V1CV2'],
                ['```ol:Verse 1', 'a', '```', '```ol:Chorus', 'b', '```'],
            ),
        );
        expect(song.isPlayOrderPartial).toBe(true);
        expect(song.playOrder).toHaveLength(2);
        // Chorus IS played; and past the token that broke, nothing is known
        // about what Structure would have gone on to name -- so no section
        // gets accused of never being played.
        expect(warnings).toHaveLength(0);
    });

    test('a report marks a partial play order rather than ending the song early', () => {
        const report = checkOpenLyricText(
            genDoc(
                ['- Structure: V1CV2'],
                ['```ol:Verse 1', 'a', '```', '```ol:Chorus', 'b', '```'],
            ),
        );
        expect(report).toContain(
            'Play order, as far as Structure could be read: Verse 1 → Chorus → ?',
        );
    });

    test('comment lines do not count as lines of the song', () => {
        const { song } = validateOpenLyric(genLyricDoc('// a note', 'a'));
        expect(song.sections[0].lineCount).toBe(1);
    });
});

describe('the report', () => {
    test('a valid song reads as valid and describes itself', () => {
        const report = checkOpenLyricText(
            genDoc(
                ['- Structure: V1x2'],
                ['```ol:Verse 1', '[G]Morning breaks', '```'],
            ),
        );
        expect(report).toContain('Valid Open Lyric. No problems found.');
        expect(report).toContain('Song: "T" by A — key C, 68bpm, 4/4');
        expect(report).toContain('Play order: Verse 1 x2');
    });

    test('an invalid song leads with the count and the line', () => {
        const report = checkOpenLyricText(genLyricDoc('[H]hi'));
        expect(report).toContain('Not valid Open Lyric — 1 problem.');
        expect(report).toContain('Line 11 (Verse 1): Invalid chord annotation.');
        expect(report).toContain('    [H]hi');
    });

    test('leaks no path, no file name and no internal id', () => {
        const report = checkOpenLyricText(genLyricDoc('[H]hi'));
        expect(report).not.toMatch(/openLyric|\.mjs|node_modules|[A-Z]:\\/);
    });

    test('caps the list rather than printing a thousand lines', () => {
        const bad = Array.from({ length: 60 }, () => {
            return '[H]x';
        });
        const report = checkOpenLyricText(genLyricDoc(...bad));
        expect(report).toContain('Not valid Open Lyric — 60 problems.');
        expect(report).toContain('… and 35 more.');
    });
});

describe('bounds and rubbish input', () => {
    test('empty text is missing its Config, not a crash', () => {
        expect(toMessages('')).toEqual(['Missing required ol part. Add ol:Config.']);
        expect(toMessages('   \n  ')).toHaveLength(1);
    });

    test('a non-string is refused the same way', () => {
        expect(validateOpenLyric(null).ok).toBe(false);
        expect(validateOpenLyric(undefined).ok).toBe(false);
        expect(validateOpenLyric(42).ok).toBe(false);
    });

    test('an oversized document is refused before it is parsed', () => {
        const huge = 'a'.repeat(OPEN_LYRIC_MAX_CHARS + 1);
        const { ok, problems } = validateOpenLyric(huge);
        expect(ok).toBe(false);
        expect(problems[0].message).toContain('is the most that can be checked');
    });

    test('a document at the size limit is still parsed', () => {
        const filler = `\n${'x'.repeat(60)}`;
        const doc = genLyricDoc('a');
        const padded =
            doc + filler.repeat(Math.floor((OPEN_LYRIC_MAX_CHARS - doc.length) / 61));
        expect(padded.length).toBeLessThanOrEqual(OPEN_LYRIC_MAX_CHARS);
        expect(validateOpenLyric(padded).ok).toBe(true);
    });

    test('a pathological chord line does not hang', () => {
        const started = Date.now();
        validateOpenLyric(genLyricDoc(`[${'A#'.repeat(400)}]hi`));
        expect(Date.now() - started).toBeLessThan(1000);
    });
});
