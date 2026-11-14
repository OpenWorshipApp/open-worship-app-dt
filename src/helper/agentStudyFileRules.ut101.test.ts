import { describe, expect, it } from 'vitest';

import {
    applyStudyEdit,
    checkStudyDiagram,
    lintStudyContent,
    readStudySection,
    toStudyTitle,
} from './agentStudyFileRules';

describe('toStudyTitle', () => {
    it('refuses a title that is only quote marks once they come off', () => {
        for (const value of ['""', "''", '“”', ' "  " ']) {
            expect(toStudyTitle(value)).toEqual({
                reason: 'Give the study a title of a few words.',
            });
        }
        // Quote marks round real words come off and the words stay.
        expect(toStudyTitle('"The Voice"')).toEqual({ title: 'The Voice' });
    });
});

describe('checkStudyDiagram', () => {
    it('refuses a diagram carrying a script address, in any case', () => {
        for (const source of [
            'flowchart LR\n  A["javascript:alert(1)"] --> B',
            'graph TD\n  A --> B["JavaScript:void(0)"]',
        ]) {
            expect(checkStudyDiagram(source)).toBe(
                'it carries a script address',
            );
        }
        expect(
            lintStudyContent(
                '```mermaid\nflowchart LR\n  A["javascript:x"] --> B\n```',
            ).reasons,
        ).toEqual([
            'Diagram 1 will not be drawn: it carries a script address.',
        ]);
    });
});

describe('readStudySection', () => {
    it('reads a section without the blank lines between it and the next heading', () => {
        const text = [
            '# The Study',
            '',
            '## One',
            '',
            'First words.',
            '',
            '',
            '## Two',
            '',
            'Second words.',
        ].join('\n');
        expect(readStudySection(text, 'one')).toEqual({
            heading: 'One',
            text: '## One\n\nFirst words.',
        });
        // The last section runs to the end of the file, its blank lines
        // dropped too.
        expect(readStudySection(`${text}\n\n\n`, 'Two')).toEqual({
            heading: 'Two',
            text: '## Two\n\nSecond words.',
        });
    });
});

describe('applyStudyEdit', () => {
    it('ends a file with no footer in one line break', () => {
        const oldText = '# The Study\n\n## Notes\n\nOld words.\n\n';
        expect(applyStudyEdit(oldText, { append: 'More words.' })).toEqual({
            text: '# The Study\n\n## Notes\n\nOld words.\n\nMore words.\n',
        });
        expect(
            applyStudyEdit(oldText, {
                section: 'Notes',
                content: 'New words.',
            }),
        ).toEqual({ text: '# The Study\n\n## Notes\n\nNew words.\n' });
    });

    it('drops the blank lines a file opens with when words are added at its end', () => {
        expect(
            applyStudyEdit('\n\n\nOld words.', { append: 'More words.' }),
        ).toEqual({ text: 'Old words.\n\nMore words.\n' });
    });
});
