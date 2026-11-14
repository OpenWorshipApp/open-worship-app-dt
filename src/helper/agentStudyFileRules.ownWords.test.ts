import { describe, expect, it } from 'vitest';

import {
    applyStudyEdit,
    describeStudyKeptParts,
    summarizeStudyChange,
} from './agentStudyFileRules';

// A part's new words never take out what they do not write (EC-544): new
// words for a part that holds parts of its own had taken every one of
// them out -- under a study's title, the whole study.

const FOOTER = '\n---\n\n*Drafted by the app’s assistant.*\n';

const STUDY = [
    '# The New Birth',
    '',
    '> **John 3:16** (KJV)',
    '>',
    '> **16** For God so loved the world.',
    '',
    '## The Setting',
    'John 3 takes place in Jerusalem.',
    '',
    '## Verse by Verse',
    '',
    'Each verse in turn.',
    '',
    '### Night',
    'Nicodemus comes by night.',
    '',
    '### Wind',
    'The wind blows where it wishes.',
    '',
    '## Questions',
    '1. What is new birth?',
];

const FILE = `${STUDY.join('\n')}\n${FOOTER}`;

function edit(section: string, change: { content?: string; append?: string }) {
    const result = applyStudyEdit(FILE, { section, ...change });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function toFile(lines: string[]) {
    return `${lines.join('\n')}\n${FOOTER}`;
}

function swap(from: string[], to: string[]) {
    const at = STUDY.indexOf(from[0]);
    expect(STUDY.slice(at, at + from.length)).toEqual(from);
    return [...STUDY.slice(0, at), ...to, ...STUDY.slice(at + from.length)];
}

describe('a part’s own words (EC-544)', () => {
    it('writes the words above its parts, which stay as they were', () => {
        const result = edit('Verse by Verse', { content: 'Read it slowly.' });
        expect(result.text).toBe(
            toFile(swap(['Each verse in turn.'], ['Read it slowly.'])),
        );
        expect(result.keptParts).toEqual({
            heading: 'Verse by Verse',
            parts: ['Night', 'Wind'],
        });
    });

    it('keeps every part under the study’s title, and the passage quoted under it (EC-548)', () => {
        const result = edit('The New Birth', {
            content: '# The New Birth\n\nA study of one night.',
        });
        expect(result.text).toBe(
            toFile([
                '# The New Birth',
                '',
                '> **John 3:16** (KJV)',
                '>',
                '> **16** For God so loved the world.',
                '',
                'A study of one night.',
                '',
                ...STUDY.slice(STUDY.indexOf('## The Setting')),
            ]),
        );
        expect(result.keptParts).toEqual({
            heading: 'The New Birth',
            parts: ['The Setting', 'Verse by Verse', 'Questions'],
        });
        expect(summarizeStudyChange(FILE, result.text).removedSections).toEqual(
            [],
        );
    });

    it('renames a part by a heading alone, every word of it kept', () => {
        const renamed = edit('Questions', { content: '## For Discussion' });
        expect(renamed.text).toBe(
            toFile(swap(['## Questions'], ['## For Discussion'])),
        );
        expect(renamed.keptParts).toBeUndefined();
        const holding = edit('Verse by Verse', { content: '## Line by Line' });
        expect(holding.text).toBe(
            toFile(swap(['## Verse by Verse'], ['## Line by Line'])),
        );
        expect(holding.keptParts).toBeUndefined();
    });

    it('writes the whole part when the words write its parts too', () => {
        const result = edit('Verse by Verse', {
            content: 'Two verses.\n\n### Night\nHe comes by night.',
        });
        expect(result.text).toBe(
            toFile([
                ...STUDY.slice(0, STUDY.indexOf('## Verse by Verse')),
                '## Verse by Verse',
                '',
                'Two verses.',
                '',
                '### Night',
                'He comes by night.',
                '',
                ...STUDY.slice(STUDY.indexOf('## Questions')),
            ]),
        );
        expect(result.keptParts).toBeUndefined();
    });

    it('reads a heading inside a diagram as no part of the words', () => {
        const result = edit('Verse by Verse', {
            content: '```mermaid\ngraph TD\n# not a heading\n```',
        });
        expect(result.text).toContain(
            '## Verse by Verse\n\n```mermaid\ngraph TD\n# not a heading\n```\n\n### Night',
        );
        expect(result.keptParts?.parts).toEqual(['Night', 'Wind']);
    });

    it('adds words at the end of its own words, never into its last part', () => {
        const result = edit('Verse by Verse', { append: 'Read them twice.' });
        expect(result.text).toBe(
            toFile(
                swap(
                    ['Each verse in turn.'],
                    ['Each verse in turn.', '', 'Read them twice.'],
                ),
            ),
        );
        expect(result.keptParts?.parts).toEqual(['Night', 'Wind']);
    });

    it('adds a part at the end of the part, as before', () => {
        const result = edit('Verse by Verse', {
            append: '### Day\nHe speaks openly.',
        });
        expect(result.text).toContain(
            'The wind blows where it wishes.\n\n### Day\nHe speaks openly.\n\n## Questions',
        );
        expect(result.keptParts).toBeUndefined();
    });

    it('changes nothing it did not before for a part with no parts', () => {
        expect(edit('The Setting', { content: 'At night.' }).text).toBe(
            toFile(
                swap(
                    ['## The Setting', 'John 3 takes place in Jerusalem.'],
                    ['## The Setting', '', 'At night.'],
                ),
            ),
        );
        expect(
            edit('Questions', { content: '## Asked\n1. Who came?' }).text,
        ).toBe(
            toFile(
                swap(
                    ['## Questions', '1. What is new birth?'],
                    ['## Asked', '1. Who came?'],
                ),
            ),
        );
    });

    it('says which parts were kept, five named at most', () => {
        expect(describeStudyKeptParts(null)).toBe('');
        expect(
            describeStudyKeptParts({ heading: 'Verse by Verse', parts: [] }),
        ).toBe('');
        expect(
            describeStudyKeptParts({
                heading: 'Verse by Verse',
                parts: ['Night', 'Wind'],
            }),
        ).toBe(
            'The parts under “Verse by Verse” were kept as they were, below ' +
                'these words: “Night”, “Wind”. To take one out, draft it ' +
                'with `remove`.',
        );
        expect(
            describeStudyKeptParts({
                heading: 'Study',
                parts: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            }),
        ).toContain('“A”, “B”, “C”, “D”, “E” and 2 more.');
    });
});
