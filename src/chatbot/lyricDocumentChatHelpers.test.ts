import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        genLyricDraftAnswer: vi.fn(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./helpBotHelpers', () => {
    return { genLyricDraftAnswer: mocks.genLyricDraftAnswer };
});

import {
    LYRIC_DOCUMENT_MORE_LABEL,
    LYRIC_DOCUMENT_PICTURES_LABEL,
    LYRIC_DOCUMENT_STEP_TOOL_NAME,
    findNamedDocumentFile,
    genLyricDocumentListAnswer,
    genLyricDocumentListState,
    readLyricDocumentAsk,
    readLyricDocumentTypedPick,
    readPictureWords,
    runLyricDocumentStep,
    toValidLyricDocumentState,
    type LyricDocumentDepsType,
} from './lyricDocumentChatHelpers';

const ALL_KINDS = ['pptx', 'docx', 'pdf', 'slide'];

function genDeps(overrides: Partial<LyricDocumentDepsType> = {}) {
    return {
        callTool: vi.fn(),
        callToolWithPictures: vi.fn(),
        transcribe: vi.fn(),
        ...overrides,
    } as unknown as LyricDocumentDepsType & {
        callTool: ReturnType<typeof vi.fn>;
        callToolWithPictures: ReturnType<typeof vi.fn>;
        transcribe: ReturnType<typeof vi.fn>;
    };
}

