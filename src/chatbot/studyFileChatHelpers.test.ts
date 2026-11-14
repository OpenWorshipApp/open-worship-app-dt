import { describe, expect, it } from 'vitest';

import type { ChatMessageType } from './chatSessionHelpers';
import {
    NOTE_TEXT_MAX_CHARS,
    STUDY_CHANGE_HELD_NOTE,
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_EMPTY_REASON,
    STUDY_HELD_MARKDOWN_NOTE,
    STUDY_HELD_NOTE,
    STUDY_HELD_PASSAGE_REASON,
    STUDY_KEEP_ANSWER_HINT,
    STUDY_KEPT_ANSWER_CHANGE_NOTE,
    STUDY_KEPT_ANSWER_HELD_MARKDOWN_NOTE,
    STUDY_KEPT_ANSWER_HELD_NOTE,
    STUDY_KEPT_ANSWER_NOTE,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
    STUDY_SYSTEM_PROMPT,
    chainHeldNewStudyEdit,
    chainStudyPartEdit,
    checkHasStudyReplace,
    checkIsStudyAnswerMarker,
    checkIsStudyNotePress,
    checkIsStudyPartShown,
    checkIsWholeStudyRewrite,
    clearStudyRenameWait,
    dropStudyCardEchoReplies,
    findHeldStudyAbove,
    findHeldStudyToTranslate,
    findOpenStudyFileName,
    findOpenStudyFiles,
    findStudyAnswerAbove,
    findStudyAnswerQuestion,
    genHeldStudyAskHint,
    genHeldStudyBeforeActions,
    genHeldStudyCopyRefusal,
    genHeldStudyKeepHint,
    genHeldStudyTranslatedNote,
    genHeldStudyWholeRefusal,
    genOpenStudyDraftRefusal,
    genStudyClaimNudge,
    genStudyDraftActions,
    genStudyLanguageHint,
    genStudyReplaceDiagramRefusal,
    genStudyReportRefusal,
    genUnreadStudyPartRefusal,
    keepDraftedStudy,
    listWrittenDiagramIndexes,
    pickKeptAnswerLanguage,
    pinOpenStudyFile,
    readDraftedStudy,
    readHeldNewStudy,
    readKeepAnswerAsk,
    readStudyCreatePlace,
    readStudyFileAsk,
    readStudyHalfLanguages,
    readStudyReplacedDiagrams,
    redraftHeldNewStudy,
    routeOpenStudyDraft,
    routeWholeStudyRewrite,
    setStudyRenameWait,
    takeDraftedStudy,
    takeStudyRenameWait,
    toAskedStudyBlocks,
    toHeldStudyBefore,
    toHeldStudyTranslateDraftArgs,
    toHeldStudyTranslatePlanArgs,
    toKeptAnswerDraftArgs,
    toKeptAnswerHeading,
    toModelDraftText,
    toNoteFromStudy,
    toReadStudyBlock,
    toStudyArgsFromNote,
    toStudyAsk,
    toStudyContentFromAnswer,
    toStudyPartDraft,
    toStudyReadShape,
    toStudyReplaceArgs,
    withHeldStudyTool,
} from './studyFileChatHelpers';
import { genTextAttachment, toAskedOfModel } from './attachmentHelpers';
import { RESOURCES_TOOL_NAME } from './resourcesChatHelpers';
import { STUDY_FILE_PROMPT } from './noteCreatePromptHelpers';
import { describeStudyReplaceRepair } from './studyNameCheckHelpers';
import {
    STUDY_REMOVE_ALONE_REASON,
    composeStudyFile,
    describeStudyKeptParts,
    lintStudyContent,
    splitStudyFooter,
    splitStudyTranslations,
} from '../helper/agentStudyFileRules';

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

    // EC-581: the card asks Bible note or Markdown file; pressed for a
    // Markdown file, it asks only where.
    it('names the choice of a Bible note or a Markdown file, unless a file was pressed for', () => {
        const shown = JSON.parse(
            toModelDraftText(JSON.stringify(DRAFT_RESULT)),
        );
        expect(shown.note).toContain('New Bible Note');
        expect(shown.note).toContain('a Bible note or a Markdown file');
        const pressed = JSON.parse(
            toModelDraftText(JSON.stringify(DRAFT_RESULT), false, '', true),
        );
        expect(pressed.note).toBe(STUDY_HELD_MARKDOWN_NOTE);
        expect(pressed.note).not.toContain('New Bible Note');
        expect(pressed.note).toContain('Create where they want it kept');
        // A change has one button whatever was pressed.
        const changed = JSON.parse(
            toModelDraftText(
                JSON.stringify({ ...DRAFT_RESULT, isChange: true }),
                false,
                '',
                true,
            ),
        );
        expect(changed.note).toBe(STUDY_CHANGE_HELD_NOTE);
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

    // EC-509, the user: _when create markdown file for user make sure ask
    // user into resource or bible-note area_. And first what it is kept AS
    // (EC-581, the user: _whenever creating bible-note or resource study
    // file should always let user choose between bible-note or markdown
    // file_).
    it('asks what a new study is kept as, and where: a Bible note, or a file in Resources or Bible Notes', () => {
        const kept = keepDraftedStudy({ ...base, nameTaken: null });
        const { reference } = kept;
        expect(
            genStudyDraftActions(kept).map((action) => {
                return [action.label, action.toolName, action.args];
            }),
        ).toEqual([
            [
                'New Bible Note',
                STUDY_CREATE_TOOL_NAME,
                { reference, to: 'note' },
            ],
            [
                'Create "MAT.3.3-7 The Voice.md" in Resources',
                STUDY_CREATE_TOOL_NAME,
                { reference, to: 'resources' },
            ],
            [
                'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
                STUDY_CREATE_TOOL_NAME,
                { reference, to: 'bible-notes' },
            ],
            ['Preview', STUDY_PREVIEW_TOOL_NAME, { reference }],
            ['Change the name', STUDY_RENAME_TOOL_NAME, { reference }],
        ]);
    });

    it('asks Bible Notes for the name Resources had taken', () => {
        const kept = keepDraftedStudy({
            ...base,
            name: 'MAT.3.3-7 The Voice (1).md',
            nameTaken: 'MAT.3.3-7 The Voice.md',
        });
        expect(
            genStudyDraftActions(kept)
                .slice(1, 3)
                .map((action) => action.label),
        ).toEqual([
            'Create "MAT.3.3-7 The Voice (1).md" in Resources',
            'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
        ]);
    });

    // EC-581, the user: _but if user click and choose step by step
    // explicitely it should skip the confirmation_.
    it('offers no Bible note once a Markdown file was pressed for', () => {
        const kept = keepDraftedStudy({
            ...base,
            nameTaken: null,
            isMarkdownOnly: true,
        });
        expect(
            genStudyDraftActions(kept).map((action) => action.label),
        ).toEqual([
            'Create "MAT.3.3-7 The Voice.md" in Resources',
            'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
            'Preview',
            'Change the name',
        ]);
    });

    it('offers no Bible note for words longer than a note holds', () => {
        const raw = base.raw;
        if (raw === null) {
            throw new Error('no raw draft');
        }
        const kept = keepDraftedStudy({
            ...base,
            raw: { ...raw, content: 'x'.repeat(NOTE_TEXT_MAX_CHARS) },
        });
        expect(genStudyDraftActions(kept)[0].label).toBe(
            'Create "MAT.3.3-7 The Voice.md" in Resources',
        );
    });

    it('tells a New Bible Note press from a Create press', () => {
        expect(checkIsStudyNotePress({ reference: 's', to: 'note' })).toBe(
            true,
        );
        expect(checkIsStudyNotePress({ to: 'bible-notes' })).toBe(false);
        expect(checkIsStudyNotePress({ to: 'resources' })).toBe(false);
        expect(checkIsStudyNotePress({ reference: 's' })).toBe(false);
        expect(checkIsStudyNotePress(undefined)).toBe(false);
    });

    it('reads where a Create press keeps the study', () => {
        expect(readStudyCreatePlace({ to: 'bible-notes' })).toBe('bible-notes');
        expect(readStudyCreatePlace({ to: 'resources' })).toBe('resources');
        // A card saved before the choice, its press carrying no `to`.
        expect(readStudyCreatePlace({ reference: 'study-1' })).toBe(
            'resources',
        );
        expect(readStudyCreatePlace(undefined)).toBe('resources');
        expect(readStudyCreatePlace({ to: 'desktop' })).toBe('resources');
    });

    it('offers Save changes and Preview for a change, no rename', () => {
        const kept = keepDraftedStudy({ ...base, isChange: true, raw: null });
        expect(
            genStudyDraftActions(kept).map((action) => action.label),
        ).toEqual(['Save changes to "MAT.3.3-7 The Voice.md"', 'Preview']);
    });
});

// EC-705, seen live under a kept answer: the model's Create in Resources and
// Create in Bible Notes beside the card's own two Create buttons.
describe('dropStudyCardEchoReplies', () => {
    const base = readDraftedStudy(JSON.stringify(DRAFT_RESULT), DRAFT_ARGS);
    if (base === null) {
        throw new Error('no draft');
    }
    const newCard = genStudyDraftActions(
        keepDraftedStudy({ ...base, nameTaken: null }),
    );
    const changeCard = genStudyDraftActions(
        keepDraftedStudy({ ...base, isChange: true, raw: null }),
    );
    const ASKED_CHANGES = [
        'Add a prayer at the end',
        'Make the title shorter',
        'Add this to the study',
        'Create a mindmap of the story',
        'Change the name to Born of the Spirit',
        'Rename it to "Born of the Spirit"',
        'What does verse 5 mean?',
    ];

    it('drops an option that says one of the card buttons again', () => {
        const echoes = [
            'Create in Resources',
            'Create in Bible Notes',
            'create in resources.',
            'Save it to Resources',
            'Save the study in my Resources folder',
            'Keep it as a Bible note',
            'Yes, create it',
            'Create',
            'Save',
            'New Bible Note',
            'Make it a Bible note',
            'Preview',
            'Preview the study',
            'Change the study name',
            'Change the name',
            'Rename it',
        ];
        expect(
            dropStudyCardEchoReplies([...echoes, ...ASKED_CHANGES], newCard),
        ).toEqual(ASKED_CHANGES);
    });

    it('drops Save changes said again under a change card', () => {
        expect(
            dropStudyCardEchoReplies(
                [
                    'Save changes',
                    'Save the changes',
                    'Save changes to the study',
                    'Preview the changes',
                    ...ASKED_CHANGES,
                ],
                changeCard,
            ),
        ).toEqual(ASKED_CHANGES);
    });

    it('reads the card as drawn, in the window language too', () => {
        // Made-up words: a language that spaces its words, and one that
        // writes them together.
        const shown = new Map([
            [
                'Create "MAT.3.3-7 The Voice.md" in Resources',
                'Zork “MAT.3.3-7 The Voice.md” vlim Resourka',
            ],
            [
                'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
                'Zork "MAT.3.3-7 The Voice.md" vlimnotaka',
            ],
        ]);
        expect(
            dropStudyCardEchoReplies(
                ['Zork vlim Resourka', 'Zorkvlimnotaka', 'Zork vlim Bibla'],
                newCard,
                (action) => shown.get(action.label) ?? action.label,
            ),
        ).toEqual(['Zork vlim Bibla']);
    });

    it('drops nothing with no study card under the answer', () => {
        const replies = ['Create in Resources', 'Preview', 'Rename it'];
        expect(
            dropStudyCardEchoReplies(replies, [
                { label: 'Undo this change', toolName: 'owa_undo' },
            ]),
        ).toEqual(replies);
        expect(dropStudyCardEchoReplies(replies, [])).toEqual(replies);
    });
});

// EC-581: what the model drafted, kept as the kind the person chooses.
describe('toNoteFromStudy', () => {
    const raw = {
        ref: 'Matthew 3:3-7',
        title: 'The Voice',
        content: [
            '# The Voice',
            '',
            '[^Matthew 3:3-7]',
            '',
            '## Who he was',
            '',
            'John came preaching [^Matthew 3:1].',
            '',
            '```mermaid',
            'flowchart TD',
            '  A["Voice"] --> B["Way"]',
            '```',
            '',
            '## Questions',
            '',
            '- What does the voice ask?',
        ].join('\n'),
        bible: null,
    };
    const noteText = [
        '[^(KJV) Matthew 3:3-7]',
        '',
        '## Who he was',
        '',
        'John came preaching [^Matthew 3:1].',
        '',
        '## Questions',
        '',
        '- What does the voice ask?',
    ].join('\n');

    it('puts the passage first, keeps the words and their verses, and counts the diagrams it leaves out', () => {
        expect(toNoteFromStudy({ isChange: false, raw, bible: 'KJV' })).toEqual(
            { title: 'The Voice', text: noteText, diagramCount: 1 },
        );
    });

    it('names no Bible when the draft has none', () => {
        expect(
            toNoteFromStudy({
                isChange: false,
                raw: { ...raw, content: 'Words.' },
                bible: '',
            }),
        ).toEqual({
            title: 'The Voice',
            text: '[^Matthew 3:3-7]\n\nWords.',
            diagramCount: 0,
        });
    });

    it('is the note the model wrote when the draft is its twin', () => {
        const note = { title: 'Sunday', text: 'Words.', file: 'Youth' };
        expect(
            toNoteFromStudy({ isChange: false, raw, bible: 'KJV', note }),
        ).toEqual({ ...note, diagramCount: 0 });
    });

    it('makes no note of a change, a draft with nothing kept, or words a note cannot hold', () => {
        expect(toNoteFromStudy({ isChange: true, raw, bible: 'KJV' })).toBe(
            null,
        );
        expect(
            toNoteFromStudy({ isChange: false, raw: null, bible: 'KJV' }),
        ).toBe(null);
        expect(
            toNoteFromStudy({
                isChange: false,
                raw: { ...raw, content: 'x'.repeat(NOTE_TEXT_MAX_CHARS) },
                bible: 'KJV',
            }),
        ).toBe(null);
    });

    it('is drafted back as the same passage and words', () => {
        const note = toNoteFromStudy({ isChange: false, raw, bible: 'KJV' });
        if (note === null) {
            throw new Error('no note');
        }
        expect(toStudyArgsFromNote(note)).toEqual({
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: noteText.split('\n').slice(2).join('\n'),
            bible: 'KJV',
        });
    });
});

