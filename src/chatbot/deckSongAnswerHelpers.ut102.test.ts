// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        readDocumentWords: vi.fn(),
        answerLyricSources: vi.fn(),
        appError: vi.fn(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: mocks.appError };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch (_error) {
                return null;
            }
        },
    };
});
vi.mock('./documentWordsHelpers', () => {
    return { readDocumentWords: mocks.readDocumentWords };
});
vi.mock('./helpBotHelpers', () => {
    return { answerLyricSources: mocks.answerLyricSources };
});

import { draftDeckSongs, planDeckSongAsk } from './deckSongAnswerHelpers';
import {
    DECK_SONG_TOOL_NAME,
    MAX_DECK_BUTTON_COUNT,
} from './deckSongAskHelpers';
import { MAX_SONGS_PER_ASK } from './lyricDraftHelpers';
import { MEDIA_FILE_TOOL_NAME } from './webBackgroundAskHelpers';

function listAnswer(folder: unknown, names: unknown) {
    return JSON.stringify({ folder, names });
}

beforeEach(() => {
    mocks.answerLyricSources.mockImplementation(
        async (sources: { name: string }[]) => {
            return {
                text: `drafted ${sources
                    .map((source) => {
                        return source.name;
                    })
                    .join(', ')}`,
                actions: [{ label: 'Create', toolName: 'owa-lyric-create' }],
            };
        },
    );
});

describe('planDeckSongAsk', () => {
    it('reads the Documents list through the media tool', async () => {
        mocks.callTool.mockResolvedValue(listAnswer('/docs', []));
        await planDeckSongAsk({ nameWords: [], kinds: ['pptx'] });
        expect(mocks.callTool).toHaveBeenCalledWith(MEDIA_FILE_TOOL_NAME, {
            action: 'list',
            kind: 'document',
        });
    });

    it('drafts at once the one file the ask named', async () => {
        mocks.callTool.mockResolvedValue(
            listAnswer('/docs', [
                'Amazing Grace.pptx',
                'Other Song.pptx',
                'notes.txt',
            ]),
        );
        const plan = await planDeckSongAsk({
            nameWords: ['amazing', 'grace'],
            kinds: ['pptx'],
        });
        expect(plan).toEqual({
            kind: 'draft',
            files: [
                {
                    filePath: '/docs/Amazing Grace.pptx',
                    name: 'Amazing Grace.pptx',
                },
            ],
        });
    });

    it('writes a Windows folder with its own separator', async () => {
        mocks.callTool.mockResolvedValue(
            listAnswer('C:\\Users\\me\\Docs\\', ['Amazing Grace.pptx']),
        );
        const plan = await planDeckSongAsk({
            nameWords: ['amazing', 'grace'],
            kinds: ['pptx'],
        });
        expect(plan).toEqual({
            kind: 'draft',
            files: [
                {
                    filePath: 'C:\\Users\\me\\Docs\\Amazing Grace.pptx',
                    name: 'Amazing Grace.pptx',
                },
            ],
        });
    });

    it('offers every document as a button when none is named', async () => {
        mocks.callTool.mockResolvedValue(
            listAnswer('/docs', ['First.pptx', 'Second.pdf', '', 7, 'a.txt']),
        );
        const plan = await planDeckSongAsk({
            nameWords: [],
            kinds: ['pptx', 'docx', 'pdf', 'ows'],
        });
        expect(plan?.kind).toBe('answer');
        if (plan?.kind !== 'answer') {
            throw new Error('not an answer');
        }
        expect(plan.answer.actions).toEqual([
            {
                label: 'Make a song from "First.pptx"',
                toolName: DECK_SONG_TOOL_NAME,
                args: { filePath: '/docs/First.pptx', name: 'First.pptx' },
            },
            {
                label: 'Make a song from "Second.pdf"',
                toolName: DECK_SONG_TOOL_NAME,
                args: { filePath: '/docs/Second.pdf', name: 'Second.pdf' },
            },
        ]);
    });

    it('says how many are left out past the button count', async () => {
        const names = Array.from(
            { length: MAX_DECK_BUTTON_COUNT + 2 },
            (_value, index) => {
                return `Song ${index + 1}.pptx`;
            },
        );
        mocks.callTool.mockResolvedValue(listAnswer('/docs', names));
        const plan = await planDeckSongAsk({ nameWords: [], kinds: ['pptx'] });
        if (plan?.kind !== 'answer') {
            throw new Error('not an answer');
        }
        expect(plan.answer.actions).toHaveLength(MAX_DECK_BUTTON_COUNT);
        expect(plan.answer.text).toContain(
            `These are ${MAX_DECK_BUTTON_COUNT} of the ${names.length}`,
        );
    });

    it('says how to attach one when the list holds no document', async () => {
        mocks.callTool.mockResolvedValue(listAnswer('/docs', ['a.txt']));
        const plan = await planDeckSongAsk({ nameWords: [], kinds: ['pptx'] });
        if (plan?.kind !== 'answer') {
            throw new Error('not an answer');
        }
        expect(plan.answer.actions).toEqual([]);
        expect(plan.answer.text).toContain('Your Documents list has no');
    });

    it('is null when the list is not a folder with names', async () => {
        for (const answer of [
            'not json',
            listAnswer('', ['a.pptx']),
            listAnswer(7, ['a.pptx']),
            listAnswer('/docs', 'a.pptx'),
            'null',
        ]) {
            mocks.callTool.mockResolvedValueOnce(answer);
            expect(
                await planDeckSongAsk({ nameWords: [], kinds: ['pptx'] }),
                answer,
            ).toBeNull();
        }
        expect(mocks.appError).not.toHaveBeenCalled();
    });

    it('is null, and logs, when the tool host throws', async () => {
        const error = new Error('no host');
        mocks.callTool.mockRejectedValue(error);
        expect(
            await planDeckSongAsk({ nameWords: [], kinds: ['pptx'] }),
        ).toBeNull();
        expect(mocks.appError).toHaveBeenCalledWith(
            error,
            'song from a document file',
        );
    });
});