beforeEach(() => {
    mocks.genLyricDraftAnswer.mockReset();
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

describe('readLyricDocumentAsk', () => {
    it('takes a song asked to be made out of a document', () => {
        expect(
            readLyricDocumentAsk('create lyric from powerpoint file'),
        ).toEqual({
            step: 'list',
            kinds: ['pptx'],
            words: 'create lyric from powerpoint file',
        });
        expect(
            readLyricDocumentAsk('Make a song from my PowerPoint'),
        ).toMatchObject({ step: 'list', kinds: ['pptx'] });
        expect(readLyricDocumentAsk('turn this pdf into lyrics')).toMatchObject(
            { kinds: ['pdf'] },
        );
        expect(
            readLyricDocumentAsk('Make a hymn from a Word document'),
        ).toMatchObject({ kinds: ['docx'] });
        expect(
            readLyricDocumentAsk('create a song from one of my documents'),
        ).toMatchObject({ kinds: ALL_KINDS });
        expect(
            readLyricDocumentAsk('make a song out of Hymns 21&22.pptx'),
        ).toMatchObject({ kinds: ['pptx'] });
    });

    it('leaves a how-to, an export, a command and a plain song ask alone', () => {
        expect(
            readLyricDocumentAsk('How do I make a song from a PowerPoint?'),
        ).toBeNull();
        expect(
            readLyricDocumentAsk(
                "How do I export a song's lyric stages to PowerPoint?",
            ),
        ).toBeNull();
        expect(
            readLyricDocumentAsk('export my song to a PowerPoint file'),
        ).toBeNull();
        expect(readLyricDocumentAsk('save the song as pdf')).toBeNull();
        expect(readLyricDocumentAsk('/lyric-from powerpoint')).toBeNull();
        expect(
            readLyricDocumentAsk(
                'Create a lyric file for song "Amazing Grace"',
            ),
        ).toBeNull();
        expect(readLyricDocumentAsk('open my PowerPoint file')).toBeNull();
        expect(readLyricDocumentAsk('')).toBeNull();
        // The song-from-a-link starter: the FILE is the song being made.
        expect(
            readLyricDocumentAsk(
                'Create a lyric file from https://example.com/amazing-grace',
            ),
        ).toBeNull();
        expect(
            readLyricDocumentAsk('make a song from the word of God'),
        ).toBeNull();
        expect(
            readLyricDocumentAsk('make a song from my word document'),
        ).toMatchObject({ kinds: ['docx'] });
    });
});

describe('the file list', () => {
    const NAMES = [
        'Hymns 21&22.pptx',
        'Amazing Grace.owl',
        'song 7 new.ows',
        'notes.docx',
        'aa.pdf',
        'max_style_elements.pptx',
    ];

    it('lists the kind asked for, file names as data, ten a page', () => {
        const answer = genLyricDocumentListAnswer(NAMES, {
            step: 'list',
            kinds: ['pptx'],
        });
        expect(answer.actions).toEqual([
            {
                label: 'Hymns 21&22.pptx',
                toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
                args: { step: 'read', name: 'Hymns 21&22.pptx' },
                isData: true,
            },
            {
                label: 'max_style_elements.pptx',
                toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
                args: { step: 'read', name: 'max_style_elements.pptx' },
                isData: true,
            },
        ]);
        const many = Array.from({ length: 23 }, (_, index) => {
            return `deck ${index + 1}.pptx`;
        });
        const first = genLyricDocumentListAnswer(many, {
            step: 'list',
            kinds: ['pptx'],
        });
        expect(first.actions).toHaveLength(11);
        expect(first.actions?.at(-1)).toMatchObject({
            label: LYRIC_DOCUMENT_MORE_LABEL,
            args: { step: 'list', kinds: ['pptx'], offset: 10 },
        });
        const last = genLyricDocumentListAnswer(many, {
            step: 'list',
            kinds: ['pptx'],
            offset: 20,
        });
        expect(last.actions?.map((action) => action.label)).toEqual([
            'deck 21.pptx',
            'deck 22.pptx',
            'deck 23.pptx',
        ]);
    });

    it('says so when there is no such file, never a song file', () => {
        const answer = genLyricDocumentListAnswer(['Amazing Grace.owl'], {
            step: 'list',
            kinds: [...ALL_KINDS] as any,
        });
        expect(answer.actions).toBeUndefined();
        expect(answer.text).toMatch(/Add the file there first/);
    });

    it('finds the one file a sentence names, by name or stem', () => {
        expect(
            findNamedDocumentFile('make a song out of hymns 21&22', NAMES),
        ).toBe('Hymns 21&22.pptx');
        expect(
            findNamedDocumentFile('a song from song 7 new.ows please', NAMES),
        ).toBe('song 7 new.ows');
        expect(findNamedDocumentFile('a song from my powerpoint', NAMES)).toBe(
            null,
        );
        expect(
            findNamedDocumentFile('song 2', ['song.pptx', 'song 2.pptx']),
        ).toBe('song 2.pptx');
    });

    it('reads a typed pick by number, name, stem, piece or button words', () => {
        const actions = genLyricDocumentListAnswer(
            Array.from({ length: 12 }, (_, index) => {
                return `Hymn ${index + 1}.pptx`;
            }),
            { step: 'list', kinds: ['pptx'] },
        ).actions;
        expect(readLyricDocumentTypedPick(actions, '2')).toEqual({
            step: 'read',
            name: 'Hymn 2.pptx',
        });
        expect(readLyricDocumentTypedPick(actions, 'hymn 10')).toEqual({
            step: 'read',
            name: 'Hymn 10.pptx',
        });
        expect(readLyricDocumentTypedPick(actions, 'Hymn 3.pptx')).toEqual({
            step: 'read',
            name: 'Hymn 3.pptx',
        });
        expect(readLyricDocumentTypedPick(actions, 'more files')).toEqual({
            step: 'list',
            kinds: ['pptx'],
            offset: 10,
        });
        // "hymn" fits ten files: no guess.
        expect(readLyricDocumentTypedPick(actions, 'hymn')).toBeNull();
        expect(readLyricDocumentTypedPick(actions, '42')).toBeNull();
        expect(readLyricDocumentTypedPick([], '1')).toBeNull();
    });

    it('builds the list a /lyric-from asks for', () => {
        expect(genLyricDocumentListState('')).toEqual({
            step: 'list',
            kinds: ALL_KINDS,
        });
        expect(genLyricDocumentListState('powerpoint')).toEqual({
            step: 'list',
            kinds: ['pptx'],
            words: 'powerpoint',
        });
    });
});

describe('toValidLyricDocumentState', () => {
    it('keeps what a step needs and refuses a path', () => {
        expect(
            toValidLyricDocumentState({
                step: 'list',
                kinds: ['pptx', 'exe'],
                offset: 10,
            }),
        ).toEqual({ step: 'list', kinds: ['pptx'], offset: 10 });
        expect(
            toValidLyricDocumentState({ step: 'read', name: 'a.pptx' }),
        ).toEqual({ step: 'read', name: 'a.pptx' });
        expect(
            toValidLyricDocumentState({ step: 'read', name: '../x/a.pptx' }),
        ).toBeNull();
        expect(
            toValidLyricDocumentState({ step: 'read', name: 'C:\\a.pptx' }),
        ).toBeNull();
        expect(
            toValidLyricDocumentState({ step: 'pictures', name: 'a.owl' }),
        ).toBeNull();
        expect(toValidLyricDocumentState({ step: 'delete' })).toBeNull();
        expect(toValidLyricDocumentState(null)).toBeNull();
    });
});

describe('readPictureWords', () => {
    it('splits on the marker lines, a fence and a lead-in left out', () => {
        const words = readPictureWords(
            'Here are the words:\n```\n=== picture 1 ===\nLine one\nLine two\n\n' +
                '=== picture 2 ===\n\n=== picture 3 ===\nThird\n```',
            3,
        );
        expect([...words.entries()]).toEqual([
            [1, 'Line one\nLine two'],
            [3, 'Third'],
        ]);
    });

    it('gives words with no marker to the one picture', () => {
        expect([...readPictureWords('Only words', 1).entries()]).toEqual([
            [1, 'Only words'],
        ]);
        expect(readPictureWords('', 1).size).toBe(0);
        expect(readPictureWords('=== picture 9 ===\nx', 2).size).toBe(0);
    });
});

describe('runLyricDocumentStep', () => {
    const READ = {
        kind: 'document',
        name: 'Hymns.pptx',
        documentKind: 'pptx',
        title: 'Praise Song No. 1',
        headings: ['Praise Song No. 1', 'Praise Song No. 2'],
        fontFamily: 'Body Face',
        text: 'Praise Song No. 1\n\nLine A\nLine B',
        blocks: [{ page: 1, text: 'Line A\nLine B' }],
        readablePages: [1],
        pictureNeededPages: [],
    };

    it('reads the one file the ask names, with no list', async () => {
        const deps = genDeps();
        deps.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_media_file') {
                expect(args).toEqual({ action: 'list', kind: 'document' });
                return JSON.stringify({ names: ['Hymns.pptx', 'x.pdf'] });
            }
            expect(name).toBe('owa_lyric_validate');
            expect(args).toEqual({
                text: READ.text,
                mode: 'draft',
                title: READ.title,
            });
            return 'Drafted a song from the text.';
        });
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify(READ),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'list', kinds: ['pptx'], words: 'a song from hymns' },
            deps,
        );
        expect(deps.callToolWithPictures).toHaveBeenCalledWith(
            'owa_media_file',
            { action: 'info', kind: 'document', name: 'Hymns.pptx' },
        );
        const [, opening, options] = mocks.genLyricDraftAnswer.mock.calls[0];
        expect(opening).toMatch(/“Hymns\.pptx”/);
        expect(options.fontFamily).toBe('Body Face');
        expect(options.notes.join(' ')).toMatch(
            /headings.*“Praise Song No\. 1”, “Praise Song No\. 2”/,
        );
        expect(options.notes.join(' ')).toMatch(/Body Face/);
        expect(options.actions).toEqual([]);
        expect(answer.text).toMatch(/Stage Style → Song Font/);
    });

    it('offers the pictures when some pages had no words to read', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('Drafted a song from the text.');
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, pictureNeededPages: [3] }),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'Hymns.pptx' },
            deps,
        );
        expect(answer.actions?.at(-1)).toEqual({
            label: LYRIC_DOCUMENT_PICTURES_LABEL,
            toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
            args: { step: 'pictures', name: 'Hymns.pptx' },
        });
        expect(answer.text).toMatch(/no words I can read/);
    });

    it('offers only the pictures when no page had words', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({
                ...READ,
                fontFamily: null,
                headings: [],
                blocks: [],
                pictureNeededPages: [1, 2],
            }),
            pictures: [],
        });
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'song 7 new.ows' },
            deps,
        );
        expect(deps.callTool).not.toHaveBeenCalled();
        expect(answer.text).toMatch(/could not read any words/);
        expect(answer.actions).toEqual([
            {
                label: LYRIC_DOCUMENT_PICTURES_LABEL,
                toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
                args: { step: 'pictures', name: 'song 7 new.ows' },
            },
        ]);
    });

    it('reads the pictures and joins their words in page order', async () => {
        const deps = genDeps();
        deps.callTool.mockResolvedValue('Drafted a song from the text.');
        const picture = { mediaType: 'image/jpeg', data: 'AAAA' };
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({
                ...READ,
                fontFamily: null,
                headings: [],
                blocks: [{ page: 1, text: 'Read off the slide' }],
                pictureNeededPages: [2, 4],
                pictureFor: [2, 4],
            }),
            pictures: [picture, picture],
        });
        deps.transcribe.mockResolvedValue({
            text: '=== picture 1 ===\nSecond slide words\n\n=== picture 2 ===\nFourth',
            who: 'A Seeing Model',
        });
        const answer = await runLyricDocumentStep(
            { step: 'pictures', name: 'Hymns.pptx' },
            deps,
        );
        expect(deps.callToolWithPictures).toHaveBeenCalledWith(
            'owa_media_file',
            {
                action: 'info',
                kind: 'document',
                name: 'Hymns.pptx',
                pictures: true,
            },
        );
        expect(deps.transcribe).toHaveBeenCalledWith([picture, picture]);
        expect(deps.callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            text:
                'Praise Song No. 1\n\nRead off the slide\n\n' +
                'Second slide words\n\nFourth',
            mode: 'draft',
            title: 'Praise Song No. 1',
        });
        expect(answer.text).toMatch(/A Seeing Model read the words of 2/);
    });

    it('says so, with a way to an assistant, when none sees pictures', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ ...READ, pictureFor: [2] }),
            pictures: [{ mediaType: 'image/jpeg', data: 'AAAA' }],
        });
        deps.transcribe.mockResolvedValue(null);
        const answer = await runLyricDocumentStep(
            { step: 'pictures', name: 'Hymns.pptx' },
            deps,
        );
        expect(answer.text).toMatch(/No assistant here can see pictures/);
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'Open AI settings',
            LYRIC_DOCUMENT_PICTURES_LABEL,
        ]);
        expect(deps.callTool).not.toHaveBeenCalled();
    });

    it('never shows a tool error, only a sentence', async () => {
        const deps = genDeps();
        deps.callToolWithPictures.mockRejectedValue(
            new Error('Timed out evaluating in C:\\Users\\someone'),
        );
        const answer = await runLyricDocumentStep(
            { step: 'read', name: 'a.pptx' },
            deps,
        );
        expect(answer.text).toBe(
            'I could not open "a.pptx" to read its words.',
        );
    });
});