describe('toStudyArgsFromNote', () => {
    it('takes the passage alone on its line as the ref, with its Bible, and leaves out the title line', () => {
        expect(
            toStudyArgsFromNote({
                title: 'The Voice',
                text: [
                    '# The Voice',
                    '',
                    '[^(KJV) Matthew 3:3-7]',
                    '',
                    'John came preaching [^Matthew 3:1].',
                ].join('\n'),
            }),
        ).toEqual({
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: 'John came preaching [^Matthew 3:1].',
            bible: 'KJV',
        });
    });

    it('takes the first verse named in a line when none stands alone, and keeps every line', () => {
        const text =
            'Saved by grace [^Ephesians 2:8-9], not by works.\n\n- Thank him';
        expect(toStudyArgsFromNote({ title: 'Grace', text })).toEqual({
            ref: 'Ephesians 2:8-9',
            title: 'Grace',
            content: text,
        });
    });

    it('makes a title a file name can take', () => {
        expect(
            toStudyArgsFromNote({
                title: 'Grace: "Saved" by Faith?',
                text: '[^Ephesians 2:8]\n\nWords.',
            })?.title,
        ).toBe('Grace Saved by Faith');
        expect(
            toStudyArgsFromNote({
                title:
                    'A very long title that runs well past what a study ' +
                    'file name may hold in its characters',
                text: '[^Ephesians 2:8]\n\nWords.',
            })?.title,
        ).toBe('A very long title that runs');
    });

    it('is null for a note that names no passage, or holds nothing but it', () => {
        expect(
            toStudyArgsFromNote({
                title: 'Prayer',
                text: 'Pray for the sick.',
            }),
        ).toBe(null);
        expect(
            toStudyArgsFromNote({ title: 'John 3', text: '[^John 3:16]' }),
        ).toBe(null);
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

    // EC-702: the guide's words under a failure are not theirs to keep.
    it('never keeps what stood for a failed ask, and newest, keeps nothing for it', () => {
        const messages: ChatMessageType[] = [
            botMessage(1, LONG_ANSWER),
            { id: 2, author: 'you', text: 'make it simpler' },
            botMessage(3, `${LONG_ANSWER} -- the guide's stand-in`, {
                note: 'Free could not answer — the service is busy.',
                isAskFailed: true,
            }),
        ];
        expect(findStudyAnswerAbove(messages)).toBe(LONG_ANSWER);
        // "That" may mean the answer above it as well.
        expect(
            findStudyAnswerAbove(messages, { isNewestOnly: true }),
        ).toBeNull();
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
            // Its own title, a level down, heads it at the end (EC-704).
            append: `## God So Loved\n\n${LONG_ANSWER}`,
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

    // EC-704: seen live, an answer on what "begotten" means added to a
    // John 3:16 study read as one more paragraph of its last part.
    it('heads an answer added at the end with the question it answered', () => {
        const file = 'JHN.3.16 Love.md';
        expect(
            toKeptAnswerDraftArgs(
                { action: 'draft', file, append: '@answer' },
                LONG_ANSWER,
                'what does the word begotten mean in this verse?',
            ),
        ).toEqual({
            action: 'draft',
            file,
            append:
                '## What does the word begotten mean in this verse?\n\n' +
                LONG_ANSWER,
        });
        // Into a part they named, a new study, or no question: as it was.
        expect(
            toKeptAnswerDraftArgs(
                { action: 'draft', file, section: 'Questions' },
                LONG_ANSWER,
                'what does the word begotten mean in this verse?',
            ).append,
        ).toBe(LONG_ANSWER);
        expect(
            toKeptAnswerDraftArgs(
                { action: 'draft', ref: 'John 3:16', title: 'Love' },
                LONG_ANSWER,
                'what does the word begotten mean in this verse?',
            ),
        ).toEqual({
            action: 'draft',
            ref: 'John 3:16',
            title: 'Love',
            content: LONG_ANSWER,
        });
        expect(
            toKeptAnswerDraftArgs({ action: 'draft', file }, LONG_ANSWER)
                .append,
        ).toBe(LONG_ANSWER);
    });

    it('takes the heading the answer has, then its title, then the question', () => {
        const headed = `## Background\n\n${LONG_ANSWER}`;
        expect(toKeptAnswerHeading(headed, headed, 'why did he come?')).toBe(
            null,
        );
        expect(
            toKeptAnswerHeading(
                `# God So Loved\n\n${LONG_ANSWER}`,
                LONG_ANSWER,
                'why did he come?',
            ),
        ).toBe('God So Loved');
        expect(
            toKeptAnswerHeading(LONG_ANSWER, LONG_ANSWER, 'why did he come?'),
        ).toBe('Why did he come?');
        // The study's own title again at its end says nothing: the
        // question heads it, or nothing does.
        const ownFile = 'Default/JHN.3.16 God So Loved (1).md';
        const titled = `# God So Loved\n\n${LONG_ANSWER}`;
        expect(
            toKeptAnswerHeading(
                titled,
                LONG_ANSWER,
                'why did he come?',
                ownFile,
            ),
        ).toBe('Why did he come?');
        expect(
            toKeptAnswerHeading(titled, LONG_ANSWER, null, ownFile),
        ).toBeNull();
        expect(
            toKeptAnswerHeading(
                titled,
                LONG_ANSWER,
                null,
                'Default/JHN.3.The New Birth.md',
            ),
        ).toBe('God So Loved');
    });

    it('reads the line they typed: a /btw taken off, a reply after its quote, marks out', () => {
        const read = (question: string | null) => {
            return toKeptAnswerHeading(LONG_ANSWER, LONG_ANSWER, question);
        };
        expect(read('/btw what is grace in this verse?')).toBe(
            'What is grace in this verse?',
        );
        expect(read('**Who** was Nicodemus?\nAnd why at night?')).toBe(
            'Who was Nicodemus?',
        );
        expect(
            read(
                'Replying to your answer:\n> God so loved the world.\n' +
                    'what does world mean here?',
            ),
        ).toBe('What does world mean here?');
        // The quote goes under what the box held: the words above it.
        expect(
            read(
                'what does world mean here?\nReplying to your answer:\n' +
                    '> God so loved the world.',
            ),
        ).toBe('What does world mean here?');
        // Nothing typed beside the quote: its frame is no heading.
        expect(
            read('Replying to your answer:\n> God so loved the world.'),
        ).toBeNull();
        // Too short, too long, a command, nothing: no heading.
        expect(read('why?')).toBeNull();
        expect(read(`why ${'and why '.repeat(20)}?`)).toBeNull();
        expect(read('/clear the screen please')).toBeNull();
        expect(read(null)).toBeNull();
        expect(read('')).toBeNull();
    });
});

describe('findStudyAnswerQuestion', () => {
    it('is the line of theirs right above the answer a keep finds', () => {
        const messages: ChatMessageType[] = [
            { id: 1, author: 'you', text: 'Make a study of John 3:16' },
            botMessage(2, `${LONG_ANSWER} -- drafted`, {
                actions: [
                    {
                        label: 'Create "JHN.3.16 Love.md"',
                        toolName: STUDY_CREATE_TOOL_NAME,
                        args: { reference: 'study-1' },
                    },
                ],
            }),
            { id: 3, author: 'you', text: 'What does begotten mean?' },
            botMessage(4, LONG_ANSWER),
            botMessage(5, `${LONG_ANSWER} -- what was wrong?`, {
                isFollowUp: true,
            }),
        ];
        expect(findStudyAnswerQuestion(messages)).toBe(
            'What does begotten mean?',
        );
        // A Retry's: above the question it asks again.
        expect(
            findStudyAnswerQuestion(
                [
                    ...messages,
                    { id: 6, author: 'you', text: 'Why at night?' },
                    botMessage(7, `${LONG_ANSWER} -- night`),
                ],
                { beforeId: 6 },
            ),
        ).toBe('What does begotten mean?');
    });

    it('is null with no answer to keep, or no line of theirs above it', () => {
        expect(findStudyAnswerQuestion([])).toBeNull();
        expect(
            findStudyAnswerQuestion([botMessage(1, LONG_ANSWER)]),
        ).toBeNull();
        expect(
            findStudyAnswerQuestion([
                { id: 1, author: 'you', text: 'Explain it' },
                botMessage(2, 'Which passage?'),
            ]),
        ).toBeNull();
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

    it('finds a study kept in Bible Notes too (EC-509)', () => {
        expect(
            findOpenStudyFiles([
                'Bible Notes/JHN.3.16 Love.md',
                'Bible Notes/Default.own',
                'Bible Notes/old/Deep.md',
                'Notes/JHN.3.16 Love.md',
            ]),
        ).toEqual(['Bible Notes/JHN.3.16 Love.md']);
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
            toStudyReadShape(
                JSON.stringify({
                    file: OPEN,
                    kind: 'text',
                    text: '# The New Birth',
                    note:
                        'Only the start of it is here: it is 44021 ' +
                        'characters. Its headings:\n# The New Birth\n## Khmer',
                }),
            ),
        ).toEqual({
            outline: '# The New Birth\n## Khmer',
            isShownWhole: false,
        });
        expect(
            toStudyReadShape(
                JSON.stringify({
                    file: OPEN,
                    kind: 'text',
                    text: HELD_CONTENT,
                }),
            ),
        ).toEqual({
            outline: '# The New Birth\n## Cross References\n## Questions',
            isShownWhole: true,
        });
        expect(toStudyReadShape('Tool refused: no such file')).toBeNull();
        expect(toStudyReadShape(JSON.stringify({ files: [] }))).toBeNull();
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

// EC-706: the study attached from Bible Notes, a copy of the same name in
// Resources → Default, and `translate` named by the file name alone.
describe('pinOpenStudyFile', () => {
    const NAME = 'PSA.100.Joyful Worship and Belonging.md';
    const NOTES = `Bible Notes/${NAME}`;

    it('names the study the tab has open for its file name alone or the other folder', () => {
        for (const file of [
            NAME,
            NAME.toLowerCase(),
            `Default/${NAME}`,
            `default\\${NAME}`,
        ]) {
            expect(
                pinOpenStudyFile(
                    { action: 'translate', file, language: 'Khmer' },
                    [NOTES],
                ),
            ).toEqual({ action: 'translate', file: NOTES, language: 'Khmer' });
        }
        expect(
            pinOpenStudyFile({ action: 'read', file: NAME }, [
                'pdf/PSA.100.pdf',
                NOTES,
            ]),
        ).toEqual({ action: 'read', file: NOTES });
    });

    it('leaves a call it cannot be sure of as the model wrote it', () => {
        const cases: [any, string[]][] = [
            // Already the open one, in any case.
            [{ file: NOTES }, [NOTES]],
            [{ file: NOTES.toUpperCase() }, [NOTES]],
            // Another study, no file, no study open.
            [{ file: 'Other.md' }, [NOTES]],
            [{ file: '' }, [NOTES]],
            [{ action: 'draft' }, [NOTES]],
            [{ file: NAME }, []],
            // A whole path, and a folder no study is changed in.
            [{ file: `C:\\Users\\data\\resources\\Default\\${NAME}` }, [NOTES]],
            [{ file: `pdf/${NAME}` }, [NOTES]],
            // Both copies open: only the folder says which.
            [{ file: NAME }, [NOTES, `Default/${NAME}`]],
        ];
        for (const [args, openList] of cases) {
            expect(pinOpenStudyFile(args, openList)).toBe(args);
        }
    });

    it('leaves the new study the card holds to its own name', () => {
        const held = {
            name: NAME,
            nameTaken: null,
            isChange: false,
            file: null,
            hash: null,
            passage: 'Psalm 100:1-5',
            bible: 'KJV',
            diagramCount: 0,
            change: null,
            content: '# Joyful Worship and Belonging\n',
            raw: {
                ref: 'Psalm 100:1-5',
                title: 'Joyful Worship and Belonging',
                content: 'Words',
                bible: null,
            },
        };
        const args = { action: 'draft', file: NAME, append: 'More.' };
        expect(pinOpenStudyFile(args, [NOTES], held)).toBe(args);
        // A held CHANGE is no new study: the open one is named.
        expect(
            pinOpenStudyFile(args, [NOTES], {
                ...held,
                isChange: true,
                file: `Default/${NAME}`,
            }),
        ).toEqual({ ...args, file: NOTES });
    });
});

// EC-503: a change parsed every diagram in the file, the person's own too.
describe('listWrittenDiagramIndexes', () => {
    const OWN = '```mermaid\nflowchart TD\n    A["Law"] --> B["Grace"]\n```';
    const OWN_BROKEN = '```mermaid\nflowchart TD\n    A["Law"] -->\n```';
    const WRITTEN = '```mermaid\nmindmap\n  root((Love))\n    Gift\n```';

    it('lists only the diagrams the call writes, by their place in the file', () => {
        const drafted = [
            '# The New Birth',
            '',
            OWN,
            '',
            '## Themes',
            '',
            WRITTEN,
            '',
            '## Old',
            '',
            OWN_BROKEN,
        ].join('\n');
        expect(
            listWrittenDiagramIndexes(
                lintStudyContent(drafted).diagrams,
                `## Themes\n\n${WRITTEN}`,
            ),
        ).toEqual([1]);
    });

    it('lists every diagram of a text written whole, and none of plain words', () => {
        const whole = ['# The New Birth', OWN, WRITTEN].join('\n\n');
        expect(
            listWrittenDiagramIndexes(lintStudyContent(whole).diagrams, whole),
        ).toEqual([0, 1]);
        expect(
            listWrittenDiagramIndexes(
                lintStudyContent(whole).diagrams,
                'A prayer to end with.',
            ),
        ).toEqual([]);
    });
});

// EC-537: words of a study written anew where they stand.
describe('an exact replace in the chat', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const OTHER = '```mermaid\nflowchart TD\n    A["Law"] --> B["Grace"]\n```';
    const PLACES =
        '```mermaid\nflowchart TD\n    A["Aenon"] --> B["Salim"]\n```';
    const HELD_CONTENT = [
        '# The New Birth',
        '',
        '## Setting',
        '',
        'John baptized in Aenon near Salim.',
        '',
        OTHER,
        '',
        PLACES,
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
        diagramCount: 2,
        change: 'It changes “Setting” (1 line(s) in, 1 out).',
        content: HELD_CONTENT,
        raw: null,
    };
    const PAIR = [{ from: 'Aenon', to: 'Enon' }];

    it('is a part of the study: sent to the one open, never a whole rewrite', () => {
        expect(
            routeOpenStudyDraft({ action: 'draft', replace: PAIR }, [OPEN]),
        ).toEqual({ args: { action: 'draft', replace: PAIR, file: OPEN } });
        expect(
            checkIsWholeStudyRewrite({
                action: 'draft',
                file: OPEN,
                replace: PAIR,
            }),
        ).toBe(false);
        expect(checkHasStudyReplace({ replace: PAIR })).toBe(true);
        expect(checkHasStudyReplace({ replace: [] })).toBe(false);
        expect(checkHasStudyReplace({ replace: 'Aenon' })).toBe(false);
    });

    it('reads a list written as JSON text, or one pair alone', () => {
        expect(
            toStudyReplaceArgs({ file: OPEN, replace: JSON.stringify(PAIR) }),
        ).toEqual({ file: OPEN, replace: PAIR });
        expect(toStudyReplaceArgs({ file: OPEN, replace: PAIR[0] })).toEqual({
            file: OPEN,
            replace: PAIR,
        });
        const args = { file: OPEN, replace: PAIR };
        expect(toStudyReplaceArgs(args)).toBe(args);
        const plain = { file: OPEN, append: 'More.' };
        expect(toStudyReplaceArgs(plain)).toBe(plain);
        expect(toStudyReplaceArgs({ replace: 'not a list' })).toEqual({
            replace: 'not a list',
        });
    });

    it('writes the words into the change already held, naming the diagrams they changed', () => {
        const chained = chainStudyPartEdit(
            { action: 'draft', file: 'JHN.3.The New Birth.md', replace: PAIR },
            HELD,
        ) as { args: any; writtenText: string };
        expect(Object.keys(chained.args).sort()).toEqual([
            'action',
            'content',
            'file',
        ]);
        expect(chained.args.file).toBe(OPEN);
        expect(chained.args.content).toBe(
            HELD_CONTENT.replaceAll('Aenon', 'Enon'),
        );
        expect(chained.writtenText).toBe(PLACES.replace('Aenon', 'Enon'));
        // The window parses that diagram alone, never the person's other.
        expect(
            listWrittenDiagramIndexes(
                lintStudyContent(chained.args.content).diagrams,
                chained.writtenText,
            ),
        ).toEqual([1]);
        const wordsOnly = chainStudyPartEdit(
            {
                action: 'draft',
                file: OPEN,
                replace: [{ from: 'baptized', to: 'baptised' }],
            },
            HELD,
        ) as { args: any; writtenText: string };
        expect(wordsOnly.writtenText).toBe('');
    });

    it('says why the held change cannot take the words', () => {
        expect(
            chainStudyPartEdit(
                {
                    action: 'draft',
                    file: OPEN,
                    replace: [{ from: 'Bethany', to: 'Bethel' }],
                },
                HELD,
            ),
        ).toEqual({
            reason: expect.stringContaining(
                'Pair 1: “Bethany” is not in the file',
            ),
        });
        expect(
            chainStudyPartEdit(
                { action: 'draft', file: OPEN, replace: PAIR, append: 'More.' },
                HELD,
            ),
        ).toEqual({
            reason: expect.stringContaining(
                '`replace` writes words anew where they stand',
            ),
        });
    });

    it('reads the diagrams a replace changed off its draft', () => {
        expect(
            readStudyReplacedDiagrams(
                JSON.stringify({
                    drafted: true,
                    diagramsChanged: [0, 2, -1, 1.5, 'x'],
                }),
            ),
        ).toEqual([0, 2]);
        expect(
            readStudyReplacedDiagrams(JSON.stringify({ drafted: true })),
        ).toBeNull();
        expect(readStudyReplacedDiagrams('Tool refused: no')).toBeNull();
    });

    it('refuses a diagram the words broke by its place in the file', () => {
        expect(
            genStudyReplaceDiagramRefusal([
                { index: 1, error: 'Parse error on line 2.' },
            ]),
        ).toBe(
            'Diagram 2 of the file would not draw with these words in it: ' +
                'Parse error on line 2. Nothing is changed: call draft ' +
                'again without the pair that changes it, or with a `to` the ' +
                'diagram can hold.',
        );
    });

    it('keeps an answer whole, never a replace beside it', () => {
        expect(
            toKeptAnswerDraftArgs(
                { action: 'draft', file: OPEN, replace: PAIR },
                `# God So Loved\n\n${LONG_ANSWER}\n\nWould you like me to say more?`,
            ),
        ).toEqual({
            action: 'draft',
            file: OPEN,
            append: `## God So Loved\n\n${LONG_ANSWER}`,
        });
    });

    // EC-541: a pair a model could not tell from its verse, put right by the
    // study's own name check before the held change takes it.
    it('puts a pair right in the held change, and says so', () => {
        const letter = (index: number) => {
            return String.fromCodePoint(0x1000 + index);
        };
        const [SIGN_I, SIGN_II, SIGN_U] = [0x102d, 0x102e, 0x102f].map(
            (code) => {
                return String.fromCodePoint(code);
            },
        );
        const digits = (text: string) => {
            return text.replace(/\d/g, (digit) => {
                return String.fromCodePoint(0x1040 + Number(digit));
            });
        };
        const ZENON = `${letter(0)}${SIGN_I}${letter(1)}${letter(2)}${SIGN_U}`;
        const SLIP = `${letter(0)}${SIGN_II}${letter(1)}${letter(2)}${SIGN_U}`;
        const QALIM = `${letter(3)}${SIGN_U}${letter(4)}${letter(5)}${SIGN_I}`;
        const WORD = `${letter(12)}${letter(13)}`;
        const content = [
            '# The New Birth',
            '',
            '> **John 3:23** (KJV)',
            '>',
            '> **23** And John also was baptizing in Zenon near to Qalim.',
            '',
            '## Places',
            '',
            'They baptized at Zenon near Qalim.',
            '',
            '---',
            '',
            `# ${WORD}`,
            '',
            `> **${WORD} ${digits('3:23')}** (ZB)`,
            '>',
            `> **${digits('23')}** ${WORD} ${ZENON} ${WORD} ${QALIM}.`,
            '',
            `${WORD} ${SLIP} ${QALIM}.`,
            '',
        ].join('\n');
        const held = { ...HELD, content };
        const asked = (pair: { from: string; to: string }) => {
            return chainStudyPartEdit(
                { action: 'draft', file: OPEN, replace: [pair] },
                held,
            ) as { args: any; writtenText: string; noteText: string };
        };
        const written = content.replace(
            `${WORD} ${SLIP} ${QALIM}.`,
            `${WORD} ${ZENON} ${QALIM}.`,
        );
        const turned = asked({ from: ZENON, to: SLIP });
        expect(turned.args.content).toBe(written);
        expect(turned.noteText).toBe(
            describeStudyReplaceRepair([
                {
                    pair: 1,
                    asked: { from: ZENON, to: SLIP },
                    written: { from: SLIP, to: ZENON },
                },
            ]),
        );
        expect(turned.noteText).toContain('The app put pair 1 right');
        // The right call is written the same, with nothing to say.
        const right = asked({ from: SLIP, to: ZENON });
        expect(right.args.content).toBe(written);
        expect(right.noteText).toBe('');
    });

    it('leads what the change does with what was put right, for the model', () => {
        const result = JSON.stringify({
            ...DRAFT_RESULT,
            isChange: true,
            change: 'It writes “B” for “A” (1 place); nothing else changes.',
        });
        expect(
            JSON.parse(
                toModelDraftText(result, false, 'The app put pair 1 right.'),
            ).change,
        ).toBe(
            'The app put pair 1 right. It writes “B” for “A” (1 place); ' +
                'nothing else changes.',
        );
        expect(JSON.parse(toModelDraftText(result, false, '')).change).toBe(
            'It writes “B” for “A” (1 place); nothing else changes.',
        );
    });

    it('is named wherever the model is told how to change a study', () => {
        expect(genOpenStudyDraftRefusal([OPEN])).toContain(
            '`replace` (each `from` as the file writes it, and its `to`)',
        );
        expect(genStudyClaimNudge([OPEN])).toContain(
            '`replace` (each `from` as the file writes it',
        );
        expect(genStudyReportRefusal('I fixed the study.', '')).toContain(
            'To change some words, call draft with `file` and `replace`',
        );
        expect(STUDY_FILE_PROMPT).toContain(
            '`replace`: [{"from", "to"}] with `file`, each `from` copied ' +
                'exactly as the file writes it',
        );
    });
});

// EC-502: one part of a long study sent back as the whole of it.
// EC-544: a part's new words in the chat keep the parts it holds.
describe('a part’s own words in the chat', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const HELD = {
        name: 'JHN.3.The New Birth.md',
        nameTaken: null,
        isChange: true,
        file: OPEN,
        hash: 'h-1',
        passage: '',
        bible: '',
        diagramCount: 0,
        change: 'It changes “Places” (1 line(s) in, 1 out).',
        content:
            '# The New Birth\n\n## Places\n\nWhere.\n\n### Aenon\nNear Salim.\n',
        raw: null,
    };

    it('keeps them in the change already held, and the model is told so', () => {
        const chained = chainStudyPartEdit(
            {
                action: 'draft',
                file: OPEN,
                section: 'Places',
                content: 'By the water.',
            },
            HELD,
        ) as { args: any; noteText: string };
        expect(chained.args).toEqual({
            action: 'draft',
            file: OPEN,
            content:
                '# The New Birth\n\n## Places\n\nBy the water.\n\n### Aenon\nNear Salim.\n',
        });
        expect(chained.noteText).toBe(
            describeStudyKeptParts({ heading: 'Places', parts: ['Aenon'] }),
        );
        const shown = JSON.parse(
            toModelDraftText(
                JSON.stringify({
                    drafted: true,
                    isChange: true,
                    change: 'It changes “Places” (1 line(s) in, 1 out).',
                    content: 'x',
                }),
                false,
                chained.noteText,
            ),
        );
        expect(shown.change).toBe(
            `${chained.noteText} It changes “Places” (1 line(s) in, 1 out).`,
        );
    });

    it('says nothing when no part was kept', () => {
        const chained = chainStudyPartEdit(
            { action: 'draft', file: OPEN, section: 'Aenon', content: 'Wet.' },
            HELD,
        ) as { args: any; noteText: string };
        expect(chained.noteText).toBe('');
    });
});

// EC-548: the passage quoted under the title, in the chat as by the tool.
describe('the passage quoted under a title in the chat', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const PASSAGE =
        '> **John 3:16** (KJV)\n>\n> **16** For God so loved the world.';
    const HELD = {
        name: 'JHN.3.The New Birth.md',
        nameTaken: null,
        isChange: true,
        file: OPEN,
        hash: 'h-1',
        passage: '',
        bible: '',
        diagramCount: 0,
        change: 'It changes “Places” (1 line(s) in, 1 out).',
        content: `# The New Birth\n\n${PASSAGE}\n\n## Places\n\nWhere.\n`,
        raw: null,
    };

    it('keeps it above words drafted for the title onto the held change, and the model is told so', () => {
        const chained = chainStudyPartEdit(
            {
                action: 'draft',
                file: OPEN,
                section: 'The New Birth',
                content: 'One night.',
            },
            HELD,
        ) as { args: any; noteText: string };
        expect(chained.args.content).toBe(
            `# The New Birth\n\n${PASSAGE}\n\nOne night.\n\n## Places\n\nWhere.\n`,
        );
        expect(chained.noteText).toContain(
            'The passage “John 3:16” quoted under “The New Birth” was kept ' +
                'as it was, above these words',
        );
    });

    it('takes it out of the held change by its reference', () => {
        const chained = chainStudyPartEdit(
            {
                action: 'draft',
                file: OPEN,
                section: 'John 3:16',
                remove: true,
            },
            HELD,
        ) as { args: any };
        expect(chained.args.content).toBe(
            '# The New Birth\n\n## Places\n\nWhere.\n',
        );
    });
});

// EC-543: a part taken out whole, in the chat as by the tool.
describe('a part taken out in the chat', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const HELD_CONTENT = [
        '# The New Birth',
        '',
        '## Setting',
        '',
        'John baptized in Aenon near Salim.',
        '',
        '## Prayer',
        '',
        'Lord, teach us.',
        '',
        '---',
        '',
        '*Drafted by the app’s assistant.*',
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
        change: 'It changes “Setting” (1 line(s) in, 1 out).',
        content: HELD_CONTENT,
        raw: null,
    };
    const REMOVE = { action: 'draft', section: 'Prayer', remove: true };

    it('is a part of the study: sent to the one open, never a whole rewrite', () => {
        expect(routeOpenStudyDraft(REMOVE, [OPEN])).toEqual({
            args: { ...REMOVE, file: OPEN },
        });
        // No part named: the tool says to name one.
        expect(
            routeOpenStudyDraft({ action: 'draft', remove: true }, [OPEN]),
        ).toEqual({ args: { action: 'draft', remove: true, file: OPEN } });
        expect(
            routeOpenStudyDraft({ action: 'draft', remove: false }, [OPEN]),
        ).toEqual({ isRefused: true });
        expect(
            checkIsWholeStudyRewrite({
                action: 'draft',
                file: OPEN,
                remove: true,
                content: 'All.',
            }),
        ).toBe(false);
    });

    it('takes the part out of the change already held', () => {
        const chained = chainStudyPartEdit(
            { ...REMOVE, file: 'JHN.3.The New Birth.md' },
            HELD,
        ) as { args: any };
        expect(chained.args).toEqual({
            action: 'draft',
            file: OPEN,
            content: HELD_CONTENT.replace(
                '## Prayer\n\nLord, teach us.\n\n',
                '',
            ),
        });
    });

    it('says why the held change cannot take the removal', () => {
        expect(
            chainStudyPartEdit(
                { ...REMOVE, file: OPEN, append: 'More.' },
                HELD,
            ),
        ).toEqual({ reason: STUDY_REMOVE_ALONE_REASON });
        expect(
            chainStudyPartEdit(
                { ...REMOVE, file: OPEN, section: 'Missing' },
                HELD,
            ),
        ).toEqual({
            reason: expect.stringContaining(
                'The file has no section “Missing”.',
            ),
        });
    });

    it('keeps an answer whole, never a removal beside it', () => {
        expect(
            toKeptAnswerDraftArgs(
                { ...REMOVE, file: OPEN },
                `# God So Loved\n\n${LONG_ANSWER}\n\nWould you like me to say more?`,
            ),
        ).toEqual({
            action: 'draft',
            file: OPEN,
            section: 'Prayer',
            append: LONG_ANSWER,
        });
    });

    it('is named wherever the ways to change a part are', () => {
        expect(STUDY_FILE_PROMPT).toContain(
            'to take a part out, `section` and `remove` true',
        );
        expect(genOpenStudyDraftRefusal([OPEN])).toContain(
            '`remove` true (that part taken out)',
        );
        const routed = routeWholeStudyRewrite(
            { action: 'draft', file: OPEN, content: '# The New Birth\n\nAll.' },
            {
                outline: '# The New Birth\n## Setting\n## Prayer',
                isShownWhole: false,
            },
        );
        expect(routed).toEqual({
            reason: expect.stringContaining(
                'to take a part out, `remove` true with its `section`.',
            ),
        });
    });
});

describe('routeWholeStudyRewrite', () => {
    const FILE = "JHN.3.The New Birth and God's Love.md";
    const OUTLINE = [
        "# The New Birth and God's Love",
        '## Diagrams',
        '### The Path to Salvation',
        '### Themes of John 3',
        '## Cross References',
        '## Questions for Discussion',
        '# The New Birth (translated)',
        '## Questions (translated)',
    ].join('\n');
    const LONG = { outline: OUTLINE, isShownWhole: false };
    const SHORT = { outline: OUTLINE, isShownWhole: true };

    function readReason(routed: unknown) {
        expect(routed).toHaveProperty('reason');
        return (routed as { reason: string }).reason;
    }

    it('tells a whole new text from a part', () => {
        expect(checkIsWholeStudyRewrite({ file: FILE, content: 'All.' })).toBe(
            true,
        );
        expect(
            checkIsWholeStudyRewrite({
                file: FILE,
                section: 'Cross References',
                content: 'A.',
            }),
        ).toBe(false);
        expect(checkIsWholeStudyRewrite({ file: FILE, append: 'More.' })).toBe(
            false,
        );
        expect(
            checkIsWholeStudyRewrite({ ref: 'John 3', content: 'New.' }),
        ).toBe(false);
        expect(checkIsWholeStudyRewrite({ file: FILE, content: ' ' })).toBe(
            false,
        );
    });

    it('drafts one part sent as the whole text as that part, sub-parts and all', () => {
        // As seen live: the file, its passage and title, and one part.
        const args = {
            action: 'draft',
            file: FILE,
            ref: 'John 3:1-36',
            title: "The New Birth and God's Love",
            content:
                '## Questions (translated)\n1. Why by night?\n\n2. Numbers 21:8-9?',
        };
        expect(routeWholeStudyRewrite(args, LONG)).toEqual({
            args: { ...args, section: 'Questions (translated)' },
        });
        const withSubs = {
            file: FILE,
            content:
                '## Diagrams\n\n### The Path to Salvation\nA\n\n### Themes of John 3\nB',
        };
        expect(routeWholeStudyRewrite(withSubs, LONG)).toEqual({
            args: { ...withSubs, section: 'Diagrams' },
        });
    });

    it('refuses a text losing parts the ask never showed, naming them, with the headings', () => {
        const reason = readReason(
            routeWholeStudyRewrite(
                {
                    file: FILE,
                    content: 'I have fixed the cross-references in the file.',
                },
                LONG,
            ),
        );
        expect(reason).toMatch(
            /^`content` with no `section` is the WHOLE new text of "JHN\.3\.The New Birth and God's Love\.md", and this one leaves out 8 of its parts: “The New Birth and God's Love”, “Diagrams”, “The Path to Salvation”, “Themes of John 3”, “Cross References” and 3 more\. The ask shows only the start of this file/,
        );
        expect(reason).toContain('call draft with `file`, `section`');
        expect(reason).toContain('never say it was.');
        expect(reason.endsWith(`Its headings:\n${OUTLINE}`)).toBe(true);
        // A part leaving its own sub-parts out is no part: refused whole.
        expect(
            readReason(
                routeWholeStudyRewrite(
                    {
                        file: FILE,
                        content: '## Diagrams\n\n### The Path to Salvation\nA',
                    },
                    LONG,
                ),
            ),
        ).toContain(
            "leaves out 6 of its parts: “The New Birth and God's Love”, “Themes of John 3”,",
        );
    });

    it('refuses most of a file shown whole, and lets a few go', () => {
        expect(
            readReason(
                routeWholeStudyRewrite(
                    { file: FILE, content: 'Two sentences.' },
                    SHORT,
                ),
            ),
        ).not.toContain('The ask shows only the start');
        const fewLost = {
            file: FILE,
            content: [
                "# The New Birth and God's Love",
                '## Diagrams',
                '### The Path to Salvation',
                '## Questions for Discussion',
                '# The New Birth (translated)',
                '## Questions (translated)',
            ].join('\n\nWords.\n\n'),
        };
        expect(routeWholeStudyRewrite(fewLost, SHORT)).toBeNull();
        expect(readReason(routeWholeStudyRewrite(fewLost, LONG))).toContain(
            'leaves out 2 of its parts: “Themes of John 3”, “Cross References”.',
        );
    });

    it('drafts a whole text keeping every part as it is', () => {
        const whole = {
            file: FILE,
            content: OUTLINE.split('\n').join('\n\nWords.\n\n'),
        };
        expect(routeWholeStudyRewrite(whole, LONG)).toBeNull();
        expect(routeWholeStudyRewrite(whole, SHORT)).toBeNull();
    });

    it('takes no part a heading cannot name for sure', () => {
        // Words before it, a sibling part after it, a heading twice.
        for (const content of [
            'Here it is:\n\n## Cross References\n- Numbers 21:8-9',
            '## Cross References\nA\n\n## Questions for Discussion\nB',
        ]) {
            expect(
                routeWholeStudyRewrite({ file: FILE, content }, LONG),
            ).toHaveProperty('reason');
        }
        expect(
            routeWholeStudyRewrite(
                { file: FILE, content: '## Questions\nA' },
                {
                    outline: '# A\n## Questions\n# B\n## Questions',
                    isShownWhole: false,
                },
            ),
        ).toHaveProperty('reason');
        // Past the headings listed, a part's own may run on unseen.
        expect(
            routeWholeStudyRewrite(
                { file: FILE, content: '## Last\nA' },
                {
                    outline: '# A\n## B\n## Last\n… and 3 more',
                    isShownWhole: false,
                },
            ),
        ).toHaveProperty('reason');
    });

    it('leaves alone a part, a new study, a file with no headings and no read', () => {
        expect(
            routeWholeStudyRewrite(
                { file: FILE, section: 'Cross References', content: 'A.' },
                LONG,
            ),
        ).toBeNull();
        expect(
            routeWholeStudyRewrite(
                { ref: 'John 3', title: 'New', content: 'All.' },
                LONG,
            ),
        ).toBeNull();
        expect(
            routeWholeStudyRewrite(
                { file: FILE, content: 'All.' },
                { outline: '', isShownWhole: false },
            ),
        ).toBeNull();
        expect(
            routeWholeStudyRewrite({ file: FILE, content: 'All.' }, null),
        ).toBeNull();
    });
});

describe('genStudyReportRefusal', () => {
    it('quotes the report, says nothing changed and how to change a line, with the headings', () => {
        const refusal = genStudyReportRefusal(
            'I have fixed the cross-references in the study file.',
            '# The New Birth\n## Questions',
        );
        expect(refusal).toMatch(
            /^These words say what was done to the study \(“I have fixed the cross-references in the study file\.”\): a study never says what was changed in it/,
        );
        expect(refusal).toContain(
            'Nothing in the file has changed: never say it was.',
        );
        expect(refusal).toContain('`section` (the heading of the part');
        expect(refusal).toMatch(
            /Its headings:\n# The New Birth\n## Questions$/,
        );
    });

    it('cuts a long report and leaves the headings out when none were read', () => {
        const refusal = genStudyReportRefusal(
            `I have corrected the study file. ${'More words. '.repeat(20)}`,
            '',
        );
        const quoted = /“([^”]*)”/.exec(refusal)?.[1] ?? '';
        expect(quoted.endsWith('…')).toBe(true);
        expect(quoted.length).toBeLessThanOrEqual(101);
        expect(refusal.endsWith('(`read` with `file` and `section`).')).toBe(
            true,
        );
    });
});

// EC-500: a part of a study drafted by its `section` with none of its words
// in front of the model.
describe('a part of a study written without its words', () => {
    const FILE = 'Default/JHN.3.The New Birth.md';
    const FILE_KEY = 'jhn.3.the new birth.md';
    const LAST = '## Last Words\n\n- The bronze snake: Numbers 21:8-9';
    // Long enough for an ask to show it cut inside its Background.
    const STUDY = [
        '# The New Birth',
        '',
        '## Questions',
        '',
        '1. Who came?',
        '',
        '## Background',
        '',
        ...Array.from({ length: 600 }, (_value, index) => {
            return `Line ${index + 1} of the background, as it was.`;
        }),
        '',
        LAST,
    ].join('\n');
    const SHOWN = toAskedStudyBlocks(
        toAskedOfModel('Fix it.', [
            genTextAttachment('JHN.3.The New Birth.md', STUDY),
            genTextAttachment('notes.txt', 'Not a study.'),
        ]),
    );
    const READ_LAST = JSON.stringify({
        file: FILE,
        kind: 'text',
        section: 'Last Words',
        text: LAST,
    });

    it('takes the study files an ask shows, cut where the ask cut them', () => {
        expect(SHOWN).toHaveLength(1);
        expect(SHOWN[0].fileKey).toBe(FILE_KEY);
        expect(SHOWN[0].isCut).toBe(true);
        expect(STUDY.startsWith(SHOWN[0].text)).toBe(true);
        expect(toAskedStudyBlocks('What does John 3:16 say?')).toEqual([]);
    });

    it('takes a read of a study, part or start, and nothing else', () => {
        expect(toReadStudyBlock(READ_LAST)).toEqual({
            fileKey: FILE_KEY,
            text: LAST,
            isCut: false,
        });
        expect(
            toReadStudyBlock(
                JSON.stringify({
                    file: FILE,
                    kind: 'text',
                    text: '# The New Birth',
                    note: 'Only the start of it is here.',
                }),
            )?.isCut,
        ).toBe(true);
        expect(
            toReadStudyBlock(
                JSON.stringify({
                    file: 'pdf/notes.txt',
                    kind: 'text',
                    text: 'A',
                }),
            ),
        ).toBeNull();
        expect(
            toReadStudyBlock(
                JSON.stringify({ file: 'pdf/JHN.3.pdf', kind: 'pdf' }),
            ),
        ).toBeNull();
        expect(toReadStudyBlock('Tool error: no such file')).toBeNull();
    });

    it('a draft of one part is its words for a part of a study file', () => {
        expect(
            toStudyPartDraft({
                action: 'draft',
                file: FILE,
                section: 'Questions',
                content: '1. Who?',
            }),
        ).toEqual({ file: FILE, section: 'Questions' });
        // Words added to a part need none of its own.
        expect(
            toStudyPartDraft({ file: FILE, section: 'Questions', append: 'A' }),
        ).toBeNull();
        expect(toStudyPartDraft({ file: FILE, content: 'All.' })).toBeNull();
        expect(
            toStudyPartDraft({ section: 'Questions', content: '1. Who?' }),
        ).toBeNull();
        expect(
            toStudyPartDraft({
                file: 'Default/notes.txt',
                section: 'Questions',
                content: '1. Who?',
            }),
        ).toBeNull();
    });

    it('a part is shown when a block holds it whole, and once', () => {
        expect(checkIsStudyPartShown(SHOWN, FILE, 'Questions')).toBe(true);
        expect(
            checkIsStudyPartShown(
                SHOWN,
                'JHN.3.The New Birth.md',
                '## questions',
            ),
        ).toBe(true);
        // Running past where the ask was cut, or after it.
        expect(checkIsStudyPartShown(SHOWN, FILE, 'Background')).toBe(false);
        expect(checkIsStudyPartShown(SHOWN, FILE, 'Last Words')).toBe(false);
        // The same heading in another file.
        expect(
            checkIsStudyPartShown(SHOWN, 'Default/Other.md', 'Questions'),
        ).toBe(false);
        const read = toReadStudyBlock(READ_LAST);
        expect(read).not.toBeNull();
        expect(
            checkIsStudyPartShown([...SHOWN, read!], FILE, 'Last Words'),
        ).toBe(true);
        // A heading written twice is no one part.
        const twice = {
            fileKey: FILE_KEY,
            text: '## Prayer\n\nA.\n\n## Prayer\n\nB.',
            isCut: false,
        };
        expect(checkIsStudyPartShown([twice], FILE, 'Prayer')).toBe(false);
    });

    it('sends the part back with its own words, as the read gives them', () => {
        const refusal = genUnreadStudyPartRefusal(SHOWN, FILE, READ_LAST);
        expect(refusal).toMatch(
            /^The part “Last Words” is in nothing you were shown of "Default\/JHN\.3\.The New Birth\.md"/,
        );
        expect(refusal).toContain(
            'Call draft again with the same `file` and `section`',
        );
        expect(refusal).toContain(
            'Nothing in the file has changed: never say it was.',
        );
        expect(refusal?.endsWith(READ_LAST)).toBe(true);
    });

    it('drafts it when the words were shown, the part is too long or the read failed', () => {
        const whole = { fileKey: FILE_KEY, text: STUDY, isCut: false };
        expect(genUnreadStudyPartRefusal([whole], FILE, READ_LAST)).toBeNull();
        expect(
            genUnreadStudyPartRefusal(
                SHOWN,
                FILE,
                JSON.stringify({
                    file: FILE,
                    kind: 'text',
                    section: 'Last Words',
                    text: LAST,
                    note: 'Only the start of this part is here.',
                }),
            ),
        ).toBeNull();
        // The start of the file, no part named.
        expect(
            genUnreadStudyPartRefusal(
                SHOWN,
                FILE,
                JSON.stringify({ file: FILE, kind: 'text', text: LAST }),
            ),
        ).toBeNull();
        expect(
            genUnreadStudyPartRefusal(SHOWN, FILE, 'Tool error: no such file'),
        ).toBeNull();
    });
});

describe('a part of the new study the card holds (EC-604)', () => {
    const NAME = 'JHN.3.16-17 God So Loved.md';
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const PASSAGE = {
        title: 'John 3:16-17',
        bibleKey: 'XB',
        verses: [
            { number: '16', text: 'For God so loved the world.' },
            { number: '17', text: 'For God sent not his Son.' },
        ],
    };
    const BODY = [
        '## Setting',
        '',
        'Nicodemus came by night.',
        '',
        '## Picture',
        '',
        '```mermaid',
        'flowchart TD',
        '    A["Light"] --> B["Life"]',
        '```',
        '',
        '## Prayer',
        '',
        'Lord, teach us.',
    ].join('\n');
    const toHeldContent = (body: string, title = 'God So Loved') => {
        return composeStudyFile({
            title,
            passage: PASSAGE,
            isPassageCut: false,
            body,
            footnote: 'Drafted by the assistant.',
        });
    };
    const CONTENT = toHeldContent(BODY);
    const HELD = {
        name: NAME,
        nameTaken: null,
        isChange: false,
        file: null,
        hash: null,
        passage: 'John 3:16-17',
        bible: 'XB',
        diagramCount: 1,
        change: null,
        content: CONTENT,
        raw: {
            ref: 'JHN 3:16-17',
            title: 'God So Loved',
            content: BODY,
            bible: null,
        },
    };
    const REPLACE = {
        action: 'draft',
        file: NAME,
        replace: [{ from: 'by night', to: 'after dark' }],
    };
    const PRAYER_EDIT = {
        action: 'draft',
        file: NAME,
        section: 'Prayer',
        content: '## Prayer\n\nLord, show us your love.',
    };
    // The worker's own `draft` of a new study, as far as the window reads
    // it: the study composed again under its title and passage.
    const genDraftTool = (shapeBody = (body: string) => body) => {
        const callList: any[] = [];
        const callDraft = async (args: any) => {
            callList.push(args);
            const content = toHeldContent(shapeBody(args.content), args.title);
            return JSON.stringify({
                drafted: true,
                isChange: false,
                name: `JHN.3.16-17 ${args.title}.md`,
                nameTaken: null,
                passage: 'John 3:16-17',
                bible: args.bible ?? '',
                diagramCount: lintStudyContent(content, Infinity).diagrams
                    .length,
                warnings: [],
                content,
            });
        };
        return { callList, callDraft };
    };
    // Mermaid's parse, as the window asks it: a diagram holding the word
    // does not draw.
    const genParser = (brokenWord: string | null = null) => {
        const sourceList: string[][] = [];
        const parseDiagrams = async (sources: string[]) => {
            sourceList.push(sources);
            return sources.map((source) => {
                return brokenWord !== null && source.includes(brokenWord)
                    ? 'Parse error on line 2'
                    : null;
            });
        };
        return { sourceList, parseDiagrams };
    };
    const toEdit = (args: any, held: any = HELD, shown: any[] = []) => {
        const edit = chainHeldNewStudyEdit(args, held, [], shown);
        if (edit === null || 'reason' in edit) {
            throw new Error(`no edit: ${JSON.stringify(edit)}`);
        }
        return edit;
    };

    it('writes words anew in the held study and drafts it again as a new study', () => {
        expect(chainHeldNewStudyEdit(REPLACE, HELD, [])).toEqual({
            args: {
                action: 'draft',
                ref: 'JHN 3:16-17',
                title: 'God So Loved',
                content: BODY.replace('by night', 'after dark'),
                bible: 'XB',
            },
            whole: CONTENT.replace('by night', 'after dark'),
            noteText: '',
            changeText:
                'It writes “after dark” for “by night” (1 place); nothing ' +
                'else changes.',
            isReplace: true,
        });
        // Its whole path as a saved study would have it, in any case.
        expect(
            toEdit({ ...REPLACE, file: `default/${NAME.toLowerCase()}` }).args
                .content,
        ).toBe(BODY.replace('by night', 'after dark'));
    });

    it('changes, adds and takes out a part the way a saved study does', () => {
        const changed = toEdit(PRAYER_EDIT);
        expect(changed.args.content).toBe(
            BODY.replace('Lord, teach us.', 'Lord, show us your love.'),
        );
        expect(changed.whole).toBe(
            CONTENT.replace('Lord, teach us.', 'Lord, show us your love.'),
        );
        expect(changed.changeText).toBeNull();
        expect(changed.isReplace).toBe(false);
        expect(
            toEdit({
                action: 'draft',
                file: NAME,
                append: '## Questions\n\n1. Who came?',
            }).args.content,
        ).toBe(`${BODY}\n\n## Questions\n\n1. Who came?`);
        expect(
            toEdit({
                action: 'draft',
                file: NAME,
                section: 'Picture',
                remove: true,
            }).args.content,
        ).toBe(
            [
                '## Setting',
                '',
                'Nicodemus came by night.',
                '',
                '## Prayer',
                '',
                'Lord, teach us.',
            ].join('\n'),
        );
    });

    it('takes a call naming no file while no study is open in the tab', () => {
        const { file: _file, ...unnamed } = PRAYER_EDIT;
        expect(toEdit(unnamed).args.content).toBe(
            BODY.replace('Lord, teach us.', 'Lord, show us your love.'),
        );
        // A study open in the tab is where such a call goes, and a `ref`
        // is a new study of its own.
        expect(chainHeldNewStudyEdit(unnamed, HELD, [OPEN])).toBeNull();
        expect(
            chainHeldNewStudyEdit({ ...unnamed, ref: 'John 3:16' }, HELD, []),
        ).toBeNull();
        // A whole study with no file is a new study's draft, as before.
        expect(
            chainHeldNewStudyEdit(
                { action: 'draft', content: 'All of it again.' },
                HELD,
                [],
            ),
        ).toBeNull();
    });

    it('is about the held new study alone', () => {
        expect(
            chainHeldNewStudyEdit(
                { ...REPLACE, file: 'Default/Other Study.md' },
                HELD,
                [],
            ),
        ).toBeNull();
        // A saved study open in the tab under that path is that study.
        expect(
            chainHeldNewStudyEdit(
                { ...REPLACE, file: `Bible Notes/${NAME}` },
                HELD,
                [`Bible Notes/${NAME}`],
            ),
        ).toBeNull();
        expect(chainHeldNewStudyEdit(REPLACE, null, [])).toBeNull();
        // A change held, a study the window cannot draft again, a note's
        // twin: none is a new study to change part by part.
        expect(
            chainHeldNewStudyEdit(
                REPLACE,
                { ...HELD, isChange: true, file: `Default/${NAME}` },
                [],
            ),
        ).toBeNull();
        expect(
            chainHeldNewStudyEdit(REPLACE, { ...HELD, raw: null }, []),
        ).toBeNull();
        expect(
            chainHeldNewStudyEdit(
                REPLACE,
                { ...HELD, raw: { ...HELD.raw, ref: ' ' } },
                [],
            ),
        ).toBeNull();
        expect(
            chainHeldNewStudyEdit(
                REPLACE,
                { ...HELD, note: { title: 'God So Loved', text: 'Words.' } },
                [],
            ),
        ).toBeNull();
    });

    it('says why the held study cannot take the change', () => {
        // Written whole again under its name.
        expect(
            chainHeldNewStudyEdit(
                { action: 'draft', file: NAME, content: 'All of it again.' },
                HELD,
                [],
            ),
        ).toEqual({ reason: genHeldStudyWholeRefusal(NAME) });
        expect(genHeldStudyWholeRefusal(NAME)).toContain(
            `"${NAME}" is not saved yet`,
        );
        // The passage the app quoted under the title.
        expect(
            chainHeldNewStudyEdit(
                {
                    action: 'draft',
                    file: NAME,
                    section: 'John 3:16-17',
                    remove: true,
                },
                HELD,
                [],
            ),
        ).toEqual({ reason: STUDY_HELD_PASSAGE_REASON });
        // No words of its own left under it.
        const oneLine = toHeldContent('Nicodemus came by night.');
        expect(
            chainHeldNewStudyEdit(
                {
                    action: 'draft',
                    file: NAME,
                    replace: [{ from: 'Nicodemus came by night.', to: '' }],
                },
                { ...HELD, content: oneLine },
                [],
            ),
        ).toEqual({ reason: STUDY_HELD_EMPTY_REASON });
        // The `#` title, which names the file.
        expect(
            chainHeldNewStudyEdit(
                {
                    action: 'draft',
                    file: NAME,
                    section: 'God So Loved',
                    content: '## Opening\n\nWords.',
                },
                HELD,
                [],
            ),
        ).toEqual({
            reason: expect.stringContaining('That takes out the study’s `#`'),
        });
        // What the edit itself refuses, as for a saved study.
        expect(
            chainHeldNewStudyEdit(
                { ...PRAYER_EDIT, section: 'Missing' },
                HELD,
                [],
            ),
        ).toEqual({
            reason: expect.stringContaining('no section “Missing”'),
        });
    });

    it('hands back a part of a translation the model was never shown, with its words', () => {
        const madeHeld = { ...HELD, isWindowMade: true as const };
        const settingEdit = {
            action: 'draft',
            file: NAME,
            section: 'Setting',
            content: '## Setting\n\nNicodemus came.',
        };
        const refused = chainHeldNewStudyEdit(settingEdit, madeHeld, [], []);
        expect(refused).toEqual({
            reason: expect.stringContaining(
                `The part “Setting” is in nothing you were shown of "${NAME}"`,
            ),
            shown: {
                fileKey: NAME.toLowerCase(),
                text: '## Setting\n\nNicodemus came by night.',
                isCut: false,
            },
        });
        const shown = (refused as { shown: any }).shown;
        // Shown it, the change goes through.
        expect(toEdit(settingEdit, madeHeld, [shown]).args.content).toContain(
            '## Setting\n\nNicodemus came.\n\n## Picture',
        );
        // Words written over in place, words added, and a study the model
        // wrote itself need no read first.
        expect(toEdit(REPLACE, madeHeld).isReplace).toBe(true);
        expect(
            toEdit({ action: 'draft', file: NAME, append: 'Amen.' }, madeHeld)
                .args.content,
        ).toContain('Lord, teach us.\n\nAmen.');
        expect(toEdit(settingEdit).args.content).toContain('Nicodemus came.');
    });

    it('reads the held study off its words, whole or a part', () => {
        const whole = JSON.parse(
            readHeldNewStudy({ action: 'read', file: NAME }, HELD) ?? '',
        );
        expect(whole).toEqual({
            file: NAME,
            kind: 'text',
            text: CONTENT,
            held: expect.stringContaining('Not saved yet'),
        });
        const part = JSON.parse(
            readHeldNewStudy(
                { action: 'read', file: NAME, section: 'Prayer' },
                HELD,
            ) ?? '',
        );
        expect(part).toEqual({
            file: NAME,
            kind: 'text',
            section: 'Prayer',
            text: '## Prayer\n\nLord, teach us.',
            held: expect.stringContaining('Not saved yet'),
        });
        expect(
            readHeldNewStudy(
                { action: 'read', file: NAME, section: 'Missing' },
                HELD,
            ),
        ).toMatch(/^Tool refused: .*no section “Missing”/);
        // Any other read is the tool's.
        expect(readHeldNewStudy({ action: 'read' }, HELD)).toBeNull();
        expect(
            readHeldNewStudy(
                { action: 'read', file: 'Default/Other Study.md' },
                HELD,
            ),
        ).toBeNull();
        expect(
            readHeldNewStudy(
                { action: 'read', file: `Default/${NAME}` },
                HELD,
                [`Default/${NAME}`],
            ),
        ).toBeNull();
        expect(
            readHeldNewStudy(
                { action: 'read', file: NAME },
                { ...HELD, isChange: true, file: `Default/${NAME}` },
            ),
        ).toBeNull();
    });

    it('reads the start of a long held study, and its headings', () => {
        const longBody = [
            '## Background',
            '',
            ...Array.from({ length: 500 }, (_value, index) => {
                return `Line ${index + 1} of the background, as it was.`;
            }),
            '',
            '## Last Words',
            '',
            'Amen.',
        ].join('\n');
        const longHeld = { ...HELD, content: toHeldContent(longBody) };
        const read = JSON.parse(
            readHeldNewStudy({ action: 'read', file: NAME }, longHeld) ?? '',
        );
        expect(read.text).toHaveLength(16 * 1024);
        expect(read.note).toContain(
            `Only the start of it is here: it is ${longHeld.content.length} characters.`,
        );
        expect(read.note).toContain('## Last Words');
        expect(read.held).toContain('Not saved yet');
    });

    it('drafts the change again and says what changed in the held study', async () => {
        const edit = toEdit(REPLACE);
        const { callList, callDraft } = genDraftTool();
        const { sourceList, parseDiagrams } = genParser();
        const redrafted = await redraftHeldNewStudy(
            edit,
            HELD,
            { callDraft, parseDiagrams },
            false,
        );
        expect(callList).toEqual([edit.args]);
        // No diagram changed, none parsed.
        expect(sourceList).toEqual([]);
        expect(redrafted.isDiagramRetry).toBe(false);
        expect(redrafted.drafted).toMatchObject({
            name: NAME,
            isChange: false,
            content: edit.whole,
            raw: {
                ref: 'JHN 3:16-17',
                title: 'God So Loved',
                content: edit.args.content,
                bible: 'XB',
            },
        });
        const shown = JSON.parse(redrafted.text);
        expect(shown.change).toBe(
            'Changed in the new study the card holds, which is still not ' +
                'saved: It writes “after dark” for “by night” (1 place); ' +
                'nothing else changes.',
        );
        expect(shown.content).toBe(
            `[held by the window: ${edit.whole.length} characters]`,
        );
        expect(shown.note).toBe(STUDY_HELD_NOTE);
        expect(redrafted.text).not.toContain('Nicodemus');
    });

    it('says the change by comparing when the draft is not the words as changed', async () => {
        const { callDraft } = genDraftTool((body) => {
            return `${body}\n\nA line the worker wrote.`;
        });
        const redrafted = await redraftHeldNewStudy(
            toEdit(REPLACE),
            HELD,
            { callDraft, parseDiagrams: genParser().parseDiagrams },
            false,
        );
        const { change } = JSON.parse(redrafted.text);
        expect(change).toMatch(
            /^Changed in the new study the card holds, which is still not saved: It changes /,
        );
        expect(change).not.toContain('It writes');
        expect(redrafted.drafted?.content).toContain(
            'A line the worker wrote.',
        );
    });

    it('refuses words written anew that break a diagram, every time', async () => {
        const edit = toEdit({
            action: 'draft',
            file: NAME,
            replace: [{ from: 'Light', to: 'Broken' }],
        });
        const { sourceList, parseDiagrams } = genParser('Broken');
        const redrafted = await redraftHeldNewStudy(
            edit,
            HELD,
            { callDraft: genDraftTool().callDraft, parseDiagrams },
            true,
        );
        expect(sourceList).toEqual([
            ['flowchart TD\n    A["Broken"] --> B["Life"]'],
        ]);
        expect(redrafted).toEqual({
            text:
                'Tool refused: Diagram 1 of the file would not draw with ' +
                'these words in it: Parse error on line 2 Nothing is ' +
                'changed: call draft again without the pair that changes ' +
                'it, or with a `to` the diagram can hold.',
            drafted: null,
            isDiagramRetry: false,
        });
    });

    it('sends a diagram a part writes back once, then leaves it out', async () => {
        const edit = toEdit({
            action: 'draft',
            file: NAME,
            section: 'Picture',
            content:
                '## Picture\n\n```mermaid\nflowchart TD\n    A["Broken"]\n```',
        });
        const tools = {
            callDraft: genDraftTool().callDraft,
            parseDiagrams: genParser('Broken').parseDiagrams,
        };
        const first = await redraftHeldNewStudy(edit, HELD, tools, false);
        expect(first.drafted).toBeNull();
        expect(first.isDiagramRetry).toBe(true);
        expect(first.text).toBe(
            'Tool refused: Diagram 1 of the study does not draw with this ' +
                'change: Parse error on line 2 Nothing is changed: the card ' +
                'holds the study as it was. Fix it and call draft again with ' +
                'the same change.',
        );
        const second = await redraftHeldNewStudy(edit, HELD, tools, true);
        expect(second.isDiagramRetry).toBe(false);
        expect(second.drafted?.content).not.toContain('```mermaid');
        expect(second.drafted?.diagramCount).toBe(0);
        expect(JSON.parse(second.text).change).toContain(
            'A diagram the change wrote did not draw again and was left out.',
        );
    });

    // EC-701: the answer above added to the held study by the window -- no
    // model's words to fix, nor to describe.
    it('adds a kept answer: its diagram that does not draw left out at once, the model told it was added', async () => {
        const edit = toEdit({
            action: 'draft',
            file: NAME,
            append:
                'Born again: a new start from God.\n\n```mermaid\n' +
                'flowchart TD\n    A["Broken"]\n```',
        });
        const tools = {
            callDraft: genDraftTool().callDraft,
            parseDiagrams: genParser('Broken').parseDiagrams,
        };
        const kept = await redraftHeldNewStudy(edit, HELD, tools, false, true);
        expect(kept.isDiagramRetry).toBe(false);
        expect(kept.drafted?.content).toContain(
            'Born again: a new start from God.',
        );
        expect(kept.drafted?.content).not.toContain('A["Broken"]');
        // The study's own diagram stays.
        expect(kept.drafted?.diagramCount).toBe(1);
        const shown = JSON.parse(kept.text);
        expect(shown.note).toBe(STUDY_KEPT_ANSWER_HELD_NOTE);
        expect(shown.change).toContain(
            'A diagram the change wrote did not draw again and was left out.',
        );
        expect(kept.text).not.toContain('Born again');
        // Pressed for a Markdown file: no New Bible Note named.
        const markdownHeld = { ...HELD, isMarkdownOnly: true as const };
        const markdown = await redraftHeldNewStudy(
            toEdit(
                { action: 'draft', file: NAME, append: 'Amen.' },
                markdownHeld,
            ),
            markdownHeld,
            tools,
            false,
            true,
        );
        expect(JSON.parse(markdown.text).note).toBe(
            STUDY_KEPT_ANSWER_HELD_MARKDOWN_NOTE,
        );
        // A model's own append is still sent back once.
        expect(
            (await redraftHeldNewStudy(edit, HELD, tools, false))
                .isDiagramRetry,
        ).toBe(true);
    });

    it('keeps what the card was made with, and passes a refusal on', async () => {
        const madeHeld = {
            ...HELD,
            isMarkdownOnly: true as const,
            isWindowMade: true as const,
        };
        const kept = await redraftHeldNewStudy(
            toEdit(REPLACE, madeHeld),
            madeHeld,
            {
                callDraft: genDraftTool().callDraft,
                parseDiagrams: genParser().parseDiagrams,
            },
            false,
        );
        expect(kept.drafted?.isMarkdownOnly).toBe(true);
        expect(kept.drafted?.isWindowMade).toBe(true);
        expect(JSON.parse(kept.text).note).toBe(STUDY_HELD_MARKDOWN_NOTE);
        const refused = await redraftHeldNewStudy(
            toEdit(REPLACE),
            HELD,
            {
                callDraft: async () => {
                    return 'Tool refused: the title is empty';
                },
                parseDiagrams: genParser().parseDiagrams,
            },
            false,
        );
        expect(refused).toEqual({
            text:
                'Tool refused: the title is empty\n(Nothing is changed: the ' +
                'card holds the new study as it was.)',
            drafted: null,
            isDiagramRetry: false,
        });
    });

    describe('the card above, asked of later (EC-606)', () => {
        const ASKED: ChatMessageType = {
            id: 1,
            author: 'you',
            text: 'Make a study of John 3:16-17',
        };
        const toCard = (id: number, reference: string) => {
            return botMessage(id, 'Here is a study of John 3:16-17.', {
                actions: genStudyDraftActions({ ...HELD, reference }),
            });
        };

        it('holds a card’s new study for a later ask, and none that EC-604 changes nothing of', () => {
            const kept = keepDraftedStudy(HELD);
            expect(toHeldStudyBefore(kept)).toEqual({
                ...kept,
                isFromEarlierAsk: true,
            });
            expect(toHeldStudyBefore(null)).toBeNull();
            expect(toHeldStudyBefore(undefined)).toBeNull();
            // A change to a saved file, a draft naming no passage, one
            // holding the model's note as its twin.
            expect(
                toHeldStudyBefore({
                    ...kept,
                    isChange: true,
                    file: `Default/${NAME}`,
                    raw: null,
                }),
            ).toBeNull();
            expect(toHeldStudyBefore({ ...kept, raw: null })).toBeNull();
            expect(
                toHeldStudyBefore({ ...kept, raw: { ...HELD.raw, ref: ' ' } }),
            ).toBeNull();
            expect(
                toHeldStudyBefore({
                    ...kept,
                    note: { title: 'God So Loved', text: 'Words' },
                }),
            ).toBeNull();
        });

        it('finds the new study the card right above the ask holds', () => {
            const kept = keepDraftedStudy(HELD);
            const card = toCard(2, kept.reference);
            expect(findHeldStudyAbove([ASKED, card])).toEqual({
                ...kept,
                isFromEarlierAsk: true,
            });
            // The window's follow-up to a thumb down is stepped over.
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    botMessage(3, 'What was wrong with it?', {
                        isFollowUp: true,
                    }),
                ])?.reference,
            ).toBe(kept.reference);
            // A Retry looks above the question it asks again.
            expect(
                findHeldStudyAbove(
                    [
                        ASKED,
                        card,
                        { id: 4, author: 'you', text: 'change its title' },
                        botMessage(5, 'Changed.'),
                    ],
                    { beforeId: 4 },
                )?.reference,
            ).toBe(kept.reference);
        });

        it('finds none once anything stands under the card', () => {
            const kept = keepDraftedStudy(HELD);
            const card = toCard(2, kept.reference);
            // Created: the "Saved as" line stands under it.
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    botMessage(
                        3,
                        `Saved as "${NAME}" in Resources → Default. It is ` +
                            'attached to this chat: ask me about it, or ask ' +
                            'me to change it.',
                        {
                            actions: [
                                {
                                    label: 'Open it',
                                    toolName: STUDY_PREVIEW_TOOL_NAME,
                                    args: { file: `Default/${NAME}` },
                                },
                            ],
                        },
                    ),
                ]),
            ).toBeNull();
            // An answer given since that did something (EC-701): a button
            // of its own, a chip, a picture asked for.
            for (const since of [
                botMessage(4, 'Press Settings, then General.', {
                    actions: [
                        {
                            label: 'Show me step by step',
                            toolName: 'owa_guide_start',
                            args: { manualId: 'W-06' },
                        },
                    ],
                }),
                botMessage(4, 'That is this button.', {
                    shows: [
                        {
                            kind: 'control',
                            value: 'Settings',
                            name: 'Settings',
                        },
                    ],
                }),
                botMessage(4, 'Send me a picture of your screen.', {
                    attachRequests: ['screenshot'],
                }),
            ]) {
                expect(
                    findHeldStudyAbove([
                        card,
                        { id: 3, author: 'you', text: 'how do I print?' },
                        since,
                    ]),
                    since.text,
                ).toBeNull();
            }
            // A draft the window holds no more: a reload, three newer ones.
            expect(findHeldStudyAbove([toCard(5, 'study-gone')])).toBeNull();
            // A change to a saved file.
            const change = keepDraftedStudy({
                ...HELD,
                isChange: true,
                file: `Default/${NAME}`,
                raw: null,
            });
            expect(
                findHeldStudyAbove([
                    botMessage(6, 'Changed.', {
                        actions: genStudyDraftActions(change),
                    }),
                ]),
            ).toBeNull();
            expect(findHeldStudyAbove([])).toBeNull();
        });

        // EC-701: "what does verse 5 mean?" answered in words between the
        // card and "add that to the study" had ended the chain.
        it('steps over up to two answers given in words since, and counts them', () => {
            const kept = keepDraftedStudy(HELD);
            const card = toCard(2, kept.reference);
            const asked = (id: number, text: string): ChatMessageType => {
                return { id, author: 'you', text };
            };
            const said = (id: number) => {
                return botMessage(
                    id,
                    'Born of water and of the Spirit: a new start from God.',
                    { replies: ['Add that to the study'] },
                );
            };
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    asked(3, 'what does verse 5 mean?'),
                    said(4),
                ]),
            ).toEqual({ ...kept, isFromEarlierAsk: true, answersBetween: 1 });
            // Two, the window's follow-up to a thumb down not counted.
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    asked(3, 'what does verse 5 mean?'),
                    said(4),
                    botMessage(5, 'What was wrong with it?', {
                        isFollowUp: true,
                    }),
                    asked(6, 'and verse 8?'),
                    said(7),
                ])?.answersBetween,
            ).toBe(2);
            // A third, and the card is too far up.
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    asked(3, 'one'),
                    said(4),
                    asked(5, 'two'),
                    said(6),
                    asked(7, 'three'),
                    said(8),
                ]),
            ).toBeNull();
            // The card itself the newest answer: no count at all, even for
            // a draft held again with the count it was reached with.
            const again = keepDraftedStudy({ ...HELD, answersBetween: 2 });
            const found = findHeldStudyAbove([
                ASKED,
                toCard(9, again.reference),
            ]);
            expect(found?.reference).toBe(again.reference);
            expect(found).not.toHaveProperty('answersBetween');
        });

        // EC-702: the line typed again after a failure had reached no study,
        // the failure's doors and the guide's buttons ending the chain.
        it('steps over what stood for a failed ask, its buttons and all, and counts it', () => {
            const kept = keepDraftedStudy(HELD);
            const card = toCard(2, kept.reference);
            const failed = (id: number) => {
                return botMessage(id, 'Here is what the guide says.', {
                    note: 'Free could not answer — the service is busy.',
                    actions: [
                        {
                            label: 'Open AI settings',
                            toolName: 'owa-open-ai-setting',
                            args: {},
                        },
                        {
                            label: 'Show me step by step',
                            toolName: 'owa_guide_start',
                            args: { manualId: 'W-06' },
                        },
                    ],
                    isAskFailed: true,
                });
            };
            const asked = (id: number): ChatMessageType => {
                return { id, author: 'you', text: 'change its title' };
            };
            expect(
                findHeldStudyAbove([ASKED, card, asked(3), failed(4)]),
            ).toEqual({ ...kept, isFromEarlierAsk: true, answersBetween: 1 });
            // Counted with the others: a third is too far up.
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    asked(3),
                    failed(4),
                    asked(5),
                    failed(6),
                ])?.answersBetween,
            ).toBe(2);
            expect(
                findHeldStudyAbove([
                    ASKED,
                    card,
                    asked(3),
                    failed(4),
                    asked(5),
                    failed(6),
                    asked(7),
                    failed(8),
                ]),
            ).toBeNull();
            // The same buttons on an answer that did not fail end it.
            const { isAskFailed: _failed, ...answered } = failed(4);
            expect(
                findHeldStudyAbove([ASKED, card, asked(3), answered]),
            ).toBeNull();
        });

        it('brings the same card back while the window holds its draft, else holds it again', () => {
            const kept = keepDraftedStudy(HELD);
            const held = toHeldStudyBefore(kept);
            if (held === null) {
                throw new Error('not held');
            }
            expect(genHeldStudyBeforeActions(held)).toEqual(
                genStudyDraftActions(kept),
            );
            // Pushed out by three newer drafts: held again, its words the
            // same, under a reference of its own.
            for (const title of ['One', 'Two', 'Three']) {
                keepDraftedStudy({ ...HELD, name: `JHN.3.16-17 ${title}.md` });
            }
            expect(takeDraftedStudy(kept.reference)).toBeNull();
            const again = genHeldStudyBeforeActions(held);
            const reference = again[0].args.reference;
            expect(reference).not.toBe(kept.reference);
            expect(takeDraftedStudy(reference)?.content).toBe(CONTENT);
            expect(
                again.map((action) => {
                    return action.label;
                }),
            ).toEqual(
                genStudyDraftActions(kept).map((action) => {
                    return action.label;
                }),
            );
        });

        it('offers an ordinary ask the study tool while the card above holds one', () => {
            const studyTool = { name: RESOURCES_TOOL_NAME };
            const tools = [
                { name: 'owa_help_search' },
                studyTool,
                { name: 'owa_click' },
            ];
            const ordinary = [tools[0], tools[2]];
            expect(withHeldStudyTool(ordinary, tools, HELD)).toEqual([
                ...ordinary,
                studyTool,
            ]);
            expect(withHeldStudyTool(ordinary, tools, null)).toBe(ordinary);
            // Offered already, or not on the host's list: as it was.
            expect(withHeldStudyTool(tools, tools, HELD)).toBe(tools);
            expect(withHeldStudyTool(ordinary, ordinary, HELD)).toBe(ordinary);
        });

        it('tells the ask the study the card holds, its headings and how a change reaches it', () => {
            expect(genHeldStudyAskHint(HELD)).toBe(
                '(The card under your last answer holds a NEW study file, ' +
                    `not saved yet: "${NAME}", on John 3:16-17. When they ` +
                    'ask to change it, call owa_resource_file draft with ' +
                    'this `file`: `section` (a heading as it reads) with ' +
                    '`content` -- that part read first, `read` with this ' +
                    '`file` and `section` -- or with `remove` true; `append` ' +
                    'for words at its end; `replace` for words where they ' +
                    'stand. The change goes into a new card. To put it into ' +
                    'another language, call owa_resource_file translate ' +
                    'with this `file`, `language` and `place`: the window ' +
                    'translates it, never you. To write it all ' +
                    'again, draft with `ref` "JHN 3:16-17", a `title` and no ' +
                    '`file`. Never tell them to change it by hand or to save ' +
                    'it before it can be changed. A question about its ' +
                    'passage -- what a word means, who someone is, the ' +
                    'background -- is part of this study, not a question ' +
                    'outside the app: answer it yourself in plain words (the ' +
                    'passage as the study quotes it is `read` with this ' +
                    '`file`), never telling them to type /btw, and change ' +
                    'nothing in it for a question. Its headings:\n' +
                    '# God So Loved\n## Setting\n## Picture\n## Prayer)',
            );
            expect(
                genHeldStudyAskHint({ ...HELD, passage: '', content: '' }),
            ).toMatch(
                /: "JHN\.3\.16-17 God So Loved\.md"\. When .* for a question\.\)$/,
            );
        });

        it('says a question about its passage is answered, never sent to /btw (EC-703)', () => {
            const hint = genHeldStudyAskHint(HELD);
            // After how it is changed, before its headings: one sentence.
            const at = hint.indexOf('A question about its passage');
            expect(at).toBeGreaterThan(
                hint.indexOf('before it can be changed.'),
            );
            expect(at).toBeLessThan(hint.indexOf('Its headings:'));
            expect(hint).toMatch(/never telling them to type \/btw/);
            expect(hint).toMatch(/change nothing in it for a question\./);
        });

        it('says the card is further up when answers stand between, and how an answer goes into it (EC-701)', () => {
            const hint = genHeldStudyAskHint({ ...HELD, answersBetween: 1 });
            expect(hint).toMatch(
                /^\(A card further up this chat, above your last answer, still holds a NEW study file, not saved yet: "JHN\.3\.16-17 God So Loved\.md", on John 3:16-17\. When they ask to change it, /,
            );
            // Everything after the lead as it was.
            expect(hint.slice(hint.indexOf('". When'))).toBe(
                genHeldStudyAskHint(HELD).slice(
                    genHeldStudyAskHint(HELD).indexOf('". When'),
                ),
            );
            expect(genHeldStudyKeepHint(HELD)).toBe(
                '(To add that answer to the new study the card above holds ' +
                    'instead, call owa_resource_file draft with `file` ' +
                    `"${NAME}" and \`append\` "@answer".)`,
            );
        });

        it('finds the held study a translate names, planned from its held words (EC-609)', () => {
            const translate = { action: 'translate', language: 'Termish' };
            expect(
                findHeldStudyToTranslate(
                    { ...translate, file: NAME },
                    HELD,
                    [],
                ),
            ).toBe(HELD);
            expect(
                findHeldStudyToTranslate(
                    { ...translate, file: `Default/${NAME.toLowerCase()}` },
                    HELD,
                    [],
                ),
            ).toBe(HELD);
            // Naming no file, with no study open: the held one.
            expect(findHeldStudyToTranslate(translate, HELD, [])).toBe(HELD);
            // A saved study's, the one open in the tab: the tool's.
            expect(
                findHeldStudyToTranslate({ ...translate, file: OPEN }, HELD, [
                    OPEN,
                ]),
            ).toBeNull();
            expect(
                findHeldStudyToTranslate(translate, HELD, [OPEN]),
            ).toBeNull();
            expect(
                findHeldStudyToTranslate(
                    { ...translate, file: `Default/${NAME}` },
                    HELD,
                    [`Default/${NAME}`],
                ),
            ).toBeNull();
            expect(
                findHeldStudyToTranslate(
                    { ...translate, file: NAME },
                    null,
                    [],
                ),
            ).toBeNull();
            // Its words go to the planner by its name: no file is read.
            expect(toHeldStudyTranslatePlanArgs(HELD, 'XXB')).toEqual({
                action: 'translate',
                name: NAME,
                content: CONTENT,
                bible: 'XXB',
            });
            expect(toHeldStudyTranslatePlanArgs(HELD, null)).toEqual({
                action: 'translate',
                name: NAME,
                content: CONTENT,
            });
        });

        describe('drafted as a new study once translated (EC-609)', () => {
            const TRANSLATED = [
                '# Xx God So Loved',
                '',
                '> **Xx John 3:16-17** (XXB)',
                '>',
                '> **16** Xx for God so loved the world.',
                '> **17** Xx for God sent not his Son.',
                '',
                '## Xx Setting',
                '',
                'Xx Nicodemus came by night.',
            ].join('\n');
            const LANGUAGE = {
                code: 'xx',
                name: 'Termish',
                nativeName: 'Termish',
                scriptPattern: null,
                terms: {},
            };
            // The worker's plan of a held study, as far as the draft reads
            // it: its own words in one part, the translations after them.
            const toPlan = (content: string, bible: string | null = 'XXB') => {
                const { body, footer } = splitStudyFooter(content);
                const { original, translations } = splitStudyTranslations(body);
                return {
                    file: '',
                    name: NAME,
                    hash: 'x',
                    title: 'God So Loved',
                    ref: 'JHN 3:16-17',
                    bible,
                    parts: [
                        { kind: 'keep' as const, text: original, quoted: null },
                    ],
                    translations,
                    footer,
                };
            };
            const toArgs = (
                place: 'append' | 'replace' | 'new',
                options: {
                    held?: typeof HELD;
                    body?: string;
                    bible?: string | null;
                    taken?: number[];
                } = {},
            ) => {
                const held = options.held ?? HELD;
                return toHeldStudyTranslateDraftArgs(held, {
                    plan: toPlan(held.content, options.bible),
                    body: options.body ?? TRANSLATED,
                    place,
                    language: LANGUAGE,
                    taken: options.taken ?? [],
                });
            };

            it('added after it: the study and its translation, its passage from the study’s Bible', () => {
                const both = {
                    action: 'draft',
                    ref: 'JHN 3:16-17',
                    title: 'God So Loved',
                    content: `${BODY}\n\n---\n\n${TRANSLATED}`,
                    bible: 'XB',
                };
                expect(toArgs('append')).toEqual(both);
                // One already in that language gives its place (EC-547).
                const twice = {
                    ...HELD,
                    content: toHeldContent(
                        `${BODY}\n\n---\n\n# Xx Old\n\nXx old words.`,
                    ),
                };
                expect(toArgs('append', { held: twice, taken: [0] })).toEqual(
                    both,
                );
                // Another language's stays, the new one after it.
                expect(toArgs('append', { held: twice })).toEqual({
                    ...both,
                    content:
                        `${BODY}\n\n---\n\n# Xx Old\n\nXx old words.\n\n` +
                        `---\n\n${TRANSLATED}`,
                });
            });

            it('in its place or as a copy: the translation alone, its passage from the Bible in that language', () => {
                const alone = {
                    action: 'draft',
                    ref: 'JHN 3:16-17',
                    title: 'Xx God So Loved',
                    content: '## Xx Setting\n\nXx Nicodemus came by night.',
                    bible: 'XXB',
                };
                expect(toArgs('replace')).toEqual(alone);
                expect(toArgs('new')).toEqual(alone);
                // No Bible in that language: the study's own.
                expect(toArgs('replace', { bible: null })).toEqual({
                    ...alone,
                    bible: 'XB',
                });
                // A title past what a file name holds is cut.
                const long = `Xx ${'word '.repeat(20)}end`;
                expect(
                    toArgs('replace', {
                        body: TRANSLATED.replace('Xx God So Loved', long),
                    }),
                ).toMatchObject({
                    title: long.slice(0, 60).trim(),
                });
            });

            it('refuses a copy of a study this answer drafted, and a translation that leaves no words', () => {
                expect(genHeldStudyCopyRefusal(HELD, 'new', true)).toBe(
                    `"${NAME}" was drafted in this answer and is not saved ` +
                        'yet, and an answer holds one card: a copy of its ' +
                        'own would take the study out. Translate it with ' +
                        'place "append" -- one new study holding both -- or ' +
                        '"replace", or tell them to press Create first and ' +
                        'then ask for the copy.',
                );
                // The card holds both, or the study in the language: one
                // card. A copy of one an earlier answer drafted: two.
                expect(
                    genHeldStudyCopyRefusal(HELD, 'append', true),
                ).toBeNull();
                expect(
                    genHeldStudyCopyRefusal(HELD, 'replace', true),
                ).toBeNull();
                expect(genHeldStudyCopyRefusal(HELD, 'new', false)).toBeNull();
                const noWords = {
                    reason:
                        `The translation of "${NAME}" left it no title or ` +
                        'no words to draft as a new study, so nothing was ' +
                        'drafted.',
                };
                const titleOnly = TRANSLATED.split('\n## ')[0];
                expect(toArgs('replace', { body: titleOnly })).toEqual(noWords);
                expect(toArgs('new', { body: titleOnly })).toEqual(noWords);
                expect(
                    toArgs('replace', { body: 'Xx words with no title.' }),
                ).toEqual(noWords);
            });

            it('tells the model no file changed and what the card holds', () => {
                const lead =
                    `"${NAME}" is a new study not saved yet, so no file ` +
                    'changed: the card under your answer holds ';
                const tail = '. Nothing is kept until they press Create.';
                expect(genHeldStudyTranslatedNote(NAME, 'append')).toBe(
                    `${lead}it again as a new study, its translation after ` +
                        `it${tail}`,
                );
                expect(genHeldStudyTranslatedNote(NAME, 'replace')).toBe(
                    `${lead}it again as a new study, translated in place of ` +
                        `its words${tail}`,
                );
                expect(genHeldStudyTranslatedNote(NAME, 'new')).toBe(
                    `${lead}the translation as a new study of its own, and ` +
                        `the card it was drafted under still holds the study${tail}`,
                );
            });
        });

        it('hands back a part the model was never shown, with its words, and keeps the study so when drafted again', async () => {
            const earlier = toHeldStudyBefore(keepDraftedStudy(HELD));
            if (earlier === null) {
                throw new Error('not held');
            }
            const settingEdit = {
                action: 'draft',
                file: NAME,
                section: 'Setting',
                content: '## Setting\n\nNicodemus came.',
            };
            const refused = chainHeldNewStudyEdit(settingEdit, earlier, [], []);
            expect(refused).toEqual({
                reason: expect.stringContaining(
                    `The part “Setting” is in nothing you were shown of "${NAME}"`,
                ),
                shown: {
                    fileKey: NAME.toLowerCase(),
                    text: '## Setting\n\nNicodemus came by night.',
                    isCut: false,
                },
            });
            const shown = (refused as { shown: any }).shown;
            expect(
                toEdit(settingEdit, earlier, [shown]).args.content,
            ).toContain('## Setting\n\nNicodemus came.\n\n## Picture');
            // Words written over in place need no read.
            const redrafted = await redraftHeldNewStudy(
                toEdit(REPLACE, earlier),
                earlier,
                {
                    callDraft: genDraftTool().callDraft,
                    parseDiagrams: genParser().parseDiagrams,
                },
                false,
            );
            expect(redrafted.drafted?.isFromEarlierAsk).toBe(true);
            expect(redrafted.drafted?.content).toContain('after dark');
            // One this ask drafted is the model's own words.
            const own = await redraftHeldNewStudy(
                toEdit(REPLACE),
                HELD,
                {
                    callDraft: genDraftTool().callDraft,
                    parseDiagrams: genParser().parseDiagrams,
                },
                false,
            );
            expect(own.drafted?.isFromEarlierAsk).toBeUndefined();
        });
    });
});

