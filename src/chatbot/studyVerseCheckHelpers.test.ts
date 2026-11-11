import { describe, expect, it } from 'vitest';

import {
    STUDY_CHECK_MAX_REFS,
    checkIsStudyCheckFile,
    collectStudyVerseRefs,
    genStudyBookNames,
    splitStudyRefCalls,
    toStudyVerseReadText,
    type StudyBookNamesType,
    type StudyRefType,
    type StudyVerseCheckType,
} from './studyVerseCheckHelpers';

// EC-497: the references a study file cites, read before a verse check. What
// `owa_bible_suggest books` answers, cut to six books: the KJV names one
// "Psalm"; two Bibles of a made-up language share their names; a third
// language's Bible is named by its key alone; and one in a script written
// without spaces, whose names may end a run of letters.
const BOOKS_ANSWER = {
    kind: 'books',
    bookKeys: ['GEN', 'NUM', 'PSA', 'JHN', 'ROM', '1PE'],
    english: ['Genesis', 'Numbers', 'Psalms', 'John', 'Romans', '1 Peter'],
    bibles: [
        {
            keys: ['KJV'],
            locale: 'en',
            books: ['Genesis', 'Numbers', 'Psalm', 'John', 'Romans', '1 Peter'],
        },
        {
            keys: ['XXB', 'XXC'],
            locale: 'xx',
            books: ['Xgen', 'Xnum', 'Xpsa', 'Xjohn', 'Xrom', '1 Xpet'],
        },
        {
            key: 'ZZB',
            locale: 'zz-ZZ',
            books: ['Zgen', 'Znum', 'Zpsa', 'Zjohn', 'Zrom', '1 Zpet'],
        },
        {
            keys: ['YTB'],
            locale: 'yy-Thai',
            books: ['Qgen', 'Qnum', 'Qpsa', 'Qjohn', 'Qrom', 'Qpet'],
        },
    ],
};

function genNames() {
    return genStudyBookNames(BOOKS_ANSWER) as StudyBookNamesType;
}

function toRefList(text: string, maxCount?: number) {
    return collectStudyVerseRefs(text, genNames(), maxCount).refs.map((one) => {
        return one.ref;
    });
}

function toWrittenList(text: string) {
    return collectStudyVerseRefs(text, genNames()).lines.flatMap((line) => {
        return line.items.map((item) => {
            return item.written;
        });
    });
}

