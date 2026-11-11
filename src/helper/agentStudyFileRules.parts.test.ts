import { describe, expect, it } from 'vitest';

import {
    applyStudyEdit,
    chunkStudyText,
    describeStudyChange,
    listStudySections,
    readStudySection,
    readStudyTitleLine,
    separateStudyLines,
    splitStudyFooter,
    splitStudyForTranslation,
    summarizeStudyChange,
    toStudyDiagramBlock,
    toStudyDiagramSource,
    toStudyOutline,
} from './agentStudyFileRules';

const FOOTER = '\n---\n\n*Drafted by the app’s assistant.*\n';

const STUDY = [
    '# The New Birth',
    '',
    '> **John 3:1-2** (KJV)',
    '>',
    '> **1** There was a man of the Pharisees, named Nicodemus.',
    '',
    '## The Setting',
    'John 3 takes place in Jerusalem.',
    '',
    '## Verse by Verse',
    '',
    '### Night',
    'Nicodemus comes by night.',
    '',
    '## Diagrams',
    '',
    '```mermaid',
    'graph TD',
    '    A["Love"] --> B["Gift"]',
    '# not a heading',
    '```',
    '',
    '## Questions',
    '1. What is new birth?',
].join('\n');

const FILE = `${STUDY}\n${FOOTER}`;

describe('splitStudyFooter', () => {
    it('takes the rule and the drafted-by line off, and nothing else', () => {
        const { body, footer } = splitStudyFooter(FILE);
        expect(body).toBe(`${STUDY}\n`);
        expect(footer).toBe(FOOTER);
        expect(body + footer).toBe(FILE);
    });

    it('reads CRLF line ends as LF', () => {
        const { body, footer } = splitStudyFooter(FILE.replace(/\n/g, '\r\n'));
        expect(body).toBe(`${STUDY}\n`);
        expect(footer).toBe(FOOTER);
    });

    it('finds no footer in a file the person wrote', () => {
        expect(splitStudyFooter('# Notes\n\nMine.\n')).toEqual({
            body: '# Notes\n\nMine.\n',
            footer: '',
        });
        // A rule in the middle, words after it: not the app's last lines.
        const text = 'One\n\n---\n\n*a note*\n\nMore words.\n';
        expect(splitStudyFooter(text).footer).toBe('');
    });
});

describe('the sections', () => {
    it('lists headings outside fences, a ## holding its ###', () => {
        const sections = listStudySections(STUDY);
        expect(
            sections.map((section) => {
                return `${section.level} ${section.heading}`;
            }),
        ).toEqual([
            '1 The New Birth',
            '2 The Setting',
            '2 Verse by Verse',
            '3 Night',
            '2 Diagrams',
            '2 Questions',
        ]);
        const verse = sections[2];
        const night = sections[3];
        expect(verse.end).toBe(sections[4].start);
        expect(night.end).toBe(sections[4].start);
        // The title holds the whole file.
        expect(sections[0].end).toBe(STUDY.split('\n').length);
    });

    it('writes an outline a model reads, cut with a count', () => {
        expect(toStudyOutline(STUDY)).toBe(
            [
                '# The New Birth',
                '## The Setting',
                '## Verse by Verse',
                '### Night',
                '## Diagrams',
                '## Questions',
            ].join('\n'),
        );
        expect(toStudyOutline(STUDY, 2)).toBe(
            '# The New Birth\n## The Setting\n… and 4 more',
        );
        expect(toStudyOutline('No headings here.')).toBe('');
    });

    it('reads one section, its heading named loosely', () => {
        expect(readStudySection(FILE, '## verse by VERSE')).toEqual({
            heading: 'Verse by Verse',
            text: '## Verse by Verse\n\n### Night\nNicodemus comes by night.',
        });
        expect(readStudySection(FILE, '**Questions**')).toEqual({
            heading: 'Questions',
            text: '## Questions\n1. What is new birth?',
        });
    });

    it('refuses a section that is not there, naming the headings', () => {
        const found = readStudySection(FILE, 'Application');
        expect('reason' in found && found.reason).toContain(
            'The file has no section “Application”. Its headings:\n# The New Birth',
        );
    });
});

