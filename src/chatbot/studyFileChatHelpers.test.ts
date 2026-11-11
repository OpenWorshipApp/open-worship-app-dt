import { describe, expect, it } from 'vitest';

import type { ChatMessageType } from './chatSessionHelpers';
import {
    STUDY_CHANGE_HELD_NOTE,
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_NOTE,
    STUDY_KEEP_ANSWER_HINT,
    STUDY_KEPT_ANSWER_CHANGE_NOTE,
    STUDY_KEPT_ANSWER_NOTE,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
    STUDY_SYSTEM_PROMPT,
    chainStudyPartEdit,
    checkIsStudyAnswerMarker,
    clearStudyRenameWait,
    findOpenStudyFiles,
    findStudyAnswerAbove,
    genOpenStudyDraftRefusal,
    genStudyClaimNudge,
    genStudyDraftActions,
    keepDraftedStudy,
    pickKeptAnswerLanguage,
    readDraftedStudy,
    readKeepAnswerAsk,
    readStudyFileAsk,
    routeOpenStudyDraft,
    setStudyRenameWait,
    takeDraftedStudy,
    takeStudyRenameWait,
    toKeptAnswerDraftArgs,
    toModelDraftText,
    toStudyAsk,
    toStudyContentFromAnswer,
    toStudyReadOutline,
} from './studyFileChatHelpers';
import { STUDY_FILE_PROMPT } from './noteCreatePromptHelpers';

const DRAFT_RESULT = {
    drafted: true,
    isChange: false,
    name: 'MAT.3.3-7 The Voice.md',
    nameTaken: 'MAT.3.3-7 The Voice (taken).md',
    passage: 'Matthew 3:3-7',
    bible: 'KJV',
    diagramCount: 2,
    warnings: [],
    content: '# The Voice\n\nStudy words',
};

const DRAFT_ARGS = {
    action: 'draft',
    ref: 'Matthew 3:3-7',
    title: 'The Voice',
    content: 'Study words',
};

describe('readDraftedStudy', () => {
    it('reads a draft result and keeps what it was made from', () => {
        const drafted = readDraftedStudy(
            JSON.stringify(DRAFT_RESULT),
            DRAFT_ARGS,
        );
        expect(drafted).toMatchObject({
            name: 'MAT.3.3-7 The Voice.md',
            nameTaken: 'MAT.3.3-7 The Voice (taken).md',
            isChange: false,
            file: null,
            hash: null,
            passage: 'Matthew 3:3-7',
            diagramCount: 2,
            content: '# The Voice\n\nStudy words',
            raw: {
                ref: 'Matthew 3:3-7',
                title: 'The Voice',
                content: 'Study words',
                bible: null,
            },
        });
    });

    it('keeps no raw input for a change, and reads its file and hash', () => {
        const drafted = readDraftedStudy(
            JSON.stringify({
                ...DRAFT_RESULT,
                isChange: true,
                file: 'Default/MAT.3.3-7 The Voice.md',
                hash: '12-abcdef01',
                change: 'It adds “Baptism”.',
            }),
            { ...DRAFT_ARGS, file: 'Default/MAT.3.3-7 The Voice.md' },
        );
        expect(drafted?.isChange).toBe(true);
        expect(drafted?.file).toBe('Default/MAT.3.3-7 The Voice.md');
        expect(drafted?.hash).toBe('12-abcdef01');
        expect(drafted?.change).toBe('It adds “Baptism”.');
        expect(drafted?.raw).toBe(null);
    });

    it('reads a refusal or anything else as no draft', () => {
        expect(readDraftedStudy('Tool refused: the title is empty', {})).toBe(
            null,
        );
        expect(readDraftedStudy('{"drafted": false}', {})).toBe(null);
        expect(readDraftedStudy('', {})).toBe(null);
    });
});