describe('genStudyBookNames', () => {
    it('is null with no names to read by', () => {
        expect(genStudyBookNames(null)).toBeNull();
        expect(genStudyBookNames('books')).toBeNull();
        expect(genStudyBookNames({ kind: 'books', english: [] })).toBeNull();
    });

    it('makes every name one table: a name to its book, and who writes it so', () => {
        const names = genNames();
        expect(names.english).toEqual(BOOKS_ANSWER.english);
        expect(names.bookKeys).toEqual(BOOKS_ANSWER.bookKeys);
        // English and the KJV write Romans alike: one name, its language once.
        expect(names.nameMap.get('romans')).toEqual({
            index: 4,
            langs: ['en'],
            sources: [{ key: 'KJV', locale: 'en' }],
            isSpaced: true,
        });
        // Two Bibles naming every book alike come as one; a key alone is read.
        expect(names.nameMap.get('xrom')).toEqual({
            index: 4,
            langs: ['xx'],
            sources: [
                { key: 'XXB', locale: 'xx' },
                { key: 'XXC', locale: 'xx' },
            ],
            isSpaced: true,
        });
        expect(names.nameMap.get('zrom')?.sources).toEqual([
            { key: 'ZZB', locale: 'zz-ZZ' },
        ]);
        // Compared in one case, with no spaces or dots.
        expect(names.nameMap.get('1peter')?.index).toBe(5);
        expect(names.nameMap.get('1xpet')?.index).toBe(5);
        expect(names.nameMap.get('psalm')?.index).toBe(2);
        // A name in a script written without spaces is never looked for by
        // its first letters.
        expect(names.nameMap.get('qrom')?.isSpaced).toBe(false);
        expect(names.spacedList).toContainEqual({ compact: 'xrom', index: 4 });
        expect(names.spacedList).not.toContainEqual({
            compact: 'qrom',
            index: 4,
        });
        expect(names.maxLength).toBe('genesis'.length);
        expect([...names.bibleMap.keys()]).toEqual([
            'KJV',
            'XXB',
            'XXC',
            'ZZB',
            'YTB',
        ]);
        expect(names.bibleMap.get('YTB')).toEqual({
            key: 'YTB',
            locale: 'yy-Thai',
            lang: 'yy',
            books: BOOKS_ANSWER.bibles[3].books,
        });
    });

    it('leaves a name to the first book given it, and skips a Bible it cannot read by', () => {
        const names = genStudyBookNames({
            english: ['Genesis', 'John'],
            // Not one key a book: no keys at all.
            bookKeys: ['GEN'],
            bibles: [
                { keys: ['AAA'], locale: 'aa', books: ['Same', 'Same'] },
                { keys: ['BBB'], locale: 'bb', books: ['Only'] },
                { keys: [' '], locale: 'cc', books: ['Cgen', 'Cjohn'] },
                { keys: ['DDD'], books: ['Dgen', 'Djohn'] },
            ],
        }) as StudyBookNamesType;
        expect(names.bookKeys).toEqual([]);
        expect(names.nameMap.get('same')).toEqual({
            index: 0,
            langs: ['aa'],
            sources: [{ key: 'AAA', locale: 'aa' }],
            isSpaced: true,
        });
        expect(names.nameMap.has('only')).toBe(false);
        expect(names.nameMap.has('cgen')).toBe(false);
        // A Bible of no known locale is read as written with spaces.
        expect(names.nameMap.get('djohn')).toEqual({
            index: 1,
            langs: [],
            sources: [{ key: 'DDD', locale: '' }],
            isSpaced: true,
        });
        expect([...names.bibleMap.keys()]).toEqual(['AAA', 'DDD']);
    });
});

describe('checkIsStudyCheckFile', () => {
    it('takes a Markdown or text file, never an app document or a picture', () => {
        for (const filePath of [
            'C:/r/John 3.md',
            '/r/notes.MARKDOWN',
            '/r/notes.txt',
        ]) {
            expect(checkIsStudyCheckFile({ kind: 'text', filePath })).toBe(
                true,
            );
        }
        for (const attachment of [
            { kind: 'text', filePath: '/r/notes.own', noteId: 3 },
            { kind: 'text', filePath: '/r/a.md', noteId: 3 },
            { kind: 'text', filePath: '/r/song.owl' },
            { kind: 'file', filePath: '/r/JHN.3.pdf' },
            { kind: 'image', filePath: '/r/a.md' },
            { kind: 'text' },
        ]) {
            expect(checkIsStudyCheckFile(attachment), attachment.filePath).toBe(
                false,
            );
        }
    });
});

// A study as the help window writes one: words before the passage, the
// passage quoted from the KJV with the Bible's own bracketed note, Cross
// References, then a part quoting another Bible.
const STUDY = [
    '# Born Again',
    '',
    'Genesis 1:1 starts it all; Genesis 1:40 does not exist.',
    '',
    '> **John 3:1-36** (KJV)',
    '> 1 There was a man of the Pharisees, named Nicodemus.',
    '> 5 Jesus answered [Ezek. 36:25-27.]',
    '',
    '## Cross References',
    '',
    '- John 3:16 is the heart. Romans 5:8; 8:1 show the love.',
    '- Psalm 23:1 and Psalms 23:1. Hezekiah 3:4 too.',
    '',
    '```mermaid',
    'flowchart TD',
    '    A[Genesis 2:7] --> B[Numbers 21:9]',
    '```',
    '',
    '> **Xjohn 3:16-17** (xxb)',
    '> 16 The words of Xjohn 3:16.',
    '',
    'Romans 5:8 and Zrom 5:8 and Xrom 5:8, as Xjohn 3:17 says.',
].join('\n');

