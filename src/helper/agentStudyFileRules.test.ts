import { describe, expect, it } from 'vitest';

import {
    applyStudyVerseTokens,
    checkStudyDiagram,
    composeStudyFile,
    describeStudyChange,
    dropStudyDiagrams,
    lintStudyContent,
    listStudyVerseTokens,
    readStudyFileName,
    STUDY_MAX_DIAGRAMS,
    STUDY_TITLE_MAX_CHARS,
    summarizeStudyChange,
    toStudyBody,
    toStudyFileName,
    toStudySpanText,
    toStudyTextHash,
    toStudyTitle,
} from './agentStudyFileRules';

const ISAIAH = {
    title: 'Isaiah 40:3',
    bibleKey: 'KJV',
    verses: [{ number: '3', text: 'The voice of him that crieth' }],
};

describe('toStudySpanText', () => {
    it('writes a verse, a range, a whole chapter and two chapters', () => {
        const target = { bookKey: 'MAT', chapter: 3, verseStart: 3 };
        expect(toStudySpanText({ ...target, verseEnd: 7 }, 17)).toBe('3-7');
        expect(
            toStudySpanText({ ...target, verseStart: 16, verseEnd: 16 }, 17),
        ).toBe('16');
        expect(
            toStudySpanText({ ...target, verseStart: 1, verseEnd: 17 }, 17),
        ).toBe('');
        expect(
            toStudySpanText(
                { ...target, verseStart: 16, verseEnd: 2, chapterEnd: 4 },
                17,
            ),
        ).toBe('16-4.2');
    });

    it('writes the span when the chapter length is unknown', () => {
        expect(
            toStudySpanText(
                { bookKey: 'MAT', chapter: 3, verseStart: 1, verseEnd: 17 },
                null,
            ),
        ).toBe('1-17');
    });
});

describe('the name', () => {
    it('leads with the span and lands under its chapter', () => {
        expect(toStudyFileName('MAT', 3, '3-7', 'The Voice')).toEqual({
            name: 'MAT.3.3-7 The Voice.md',
        });
        expect(toStudyFileName('JHN', 3, '', 'Born Again')).toEqual({
            name: 'JHN.3.Born Again.md',
        });
        expect(readStudyFileName('MAT.3.3-7 The Voice.md')).toEqual({
            bookKey: 'MAT',
            chapter: 3,
            span: '3-7',
            title: 'The Voice',
        });
        expect(readStudyFileName('1CO.13.Love.md')).toEqual({
            bookKey: '1CO',
            chapter: 13,
            span: '',
            title: 'Love',
        });
        expect(readStudyFileName('MAT.3.3-7 The Voice (1).md')?.title).toBe(
            'The Voice (1)',
        );
        expect(readStudyFileName('notes.md')).toBeNull();
        expect(readStudyFileName('MAT.3.3-7 The Voice.pdf')).toBeNull();
    });

    it('refuses a title a file name cannot carry, never cleans it', () => {
        expect(toStudyTitle('Who: is he?')).toHaveProperty('reason');
        expect(toStudyTitle('')).toHaveProperty('reason');
        expect(toStudyTitle(42)).toHaveProperty('reason');
        expect(
            toStudyTitle('x'.repeat(STUDY_TITLE_MAX_CHARS + 1)),
        ).toHaveProperty('reason');
        expect(toStudyTitle('Ends with a dot.')).toHaveProperty('reason');
    });

    it('reads a whole name typed back as its title', () => {
        expect(toStudyTitle('  The  Voice ')).toEqual({ title: 'The Voice' });
        expect(toStudyTitle('MAT.3.3-7 A New Name.md')).toEqual({
            title: 'A New Name',
        });
        expect(toStudyTitle('“Repent”')).toEqual({ title: 'Repent' });
        expect(toStudyTitle('Kept Words.md')).toEqual({ title: 'Kept Words' });
    });
});

describe('verse tokens', () => {
    it('lists tokens outside fenced blocks only', () => {
        const content = [
            'See [^Isaiah 40:3] and [^(KJV) John 1:23].',
            '```mermaid',
            'flowchart TD',
            'A["[^Luke 3:4]"]',
            '```',
            '[^Isaiah 40:3]',
        ].join('\n');
        expect(listStudyVerseTokens(content)).toEqual([
            'Isaiah 40:3',
            '(KJV) John 1:23',
        ]);
    });

    it('quotes a token alone on its line and names one in a sentence', () => {
        const content = [
            'As it is written:',
            '[^Isaiah 40:3]',
            'See [^Isaiah 40:3].',
        ].join('\n');
        const out = applyStudyVerseTokens(
            content,
            new Map([['Isaiah 40:3', ISAIAH]]),
        );
        expect(out).toBe(
            [
                'As it is written:',
                '> **Isaiah 40:3** (KJV)',
                '>',
                '> **3** The voice of him that crieth',
                'See Isaiah 40:3.',
            ].join('\n'),
        );
    });

    it('leaves a token it cannot read, and a fenced one, as written', () => {
        const content = ['[^Nowhere 1:1]', '```', '[^Isaiah 40:3]', '```'].join(
            '\n',
        );
        expect(
            applyStudyVerseTokens(content, new Map([['Isaiah 40:3', ISAIAH]])),
        ).toBe(content);
    });
});

