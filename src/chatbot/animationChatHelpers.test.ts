import { describe, expect, it } from 'vitest';

import {
    ANIMATION_EDIT_TOOL_NAME,
    ANIMATION_SYSTEM_PROMPT,
    ANIMATION_UNDO_KIND,
    checkIsAnimationEdited,
    checkIsAnimationThread,
    findAnimationUndoIds,
    genAnimationOpeningAnswer,
    genAnimationUndoAction,
    mergeEditedAnimation,
    pickAnimationUndoId,
    readEditedAnimation,
    toAnimationAsk,
    toAnimationHandoffSession,
    toAnimationReadText,
} from './animationChatHelpers';
import {
    findOpenFileAttachments,
    type ChatAttachmentType,
} from './attachmentHelpers';
import type { ChatSessionType } from './chatSessionHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';
import { ANIMATION_EDIT_TOOL_NAME as MCP_TOOL_NAME } from '../../tools/owa-devtools-mcp/agentAnimationEdit.mjs';
import { MODEL_ON_ASK_TOOL_MAP } from '../../tools/owa-devtools-mcp/modelTools.mjs';

const UNDO_ACTION = {
    label: LYRIC_UNDO_LABEL,
    toolName: LYRIC_UNDO_TOOL_NAME,
    args: {
        id: 'animation.2.abc',
        name: 'animation',
        kind: ANIMATION_UNDO_KIND,
        ids: ['animation.1.abc', 'animation.2.abc'],
    },
};

describe('the tool', () => {
    it('is the MCP tool, offered to an animation ask alone', () => {
        expect(ANIMATION_EDIT_TOOL_NAME).toBe(MCP_TOOL_NAME);
        expect(
            (MODEL_ON_ASK_TOOL_MAP as Record<string, string>)[
                ANIMATION_EDIT_TOOL_NAME
            ],
        ).toBe('animation');
    });
});

describe('genAnimationOpeningAnswer', () => {
    it('says what a shader can have changed, its code among it', () => {
        const opening = genAnimationOpeningAnswer({
            name: 'Plasma',
            engine: 'glsl',
        });
        expect(opening.text).toContain('“Plasma”');
        expect(opening.text).toContain('Shader Code');
        expect(opening.replies).toEqual([
            'Make it slower',
            'Use warmer colors',
            'Explain the shader code',
        ]);
    });

    it('offers to explain a CSS animation’s code, a built-in’s too', () => {
        // A built-in effect has code: its panel opens on it written as CSS.
        for (const name of ['Aurora', 'Custom CSS']) {
            const opening = genAnimationOpeningAnswer({ name, engine: 'css' });
            expect(opening.text).toContain('or its code in CSS Code');
            expect(opening.replies).toEqual([
                'Make it slower',
                'Use warmer colors',
                'Explain the CSS code',
            ]);
        }
    });
});

describe('toAnimationHandoffSession', () => {
    const genTab = (messages: any[]) => {
        return {
            id: 'tab',
            title: '',
            messages,
            draft: '',
            focus: 'reader',
            isFocusChosen: false,
            provider: null,
            model: '',
            isLocked: false,
        } as unknown as ChatSessionType;
    };

    it('only sets a fresh tab to the Presenter', () => {
        expect(toAnimationHandoffSession(genTab([]))).toEqual({
            ...genTab([]),
            focus: 'presenter',
            isFocusChosen: true,
        });
    });

    it('puts away what the tab in front still held, as its × would', () => {
        // Seen live: with the strip full the card landed in a tab still
        // asking about an Exodus study, which would take the next line.
        const study: ChatAttachmentType = {
            id: 'file-1',
            kind: 'text',
            name: 'EXO.3.md',
            mimeType: 'text/markdown',
            byteSize: 120,
            filePath: '/resources/Default/EXO.3.md',
        };
        const messages = [
            {
                id: 4,
                author: 'you',
                text: 'Translate it',
                attachments: [study],
            },
            { id: 9, author: 'bot', text: 'Done.' },
        ];
        expect(findOpenFileAttachments(messages)).toHaveLength(1);
        const ready = toAnimationHandoffSession(genTab(messages));
        expect(ready).toMatchObject({
            focus: 'presenter',
            isFocusChosen: true,
            fileClosedAt: 9,
            lookupClosedAt: 9,
            foregroundClosedAt: 9,
        });
        expect(findOpenFileAttachments(messages, ready.fileClosedAt)).toEqual(
            [],
        );
        // The conversation above is kept as it was.
        expect(ready.messages).toBe(messages);
    });
});