describe('collectStudyVerseRefs', () => {
    it('reads the study by its parts, each by the Bible the part quotes', () => {
        const check = collectStudyVerseRefs(STUDY, genNames());
        expect(check.refs).toEqual([
            {
                ref: 'Genesis 1:1',
                key: 'GEN 1:1',
                bible: null,
                isInstalled: false,
            },
            {
                ref: 'Genesis 1:40',
                key: 'GEN 1:40',
                bible: null,
                isInstalled: false,
            },
            {
                ref: 'Romans 5:8',
                key: 'ROM 5:8',
                bible: 'KJV',
                isInstalled: true,
            },
            {
                ref: 'Romans 8:1',
                key: 'ROM 8:1',
                bible: 'KJV',
                isInstalled: true,
            },
            {
                ref: 'Psalms 23:1',
                key: 'PSA 23:1',
                bible: 'KJV',
                isInstalled: true,
            },
            // The key a passage names is found whatever its case.
            {
                ref: 'Romans 5:8',
                key: 'ROM 5:8',
                bible: 'XXB',
                isInstalled: true,
            },
        ]);
        expect(check.lines).toEqual([
            {
                text: 'Genesis 1:1 starts it all; Genesis 1:40 does not exist.',
                heading: 'Born Again',
                bible: null,
                items: [
                    {
                        kind: 'ref',
                        written: 'Genesis 1:1',
                        refIndex: 0,
                        nameNote: null,
                    },
                    {
                        kind: 'ref',
                        written: 'Genesis 1:40',
                        refIndex: 1,
                        nameNote: null,
                    },
                ],
            },
            {
                // John 3:16 is a verse of the passage quoted: not read again.
                text: '- John 3:16 is the heart. Romans 5:8; 8:1 show the love.',
                heading: 'Cross References',
                bible: 'KJV',
                items: [
                    {
                        kind: 'ref',
                        written: 'Romans 5:8',
                        refIndex: 2,
                        nameNote: null,
                    },
                    // After a semicolon, the book before it.
                    {
                        kind: 'ref',
                        written: '8:1',
                        refIndex: 3,
                        nameNote: null,
                    },
                ],
            },
            {
                text: '- Psalm 23:1 and Psalms 23:1. Hezekiah 3:4 too.',
                heading: 'Cross References',
                bible: 'KJV',
                items: [
                    {
                        kind: 'ref',
                        written: 'Psalm 23:1',
                        refIndex: 4,
                        nameNote: null,
                    },
                    {
                        kind: 'ref',
                        written: 'Psalms 23:1',
                        refIndex: 4,
                        nameNote: null,
                    },
                    {
                        kind: 'unknown',
                        written: 'Hezekiah 3:4',
                        word: 'Hezekiah',
                    },
                ],
            },
            {
                text: 'Romans 5:8 and Zrom 5:8 and Xrom 5:8, as Xjohn 3:17 says.',
                heading: 'Cross References',
                bible: 'XXB',
                items: [
                    {
                        kind: 'ref',
                        written: 'Romans 5:8',
                        refIndex: 5,
                        nameNote: {
                            name: 'Romans',
                            isEnglish: true,
                            sources: [{ key: 'KJV', locale: 'en' }],
                            ownName: 'Xrom',
                        },
                    },
                    {
                        kind: 'ref',
                        written: 'Zrom 5:8',
                        refIndex: 5,
                        nameNote: {
                            name: 'Zrom',
                            isEnglish: false,
                            sources: [{ key: 'ZZB', locale: 'zz-ZZ' }],
                            ownName: 'Xrom',
                        },
                    },
                    {
                        kind: 'ref',
                        written: 'Xrom 5:8',
                        refIndex: 5,
                        nameNote: null,
                    },
                ],
            },
        ]);
        expect(check.passages).toEqual([
            { bible: 'KJV', title: 'John 3:1-36', count: 1 },
            { bible: 'XXB', title: 'Xjohn 3:16-17', count: 1 },
        ]);
        expect(check.leftCount).toBe(0);
        // Neither the Bible's own note in the passage nor the diagram.
        expect(JSON.stringify(check)).not.toContain('Ezek');
        expect(JSON.stringify(check.lines)).not.toContain('Genesis 2:7');
    });

    it('takes a book written short when only one name starts so', () => {
        expect(
            toRefList('Num. 21:8-9 and 1 Pet 1:23 and Gen 2:7 are cited.'),
        ).toEqual(['Numbers 21:8-9', '1 Peter 1:23', 'Genesis 2:7']);
        const names = genStudyBookNames({
            english: ['Judges', 'Jude'],
            bookKeys: ['JDG', 'JUD'],
            bibles: [],
        }) as StudyBookNamesType;
        const check = collectStudyVerseRefs('As Jud 1:3 says.', names);
        // Two books start so: listed as no name, never guessed.
        expect(check.refs).toEqual([]);
        expect(check.lines[0]?.items).toEqual([
            { kind: 'unknown', written: 'Jud 1:3', word: 'Jud' },
        ]);
    });

    it('reads Psalm and Psalms alike, as the resolver does', () => {
        for (const name of ['Psalm', 'Psalms']) {
            const names = genStudyBookNames({
                english: [name],
                bookKeys: ['PSA'],
                bibles: [],
            }) as StudyBookNamesType;
            expect(
                collectStudyVerseRefs('Psalm 23:1 and Psalms 23:2.', names)
                    .refs,
            ).toEqual([
                {
                    ref: `${name} 23:1`,
                    key: 'PSA 23:1',
                    bible: null,
                    isInstalled: false,
                },
                {
                    ref: `${name} 23:2`,
                    key: 'PSA 23:2',
                    bible: null,
                    isInstalled: false,
                },
            ]);
        }
    });

    it('is no reference that is a time, a part of a list, or a word in lower case', () => {
        for (const text of [
            'Part 2: 4 steps to take.',
            'We meet at 10:30 am, or 7.30 p.m.',
            'the cat 3:4 sat',
            'romans 5:8 in lower case',
            'Version 2.7 of the app',
            'Room 151:2 and John 3:200',
        ]) {
            const check = collectStudyVerseRefs(text, genNames());
            expect(check.lines, text).toEqual([]);
        }
    });

    it('reads a range, script digits and a dot after a known book', () => {
        expect(
            toRefList(
                'Numbers 21:8\u20139, Genesis \uFF12\uFF1A\uFF17, Genesis 2.8 and John 3:16-4:2.',
            ),
        ).toEqual([
            'Numbers 21:8-9',
            'Genesis 2:7',
            'Genesis 2:8',
            'John 3:16',
        ]);
        expect(toWrittenList('Genesis \uFF12\uFF1A\uFF17 here.')).toEqual([
            'Genesis \uFF12\uFF1A\uFF17',
        ]);
    });

    it('finds a name of a script written without spaces at the end of a run of letters, and no other there', () => {
        expect(toWrittenList('Read abcQnum 21:8 and abcXrom 5:8.')).toEqual([
            'Qnum 21:8',
        ]);
    });

    it('reads a whole chapter quoted as its verses', () => {
        const check = collectStudyVerseRefs(
            [
                '> **John 3** (KJV)',
                '> 16 For God so loved the world.',
                '',
                'John 3:16 and John 3:36 are in it; John 4:1 is not.',
            ].join('\n'),
            genNames(),
        );
        expect(check.passages).toEqual([
            { bible: 'KJV', title: 'John 3', count: 2 },
        ]);
        expect(
            check.refs.map((one) => {
                return one.ref;
            }),
        ).toEqual(['John 4:1']);
    });

    it('reads a part quoting a Bible not installed with no Bible of its own', () => {
        const check = collectStudyVerseRefs(
            [
                '> **John 3:16** (NIV)',
                '> For God so loved.',
                '',
                'Romans 5:8.',
            ].join('\n'),
            genNames(),
        );
        expect(check.refs).toEqual([
            {
                ref: 'Romans 5:8',
                key: 'ROM 5:8',
                bible: 'NIV',
                isInstalled: false,
            },
        ]);
    });

    it('reads as many as asked and counts the rest once each', () => {
        const check = collectStudyVerseRefs(
            'Genesis 1:1, Genesis 1:2, Genesis 1:3 and Genesis 1:4, then Genesis 1:3 again.',
            genNames(),
            2,
        );
        expect(
            check.refs.map((one) => {
                return one.ref;
            }),
        ).toEqual(['Genesis 1:1', 'Genesis 1:2']);
        expect(check.leftCount).toBe(2);
        expect(STUDY_CHECK_MAX_REFS).toBe(24);
    });

    // EC-499: said once for the file, the wrong name was fixed on the line
    // that was listed and stayed in a discussion question further down.
    it('lists a name no Bible gives a book once a line, on every line it is on, eight in all', () => {
        const words = 'Aaaa Bbbb Cccc Dddd Eeee Ffff Gggg Hhhh Iiii Jjjj'.split(
            ' ',
        );
        const check = collectStudyVerseRefs(
            [
                'Aaaa 1:1 again: Aaaa 1:1.',
                ...words.map((word) => `${word} 1:1.`),
            ].join('\n'),
            genNames(),
        );
        expect(check.lines[0]?.items).toHaveLength(1);
        const unknownList = check.lines.flatMap((line) => {
            return line.items.map((item) => {
                return item.written;
            });
        });
        expect(unknownList).toEqual(
            ['Aaaa', ...words.slice(0, 7)].map((word) => {
                return `${word} 1:1`;
            }),
        );
    });

    it('shows a long line round its first reference', () => {
        const line = `${'word '.repeat(60)}Genesis 1:1 ${'word '.repeat(60)}`;
        const [shown] = collectStudyVerseRefs(line, genNames()).lines;
        expect(shown?.text.startsWith('\u2026')).toBe(true);
        expect(shown?.text.endsWith('\u2026')).toBe(true);
        expect(shown?.text).toContain('Genesis 1:1');
        expect(shown?.text.length).toBeLessThanOrEqual(242);
    });
});

