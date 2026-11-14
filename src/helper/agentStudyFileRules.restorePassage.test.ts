import { describe, expect, it } from 'vitest';

import {
    describeStudyRestoredPassages,
    restoreStudyPassages,
} from './agentStudyFileRules';

// A passage the app quoted is the Bible's words (EC-549): copied back with
// words changed, it is put back as it was quoted.

const PASSAGE = [
    '> **John 3:16** (KJV)',
    '>',
    '> **16** For God so loved the world.',
];

const OLD = [
    '# The New Birth',
    '',
    ...PASSAGE,
    '',
    '## The Setting',
    'At night.',
    '',
].join('\n');

describe('a quoted passage copied back with words changed (EC-549)', () => {
    it('puts the passage back as it was quoted, every other word as written', () => {
        const changed = [
            '# The New Birth',
            '',
            '> **John 3:16** (KJV)',
            '>',
            '> **16** For God so loved the whole world.',
            '',
            'A study of one night.',
            '',
            '## The Setting',
            'At night.',
        ].join('\n');
        const result = restoreStudyPassages(OLD, changed);
        expect(result.text).toBe(
            changed.replace('the whole world', 'the world'),
        );
        expect(result.restored).toEqual([
            { title: 'John 3:16', bibleKey: 'KJV', lineCount: 1 },
        ]);
    });

    it('puts back a line dropped from the quote', () => {
        const dropped = OLD.replace('>\n> **16**', '> **16**');
        expect(dropped).not.toBe(OLD);
        const result = restoreStudyPassages(OLD, dropped);
        expect(result.text).toBe(OLD);
        expect(result.restored[0].lineCount).toBe(1);
    });

    it('leaves an exact copy, spaces at a line end, and words outside the quote as they are', () => {
        const words = OLD.replace('At night.', 'By night.');
        expect(restoreStudyPassages(OLD, words)).toEqual({
            text: words,
            restored: [],
        });
        const spaced = OLD.replace('the world.', 'the world.  ');
        expect(restoreStudyPassages(OLD, spaced)).toEqual({
            text: spaced,
            restored: [],
        });
        expect(restoreStudyPassages('# No passage\n', OLD)).toEqual({
            text: OLD,
            restored: [],
        });
    });

    it('writes a quote of another Bible or another reference as it is', () => {
        const otherBible = OLD.replace('(KJV)', '(ASV)').replace(
            'the world',
            'the whole world',
        );
        expect(restoreStudyPassages(OLD, otherBible)).toEqual({
            text: otherBible,
            restored: [],
        });
        const otherRef = OLD.replace('**John 3:16**', '**John 3:17**');
        expect(restoreStudyPassages(OLD, otherRef).restored).toEqual([]);
    });

    it('leaves a reference the old text quotes twice apart as written, and takes two alike as one', () => {
        const apart = [
            ...PASSAGE,
            '',
            '## Again',
            '',
            '> **John 3:16** (KJV)',
            '>',
            '> **16** For God so loved.',
        ].join('\n');
        const changedApart = apart.replace('loved the world', 'cared');
        expect(restoreStudyPassages(apart, changedApart).restored).toEqual([]);
        const alike = [...PASSAGE, '', '## Again', '', ...PASSAGE].join('\n');
        const changedAlike = alike.replace('the world', 'all the world');
        const result = restoreStudyPassages(alike, changedAlike);
        expect(result.text).toBe(alike);
        expect(result.restored).toHaveLength(1);
    });

    it('reads a quote inside a fenced block as no passage', () => {
        const fenced = `${OLD}\n\`\`\`md\n> **John 3:16** (KJV)\n> changed\n\`\`\`\n`;
        expect(restoreStudyPassages(OLD, fenced)).toEqual({
            text: fenced,
            restored: [],
        });
    });

    it('says which passages were put back, and how to quote another', () => {
        expect(describeStudyRestoredPassages([])).toBe('');
        expect(
            describeStudyRestoredPassages([
                { title: 'John 3:16', bibleKey: 'KJV', lineCount: 1 },
            ]),
        ).toBe(
            'The passage “John 3:16” was put back as the app quoted it from ' +
                'the Bible: the words sent changed 1 of its line(s), and a ' +
                "quoted passage is the Bible's own words. To quote another " +
                'passage, put its reference alone on a line, as [^John 3:16].',
        );
        expect(
            describeStudyRestoredPassages([
                { title: 'John 3:16', bibleKey: 'KJV', lineCount: 1 },
                { title: 'John 3:17', bibleKey: 'KJV', lineCount: 2 },
            ]),
        ).toContain(
            'The passages “John 3:16”, “John 3:17” were put back as the app ' +
                'quoted them from the Bible: the words sent changed 3 of ' +
                'their line(s)',
        );
    });
});