describe('toModelDraftText', () => {
    it('holds the study back from the model and says what to do', () => {
        const shown = JSON.parse(
            toModelDraftText(JSON.stringify(DRAFT_RESULT)),
        );
        expect(shown.content).toBe(
            `[held by the window: ${DRAFT_RESULT.content.length} characters]`,
        );
        expect(shown.note).toBe(STUDY_HELD_NOTE);
        expect(shown.name).toBe(DRAFT_RESULT.name);
        expect(JSON.stringify(shown)).not.toContain('Study words');
    });

    it('tells a CHANGE to name Save changes and every part it changes', () => {
        const shown = JSON.parse(
            toModelDraftText(
                JSON.stringify({
                    ...DRAFT_RESULT,
                    isChange: true,
                    file: 'Default/MAT.3.3-7 The Voice.md',
                    hash: '1c6-0477206d',
                    change: 'It changes “Questions” and adds “A prayer”.',
                }),
            ),
        );
        expect(shown.note).toBe(STUDY_CHANGE_HELD_NOTE);
        expect(shown.note).toContain('Save changes');
        expect(shown.note).not.toContain('Create');
        expect(shown.note).toContain('every part `change` names');
        // What it changes still reaches the model whole.
        expect(shown.change).toBe(
            'It changes “Questions” and adds “A prayer”.',
        );
        expect(JSON.stringify(shown)).not.toContain('Study words');
    });

    it('passes a refusal through untouched', () => {
        expect(toModelDraftText('Tool refused: no')).toBe('Tool refused: no');
    });

    it('says the answer was kept when the window put it in (EC-466)', () => {
        const shown = JSON.parse(
            toModelDraftText(JSON.stringify(DRAFT_RESULT), true),
        );
        expect(shown.note).toBe(STUDY_KEPT_ANSWER_NOTE);
        expect(shown.note).toContain('Create');
        expect(shown.note).toContain('name no section or diagram');
        expect(JSON.stringify(shown)).not.toContain('Study words');
        const changed = JSON.parse(
            toModelDraftText(
                JSON.stringify({ ...DRAFT_RESULT, isChange: true }),
                true,
            ),
        );
        expect(changed.note).toBe(STUDY_KEPT_ANSWER_CHANGE_NOTE);
        expect(changed.note).toContain('Save changes');
        expect(changed.note).not.toContain('Create');
    });
});

describe('held drafts', () => {
    it('keeps the three newest and forgets the oldest', () => {
        const base = readDraftedStudy(JSON.stringify(DRAFT_RESULT), DRAFT_ARGS);
        if (base === null) {
            throw new Error('no draft');
        }
        const keptList = [1, 2, 3, 4].map((index) => {
            return keepDraftedStudy({ ...base, name: `n${index}.md` });
        });
        expect(takeDraftedStudy(keptList[0].reference)).toBe(null);
        expect(takeDraftedStudy(keptList[3].reference)?.name).toBe('n4.md');
        expect(takeDraftedStudy('study-unknown')).toBe(null);
        // Every reference is its own, even within one millisecond.
        expect(new Set(keptList.map((kept) => kept.reference)).size).toBe(4);
    });
});

describe('genStudyDraftActions', () => {
    const base = readDraftedStudy(JSON.stringify(DRAFT_RESULT), DRAFT_ARGS);
    if (base === null) {
        throw new Error('no draft');
    }

    it('offers Create, Preview and Change the name for a new file', () => {
        const kept = keepDraftedStudy(base);
        const actions = genStudyDraftActions(kept);
        expect(
            actions.map((action) => [action.label, action.toolName]),
        ).toEqual([
            ['Create "MAT.3.3-7 The Voice.md"', STUDY_CREATE_TOOL_NAME],
            ['Preview', STUDY_PREVIEW_TOOL_NAME],
            ['Change the name', STUDY_RENAME_TOOL_NAME],
        ]);
        actions.forEach((action) => {
            expect(action.args).toEqual({ reference: kept.reference });
        });
    });

    it('offers Save changes and Preview for a change, no rename', () => {
        const kept = keepDraftedStudy({ ...base, isChange: true, raw: null });
        expect(
            genStudyDraftActions(kept).map((action) => action.label),
        ).toEqual(['Save changes to "MAT.3.3-7 The Voice.md"', 'Preview']);
    });
});