function genCheck(refs: StudyRefType[]): StudyVerseCheckType {
    return { refs, lines: [], leftCount: 0, passages: [], names: genNames() };
}

function genRef(ref: string, bible: string | null): StudyRefType {
    return { ref, key: null, bible, isInstalled: bible !== null };
}

describe('splitStudyRefCalls', () => {
    it('reads one Bible a call, eight references at most', () => {
        const refs = Array.from({ length: 9 }, (_, index) => {
            return genRef(`Genesis 1:${index + 1}`, 'KJV');
        });
        expect(
            splitStudyRefCalls(genCheck(refs)).map((call) => {
                return call.refs.length;
            }),
        ).toEqual([8, 1]);
    });

    it('keeps a Bible its own call, the study order kept within it', () => {
        expect(
            splitStudyRefCalls(
                genCheck([
                    genRef('Genesis 1:1', 'KJV'),
                    genRef('Romans 5:8', null),
                    genRef('John 3:16', 'KJV'),
                    genRef('Romans 5:8', 'NIV'),
                ]),
            ),
        ).toEqual([
            {
                bible: 'KJV',
                isInstalled: true,
                refs: ['Genesis 1:1', 'John 3:16'],
            },
            { bible: null, isInstalled: false, refs: ['Romans 5:8'] },
            { bible: 'NIV', isInstalled: true, refs: ['Romans 5:8'] },
        ]);
    });

    it('keeps a call within the letters the tool reads of it', () => {
        const name = 'A'.repeat(95);
        const refs = Array.from({ length: 5 }, (_, index) => {
            return genRef(`${name} 1:${index + 1}`, 'KJV');
        });
        const calls = splitStudyRefCalls(genCheck(refs));
        expect(
            calls.map((call) => {
                return call.refs.length;
            }),
        ).toEqual([3, 2]);
        for (const call of calls) {
            expect(call.refs.join('; ').length).toBeLessThanOrEqual(400);
        }
    });
});

