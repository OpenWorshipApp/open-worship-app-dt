// `/lyric-from` and the two roads `/lyric` hands on: a document's name to
// the document reader, several links to the one Create all. The app is
// reached through `callTool` / `callToolWithPictures` alone, routed here by
// tool name; the song drafter (`helpBotHelpers`) is a fake, since only what
// the command does with its answer is under test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        callToolWithPictures: vi.fn(),
        appError: vi.fn(),
        answerLyricLink: vi.fn(),
        answerLyricLinks: vi.fn(),
        answerLyricPaste: vi.fn(),
        answerLyricTitle: vi.fn(),
        settingMap: new Map<string, string>(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return {
        appError: (...args: any[]) => h.appError(...args),
    };
});

vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => h.settingMap.get(key) ?? null,
        setSetting: (key: string, value: string) => {
            h.settingMap.set(key, value);
        },
    };
});

vi.mock('./mcpClient', () => {
    return {
        callTool: (...args: any[]) => h.callTool(...args),
        callToolWithPictures: (...args: any[]) => {
            return h.callToolWithPictures(...args);
        },
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch {
                return null;
            }
        },
    };
});

vi.mock('./helpBotHelpers', () => {
    return {
        BUILTIN_TOOL_NAME: 'builtin-command',
        answerFromManual: vi.fn(),
        answerLyricLink: (...args: any[]) => h.answerLyricLink(...args),
        answerLyricLinks: (...args: any[]) => h.answerLyricLinks(...args),
        answerLyricPaste: (...args: any[]) => h.answerLyricPaste(...args),
        answerLyricTitle: (...args: any[]) => h.answerLyricTitle(...args),
        answerWhereIs: vi.fn(),
    };
});

import { runBuiltinCommand } from './builtinActionHelpers';
import { setCurrentWindowAim } from './windowAimHelpers';

const DOCUMENT_NAMES = [
    'Hymns.pptx',
    'Sermon notes.docx',
    'Bulletin.pdf',
    'photo.png',
    'Morning.ows',
];

function routeDocuments(names: string[]) {
    h.callTool.mockImplementation(async (name: string, args?: any) => {
        if (
            name === 'owa_media_file' &&
            args?.action === 'list' &&
            args?.kind === 'document'
        ) {
            return JSON.stringify({ names });
        }
        throw new Error(`no reply for ${name}`);
    });
}

async function run(text: string) {
    const steps: string[] = [];
    const answer = await runBuiltinCommand(text, 'presenter', (step) => {
        steps.push(`${step.isDone ? 'done' : 'start'}: ${step.text}`);
    });
    return { answer, steps };
}

function toLabels(actions: any[] | undefined) {
    return (actions ?? []).map((action) => {
        return action.label;
    });
}

beforeEach(() => {
    h.settingMap.clear();
});

afterEach(() => {
    setCurrentWindowAim(null);
});

describe('/lyric-from', () => {
    it('lists every document a song can be made from, and nothing else', async () => {
        routeDocuments(DOCUMENT_NAMES);
        const { answer } = await run('/lyric-from');
        expect(answer.text).toBe(
            'Which file should I make the song from? Press its name, or ' +
                'type its number.',
        );
        expect(toLabels(answer.actions)).toEqual([
            'Hymns.pptx',
            'Sermon notes.docx',
            'Bulletin.pdf',
            'Morning.ows',
        ]);
        // Each row reads its own file when pressed.
        expect(answer.actions?.[0]?.args).toEqual({
            step: 'read',
            name: 'Hymns.pptx',
        });
        expect(h.callTool).toHaveBeenCalledWith('owa_media_file', {
            action: 'list',
            kind: 'document',
        });
        expect(h.callToolWithPictures).not.toHaveBeenCalled();
    });

    it('a kind named after it lists only that kind', async () => {
        routeDocuments(DOCUMENT_NAMES);
        const { answer } = await run('/lyric-from powerpoint');
        expect(toLabels(answer.actions)).toEqual(['Hymns.pptx']);
    });
});

describe('/lyric handing on', () => {
    it("a document's name reads that document, not a song title", async () => {
        routeDocuments(DOCUMENT_NAMES);
        h.callToolWithPictures.mockResolvedValue({
            text: JSON.stringify({ blocks: [], pictureNeededPages: [1, 2] }),
            pictures: [],
        });
        const { answer } = await run('/lyric Hymns.pptx');
        expect(h.answerLyricTitle).not.toHaveBeenCalled();
        expect(h.callToolWithPictures).toHaveBeenCalledWith('owa_media_file', {
            action: 'info',
            kind: 'document',
            name: 'Hymns.pptx',
        });
        expect(answer.text).toContain(
            'I could not read any words in "Hymns.pptx": its pages are ' +
                'pictures, or in a font that does not copy.',
        );
        expect(answer.actions?.map((action: any) => action.args)).toEqual([
            { step: 'pictures', name: 'Hymns.pptx' },
        ]);
    });

    it('a document name not in the list offers the list of that kind', async () => {
        routeDocuments(DOCUMENT_NAMES);
        const { answer } = await run('/lyric Elsewhere.pdf');
        expect(h.answerLyricTitle).not.toHaveBeenCalled();
        expect(h.callToolWithPictures).not.toHaveBeenCalled();
        expect(toLabels(answer.actions)).toEqual(['Bulletin.pdf']);
    });

    it('several links and little else go to one Create all', async () => {
        h.answerLyricLinks.mockResolvedValue({ text: 'Two songs drafted.' });
        const { answer } = await run(
            '/lyric https://songs.example/one and https://songs.example/two',
        );
        expect(answer).toEqual({ text: 'Two songs drafted.' });
        expect(h.answerLyricLinks).toHaveBeenCalledOnce();
        expect(h.answerLyricLinks.mock.calls[0][0]).toEqual([
            'https://songs.example/one',
            'https://songs.example/two',
        ]);
        expect(h.answerLyricLinks.mock.calls[0][1]).toBeTypeOf('function');
        expect(h.answerLyricLink).not.toHaveBeenCalled();
        expect(h.answerLyricPaste).not.toHaveBeenCalled();
    });

    it('links inside a long paste stay a paste', async () => {
        h.answerLyricPaste.mockResolvedValue({ text: 'Pasted song.' });
        const words = [
            'Amazing grace how sweet the sound that saved a wretch like me',
            'I once was lost but now am found was blind but now I see',
            'https://songs.example/one https://songs.example/two',
        ].join(' ');
        await run(`/lyric ${words}`);
        expect(h.answerLyricLinks).not.toHaveBeenCalled();
    });
});