// The language a change to a study is written in, said on the ask
// (2026-11-13, EC-608).
describe('the language a change to a study is written in (EC-608)', () => {
    const NAME_MAP: Record<string, string> = {
        en: 'English',
        tt: 'Ttlang',
        zz: 'Zzlang',
    };
    function toName(code: string) {
        return NAME_MAP[code] ?? null;
    }
    // Reads the made-up words a half is written in, as the window reads a
    // typed line: `zorb` is Zzlang's, `tamo` Ttlang's, `the` English's.
    function readMadeUp(sample: string) {
        return /\bzorb\b/i.test(sample)
            ? 'zz'
            : /\btamo\b/i.test(sample)
              ? 'tt'
              : /\bthe\b/i.test(sample)
                ? 'en'
                : null;
    }
    const ENGLISH_HALF = [
        '# Born Again',
        '',
        '## The Setting',
        '',
        'Nicodemus came by night to the Lord.',
    ].join('\n');
    function withTranslations(...titles: string[]) {
        return [
            ENGLISH_HALF,
            ...titles.map((title) => {
                return `\n---\n\n# ${title}\n\n${title.toLowerCase()} vel quan.`;
            }),
        ].join('\n');
    }

    describe('readStudyHalfLanguages', () => {
        it('reads the study, then each translation after it, each by its own words', () => {
            expect(
                readStudyHalfLanguages(
                    withTranslations('Zorb', 'Tamo'),
                    'en',
                    readMadeUp,
                ),
            ).toEqual(['en', 'zz', 'tt']);
            expect(
                readStudyHalfLanguages(ENGLISH_HALF, 'en', readMadeUp),
            ).toEqual(['en']);
        });

        it('never by a quoted passage, a diagram or the footer', () => {
            const text = [
                '# Zorb Vel',
                '',
                '> **John 3:3** (KJV)',
                '>',
                '> **3** The Lord answered and said.',
                '',
                '```mermaid',
                'flowchart TD',
                '    A[The Way] --> B[The Life]',
                '```',
                '',
                'zorb vel quan.',
                '',
                '---',
                '',
                '*Drafted by the assistant.*',
            ].join('\n');
            const samples: string[] = [];
            const halves = readStudyHalfLanguages(
                composeStudyFile({
                    title: 'Zorb Vel',
                    passage: {
                        title: 'John 3:3',
                        bibleKey: 'KJV',
                        verses: [{ number: '3', text: 'The Lord answered.' }],
                    },
                    isPassageCut: false,
                    body: 'zorb vel quan.',
                    footnote: 'The assistant drafted it.',
                }),
                'en',
                (sample) => {
                    samples.push(sample);
                    return readMadeUp(sample);
                },
            );
            expect(halves).toEqual(['zz']);
            expect(samples.join('\n')).not.toContain('The Lord answered');
            expect(samples.join('\n')).not.toContain('drafted it');
            expect(readStudyHalfLanguages(text, 'en', readMadeUp)).toEqual([
                'zz',
            ]);
        });

        it('hands the app’s language to the reader, and reads six halves at most', () => {
            expect(
                readStudyHalfLanguages(ENGLISH_HALF, 'qq', (_sample, app) => {
                    return app;
                }),
            ).toEqual(['qq']);
            expect(
                readStudyHalfLanguages(
                    withTranslations(
                        'Zorb',
                        'Tamo',
                        'Zorb',
                        'Tamo',
                        'Zorb',
                        'Tamo',
                    ),
                    'en',
                    readMadeUp,
                ),
            ).toHaveLength(6);
        });

        it('a half its words cannot say is null', () => {
            expect(
                readStudyHalfLanguages('# Vel\n\nquan.', 'en', readMadeUp),
            ).toEqual([null]);
            expect(readStudyHalfLanguages('', 'en', readMadeUp)).toEqual([
                null,
            ]);
        });
    });

    describe('findOpenStudyFileName', () => {
        const OPEN = [
            'pdf/JHN.3.pdf',
            'Default/JHN.3.Born Again.md',
            'Bible Notes/GEN.4.Cain.md',
            'Default/sub/JHN.3.Deeper.md',
        ];

        it('names a study a change can be drafted for by its own base name', () => {
            expect(
                findOpenStudyFileName(
                    'C:\\data\\resources\\Default\\JHN.3.Born Again.md',
                    OPEN,
                ),
            ).toBe('Default/JHN.3.Born Again.md');
            expect(findOpenStudyFileName('/notes/gen.4.cain.MD', OPEN)).toBe(
                'Bible Notes/GEN.4.Cain.md',
            );
        });

        it('nothing for a file no change is drafted for, nor an empty path', () => {
            expect(findOpenStudyFileName('/data/JHN.3.Deeper.md', OPEN)).toBe(
                null,
            );
            expect(findOpenStudyFileName('/data/pdf/JHN.3.pdf', OPEN)).toBe(
                null,
            );
            expect(findOpenStudyFileName('', OPEN)).toBe(null);
            expect(findOpenStudyFileName('/x/JHN.3.Born Again.md', [])).toBe(
                null,
            );
        });
    });

    describe('genStudyLanguageHint', () => {
        const NAME = 'Default/JHN.3.Born Again.md';
        const OWN = { language: 'Zzlang', text: '  zorb vel quan  ' };

        it('says nothing of a study in the language the model is asked in', () => {
            for (const halfLanguages of [['en'], [null], ['en', null]]) {
                expect(
                    genStudyLanguageHint({
                        name: NAME,
                        halfLanguages,
                        askedCode: 'en',
                        ownWords: null,
                        toLanguageName: toName,
                    }),
                ).toBe(null);
            }
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['zz'],
                    askedCode: 'zz',
                    ownWords: null,
                    toLanguageName: toName,
                }),
            ).toBe(null);
        });

        it('a study in another language: every word put into it in that language', () => {
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['zz'],
                    askedCode: 'en',
                    ownWords: null,
                    toLanguageName: toName,
                }),
            ).toBe(
                `(The study file "${NAME}" is written in Zzlang: every word ` +
                    'you put into it is in Zzlang, whatever language this ' +
                    'message is in, unless they ask for another.)',
            );
            // Asked in their language of an English study, as of a Gemma 4.
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['en'],
                    askedCode: 'zz',
                    ownWords: null,
                    toLanguageName: toName,
                }),
            ).toContain(
                'is written in English: every word you put into it is in English,',
            );
        });

        it('a study and its translations: each half in its own language', () => {
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['en', 'zz'],
                    askedCode: 'en',
                    ownWords: null,
                    toLanguageName: toName,
                }),
            ).toBe(
                `(The study file "${NAME}" is written in English, with a ` +
                    'translation into Zzlang after it, each under a rule and ' +
                    'a # title of its own: a word you put into a part is in ' +
                    'the language of the half that part is in, whatever ' +
                    'language this message is in, unless they ask for ' +
                    'another.)',
            );
            const three = genStudyLanguageHint({
                name: NAME,
                halfLanguages: ['en', 'zz', 'tt', null],
                askedCode: 'zz',
                ownWords: null,
                toLanguageName: toName,
            });
            expect(three).toContain(
                'with translations into Zzlang, Ttlang and another language after it',
            );
        });

        it('a language none here names is the language it is written in', () => {
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['other'],
                    askedCode: 'en',
                    ownWords: null,
                }),
            ).toBe(
                `(The study file "${NAME}" is not written in English: every ` +
                    'word you put into it is in the language it is written ' +
                    'in, whatever language this message is in, unless they ' +
                    'ask for another.)',
            );
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['other'],
                    askedCode: 'qq',
                    ownWords: null,
                    toLanguageName: toName,
                }),
            ).toContain('is not written in the language of this message:');
        });

        it('asked their English: their words as typed, and the answer in English', () => {
            const hint = genStudyLanguageHint({
                name: NAME,
                halfLanguages: ['zz'],
                askedCode: 'en',
                ownWords: OWN,
                toLanguageName: toName,
            });
            expect(hint).toContain('is written in Zzlang: every word');
            expect(hint).toContain(
                'They asked in Zzlang, and the question this message starts ' +
                    'with is its English. As they typed it: "zorb vel quan". ' +
                    'A word of the study it names -- what a `replace` writes ' +
                    'over -- and words they give to be written into it are ' +
                    'taken from what they typed, exactly as they typed it, ' +
                    'never the English of it. Your answer to them stays in ' +
                    'English: the window puts it into their language.)',
            );
            // An English study: their words alone.
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['en'],
                    askedCode: 'en',
                    ownWords: OWN,
                    toLanguageName: toName,
                }),
            ).toMatch(/^\(They asked in Zzlang, /);
            // Nothing typed is nothing to carry.
            expect(
                genStudyLanguageHint({
                    name: NAME,
                    halfLanguages: ['en'],
                    askedCode: 'en',
                    ownWords: { language: 'Zzlang', text: '   ' },
                    toLanguageName: toName,
                }),
            ).toBe(null);
        });
    });
});
