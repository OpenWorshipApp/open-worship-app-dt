import { describe, expect, it } from 'vitest';

import {
    STUDY_HEADINGS_LEAD,
    applyStudyRemove,
    describeStudyChange,
    splitStudyFooter,
    splitStudyTranslations,
    summarizeStudyChange,
} from './agentStudyFileRules';

// A part of a study taken out whole (EC-543): no other call could, so a
// part of a long study stayed in for good, and a second translation could
// not take the place of the first.

const FOOTER = '\n---\n\n*Drafted by the app’s assistant.*\n';

const ORIGINAL = [
    '# The New Birth',
    '',
    'Words under the title.',
    '',
    '## The Setting',
    'John 3 takes place in Jerusalem.',
    '',
    '## Verse by Verse',
    '',
    '### Night',
    'Nicodemus comes by night.',
    '',
    '### Wind',
    'The wind blows where it wishes.',
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
];

const TRANSLATION = [
    '# The Birth From Above',
    '',
    '## The Place',
    'Jerusalem, at night.',
    '',
    '## Asked',
    '1. What is it to be born again?',
];

const SECOND_TRANSLATION = ['# Born Again', '', '## Where', 'In the city.'];

function toFile(...blocks: string[][]) {
    return `${blocks
        .map((lines) => {
            return lines.join('\n');
        })
        .join('\n\n---\n\n')}\n${FOOTER}`;
}

function remove(text: string, section: string) {
    const result = applyStudyRemove(text, section);
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result.text;
}

function cut(lines: string[], from: string, to: string | null) {
    const start = lines.indexOf(from);
    const end = to === null ? lines.length : lines.indexOf(to);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const head = lines.slice(0, start);
    while (head.at(-1) === '') {
        head.pop();
    }
    const rest = lines.slice(end);
    return rest.length === 0 ? head : [...head, '', ...rest];
}