describe('applyStudyEdit', () => {
    it('appends before the app’s last lines, which stay last', () => {
        const edited = applyStudyEdit(FILE, { append: '## More\nWords.' });
        expect('text' in edited && edited.text).toBe(
            `${STUDY}\n\n## More\nWords.\n${FOOTER}`,
        );
    });

    it('gives a section new words under its own heading', () => {
        const edited = applyStudyEdit(FILE, {
            section: 'The Setting',
            content: 'It happens at night in Jerusalem.',
        });
        expect('text' in edited && edited.text).toContain(
            '## The Setting\n\nIt happens at night in Jerusalem.\n\n## Verse by Verse',
        );
        expect('text' in edited && edited.text).not.toContain(
            'takes place in Jerusalem',
        );
        expect('text' in edited && edited.text.endsWith(FOOTER)).toBe(true);
    });

    it('takes a heading the new words carry as the section’s own', () => {
        const edited = applyStudyEdit(FILE, {
            section: 'Questions',
            content: '## Questions to Discuss\n1. Who was Nicodemus?',
        });
        expect('text' in edited && edited.text).toContain(
            '## Questions to Discuss\n1. Who was Nicodemus?\n',
        );
        expect('text' in edited && edited.text).not.toContain('new birth?');
    });

    it('adds to the end of one section, the next one untouched', () => {
        const edited = applyStudyEdit(FILE, {
            section: 'Verse by Verse',
            append: '### Day\nHe speaks openly.',
        });
        expect('text' in edited && edited.text).toContain(
            'Nicodemus comes by night.\n\n### Day\nHe speaks openly.\n\n## Diagrams',
        );
    });

    it('puts more items on the list a section ends in, with no gap', () => {
        const edited = applyStudyEdit(FILE, {
            section: 'Questions',
            append: '2. Who was Nicodemus?',
        });
        expect('text' in edited && edited.text).toContain(
            '1. What is new birth?\n2. Who was Nicodemus?\n',
        );
        const atEnd = applyStudyEdit(FILE, { append: '2. Who was he?' });
        expect('text' in atEnd && atEnd.text).toContain(
            '1. What is new birth?\n2. Who was he?\n',
        );
        // Words that are not an item stay a paragraph of their own.
        const words = applyStudyEdit(FILE, { append: 'A closing word.' });
        expect('text' in words && words.text).toContain(
            '1. What is new birth?\n\nA closing word.\n',
        );
    });

    it('never takes a heading inside a diagram for a section', () => {
        const edited = applyStudyEdit(FILE, {
            section: 'not a heading',
            content: 'x',
        });
        expect('reason' in edited && edited.reason).toContain(
            'no section “not a heading”',
        );
    });

    it('refuses a heading the file has twice, and an empty change', () => {
        const twice = '## A\none\n\n## A\ntwo\n';
        const edited = applyStudyEdit(twice, { section: 'A', content: 'x' });
        expect('reason' in edited && edited.reason).toContain(
            'The file has 2 sections called “A”',
        );
        expect('reason' in applyStudyEdit(FILE, {})).toBe(true);
        expect('reason' in applyStudyEdit(FILE, { section: 'Diagrams' })).toBe(
            true,
        );
    });

    it('says to append to a file with no headings', () => {
        const edited = applyStudyEdit('Plain words.\n', {
            section: 'Setting',
            content: 'x',
        });
        expect('reason' in edited && edited.reason).toContain(
            'It has no headings: add to it with `append`.',
        );
    });
});

describe('the change a translation added makes', () => {
    it('adds the headings it repeats, and changes no section above it', () => {
        const edited = applyStudyEdit(FILE, {
            append: '---\n\n# The New Birth\n\n## The Setting\nIn Jerusalem.',
        });
        const newText = 'text' in edited ? edited.text : '';
        const change = summarizeStudyChange(FILE, newText);
        expect(change.addedSections).toEqual(['The New Birth', 'The Setting']);
        expect(change.changedSections).toEqual([]);
        expect(change.removedSections).toEqual([]);
        expect(describeStudyChange(change)).toBe(
            'It adds “The New Birth”, “The Setting” (4 line(s) in, 0 out).',
        );
    });

    it('names five sections and counts the rest', () => {
        expect(
            describeStudyChange({
                addedSections: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                removedSections: [],
                changedSections: [],
                addedLines: 7,
                removedLines: 0,
            }),
        ).toBe(
            'It adds “A”, “B”, “C”, “D”, “E” and 2 more (7 line(s) in, 0 out).',
        );
    });

    it('reads no heading inside a fenced block', () => {
        const change = summarizeStudyChange(
            '## A\none\n',
            '## A\none\n\n```\n# not a section\n```\n',
        );
        expect(change.addedSections).toEqual([]);
        expect(change.changedSections).toEqual(['A']);
    });
});