describe('draftDeckSongs', () => {
    it('reads each file and drafts its words with no model', async () => {
        mocks.readDocumentWords.mockResolvedValue('Line one\nLine two');
        const reportStep = vi.fn();
        const answer = await draftDeckSongs(
            [{ filePath: '/docs/Song.pptx', name: 'Song.pptx' }],
            reportStep,
        );
        expect(mocks.readDocumentWords).toHaveBeenCalledWith('/docs/Song.pptx');
        expect(mocks.answerLyricSources).toHaveBeenCalledWith(
            [{ kind: 'text', name: 'Song.pptx', text: 'Line one\nLine two' }],
            0,
            reportStep,
        );
        expect(answer.text).toBe('drafted Song.pptx');
    });

    it('takes the words a file came with instead of reading it', async () => {
        await draftDeckSongs([
            { filePath: '/docs/A.pptx', name: 'A.pptx', text: 'Given words' },
        ]);
        expect(mocks.readDocumentWords).not.toHaveBeenCalled();
        expect(mocks.answerLyricSources).toHaveBeenCalledWith(
            [{ kind: 'text', name: 'A.pptx', text: 'Given words' }],
            0,
            null,
        );
    });

    it('says, after the draft, which file held no song', async () => {
        mocks.readDocumentWords.mockImplementation(async (filePath: string) => {
            return filePath.endsWith('Empty.pdf') ? null : 'Words';
        });
        const answer = await draftDeckSongs([
            { filePath: '/docs/Good.pptx', name: 'Good.pptx' },
            { filePath: '/docs/Empty.pdf', name: 'Empty.pdf' },
        ]);
        expect(answer.text).toBe(
            'drafted Good.pptx\n\nI could not find a song in "Empty.pdf".',
        );
        expect(answer.actions).toEqual([
            { label: 'Create', toolName: 'owa-lyric-create' },
        ]);
    });

    it('answers only the failures when no file held a song', async () => {
        mocks.readDocumentWords.mockResolvedValue(null);
        const answer = await draftDeckSongs([
            { filePath: '/docs/A.pdf', name: 'A.pdf' },
            { filePath: '/docs/B.pdf', name: 'B.pdf' },
        ]);
        expect(mocks.answerLyricSources).not.toHaveBeenCalled();
        expect(answer).toEqual({
            text:
                'I could not find a song in "A.pdf".\n\n' +
                'I could not find a song in "B.pdf".',
        });
    });

    it('drafts no more than the songs one ask may hold', async () => {
        mocks.readDocumentWords.mockResolvedValue('Words');
        const files = Array.from(
            { length: MAX_SONGS_PER_ASK + 2 },
            (_value, index) => {
                return { filePath: `/docs/${index}.pptx`, name: `${index}` };
            },
        );
        await draftDeckSongs(files);
        expect(mocks.readDocumentWords).toHaveBeenCalledTimes(
            MAX_SONGS_PER_ASK,
        );
        expect(mocks.answerLyricSources.mock.calls[0][0]).toHaveLength(
            MAX_SONGS_PER_ASK,
        );
    });
});