describe('the rename wait', () => {
    it('takes one short line as the new name, once', () => {
        setStudyRenameWait('tab-1', 'study-a');
        expect(takeStudyRenameWait('tab-1', '  Prepare the Way ')).toBe(
            'study-a',
        );
        expect(takeStudyRenameWait('tab-1', 'Prepare the Way')).toBe(null);
    });

    it('ends on a question, a command, two lines or a long line', () => {
        for (const line of [
            'What should I call it?',
            '/clear',
            'one\ntwo',
            'x'.repeat(81),
            '',
        ]) {
            setStudyRenameWait('tab-2', 'study-b');
            expect(takeStudyRenameWait('tab-2', line)).toBe(null);
            expect(takeStudyRenameWait('tab-2', 'A name')).toBe(null);
        }
    });

    it('is per tab and can be cleared', () => {
        setStudyRenameWait('tab-3', 'study-c');
        expect(takeStudyRenameWait('tab-4', 'A name')).toBe(null);
        clearStudyRenameWait('tab-3');
        expect(takeStudyRenameWait('tab-3', 'A name')).toBe(null);
    });
});

describe('readStudyFileAsk', () => {
    it('takes the asks for a study file', () => {
        for (const line of [
            'make a resource study content for Mathew 3:3-7',
            'make a resource file for John 3:16',
            'save to the resource file',
            'Create a study guide on Romans 8',
            'write a study of Psalm 23',
            'make a markdown file for Luke 15',
        ]) {
            expect(readStudyFileAsk(line)).toBe(true);
        }
    });

    it('leaves a note, a how-to, a folder and plain questions alone', () => {
        for (const line of [
            'make a note for John 3:16',
            'make a study note on John 3:16',
            'How do I make a resource file?',
            'where are the resources?',
            'create a resources folder',
            'what does John 3:16 mean',
            'John 3:16',
            '/verse John 3:16',
            '',
        ]) {
            expect(readStudyFileAsk(line)).toBe(false);
        }
    });
});

describe('toStudyAsk', () => {
    it('names the file language only when it is not English', () => {
        expect(toStudyAsk('make a study', null)).toBe(
            'make a study\n\n(They ask for a study file.)',
        );
        expect(toStudyAsk('make a study', 'Xxlang')).toContain(
            'every word of it -- in Xxlang.)',
        );
    });
});

// "Save that as a study file" (EC-466): the answer that was read, not a
// study written again.
const LONG_ANSWER =
    'John 3:16 tells why Jesus came: God so loved the world that he gave ' +
    'his only Son, so that whoever believes in him has eternal life.';

function botMessage(
    id: number,
    text: string,
    extra: Partial<ChatMessageType> = {},
): ChatMessageType {
    return { id, author: 'bot', text, ...extra };
}