describe('applyStudyRemove', () => {
    it('takes one part out, and every other line stays as it was', () => {
        const file = toFile(ORIGINAL);
        const text = remove(file, 'The Setting');
        expect(text).toBe(
            toFile(cut(ORIGINAL, '## The Setting', '## Verse by Verse')),
        );
        expect(describeStudyChange(summarizeStudyChange(file, text))).toBe(
            'It removes “The Setting” (0 line(s) in, 2 out).',
        );
    });

    it('takes a part’s own parts with it, named loosely', () => {
        const file = toFile(ORIGINAL);
        const text = remove(file, '  verse BY verse ');
        expect(text).toBe(
            toFile(cut(ORIGINAL, '## Verse by Verse', '## Diagrams')),
        );
        expect(summarizeStudyChange(file, text).removedSections).toEqual([
            'Verse by Verse',
            'Night',
            'Wind',
        ]);
    });

    it('takes out one subpart alone', () => {
        expect(remove(toFile(ORIGINAL), 'Night')).toBe(
            toFile(cut(ORIGINAL, '### Night', '### Wind')),
        );
    });

    it('takes a diagram part out with its fence, and never a heading in it', () => {
        expect(remove(toFile(ORIGINAL), 'Diagrams')).toBe(
            toFile(cut(ORIGINAL, '## Diagrams', '## Questions')),
        );
        const result = applyStudyRemove(toFile(ORIGINAL), 'not a heading');
        expect(result).toEqual({
            reason: expect.stringContaining(
                'The file has no section “not a heading”.',
            ),
        });
    });

    it('takes the last part out, the app’s last lines still last', () => {
        const text = remove(toFile(ORIGINAL), 'Questions');
        expect(text).toBe(toFile(cut(ORIGINAL, '## Questions', null)));
        expect(splitStudyFooter(text).footer).toBe(FOOTER);
    });

    it('keeps the rule a translation under the study opens with', () => {
        const file = toFile(ORIGINAL, TRANSLATION);
        const text = remove(file, 'Questions');
        expect(text).toBe(
            toFile(cut(ORIGINAL, '## Questions', null), TRANSLATION),
        );
        const { original, translations } = splitStudyTranslations(
            splitStudyFooter(text).body,
        );
        expect(translations.startsWith('---\n\n# The Birth From Above')).toBe(
            true,
        );
        expect(original).not.toContain('## Questions');
    });

    it('takes a whole translation out, and leaves no rule over the footer', () => {
        const file = toFile(ORIGINAL, TRANSLATION);
        const text = remove(file, 'The Birth From Above');
        expect(text).toBe(toFile(ORIGINAL));
        expect(summarizeStudyChange(file, text).removedSections).toEqual([
            'The Birth From Above',
            'The Place',
            'Asked',
        ]);
    });

    it('takes the first of two translations out, one rule left between', () => {
        const file = toFile(ORIGINAL, TRANSLATION, SECOND_TRANSLATION);
        expect(remove(file, 'The Birth From Above')).toBe(
            toFile(ORIGINAL, SECOND_TRANSLATION),
        );
        expect(remove(file, 'Born Again')).toBe(toFile(ORIGINAL, TRANSLATION));
    });

    it('takes a part of a translation out, the study above untouched', () => {
        const file = toFile(ORIGINAL, TRANSLATION);
        expect(remove(file, 'The Place')).toBe(
            toFile(ORIGINAL, cut(TRANSLATION, '## The Place', '## Asked')),
        );
        expect(remove(file, 'Asked')).toBe(
            toFile(ORIGINAL, cut(TRANSLATION, '## Asked', null)),
        );
    });

    it('keeps a rule between two parts once, whichever is taken out', () => {
        const lines = [
            '# Notes',
            '',
            '## One',
            'First.',
            '',
            '---',
            '',
            '## Two',
            'Second.',
            '',
            '## Three',
            'Third.',
        ];
        const file = `${lines.join('\n')}\n`;
        expect(remove(file, 'One')).toBe(
            [
                '# Notes',
                '',
                '---',
                '',
                '## Two',
                'Second.',
                '',
                '## Three',
                'Third.',
                '',
            ].join('\n'),
        );
        expect(remove(file, 'Two')).toBe(
            [
                '# Notes',
                '',
                '## One',
                'First.',
                '',
                '---',
                '',
                '## Three',
                'Third.',
                '',
            ].join('\n'),
        );
    });

    it('reads CRLF line ends, and a file the person wrote with no footer', () => {
        const file = `${ORIGINAL.join('\r\n')}\r\n`;
        expect(remove(file, 'The Setting')).toBe(
            `${cut(ORIGINAL, '## The Setting', '## Verse by Verse').join('\n')}\n`,
        );
    });

    it('refuses the study’s own title: its part is the whole study', () => {
        const result = applyStudyRemove(
            toFile(ORIGINAL, TRANSLATION),
            'The New Birth',
        );
        expect('reason' in result && result.reason).toBe(
            "“The New Birth” is the study's own title: its part is the " +
                'whole study. Name the part to take out by its own heading. ' +
                `${STUDY_HEADINGS_LEAD}\n# The New Birth\n## The Setting\n` +
                '## Verse by Verse\n### Night\n### Wind\n## Diagrams\n' +
                '## Questions\n# The Birth From Above\n## The Place\n## Asked',
        );
    });

    it('refuses no part named, a part not there, and one named twice', () => {
        expect(applyStudyRemove(toFile(ORIGINAL), '  ')).toEqual({
            reason:
                'Name the part to take out in `section`: its heading, as ' +
                'the file writes it.',
        });
        const missing = applyStudyRemove(toFile(ORIGINAL), 'Prayer');
        expect('reason' in missing && missing.reason).toContain(
            `The file has no section “Prayer”. ${STUDY_HEADINGS_LEAD}`,
        );
        const twice = applyStudyRemove(
            toFile([...ORIGINAL, '', '## The Setting', 'Again.']),
            'The Setting',
        );
        expect('reason' in twice && twice.reason).toContain(
            'The file has 2 sections called “The Setting”; only their ' +
                'place tells them apart, so the person takes the one out ' +
                'in the editor.',
        );
    });

    it('refuses to take out all a study holds', () => {
        const result = applyStudyRemove('## Only\nWords.\n', 'Only');
        expect(result).toEqual({
            reason: '“Only” is all the study holds: nothing would be left of it.',
        });
    });
});
