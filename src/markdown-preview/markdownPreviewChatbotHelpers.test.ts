import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    askAiCaution: vi.fn<(kind: string) => Promise<boolean>>(),
    requestChatbotFile: vi.fn(),
    openChatbotPage: vi.fn(),
}));

// The three modules the press loads, and nothing else.
vi.mock('../helper/ai/aiCautionHelpers', () => ({
    askAiCaution: h.askAiCaution,
}));
vi.mock('../helper/ai/chatbotHandoffStoreHelpers', () => ({
    requestChatbotFile: h.requestChatbotFile,
}));
vi.mock('../helper/chatbotPageHelpers', () => ({
    openChatbotPage: h.openChatbotPage,
}));

import {
    openMarkdownInChatbot,
    toEditorSelectionMention,
} from './markdownPreviewChatbotHelpers';

const LINE_LIST = [
    '# The New Birth',
    '',
    'For God so loved the world, that he gave',
    'his only begotten Son.',
    '',
];

// What Monaco hands an action: the model and the primary selection, as
// lines and 1-based columns, the end column after the last letter taken.
function genEditor(
    selection: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    } | null,
) {
    const model = {
        getLineContent: (lineNumber: number) => {
            return LINE_LIST[lineNumber - 1];
        },
        getValueInRange: (range: NonNullable<typeof selection>) => {
            const taken = LINE_LIST.slice(
                range.startLineNumber - 1,
                range.endLineNumber,
            );
            taken[taken.length - 1] = taken[taken.length - 1].slice(
                0,
                range.endColumn - 1,
            );
            taken[0] = taken[0].slice(range.startColumn - 1);
            return taken.join('\n');
        },
    };
    return {
        getModel: () => {
            return model;
        },
        getSelection: () => {
            return selection === null
                ? null
                : {
                      ...selection,
                      isEmpty: () => {
                          return (
                              selection.startLineNumber ===
                                  selection.endLineNumber &&
                              selection.startColumn === selection.endColumn
                          );
                      },
                  };
        },
    } as any;
}

beforeEach(() => {
    h.askAiCaution.mockReset();
    h.requestChatbotFile.mockReset();
    h.openChatbotPage.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// 2026-11-11, the user, the Markdown Preview's editor with line 7 selected:
// _selected text in editor should have option to mention in chatbot input
// text_.
describe('the words selected in the editor', () => {
    it('are the words, the rest of their line round them, and their line', () => {
        expect(
            toEditorSelectionMention(
                genEditor({
                    startLineNumber: 3,
                    startColumn: 9,
                    endLineNumber: 3,
                    endColumn: 27,
                }),
            ),
        ).toEqual({
            text: 'so loved the world',
            before: 'For God ',
            after: ', that he gave',
            start: null,
            end: null,
            lines: { first: 3, last: 3 },
        });
    });

    it('run over lines, the first line before them and the last after', () => {
        expect(
            toEditorSelectionMention(
                genEditor({
                    startLineNumber: 3,
                    startColumn: 5,
                    endLineNumber: 4,
                    endColumn: 9,
                }),
            ),
        ).toEqual({
            text: 'God so loved the world, that he gave\nhis only',
            before: 'For ',
            after: ' begotten Son.',
            start: null,
            end: null,
            lines: { first: 3, last: 4 },
        });
    });

    it('end on the line before when a whole line is taken with its break', () => {
        // A triple click: line 3 from its start to the start of line 4.
        expect(
            toEditorSelectionMention(
                genEditor({
                    startLineNumber: 3,
                    startColumn: 1,
                    endLineNumber: 4,
                    endColumn: 1,
                }),
            ),
        ).toMatchObject({
            before: '',
            after: '',
            lines: { first: 3, last: 3 },
        });
    });

    it('are none when nothing, or nothing but a blank line, is selected', () => {
        expect(toEditorSelectionMention(genEditor(null))).toBeNull();
        expect(
            toEditorSelectionMention(
                genEditor({
                    startLineNumber: 3,
                    startColumn: 4,
                    endLineNumber: 3,
                    endColumn: 4,
                }),
            ),
        ).toBeNull();
        expect(
            toEditorSelectionMention(
                genEditor({
                    startLineNumber: 2,
                    startColumn: 1,
                    endLineNumber: 3,
                    endColumn: 1,
                }),
            ),
        ).toBeNull();
    });
});

describe('opening the assistant on the file', () => {
    const mention = {
        text: 'so loved',
        before: 'For God ',
        after: ' the world',
        start: null,
        end: null,
        lines: { first: 3, last: 3 },
    };

    it('asks the caution, leaves the request, then opens the help window', async () => {
        h.askAiCaution.mockResolvedValue(true);
        expect(await openMarkdownInChatbot('C:\\r\\notes.md', mention)).toBe(
            true,
        );
        expect(h.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(h.requestChatbotFile).toHaveBeenCalledWith(
            'C:\\r\\notes.md',
            null,
            null,
            mention,
        );
        // The request is waiting before the window opens to take it.
        expect(h.requestChatbotFile.mock.invocationCallOrder[0]).toBeLessThan(
            h.openChatbotPage.mock.invocationCallOrder[0],
        );
        // The toolbar's 🤖: the file alone.
        await openMarkdownInChatbot('C:\\r\\notes.md');
        expect(h.requestChatbotFile).toHaveBeenLastCalledWith(
            'C:\\r\\notes.md',
            null,
            null,
            null,
        );
    });

    it('leaves nothing and opens nothing when the caution is cancelled', async () => {
        h.askAiCaution.mockResolvedValue(false);
        expect(await openMarkdownInChatbot('C:\\r\\notes.md', mention)).toBe(
            false,
        );
        expect(h.requestChatbotFile).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    it('says a failure in the log, never as a press that threw', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const error = new Error('no popup');
        h.askAiCaution.mockRejectedValue(error);
        expect(await openMarkdownInChatbot('C:\\r\\notes.md')).toBe(false);
        expect(consoleError).toHaveBeenCalledWith(error);
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });
});