describe('findStudyAnswerAbove', () => {
    it('is the newest answer of the tab, as it was read', () => {
        const older = `${LONG_ANSWER} (older)`;
        expect(
            findStudyAnswerAbove([
                { id: 1, author: 'you', text: 'Explain John 3:16' },
                botMessage(2, older),
                { id: 3, author: 'you', text: 'And again?' },
                botMessage(4, `  ${LONG_ANSWER}\n`),
            ]),
        ).toBe(LONG_ANSWER);
    });

    it("steps over a study card, the window's follow-up and a short line", () => {
        const card = botMessage(3, `${LONG_ANSWER} -- drafted`, {
            actions: [
                {
                    label: 'Create "JHN.3.16 Love.md"',
                    toolName: STUDY_CREATE_TOOL_NAME,
                    args: { reference: 'study-1' },
                },
            ],
        });
        expect(
            findStudyAnswerAbove([
                botMessage(1, LONG_ANSWER),
                { id: 2, author: 'you', text: 'save it as a study file' },
                card,
                botMessage(4, `${LONG_ANSWER} -- what was wrong?`, {
                    isFollowUp: true,
                }),
                botMessage(5, 'You are welcome!'),
            ]),
        ).toBe(LONG_ANSWER);
    });

    it('is null when the tab holds no answer worth keeping', () => {
        expect(findStudyAnswerAbove([])).toBeNull();
        expect(
            findStudyAnswerAbove([
                { id: 1, author: 'you', text: LONG_ANSWER },
                botMessage(2, 'Which passage?'),
            ]),
        ).toBeNull();
    });

    it("reads a Retry's answer above the question it asks again", () => {
        const retried = `${LONG_ANSWER} -- the answer being retried`;
        const messages: ChatMessageType[] = [
            botMessage(1, LONG_ANSWER),
            { id: 2, author: 'you', text: 'save that as a study file' },
            botMessage(3, retried),
        ];
        expect(findStudyAnswerAbove(messages)).toBe(retried);
        expect(findStudyAnswerAbove(messages, { beforeId: 2 })).toBe(
            LONG_ANSWER,
        );
        // An id no longer in the tab reads the whole tab.
        expect(findStudyAnswerAbove(messages, { beforeId: 99 })).toBe(retried);
    });

    it('newest only: a study card or a short line there is no answer to keep', () => {
        const card = botMessage(3, `${LONG_ANSWER} -- drafted`, {
            actions: [
                {
                    label: 'Create "JHN.3.16 Love.md"',
                    toolName: STUDY_CREATE_TOOL_NAME,
                    args: { reference: 'study-1' },
                },
            ],
        });
        const isNewestOnly = true;
        expect(
            findStudyAnswerAbove(
                [
                    botMessage(1, LONG_ANSWER),
                    { id: 2, author: 'you', text: 'make a study' },
                    card,
                ],
                { isNewestOnly },
            ),
        ).toBeNull();
        expect(
            findStudyAnswerAbove(
                [botMessage(1, LONG_ANSWER), botMessage(2, 'Glad to help!')],
                { isNewestOnly },
            ),
        ).toBeNull();
        // The window's follow-up to a thumb down is still stepped over.
        expect(
            findStudyAnswerAbove(
                [
                    botMessage(1, LONG_ANSWER),
                    botMessage(2, `${LONG_ANSWER} -- what was wrong?`, {
                        isFollowUp: true,
                    }),
                ],
                { isNewestOnly },
            ),
        ).toBe(LONG_ANSWER);
    });
});

describe('readKeepAnswerAsk', () => {
    it('reads a line that keeps the answer above as a study file', () => {
        for (const line of [
            'save that as a study file',
            'Save this as a study.',
            'keep it as a study file',
            'make that a study file',
            'turn this into a study',
            'put that in a study file',
            'save your answer as a study file',
            'save the answer above as a study',
            'add that to my study',
            'save as a study file',
            'Can you save that as a study file?',
            'please save this to my resources',
            'save it as a markdown file',
            'copy what you said into a study file',
        ]) {
            expect(readKeepAnswerAsk(line), line).toBe(true);
        }
    });

    it('leaves a new study, a how-to and a line asking more to the model', () => {
        for (const line of [
            'make a study file for John 3:16',
            'make a study file about this passage',
            'make a study on it',
            'make a study file that explains John 3',
            'make a study file for John 3:16 like that',
            'save that as a study file and add a diagram',
            'save that as a study file with questions',
            'translate that into a study file',
            'how do I save this as a study file?',
            'can I save that as a study file',
            'save that as a note',
            'save that study',
            'keep this',
            '/study that',
            '',
            `save that as a study file ${'please '.repeat(20)}`,
        ]) {
            expect(readKeepAnswerAsk(line), line).toBe(false);
        }
    });

    it('is said on the ask with the marker the window reads', () => {
        expect(STUDY_KEEP_ANSWER_HINT).toContain('`content` "@answer"');
        expect(STUDY_KEEP_ANSWER_HINT).toContain('`append` "@answer"');
    });
});