describe('separateStudyLines', () => {
    it('keeps verse-by-verse lines apart (the user’s John 3 file)', () => {
        const text = [
            '## Verse by Verse',
            'John 3:1-2 Nicodemus approaches Jesus under the cover of night',
            'John 3:3-8 Jesus introduces the concept of being born again',
            '1 John 2:3 And hereby we do know that we know him',
            '3:16 For God so loved the world',
        ].join('\n');
        expect(separateStudyLines(text)).toBe(
            [
                '## Verse by Verse',
                'John 3:1-2 Nicodemus approaches Jesus under the cover of night',
                '',
                'John 3:3-8 Jesus introduces the concept of being born again',
                '',
                '1 John 2:3 And hereby we do know that we know him',
                '',
                '3:16 For God so loved the world',
            ].join('\n'),
        );
    });

    it('keeps sentences written one a line apart, and bold-led lines', () => {
        expect(
            separateStudyLines(
                'He came by night.\nHe asked a question?\nJesus answered',
            ),
        ).toBe('He came by night.\n\nHe asked a question?\n\nJesus answered');
        expect(separateStudyLines('**Faith** trusts\n**Hope** waits')).toBe(
            '**Faith** trusts\n\n**Hope** waits',
        );
    });

    it('leaves a paragraph wrapped mid-sentence as it is', () => {
        const text =
            'John 3 takes place during the early\nstages of the ministry.';
        expect(separateStudyLines(text)).toBe(text);
    });

    it('leaves lists, quotes, tables, fences and hard breaks alone', () => {
        const text = [
            '- One thing.',
            'more of the same item.',
            'and more.',
            '',
            '> A quote line.',
            'lazy quote line.',
            '',
            '| a | b |',
            '| - | - |',
            '',
            '```mermaid',
            'graph TD',
            'A.',
            'B.',
            '```',
            '',
            'A line with a break.  ',
            'The next line.',
        ].join('\n');
        expect(separateStudyLines(text)).toBe(text);
    });

    it('leaves lines the file already had, and keeps new ones apart', () => {
        const old = 'Intro.\n\nOne.\nTwo.\n';
        expect(separateStudyLines('Intro.\n\nOne.\nTwo.\n', old)).toBe(
            'Intro.\n\nOne.\nTwo.\n',
        );
        expect(separateStudyLines('Intro.\n\nOne.\nThree.\n', old)).toBe(
            'Intro.\n\nOne.\n\nThree.\n',
        );
    });

    it('reads CRLF and keeps a paragraph after a heading its own', () => {
        expect(separateStudyLines('## A\r\nOne.\r\nTwo.')).toBe(
            '## A\nOne.\n\nTwo.',
        );
    });
});

describe('the parts a translation treats apart', () => {
    it('splits words, the passage, diagrams and kept blocks, losslessly', () => {
        const body = [
            STUDY,
            '',
            '---',
            '',
            '```js',
            'const kept = 1;',
            '```',
        ].join('\n');
        const parts = splitStudyForTranslation(body);
        expect(
            parts.map((part) => {
                return part.kind;
            }),
        ).toEqual([
            'text',
            'passage',
            'text',
            'diagram',
            'text',
            'keep',
            'text',
            'keep',
        ]);
        expect(
            parts
                .map((part) => {
                    return part.text;
                })
                .join('\n'),
        ).toBe(body);
        expect(parts[1]).toMatchObject({
            title: 'John 3:1-2',
            bibleKey: 'KJV',
        });
        expect(parts[3].text.startsWith('```mermaid\ngraph TD')).toBe(true);
    });

    it('takes an unclosed fence to the end as one block', () => {
        const parts = splitStudyForTranslation('Words.\n```mermaid\ngraph TD');
        expect(parts.at(-1)).toEqual({
            kind: 'diagram',
            text: '```mermaid\ngraph TD',
        });
    });

    it('cuts words where paragraphs end, a long one kept whole', () => {
        expect(chunkStudyText('a\n\nb\n\nc', 3)).toEqual(['a', 'b', 'c']);
        expect(chunkStudyText('a\n\nb\n\nc', 10)).toEqual(['a\n\nb\n\nc']);
        expect(chunkStudyText('x'.repeat(20) + '\n\ny', 10)).toEqual([
            'x'.repeat(20),
            'y',
        ]);
        expect(chunkStudyText('\n\n  \n\n', 10)).toEqual([]);
    });

    it('hands a diagram over without its fences and fences it again', () => {
        const block = '```mermaid\ngraph TD\n    A["Love"] --> B["Gift"]\n```';
        const source = toStudyDiagramSource(block);
        expect(source).toBe('graph TD\n    A["Love"] --> B["Gift"]');
        expect(
            toStudyDiagramBlock(block, 'graph TD\n    A["L"] --> B["G"]\n\n'),
        ).toBe('```mermaid\ngraph TD\n    A["L"] --> B["G"]\n```');
        expect(
            toStudyDiagramBlock('~~~mermaid\ngraph TD\n~~~', 'graph LR'),
        ).toBe('~~~mermaid\ngraph LR\n~~~');
    });

    it('reads the title line, never one inside a fence', () => {
        expect(readStudyTitleLine(STUDY)).toBe('The New Birth');
        expect(readStudyTitleLine('```\n# code\n```\n## Two')).toBeNull();
        expect(readStudyTitleLine('```\n# code\n```\n# Real')).toBe('Real');
    });
});
