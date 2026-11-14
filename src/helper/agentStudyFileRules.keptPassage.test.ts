import { describe, expect, it } from 'vitest';

import {
    applyStudyEdit,
    applyStudyRemove,
    describeStudyEditKept,
    describeStudyKeptParts,
    describeStudyKeptPassages,
    summarizeStudyChange,
} from './agentStudyFileRules';

// The passage the app quoted under a study's title stays beside new words
// that place none (EC-548): the title's own words ARE that passage, and an
// introduction sent for them had taken it out.

const FOOTER = '\n---\n\n*Drafted by the app’s assistant.*\n';

const PASSAGE = [
    '> **John 3:16** (KJV)',
    '>',
    '> **16** For God so loved the world.',
];

const STUDY = [
    '# The New Birth',
    '',
    ...PASSAGE,
    '',
    '## The Setting',
    'John 3 takes place in Jerusalem.',
    '',
    '## Questions',
    '1. What is new birth?',
];

function toFile(lines: string[]) {
    return `${lines.join('\n')}\n${FOOTER}`;
}

const FILE = toFile(STUDY);

function edit(
    section: string,
    change: { content?: string; append?: string },
    file = FILE,
) {
    const result = applyStudyEdit(file, { section, ...change });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function remove(section: string, file = FILE) {
    const result = applyStudyRemove(file, section);
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result.text;
}

const REST = STUDY.slice(STUDY.indexOf('## The Setting'));

describe('the passage quoted under a part, beside its new words (EC-548)', () => {
    it('keeps the passage under the title above an introduction written for it', () => {
        const result = edit('The New Birth', {
            content: 'A study of one night.',
        });
        expect(result.text).toBe(
            toFile([
                '# The New Birth',
                '',
                ...PASSAGE,
                '',
                'A study of one night.',
                '',
                ...REST,
            ]),
        );
        expect(result.keptPassages).toEqual({
            heading: 'The New Birth',
            passages: [{ title: 'John 3:16', bibleKey: 'KJV' }],
            isAbove: true,
        });
        expect(result.keptParts?.parts).toEqual(['The Setting', 'Questions']);
        const change = summarizeStudyChange(FILE, result.text);
        expect(change.removedSections).toEqual([]);
    });

    it('keeps it below new words when words stood above it', () => {
        const file = toFile([
            '# The New Birth',
            '',
            'An old opening.',
            '',
            ...PASSAGE,
            '',
            ...REST,
        ]);
        const result = edit(
            'The New Birth',
            { content: 'A new opening.' },
            file,
        );
        expect(result.text).toBe(
            toFile([
                '# The New Birth',
                '',
                'A new opening.',
                '',
                ...PASSAGE,
                '',
                ...REST,
            ]),
        );
        expect(result.keptPassages?.isAbove).toBe(false);
    });

    it('keeps it when the words write the part’s parts too', () => {
        const result = edit('The New Birth', {
            content: 'One night.\n\n## The Setting\nAt night.',
        });
        expect(result.text).toBe(
            toFile([
                '# The New Birth',
                '',
                ...PASSAGE,
                '',
                'One night.',
                '',
                '## The Setting',
                'At night.',
            ]),
        );
        expect(result.keptPassages?.passages).toEqual([
            { title: 'John 3:16', bibleKey: 'KJV' },
        ]);
        const titled = edit('The New Birth', {
            content: '# The New Birth\n\n## The Setting\nAt night.',
        });
        expect(titled.text).toBe(
            toFile([
                '# The New Birth',
                '',
                ...PASSAGE,
                '',
                '## The Setting',
                'At night.',
            ]),
        );
    });

    it('writes it anew when the words place a passage: a verse token alone on its line, or a quote', () => {
        const token = edit('The New Birth', {
            content: '[^John 3:3]\n\nA study of one night.',
        });
        expect(token.text).toBe(
            toFile([
                '# The New Birth',
                '',
                '[^John 3:3]',
                '',
                'A study of one night.',
                '',
                ...REST,
            ]),
        );
        expect(token.keptPassages).toBeUndefined();
        const quoted = edit('The New Birth', {
            content:
                '> **John 3:3** (KJV)\n>\n> **3** Except a man be born again.',
        });
        expect(quoted.text).not.toContain('John 3:16');
        expect(quoted.keptPassages).toBeUndefined();
    });

    it('reads a token in a sentence, and a quote inside a fenced block, as no passage', () => {
        const sentence = edit('The New Birth', {
            content: 'Read [^John 3:3] first.',
        });
        expect(sentence.text).toContain(
            `${PASSAGE.join('\n')}\n\nRead [^John 3:3] first.`,
        );
        const fenced = edit('The New Birth', {
            content: '```md\n> **John 3:3** (KJV)\n```',
        });
        expect(fenced.text).toContain(
            `${PASSAGE.join('\n')}\n\n\`\`\`md\n> **John 3:3** (KJV)\n\`\`\``,
        );
        expect(fenced.keptPassages?.passages).toHaveLength(1);
    });

    it('leaves a rename and added words as they were', () => {
        const renamed = edit('The New Birth', {
            content: '# The Second Birth',
        });
        expect(renamed.text).toBe(
            FILE.replace('# The New Birth', '# The Second Birth'),
        );
        expect(renamed.keptPassages).toBeUndefined();
        const added = edit('The New Birth', { append: 'Read it twice.' });
        expect(added.text).toBe(
            toFile([
                '# The New Birth',
                '',
                ...PASSAGE,
                '',
                'Read it twice.',
                '',
                ...REST,
            ]),
        );
        expect(added.keptPassages).toBeUndefined();
    });

    it('keeps every passage of a part, in their order, and touches no other part', () => {
        const second = [
            '> **John 3:17** (KJV)',
            '>',
            '> **17** For God sent not his Son.',
        ];
        const file = toFile([
            '# The New Birth',
            '',
            ...PASSAGE,
            '',
            ...second,
            '',
            ...REST,
        ]);
        const result = edit('The New Birth', { content: 'Two verses.' }, file);
        expect(result.text).toBe(
            toFile([
                '# The New Birth',
                '',
                ...PASSAGE,
                '',
                ...second,
                '',
                'Two verses.',
                '',
                ...REST,
            ]),
        );
        expect(
            result.keptPassages?.passages.map((one) => {
                return one.title;
            }),
        ).toEqual(['John 3:16', 'John 3:17']);
        const setting = edit('The Setting', { content: 'At night.' });
        expect(setting.keptPassages).toBeUndefined();
    });
});

describe('a quoted passage taken out by its reference (EC-548)', () => {
    it('takes out the passage alone, every other line as it was', () => {
        const expected = toFile(['# The New Birth', '', ...REST]);
        expect(remove('John 3:16')).toBe(expected);
        expect(remove('John 3:16 (KJV)')).toBe(expected);
        expect(remove('**John 3:16** (KJV)')).toBe(expected);
    });

    it('takes a part named like a passage first, and refuses a passage quoted twice', () => {
        const named = toFile([
            '# The New Birth',
            '',
            ...PASSAGE,
            '',
            '## John 3:16',
            'Its own part.',
        ]);
        expect(remove('John 3:16', named)).toBe(
            toFile(['# The New Birth', '', ...PASSAGE]),
        );
        const twice = toFile([
            '# The New Birth',
            '',
            ...PASSAGE,
            '',
            '## Again',
            '',
            ...PASSAGE,
        ]);
        expect(applyStudyRemove(twice, 'John 3:16')).toEqual({
            reason:
                'The file quotes “John 3:16” 2 times; only their place ' +
                'tells them apart, so the person takes the one out in the ' +
                'editor.',
        });
    });

    it('points from the title at the passage quoted under it', () => {
        const refused = applyStudyRemove(FILE, 'The New Birth');
        expect('reason' in refused && refused.reason).toContain(
            'is the whole study. The passage quoted under it is taken out ' +
                'by its reference: `section` “John 3:16”. Name the part to ' +
                'take out by its own heading.',
        );
        const bare = applyStudyRemove(
            toFile(['# The New Birth', '', ...REST]),
            'The New Birth',
        );
        expect('reason' in bare && bare.reason).not.toContain('passage');
    });

    it('answers a reference nothing quotes as a heading not found', () => {
        expect(applyStudyRemove(FILE, 'John 3:17')).toEqual({
            reason: expect.stringContaining(
                'The file has no section “John 3:17”.',
            ),
        });
    });
});

describe('what the model is told was kept (EC-548)', () => {
    it('names the passage, where it stands, and how to quote another or take it out', () => {
        expect(describeStudyKeptPassages(null)).toBe('');
        expect(
            describeStudyKeptPassages({
                heading: 'The New Birth',
                passages: [],
                isAbove: true,
            }),
        ).toBe('');
        expect(
            describeStudyKeptPassages({
                heading: 'The New Birth',
                passages: [{ title: 'John 3:16', bibleKey: 'KJV' }],
                isAbove: true,
            }),
        ).toBe(
            'The passage “John 3:16” quoted under “The New Birth” was kept ' +
                'as it was, above these words: the app quotes it from the ' +
                'Bible. To quote another passage there, put its reference ' +
                'alone on a line of the words, as [^John 3:16]; to take one ' +
                'out, draft `remove` with `section` “John 3:16”.',
        );
        expect(
            describeStudyKeptPassages({
                heading: 'Opening',
                passages: [
                    { title: 'John 3:16', bibleKey: 'KJV' },
                    { title: 'John 3:17', bibleKey: 'KJV' },
                ],
                isAbove: false,
            }),
        ).toContain(
            'The passages “John 3:16”, “John 3:17” quoted under “Opening” ' +
                'were kept as they were, below these words: the app quotes ' +
                'them from the Bible.',
        );
    });

    it('joins the parts kept and the passages kept, parts first', () => {
        const result = edit('The New Birth', {
            content: 'A study of one night.',
        });
        expect(describeStudyEditKept(result)).toBe(
            `${describeStudyKeptParts(result.keptParts ?? null)} ` +
                describeStudyKeptPassages(result.keptPassages ?? null),
        );
        expect(describeStudyEditKept({})).toBe('');
        expect(
            describeStudyEditKept(
                edit('The Setting', { content: 'At night.' }),
            ),
        ).toBe('');
    });
});
