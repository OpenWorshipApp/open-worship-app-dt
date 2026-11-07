// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
    genBibleLyricMarkdown,
    sanitizeOpenLyricLine,
} from './bibleLyricMarkdownHelpers';

// The real open-lyric is the oracle (recipe: publicDomainSongsHelpers.test.ts).
// monaco-editor's clipboard contrib (pulled in by open-lyric) probes these at
// module-eval time and jsdom implements neither -- so open-lyric must be
// imported dynamically after the patch.
(document as any).queryCommandSupported ??= () => false;
(document as any).execCommand ??= () => false;
const { EditorOpenLyricPlugin, OpenLyric } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();
function checkMarkdown(text: string): boolean {
    return openLyricApi.document.checkMarkdown(text) === true;
}
// The text each part shows, as the lyric's own stage 0 reads it.
async function readPartTextMap(markdown: string) {
    const openLyric = new OpenLyric();
    openLyric.value = markdown;
    return (await openLyric.getElementMap({
        type: 'text',
        isWithInfo: false,
        isWithKeyNote: false,
        isShowingCommentText: false,
    } as any)) as Record<string, string>;
}

describe('genBibleLyricMarkdown', () => {
    test('one part per Bible verse, named after its number, a line per version', async () => {
        const markdown = genBibleLyricMarkdown(
            '(KJV) John 3:16-17, (NIV) John 3:16-17',
            [
                {
                    number: 16,
                    lines: [
                        '16: For God so loved the world',
                        '16: For God so loved the world, that',
                    ],
                },
                {
                    number: 17,
                    lines: [
                        '17: For God sent not his Son',
                        '17: For God did not send his Son',
                    ],
                },
            ],
        );
        expect(markdown).toBe(
            [
                '# (KJV) John 3:16-17, (NIV) John 3:16-17',
                '',
                '```ol:Config',
                '- Title: (KJV) John 3:16-17, (NIV) John 3:16-17',
                '- Structure: V16V17',
                '```',
                '',
                '```ol:Verse 16',
                '16: For God so loved the world',
                '16: For God so loved the world, that',
                '```',
                '',
                '```ol:Verse 17',
                '17: For God sent not his Son',
                '17: For God did not send his Son',
                '```',
                '',
            ].join('\n'),
        );
        expect(checkMarkdown(markdown)).toBe(true);
        const partTextMap = await readPartTextMap(markdown);
        expect(Object.keys(partTextMap)).toEqual(['Verse 16', 'Verse 17']);
        const partTextList = Object.values(partTextMap).join('\n');
        // Every version's line is a lyric line of its own -- none was read as
        // a comment or folded into another as its translation.
        for (const line of [
            '16: For God so loved the world',
            '16: For God so loved the world, that',
            '17: For God did not send his Son',
        ]) {
            expect(partTextList).toContain(line);
        }
    });

    test('a single verse is still a numbered part', () => {
        const markdown = genBibleLyricMarkdown('(KJV) John 3:16', [
            { number: 16, lines: ['16: For God so loved the world'] },
        ]);
        expect(markdown).toContain('- Structure: V16\n');
        expect(markdown).toContain('```ol:Verse 16\n');
        expect(checkMarkdown(markdown)).toBe(true);
    });

    test('the other versions are one Subtitle line, read back as the subtitle', async () => {
        const markdown = genBibleLyricMarkdown(
            '(KJV) John 3:16',
            [{ number: 16, lines: ['16: a', '16: b', '16: c'] }],
            '(NIV) John 3:16,\n  (KH) John 3:16',
        );
        expect(markdown).toContain(
            [
                '- Title: (KJV) John 3:16',
                '- Subtitle: (NIV) John 3:16, (KH) John 3:16',
                '- Structure: V16',
            ].join('\n'),
        );
        expect(checkMarkdown(markdown)).toBe(true);
        const openLyric = new OpenLyric();
        openLyric.value = markdown;
        const infoMap = (await openLyric.getElementMap({
            type: 'text',
            isWithInfo: true,
            isWithKeyNote: false,
            isShowingCommentText: false,
        } as any)) as Record<string, string>;
        expect(infoMap.Info).toBe(
            '(KJV) John 3:16\n(NIV) John 3:16, (KH) John 3:16',
        );
    });

    test('no other version, no Subtitle line', () => {
        expect(
            genBibleLyricMarkdown(
                '(KJV) John 3:16',
                [{ number: 16, lines: ['16: a'] }],
                ' ',
            ),
        ).not.toContain('Subtitle');
    });

    test('a number met twice numbers every part in order instead', () => {
        // John 1:51-2:51 meets verse 51 in both chapters; a part name is
        // declared once per document.
        const markdown = genBibleLyricMarkdown('(KJV) John 1:51-2:51', [
            { number: 51, lines: ['1:51: first'] },
            { number: 1, lines: ['2:1: second'] },
            { number: 51, lines: ['2:51: third'] },
        ]);
        expect(markdown).toContain('- Structure: V1V2V3\n');
        expect(markdown).toContain('```ol:Verse 3\n2:51: third\n```');
        expect(checkMarkdown(markdown)).toBe(true);
    });

    test('distinct numbers across chapters keep the Bible numbers', () => {
        const markdown = genBibleLyricMarkdown('(KJV) John 1:51-2:2', [
            { number: 51, lines: ['1:51: a'] },
            { number: 1, lines: ['2:1: b'] },
            { number: 2, lines: ['2:2: c'] },
        ]);
        expect(markdown).toContain('- Structure: V51V1V2\n');
        expect(checkMarkdown(markdown)).toBe(true);
    });

    test('verse text that means something to open-lyric stays valid text', () => {
        const markdown = genBibleLyricMarkdown('(KJV) Psalm 1:1\n  title', [
            {
                number: 1,
                lines: [
                    '// Blessed [is] the man | that walketh',
                    '   ``` not a fence',
                    'two\nlines',
                    '1: [unclosed',
                    '1: closed] only',
                ],
            },
        ]);
        expect(markdown).toContain('- Title: (KJV) Psalm 1:1 title\n');
        expect(markdown).toContain(
            [
                '```ol:Verse 1',
                'Blessed (is) the man / that walketh',
                "''' not a fence",
                'two lines',
                '1: (unclosed',
                '1: closed) only',
                '```',
            ].join('\n'),
        );
        expect(checkMarkdown(markdown)).toBe(true);
    });
});

describe('sanitizeOpenLyricLine', () => {
    test('a plain line is left as it is', () => {
        expect(sanitizeOpenLyricLine('16: For God so loved the world')).toBe(
            '16: For God so loved the world',
        );
    });

    test('leading space is dropped: an indented line is a translation', () => {
        expect(sanitizeOpenLyricLine('\t 3: text ')).toBe('3: text');
    });

    test('a line of nothing but slashes is empty, and is left out', () => {
        expect(sanitizeOpenLyricLine('//')).toBe('');
        const markdown = genBibleLyricMarkdown('(KJV) Gen 1:1', [
            { number: 1, lines: ['//', '1: In the beginning'] },
        ]);
        expect(markdown).toContain('```ol:Verse 1\n1: In the beginning\n```');
    });
});