describe('toStudyVerseReadText', () => {
    it('is null with no table of names', () => {
        expect(toStudyVerseReadText(null, [])).toBeNull();
    });

    it('carries each line with the words its part read, and what could not be', () => {
        const check = collectStudyVerseRefs(STUDY, genNames());
        const calls = splitStudyRefCalls(check);
        expect(calls).toEqual([
            {
                bible: null,
                isInstalled: false,
                refs: ['Genesis 1:1', 'Genesis 1:40'],
            },
            {
                bible: 'KJV',
                isInstalled: true,
                refs: ['Romans 5:8', 'Romans 8:1', 'Psalms 23:1'],
            },
            { bible: 'XXB', isInstalled: true, refs: ['Romans 5:8'] },
        ]);
        const text = toStudyVerseReadText(check, [
            {
                call: calls[0],
                result: {
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'GEN 1:1',
                            ref: 'Genesis 1:1',
                            text: 'In the beginning God created the heaven and the earth.',
                        },
                    ],
                    notFound: [
                        {
                            ref: 'Genesis 1:40',
                            reason: 'Genesis 1 has 31 verses.',
                        },
                    ],
                },
            },
            {
                call: calls[1],
                result: {
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'ROM 5:8',
                            ref: 'Romans 5:8',
                            text: 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.',
                        },
                        {
                            key: 'ROM 8:1',
                            ref: 'Romans 8:1',
                            text: 'There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.',
                        },
                    ],
                },
            },
            {
                call: calls[2],
                result: {
                    bible: 'XXB',
                    verses: [
                        {
                            key: 'ROM 5:8',
                            ref: 'Romans 5:8',
                            title: 'Xrom 5:8',
                            text: 'The words of Xrom 5:8.',
                        },
                    ],
                },
            },
        ]);
        const lines = (text ?? '').split('\n');
        expect(lines[0]).toMatch(/^\(This asks to check the Bible references/);
        expect(lines[0]).toContain('"[Ezek. 36:25-27.]"');
        expect(lines.slice(1)).toEqual([
            '',
            'Before the study quotes a passage:',
            'Line (under "Born Again"): "Genesis 1:1 starts it all; Genesis 1:40 does not exist."',
            '- "Genesis 1:1": KJV reads: "In the beginning God created the heaven and the earth."',
            '- "Genesis 1:40": Genesis 1 has 31 verses.',
            '',
            'The part quoting KJV (en):',
            'Line (under "Cross References"): "- John 3:16 is the heart. Romans 5:8; 8:1 show the love."',
            '- "Romans 5:8": KJV reads: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us."',
            '- "8:1" (Romans 8:1): KJV reads: "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit."',
            'Line (under "Cross References"): "- Psalm 23:1 and Psalms 23:1. Hezekiah 3:4 too."',
            '- "Psalm 23:1" (Psalms 23:1): The app could not read it from KJV.',
            '- "Psalms 23:1": read above.',
            '- "Hezekiah 3:4": no installed Bible names a book "Hezekiah".',
            '',
            'The part quoting XXB (xx):',
            'Line (under "Cross References"): "Romans 5:8 and Zrom 5:8 and Xrom 5:8, as Xjohn 3:17 says."',
            '- "Romans 5:8": "Romans" is the English name of the book; XXB names it "Xrom". XXB Xrom 5:8 reads: "The words of Xrom 5:8."',
            '- "Zrom 5:8" (Romans 5:8): read above. "Zrom" is how ZZB (zz-ZZ) names the book; XXB names it "Xrom".',
            '- "Xrom 5:8" (Romans 5:8): read above.',
            // The KJV names its books as English does: no list for it.
            'XXB names the books: Genesis = Xgen; Numbers = Xnum; Psalms = Xpsa; John = Xjohn; Romans = Xrom; 1 Peter = 1 Xpet.',
            '1 reference to verses of John 3:1-36 (KJV) was not read again: the study quotes that passage, so check it against the passage.',
            '1 reference to verses of Xjohn 3:16-17 (XXB) was not read again: the study quotes that passage, so check it against the passage.)',
        ]);
    });

    it('names the Bibles a name of another language is from, and a part not installed', () => {
        const check = collectStudyVerseRefs(
            [
                '> **Zjohn 3:16** (ZZB)',
                '> 16 The words.',
                '',
                'Xrom 5:8 and Qnum 21:8.',
                '',
                '> **John 3:16** (NIV)',
                '> 16 For God so loved the world.',
                '',
                'Romans 5:8 and Romans 5:9.',
            ].join('\n'),
            genNames(),
        );
        const text = toStudyVerseReadText(check, [
            {
                call: {
                    bible: 'NIV',
                    isInstalled: false,
                    refs: ['Romans 5:8'],
                },
                result: {
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'ROM 5:8',
                            ref: 'Romans 5:8',
                            text: 'But God commendeth his love toward us.',
                        },
                    ],
                },
            },
            // A result that is no answer at all reads nothing.
            {
                call: { bible: 'ZZB', isInstalled: true, refs: [] },
                result: null,
            },
        ]);
        expect(text).toContain(
            '- "Xrom 5:8" (Romans 5:8): "Xrom" is how XXB (xx) and 1 other Bible name the book; ZZB names it "Zrom". The app could not read it from ZZB.',
        );
        expect(text).toContain(
            '- "Qnum 21:8" (Numbers 21:8): "Qnum" is how YTB (yy-Thai) names the book; ZZB names it "Znum". The app could not read it from ZZB.',
        );
        expect(text).toContain(
            'ZZB names the books: Genesis = Zgen; Numbers = Znum;',
        );
        expect(text).toContain('The part quoting NIV (not installed):');
        // Read from the Bible the app reads by when the study's is not installed.
        expect(text).toContain(
            '- "Romans 5:8": KJV reads: "But God commendeth his love toward us."',
        );
        expect(text).toContain(
            '- "Romans 5:9": The app could not read it from NIV.',
        );
        expect(text).not.toContain('NIV names the books');
    });

    it('says when the study cites nothing outside what it quotes, or nothing at all', () => {
        const names = genNames();
        const quotedOnly = toStudyVerseReadText(
            collectStudyVerseRefs(
                [
                    '> **John 3** (KJV)',
                    '> 16 For God so loved the world.',
                    '',
                    'John 3:16 and John 3:17 are the heart of it.',
                ].join('\n'),
                names,
            ),
            [],
        );
        expect(quotedOnly).toContain(
            '\n\nThe study cites no reference outside the passages it quotes.\n' +
                '2 references to verses of John 3 (KJV) were not read again: ' +
                'the study quotes that passage, so check them against the passage.)',
        );
        expect(
            toStudyVerseReadText(
                collectStudyVerseRefs('Just words.', names),
                [],
            ),
        ).toContain(
            "\n\nThe app found no Bible reference in the study's own words.)",
        );
    });

    it('says how many were left unread', () => {
        const check = collectStudyVerseRefs(
            'Genesis 1:1, Genesis 1:2, Genesis 1:3.',
            genNames(),
            2,
        );
        expect(toStudyVerseReadText(check, [])).toContain(
            '1 more reference was not read: the first 2 were.)',
        );
    });
});
