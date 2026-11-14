import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        appError: vi.fn(),
        genLyricDraftAnswer: vi.fn(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: mocks.appError };
});
vi.mock('./helpBotHelpers', () => {
    return { genLyricDraftAnswer: mocks.genLyricDraftAnswer };
});

import {
    describeLyricDocumentStep,
    genLyricDocumentListAnswer,
    genPictureWordsAsk,
    LYRIC_DOCUMENT_PICTURES_LABEL,
    LYRIC_DOCUMENT_STEP_TOOL_NAME,
    readLyricDocumentTypedPick,
    runLyricDocumentStep,
    type LyricDocumentDepsType,
} from './lyricDocumentChatHelpers';

type DepsMockType = {
    callTool: ReturnType<typeof vi.fn<LyricDocumentDepsType['callTool']>>;
    callToolWithPictures: ReturnType<
        typeof vi.fn<LyricDocumentDepsType['callToolWithPictures']>
    >;
    transcribe: ReturnType<typeof vi.fn<LyricDocumentDepsType['transcribe']>>;
    report: ReturnType<typeof vi.fn<(line: string) => void>>;
};

function genDeps(): DepsMockType {
    return {
        callTool: vi.fn<LyricDocumentDepsType['callTool']>(),
        callToolWithPictures:
            vi.fn<LyricDocumentDepsType['callToolWithPictures']>(),
        transcribe: vi.fn<LyricDocumentDepsType['transcribe']>(),
        report: vi.fn<(line: string) => void>(),
    };
}

function asDeps(deps: DepsMockType) {
    return deps as unknown as LyricDocumentDepsType;
}

const PICTURES_ACTION = (name: string) => {
    return {
        label: LYRIC_DOCUMENT_PICTURES_LABEL,
        toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
        args: { step: 'pictures', name },
    };
};

const READ = {
    kind: 'document',
    name: 'Hymns.pptx',
    documentKind: 'pptx',
    title: 'Praise Song No. 1',
    headings: [],
    fontFamily: 'Body Face',
    text: 'Praise Song No. 1\n\nLine A\nLine B',
    blocks: [{ page: 1, text: 'Line A\nLine B' }],
    readablePages: [1],
    pictureNeededPages: [],
};

beforeEach(() => {
    mocks.genLyricDraftAnswer.mockImplementation(
        (_raw: string, opening: string, options: any) => {
            return {
                text: [opening, ...(options?.notes ?? [])].join('\n\n'),
                actions: [
                    { label: 'Create "Song"', toolName: 'owa-lyric-create' },
                    ...(options?.actions ?? []),
                ],
            };
        },
    );
});

describe('readLyricDocumentTypedPick', () => {
    const actions = genLyricDocumentListAnswer(
        ['Hymn One.pptx', 'Hymn Two.pptx', 'Psalm.pdf'],
        { step: 'list', kinds: ['pptx', 'pdf'] },
    ).actions;

    it('takes a unique piece of three letters or more, and no shorter one', () => {
        expect(readLyricDocumentTypedPick(actions, 'two')).toEqual({
            step: 'read',
            name: 'Hymn Two.pptx',
        });
        expect(readLyricDocumentTypedPick(actions, 'sal')).toEqual({
            step: 'read',
            name: 'Psalm.pdf',
        });
        // Two letters only ever name a file by its whole stem.
        expect(readLyricDocumentTypedPick(actions, 'ps')).toBeNull();
        expect(readLyricDocumentTypedPick(actions, 'tw')).toBeNull();
    });

    it('takes nothing typed blank, and nothing under another list', () => {
        expect(readLyricDocumentTypedPick(actions, '   ')).toBeNull();
        expect(
            readLyricDocumentTypedPick(
                [{ label: 'Psalm.pdf', toolName: 'owa-other' }],
                'psalm',
            ),
        ).toBeNull();
        expect(readLyricDocumentTypedPick(undefined, 'psalm')).toBeNull();
    });
});

describe('runLyricDocumentStep: reading a file', () => {
    it('says the font is missing here when the slides name one this computer lacks', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('Drafted a song from the text.');
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, isFontMissing: true }),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(deps.report).toHaveBeenCalledWith(
            'Reading Hymns.pptx from the app',
        );
        const [, , options] = mocks.genLyricDraftAnswer.mock.calls[0];
        expect(options.notes).toEqual([
            'Every stage shows it in Body Face, the font of its slides. ' +
                'Change it in Stage Style → Song Font.',
            'Body Face is not installed on this computer, so it shows in ' +
                'the app font here.',
        ]);
        expect(answer.text).toContain('Body Face is not installed');
    });

    it('says no font at all when the slides name none', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('Drafted a song from the text.');
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({
                ...READ,
                fontFamily: '',
                isFontMissing: true,
            }),
            pictures: [],
        });
        await runLyricDocumentStep(
            { step: 'read', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        const [, , options] = mocks.genLyricDraftAnswer.mock.calls[0];
        expect(options.notes).toEqual([]);
    });

    it('says it found no song when the drafter writes none, keeping the pictures button', async () => {
        mocks.genLyricDraftAnswer.mockReturnValue(null);
        const deps = genDeps();
        deps.callTool.mockResolvedValue('No song in it.');
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, pictureNeededPages: [2] }),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(answer).toEqual({
            text:
                'I read “Hymns.pptx” but could not find a song on it. If ' +
                'the words are in front of you, paste them here and I will ' +
                'write them out.',
            actions: [PICTURES_ACTION('Hymns.pptx')],
        });
    });

    it('says it found no song on a file with no words and no pictures to read', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, blocks: [] }),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(deps.callTool).not.toHaveBeenCalled();
        expect(answer).toEqual({
            text:
                'I read “Hymns.pptx” but could not find a song on it. If ' +
                'the words are in front of you, paste them here and I will ' +
                'write them out.',
        });
    });

    it('says it could not open the file when its words do not come back', async () => {
        for (const text of ['not json', 'null', '7']) {
            const deps = genDeps();
            deps.callToolWithPictures.mockResolvedValue({ text, pictures: [] });
            const answer = await runLyricDocumentStep(
                { step: 'read', name: 'Hymns.pptx' },
                asDeps(deps),
            );
            expect(answer, text).toEqual({
                text: 'I could not open "Hymns.pptx" to read its words.',
            });
        }
        expect(mocks.appError).toHaveBeenCalledTimes(3);
        expect(mocks.appError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(mocks.appError.mock.calls[0][1]).toBe('lyric from a document');
    });
});

