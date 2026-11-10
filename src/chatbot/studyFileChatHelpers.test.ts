import { describe, expect, it } from 'vitest';

import {
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_NOTE,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
    clearStudyRenameWait,
    genStudyDraftActions,
    keepDraftedStudy,
    readDraftedStudy,
    readStudyFileAsk,
    setStudyRenameWait,
    takeDraftedStudy,
    takeStudyRenameWait,
    toModelDraftText,
    toStudyAsk,
} from './studyFileChatHelpers';

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

    it('passes a refusal through untouched', () => {
        expect(toModelDraftText('Tool refused: no')).toBe('Tool refused: no');
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