describe('toKeptAnswerDraftArgs', () => {
    const answer = `# God So Loved\n\n${LONG_ANSWER}\n\nWould you like me to say more?`;

    it("puts the answer in a new study's place of whatever the model wrote", () => {
        expect(
            toKeptAnswerDraftArgs(
                {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    bible: 'KJV',
                    content: '## Background\n\nA study of its own.',
                    section: 'Background',
                },
                answer,
            ),
        ).toEqual({
            action: 'draft',
            ref: 'John 3:16',
            title: 'God So Loved',
            bible: 'KJV',
            content: LONG_ANSWER,
        });
    });

    it('adds it to a study file being changed, never as its whole text', () => {
        expect(
            toKeptAnswerDraftArgs(
                {
                    action: 'draft',
                    file: 'JHN.3.16 Love.md',
                    content: 'The whole study written again.',
                },
                answer,
            ),
        ).toEqual({
            action: 'draft',
            file: 'JHN.3.16 Love.md',
            append: LONG_ANSWER,
        });
        expect(
            toKeptAnswerDraftArgs(
                {
                    action: 'draft',
                    file: 'JHN.3.16 Love.md',
                    section: 'Questions',
                    append: 'Words of its own.',
                },
                answer,
            ),
        ).toEqual({
            action: 'draft',
            file: 'JHN.3.16 Love.md',
            section: 'Questions',
            append: LONG_ANSWER,
        });
    });
});

describe('pickKeptAnswerLanguage', () => {
    // Opaque to it: the language the line asking to keep was typed in.
    const TYPED = 'typed-language';

    it("is the answer's own, whatever the keep line was typed in", () => {
        expect(pickKeptAnswerLanguage(LONG_ANSWER, TYPED, 'en')).toBe('en');
    });

    it("is the typed line's when the answer's cannot be told", () => {
        expect(pickKeptAnswerLanguage('1. 2. 3.', TYPED, 'en')).toBe(TYPED);
        // Runic: a script no language here claims.
        const runic = String.fromCodePoint(0x16a0, 0x16a2, 0x16a6, 0x16b1);
        expect(
            pickKeptAnswerLanguage(`${runic} ${runic} ${runic}`, TYPED, 'en'),
        ).toBe(TYPED);
    });
});

describe('checkIsStudyAnswerMarker', () => {
    it('reads @answer however it is quoted or cased', () => {
        for (const value of [
            '@answer',
            ' "@answer" ',
            '`@Answer`',
            "'@ANSWER'",
        ]) {
            expect(checkIsStudyAnswerMarker(value)).toBe(true);
        }
        for (const value of ['@answer above', 'answer', '', null, 3]) {
            expect(checkIsStudyAnswerMarker(value)).toBe(false);
        }
    });

    it('is named in every prompt a study is drafted under', () => {
        for (const prompt of [STUDY_SYSTEM_PROMPT, STUDY_FILE_PROMPT]) {
            expect(prompt).toContain('put exactly "@answer" as `content`');
        }
    });
});