describe('runLyricDocumentStep: the list', () => {
    it('lists the files when the ask names none of them', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue(
            JSON.stringify({ names: ['Hymns.pptx', 7, 'Other.pptx', 'x.pdf'] }),
        );
        const answer = await runLyricDocumentStep(
            { step: 'list', kinds: ['pptx'], words: 'a song from my slides' },
            asDeps(deps),
        );
        expect(deps.callToolWithPictures).not.toHaveBeenCalled();
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual(['Hymns.pptx', 'Other.pptx']);
    });

    it('says there is no document when the list does not come back', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('no list');
        const answer = await runLyricDocumentStep(
            { step: 'list', kinds: ['pptx'] },
            asDeps(deps),
        );
        expect(answer.text).toBe(
            'There is no PowerPoint, Word, PDF or slide file in your ' +
                'Documents list. Add the file there first, then ask me again.',
        );
        expect(answer.actions).toBeUndefined();
    });
});

describe('runLyricDocumentStep: reading the pictures', () => {
    const picture = { mediaType: 'image/jpeg', data: 'AAAA' } as const;
    const TRY_AGAIN =
        'I could not read the words off the pictures just now. Press the ' +
        'button again in a moment.';

    it('asks to press again when no picture came back, with no assistant asked', async () => {
        for (const reply of [
            { read: { ...READ, pictureFor: [2] }, pictures: [] },
            { read: { ...READ, pictureFor: [] }, pictures: [picture] },
            { read: { ...READ }, pictures: [picture] },
        ]) {
            const deps = genDeps();
            deps.callToolWithPictures.mockResolvedValue({
                text: JSON.stringify(reply.read),
                pictures: reply.pictures as any,
            });
            const answer = await runLyricDocumentStep(
                { step: 'pictures', name: 'Hymns.pptx' },
                asDeps(deps),
            );
            expect(answer).toEqual({
                text: TRY_AGAIN,
                actions: [PICTURES_ACTION('Hymns.pptx')],
            });
            expect(deps.transcribe).not.toHaveBeenCalled();
        }
    });

    it('asks to press again when the assistant read no words for any picture', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, pictureFor: [2] }),
            pictures: [picture as any],
        });
        deps.transcribe.mockResolvedValue({
            text: '=== picture 5 ===\nWords of no picture asked for',
            who: 'A Seeing Model',
        });
        const answer = await runLyricDocumentStep(
            { step: 'pictures', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(answer).toEqual({
            text: TRY_AGAIN,
            actions: [PICTURES_ACTION('Hymns.pptx')],
        });
        expect(deps.callTool).not.toHaveBeenCalled();
    });

    it('titles the joined words by the file name when the read gives no title', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('Drafted a song from the text.');
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({
                ...READ,
                title: undefined,
                blocks: [],
                pictureFor: [1],
            }),
            pictures: [picture as any],
        });
        deps.transcribe.mockResolvedValue({
            text: 'Only words',
            who: 'A Seeing Model',
        });
        await runLyricDocumentStep(
            { step: 'pictures', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(deps.callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            text: 'Hymns\n\nOnly words',
            mode: 'draft',
            title: undefined,
        });
    });

    it('says it could not open the file when its words do not come back', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockResolvedValue({
            text: 'not json',
            pictures: [picture as any],
        });
        const answer = await runLyricDocumentStep(
            { step: 'pictures', name: 'Hymns.pptx' },
            asDeps(deps),
        );
        expect(answer).toEqual({
            text: 'I could not open "Hymns.pptx" to read its words.',
        });
        expect(deps.transcribe).not.toHaveBeenCalled();
    });
});

describe('describeLyricDocumentStep', () => {
    it('names the file a step reads, and nothing for the list', () => {
        expect(
            describeLyricDocumentStep({ step: 'list', kinds: ['pptx'] }),
        ).toBeNull();
        expect(
            describeLyricDocumentStep({ step: 'read', name: 'Hymns.pptx' }),
        ).toBe('Reading Hymns.pptx from the app');
        expect(
            describeLyricDocumentStep({ step: 'pictures', name: 'a.pdf' }),
        ).toBe('Reading a.pdf from the app');
    });
});

describe('genPictureWordsAsk', () => {
    it('asks for each picture by the marker line the reader splits on', () => {
        const ask = genPictureWordsAsk(3);
        expect(ask).toContain('these 3 picture(s), in order');
        expect(ask).toContain('"=== picture N ==="');
    });
});