describe('checkIsAnimationThread', () => {
    it('keeps a plain line under an animation answer in it', () => {
        const messages = [
            { author: 'bot' as const, isAnimationAnswer: true as const },
            // The window's own line under it does not end the thread.
            { author: 'bot' as const, isFollowUp: true as const },
        ];
        expect(checkIsAnimationThread(messages, 'slower please')).toBe(true);
        expect(checkIsAnimationThread(messages, '/clear')).toBe(false);
    });

    it('is no thread under another answer', () => {
        expect(
            checkIsAnimationThread(
                [
                    { author: 'bot', isAnimationAnswer: true },
                    { author: 'you' },
                    { author: 'bot' },
                ],
                'slower',
            ),
        ).toBe(false);
        expect(checkIsAnimationThread([], 'slower')).toBe(false);
    });
});

describe('findAnimationUndoIds', () => {
    it('answers the last answer’s change ids, newest first', () => {
        expect(
            findAnimationUndoIds([
                {
                    author: 'bot',
                    isAnimationAnswer: true,
                    actions: [UNDO_ACTION],
                },
            ]),
        ).toEqual(['animation.2.abc', 'animation.1.abc']);
    });

    it('answers none under an answer that changed nothing or is not one', () => {
        expect(
            findAnimationUndoIds([{ author: 'bot', isAnimationAnswer: true }]),
        ).toEqual([]);
        expect(
            findAnimationUndoIds([{ author: 'bot', actions: [UNDO_ACTION] }]),
        ).toEqual([]);
        // A song's undo is not this tool's.
        expect(
            findAnimationUndoIds([
                {
                    author: 'bot',
                    isAnimationAnswer: true,
                    actions: [
                        {
                            toolName: LYRIC_UNDO_TOOL_NAME,
                            args: { id: 'x', kind: 'screen' },
                        },
                    ],
                },
            ]),
        ).toEqual([]);
    });
});

describe('toAnimationReadText', () => {
    it('lists the editors and quotes the target shader’s code', () => {
        const text = toAnimationReadText({
            target: 'background:0',
            editors: [
                {
                    editor: 'background:0',
                    where: 'Background, screen 0',
                    engine: 'glsl',
                    effect: 'custom',
                    colors: ['#000000', '#FF0000'],
                    speed: 'normal',
                    quality: 'high',
                    opacity: 100,
                    blend: 'normal',
                    isCodeOpen: true,
                    code: 'void mainImage() {}',
                    codeError: "ERROR: 0:3: 'x' : undeclared identifier",
                },
                {
                    editor: 'foreground:0',
                    where: 'Animation Show, screen 0',
                    engine: 'css',
                    effect: 'aurora',
                },
            ],
        });
        expect(text).toContain('- background:0 (Background, screen 0)');
        expect(text).toContain('colors: #000000, #FF0000');
        expect(text).toContain('Shader Code panel: open');
        expect(text).toContain('```glsl\nvoid mainImage() {}\n```');
        expect(text).toContain('It does not compile: ERROR: 0:3:');
        expect(text).toContain('- foreground:0 (Animation Show, screen 0)');
    });

    it('quotes a CSS animation’s own code as CSS, with its check', () => {
        const text = toAnimationReadText({
            target: 'foreground:1',
            editors: [
                {
                    editor: 'foreground:1',
                    where: 'Animation Show, screen 1',
                    engine: 'css',
                    effect: 'custom',
                    isCodeOpen: true,
                    code: '.dot { opacity: 0.5; }',
                    codeError: 'The CSS has a url()',
                },
            ],
        });
        expect(text).toContain('CSS Code panel: open');
        expect(text).toContain('The CSS code of foreground:1');
        expect(text).toContain('```css\n.dot { opacity: 0.5; }\n```');
        expect(text).toContain('It does not pass its check: The CSS has');
    });

    it('quotes a built-in CSS effect’s code as any other', () => {
        const text = toAnimationReadText({
            target: 'background:0',
            editors: [
                {
                    editor: 'background:0',
                    engine: 'css',
                    effect: 'bokeh',
                    code: '.dot { left: calc(var(--x) * 1%); }',
                },
            ],
        });
        expect(text).toContain('The CSS code of background:0:');
        expect(text).toContain('```css\n.dot { left: calc(var(--x) * 1%); }');
        expect(text).not.toContain('no code');
    });

    it('says what the worker said when no editor is open', () => {
        expect(
            toAnimationReadText({
                editors: [],
                note: 'No animation editor is open.',
            }),
        ).toBe('No animation editor is open.');
        expect(toAnimationReadText(null)).toBeNull();
    });
});