describe('toStudyContentFromAnswer', () => {
    it('leaves the title to the file and keeps one # title in it', () => {
        expect(
            toStudyContentFromAnswer(
                '# God So Loved\r\n\r\nWords.\r\n\r\n# Born again\r\n\r\nMore.',
            ),
        ).toBe('Words.\n\n## Born again\n\nMore.');
    });

    it('never touches a # inside a code block or a deeper heading', () => {
        const kept =
            'Words.\n\n```mermaid\nflowchart TD\n# a comment\n```\n\n## Kept';
        expect(toStudyContentFromAnswer(kept)).toBe(kept);
    });

    it('takes off the offer the answer ended on, and nothing else', () => {
        expect(
            toStudyContentFromAnswer(
                `${LONG_ANSWER}\n\nWould you like me to draw a timeline of it?\n`,
            ),
        ).toBe(LONG_ANSWER);
        expect(
            toStudyContentFromAnswer(
                `${LONG_ANSWER}\n\nLet me know if you want more.`,
            ),
        ).toBe(LONG_ANSWER);
        // A question of the study's own stays, and so does one alone.
        const asked = `${LONG_ANSWER}\n\nDo you believe it today?`;
        expect(toStudyContentFromAnswer(asked)).toBe(asked);
        expect(toStudyContentFromAnswer('Would you like me to say more?')).toBe(
            'Would you like me to say more?',
        );
    });
});