describe('the diagram check', () => {
    it('takes the kinds the preview draws', () => {
        expect(checkStudyDiagram('flowchart TD\nA["One"] --> B["Two"]')).toBe(
            null,
        );
        expect(checkStudyDiagram('%% a comment\ntimeline\ntitle T')).toBe(null);
        expect(checkStudyDiagram('mindmap\n  root(("Repent"))')).toBe(null);
        expect(checkStudyDiagram('A["x<br>y"]')).toMatch(/starts with "A\["/);
    });

    it('refuses options, presses, HTML and an empty block', () => {
        expect(checkStudyDiagram('%%{init: {}}%%\nflowchart TD')).toMatch(
            /options/,
        );
        expect(checkStudyDiagram('flowchart TD\nclick A call x()')).toMatch(
            /click/,
        );
        expect(checkStudyDiagram('flowchart TD\nA["<img src=x>"]')).toMatch(
            /HTML/,
        );
        expect(checkStudyDiagram('flowchart TD\nA["one<br/>two"]')).toBe(null);
        expect(checkStudyDiagram('\n\n')).toMatch(/empty/);
    });

    it('names each failing diagram and an open fence', () => {
        const content = [
            '## Diagram',
            '```mermaid',
            'flowchart LR',
            'A --> B',
            '```',
            '```mermaid',
            'bogus',
            '```',
            '```mermaid',
            'pie',
        ].join('\n');
        const lint = lintStudyContent(content);
        expect(lint.diagrams).toHaveLength(2);
        expect(lint.reasons).toEqual([
            'A ``` block is not closed.',
            expect.stringMatching(/^Diagram 2 will not be drawn/),
        ]);
    });

    it('refuses raw HTML outside code but not in code or links', () => {
        expect(lintStudyContent('<script>x</script>').reasons[0]).toMatch(
            /Raw HTML/,
        );
        expect(
            lintStudyContent('Use `<div>` and <https://example.com> and a<br>b')
                .reasons,
        ).toEqual([]);
    });

    it('caps the number of diagrams', () => {
        const block = '```mermaid\npie\n"A" : 1\n```';
        const lint = lintStudyContent(
            Array(STUDY_MAX_DIAGRAMS + 1)
                .fill(block)
                .join('\n'),
        );
        expect(lint.reasons[0]).toMatch(/more than/);
    });
});

describe('the file', () => {
    it('drops a title of the model own and composes the parts', () => {
        expect(toStudyBody('# Mine\n\n## Overview\nText')).toBe(
            '## Overview\nText',
        );
        const file = composeStudyFile({
            title: 'The Voice',
            passage: ISAIAH,
            isPassageCut: true,
            body: '## Overview\nText',
            footnote: 'Drafted by the app assistant.',
        });
        expect(file).toBe(
            [
                '# The Voice',
                '',
                '> **Isaiah 40:3** (KJV)',
                '>',
                '> **3** The voice of him that crieth',
                '>',
                '> …',
                '',
                '## Overview\nText',
                '',
                '---',
                '',
                '*Drafted by the app assistant.*',
                '',
            ].join('\n'),
        );
    });

    it('fingerprints text so a stale change is told apart', () => {
        expect(toStudyTextHash('abc')).toBe(toStudyTextHash('abc'));
        expect(toStudyTextHash('abc')).not.toBe(toStudyTextHash('abd'));
        expect(toStudyTextHash('')).toMatch(/^0-[0-9a-f]{8}$/);
    });
});

describe('a change', () => {
    it('names the sections it adds, changes and removes', () => {
        const before = '# T\n\n## Overview\nOld\n\n## People\nJohn';
        const after = '# T\n\n## Overview\nNew\n\n## Baptism\nWater';
        const change = summarizeStudyChange(before, after);
        expect(change).toEqual({
            addedSections: ['Baptism'],
            removedSections: ['People'],
            changedSections: ['Overview'],
            addedLines: 3,
            removedLines: 3,
        });
        expect(describeStudyChange(change)).toBe(
            'It adds “Baptism”; changes “Overview”; removes “People” ' +
                '(3 line(s) in, 3 out).',
        );
    });

    it('says when nothing changes', () => {
        const change = summarizeStudyChange('## A\nx', '## A\nx');
        expect(describeStudyChange(change)).toBe('Nothing changes.');
    });
});

describe('dropStudyDiagrams', () => {
    it('takes out only the diagrams named, fences and all', () => {
        const content = [
            '## One',
            '```mermaid',
            'flowchart TD',
            'A --> B',
            '```',
            '```js',
            'keep()',
            '```',
            '## Two',
            '```mermaid',
            'timeline',
            '```',
            'end',
        ].join(String.fromCharCode(10));
        expect(
            dropStudyDiagrams(content, [0]).split(String.fromCharCode(10)),
        ).toEqual([
            '## One',
            '```js',
            'keep()',
            '```',
            '## Two',
            '```mermaid',
            'timeline',
            '```',
            'end',
        ]);
        expect(dropStudyDiagrams(content, [])).toBe(content);
    });
});