describe('toAnimationAsk', () => {
    it('puts the read and the undo ids under the question', () => {
        const ask = toAnimationAsk('undo that', 'READ', [
            'animation.2.abc',
            'animation.1.abc',
        ]);
        expect(ask).toContain('undo that');
        expect(ask).toContain('read just now:\nREAD');
        expect(ask).toContain('"animation.2.abc", "animation.1.abc"');
    });

    it('asks the model to read when the read failed, and fills a wordless ask', () => {
        const ask = toAnimationAsk('', null);
        expect(ask).toContain('They sent no words');
        expect(ask).toContain(`${ANIMATION_EDIT_TOOL_NAME} read`);
    });
});

describe('the change an answer made', () => {
    it('reads a change off its result, and no change off a read', () => {
        const edited = readEditedAnimation(
            JSON.stringify({
                did: 'changed speed',
                undoId: 'animation.1.abc',
            }),
        );
        expect(edited).toMatchObject({
            name: 'animation',
            undoId: 'animation.1.abc',
        });
        expect(checkIsAnimationEdited(edited)).toBe(true);
        expect(readEditedAnimation(JSON.stringify({ editors: [] }))).toBeNull();
        expect(
            readEditedAnimation(
                JSON.stringify({ did: 'x', undoId: 'no spaces allowed' }),
            ),
        ).toBeNull();
        expect(readEditedAnimation('not json')).toBeNull();
    });

    it('puts every change of one answer under one undo', () => {
        const first = readEditedAnimation(
            JSON.stringify({ did: 'a', undoId: 'animation.1.abc' }),
        );
        const second = readEditedAnimation(
            JSON.stringify({ did: 'b', undoId: 'animation.2.abc' }),
        );
        if (first === null || second === null) {
            throw new Error('Both changes read.');
        }
        const merged = mergeEditedAnimation(first, second);
        expect(merged.undoIdList).toEqual([
            'animation.1.abc',
            'animation.2.abc',
        ]);
        expect(merged.undoId).toBe('animation.2.abc');
        // A change of another kind is not merged in.
        expect(
            mergeEditedAnimation({ name: 'Song', undoId: 'x' }, second),
        ).toBe(second);
        expect(genAnimationUndoAction(merged)).toEqual(UNDO_ACTION);
        expect(genAnimationUndoAction({ ...merged, undoId: null })).toBeNull();
    });

    it('takes the OLDEST change back on the press', () => {
        expect(pickAnimationUndoId(UNDO_ACTION.args)).toBe('animation.1.abc');
        expect(pickAnimationUndoId({ id: 'animation.3.x' })).toBe(
            'animation.3.x',
        );
        expect(pickAnimationUndoId({ id: '../x y' })).toBeNull();
    });
});

describe('ANIMATION_SYSTEM_PROMPT', () => {
    it('names the tool’s actions, the shader’s rules and the CSS boxes', () => {
        for (const words of [
            'action "set"',
            'action "code"',
            'action "undo"',
            'mainImage',
            'uColors',
            '.scene',
            '.layer',
            '.dot',
            'var(--color-1)',
            'var(--accent)',
            'ONLY transform and opacity',
            'OPTIONS:',
        ]) {
            expect(ANIMATION_SYSTEM_PROMPT).toContain(words);
        }
    });
});