// EC-499: asked to fix a study's references, gemma4:cloud drafted the whole
// study with no `file` and no `ref`, four times, every one refused as a new
// study with no passage -- and said the references were fixed.
describe('the study a tab has open', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const HELD_CONTENT = [
        '# The New Birth',
        '',
        '## Cross References',
        '',
        '- Numbers 21:8-9 (the bronze serpent)',
        '',
        '## Questions',
        '',
        '1. Who came by night?',
        '',
    ].join('\n');
    const HELD = {
        name: 'JHN.3.The New Birth.md',
        nameTaken: null,
        isChange: true,
        file: OPEN,
        hash: 'h-1',
        passage: '',
        bible: '',
        diagramCount: 0,
        change: 'It changes “Cross References” (1 line(s) in, 1 out).',
        content: HELD_CONTENT,
        raw: null,
    };

    it('finds the Markdown files of the Default folder alone', () => {
        expect(
            findOpenStudyFiles([
                'pdf/JHN.3.pdf',
                OPEN,
                'default/Other.MD',
                'Default/notes/Deep.md',
                'Default/Plain.txt',
                'Media/Default/X.md',
            ]),
        ).toEqual([OPEN, 'default/Other.MD']);
        expect(findOpenStudyFiles([])).toEqual([]);
    });

    it('sends a part named with no file to the one study open', () => {
        expect(
            routeOpenStudyDraft(
                { action: 'draft', section: 'Questions', content: '1. Who?' },
                [OPEN],
            ),
        ).toEqual({
            args: {
                action: 'draft',
                section: 'Questions',
                content: '1. Who?',
                file: OPEN,
            },
        });
        expect(
            routeOpenStudyDraft({ action: 'draft', append: 'More.' }, [OPEN]),
        ).toEqual({ args: { action: 'draft', append: 'More.', file: OPEN } });
    });

    it('refuses the whole study written again, and a part while two are open', () => {
        expect(
            routeOpenStudyDraft({ action: 'draft', content: '# All of it' }, [
                OPEN,
            ]),
        ).toEqual({ isRefused: true });
        expect(
            routeOpenStudyDraft(
                { action: 'draft', section: 'Questions', content: '1. Who?' },
                [OPEN, 'Default/Other.md'],
            ),
        ).toEqual({ isRefused: true });
    });

    it('leaves a call naming a file or a passage, and a tab with no study open', () => {
        expect(
            routeOpenStudyDraft({ action: 'draft', file: OPEN, content: 'x' }, [
                OPEN,
            ]),
        ).toBeNull();
        expect(
            routeOpenStudyDraft(
                { action: 'draft', ref: 'John 3', title: 'New', content: 'x' },
                [OPEN],
            ),
        ).toBeNull();
        expect(
            routeOpenStudyDraft({ action: 'draft', content: 'x' }, []),
        ).toBeNull();
    });

    it('says the call to make: the file, a part at a time, and the headings', () => {
        const refusal = genOpenStudyDraftRefusal(
            [OPEN],
            '# The New Birth\n## Cross References',
        );
        expect(refusal).toContain(`\`file\` "${OPEN}"`);
        expect(refusal).toContain('`section` (one of its headings');
        expect(refusal).toContain('never say it was changed or fixed');
        expect(refusal).toContain('A NEW study needs `ref`');
        expect(refusal).toMatch(
            /Its headings:\n# The New Birth\n## Cross References$/,
        );
        expect(genOpenStudyDraftRefusal([OPEN, 'Default/Other.md'])).toContain(
            `"${OPEN}" or "Default/Other.md"`,
        );
        expect(genOpenStudyDraftRefusal([OPEN])).not.toContain('Its headings');
    });

    it("takes the headings off a read: a long file's list, else the text's own", () => {
        expect(
            toStudyReadOutline(
                JSON.stringify({
                    file: OPEN,
                    kind: 'text',
                    text: '# The New Birth',
                    note:
                        'Only the start of it is here: it is 44021 ' +
                        'characters. Its headings:\n# The New Birth\n## Khmer',
                }),
            ),
        ).toBe('# The New Birth\n## Khmer');
        expect(
            toStudyReadOutline(
                JSON.stringify({
                    file: OPEN,
                    kind: 'text',
                    text: HELD_CONTENT,
                }),
            ),
        ).toBe('# The New Birth\n## Cross References\n## Questions');
        expect(toStudyReadOutline('Tool refused: no such file')).toBe('');
        expect(toStudyReadOutline(JSON.stringify({ files: [] }))).toBe('');
    });

    it('puts a second part on top of the change already held, by its name alone too', () => {
        const chained = chainStudyPartEdit(
            {
                action: 'draft',
                file: 'JHN.3.The New Birth.md',
                section: 'Questions',
                content: '1. Who came to Jesus by night?',
            },
            HELD,
        );
        expect(chained).not.toBeNull();
        const { args } = chained as { args: any };
        expect(Object.keys(args).sort()).toEqual(['action', 'content', 'file']);
        expect(args.file).toBe(OPEN);
        // The held change's own words stay; the part is the new one.
        expect(args.content).toContain('- Numbers 21:8-9 (the bronze serpent)');
        expect(args.content).toContain('1. Who came to Jesus by night?');
        expect(args.content).not.toContain('1. Who came by night?');
        const appended = chainStudyPartEdit(
            { action: 'draft', file: OPEN, append: 'Read John 3 again.' },
            HELD,
        ) as { args: any };
        expect(appended.args.content).toContain('1. Who came by night?');
        expect(appended.args.content.trimEnd()).toMatch(/Read John 3 again\.$/);
    });

    it('says why when the held change has no such part', () => {
        const chained = chainStudyPartEdit(
            {
                action: 'draft',
                file: OPEN,
                section: 'Application',
                content: 'Live it.',
            },
            HELD,
        );
        expect(chained).toEqual({
            reason: expect.stringContaining(
                'The file has no section “Application”. Its headings:',
            ),
        });
    });

    it('leaves the whole text, another file, a new study and nothing held', () => {
        const part = {
            action: 'draft',
            file: OPEN,
            section: 'Questions',
            content: '1. Who?',
        };
        expect(
            chainStudyPartEdit(
                { action: 'draft', file: OPEN, content: '# All of it' },
                HELD,
            ),
        ).toBeNull();
        expect(
            chainStudyPartEdit({ ...part, file: 'Default/Other.md' }, HELD),
        ).toBeNull();
        expect(
            chainStudyPartEdit(part, { ...HELD, isChange: false, file: null }),
        ).toBeNull();
        expect(chainStudyPartEdit(part, null)).toBeNull();
    });

    it('hands a claimed change back with the file to draft it in', () => {
        const nudge = genStudyClaimNudge([OPEN]);
        expect(nudge).toMatch(/^Not yet: nothing in the study file changed/);
        expect(nudge).toContain(`\`file\` "${OPEN}"`);
        expect(nudge).toContain('say so plainly');
    });
});
