import { describe, expect, it, vi } from 'vitest';

import {
    LYRIC_EDIT_DESCRIPTION,
    LYRIC_EDIT_TOOL_NAME,
    registerLyricEditTool,
    runLyricEdit,
    toLyricEditTarget,
} from './agentLyricEdit.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
    MODEL_ON_ASK_TOOL_MAP,
    filterModelToolList,
    pickAskToolList,
} from './modelTools.mjs';

const SONG = [
    '```ol:Config',
    '- Title: Grace',
    '- Key: C',
    '- Structure: V1',
    '```',
    '',
    '```ol:Verse 1',
    'Amazing grace',
    'How sweet the sound',
    '```',
    '',
].join('\n');
const SONG_PATH = 'C:\\data\\documents\\Grace.owl';

function genWorker({ content = SONG, readReason, writeReason } = {}) {
    const calls = [];
    const worker = vi.fn(async (request) => {
        calls.push(request);
        if (request.action === 'read') {
            return readReason === undefined
                ? {
                      name: 'Grace',
                      filePath: SONG_PATH,
                      content,
                      hash: 'h1',
                      hasUnsavedChanges: false,
                  }
                : { isError: true, reason: readReason };
        }
        return writeReason === undefined
            ? {
                  updated: 'Grace',
                  undoId: 'u-1',
                  note: 'Unsaved -- the user presses Save.',
              }
            : { isError: true, reason: writeReason };
    });
    return { worker, calls };
}

function readText(result) {
    return result.content[0].text;
}

describe('what `file` names', () => {
    it('a whole .owl path is a path, a name is a Documents name', () => {
        expect(toLyricEditTarget(SONG_PATH)).toEqual({ filePath: SONG_PATH });
        expect(toLyricEditTarget('/home/me/Grace.owl')).toEqual({
            filePath: '/home/me/Grace.owl',
        });
        expect(toLyricEditTarget('Grace')).toEqual({ name: 'Grace' });
        expect(toLyricEditTarget('Grace.owl')).toEqual({ name: 'Grace' });
    });

    it('anything else is refused in a sentence', () => {
        expect(toLyricEditTarget('').reason).toMatch(/Name the song/);
        expect(toLyricEditTarget('C:\\data\\setting.json').reason).toMatch(
            /Only a song file/,
        );
        expect(
            toLyricEditTarget('C:\\data\\..\\secret\\Grace.owl').reason,
        ).toMatch(/\.\./);
        expect(toLyricEditTarget('a/b').reason).toBeTruthy();
    });
});

describe('a change', () => {
    it('reads the head, changes it in words and writes it back with its hash', async () => {
        const { worker, calls } = genWorker();
        const result = await runLyricEdit(
            {
                file: 'Grace',
                action: 'add-translation',
                part: 'Verse 1',
                lines: ['one', 'two'],
            },
            worker,
        );
        expect(result.isError).toBeUndefined();
        expect(calls[0]).toEqual({ action: 'read', name: 'Grace' });
        expect(calls[1]).toMatchObject({
            action: 'update',
            filePath: SONG_PATH,
            expectedHash: 'h1',
            summary: 'a translation under each line of Verse 1',
        });
        expect(calls[1].content).toContain('Amazing grace\n\tone');
        expect(JSON.parse(readText(result))).toMatchObject({
            name: 'Grace',
            isChanged: true,
            changed: ['a translation under each line of Verse 1'],
            parts: ['Verse 1'],
            isSaved: false,
            undoId: 'u-1',
        });
    });

    it('read answers the song part by part and writes nothing', async () => {
        const { worker, calls } = genWorker();
        const result = await runLyricEdit(
            { file: SONG_PATH, action: 'read' },
            worker,
        );
        expect(calls).toEqual([{ action: 'read', filePath: SONG_PATH }]);
        expect(JSON.parse(readText(result))).toMatchObject({
            name: 'Grace',
            key: 'C',
            parts: [
                {
                    part: 'Verse 1',
                    lines: ['Amazing grace', 'How sweet the sound'],
                },
            ],
        });
    });

    it('a change that changes nothing is not written', async () => {
        const { worker, calls } = genWorker();
        const result = await runLyricEdit(
            { file: 'Grace', action: 'set-config', config: { Key: 'C' } },
            worker,
        );
        expect(calls).toHaveLength(1);
        expect(JSON.parse(readText(result)).isChanged).toBe(false);
    });

    it('a refusal from the edit, the read or the write reaches the caller', async () => {
        const refusedEdit = await runLyricEdit(
            {
                file: 'Grace',
                action: 'set-lines',
                part: 'Bridge',
                lines: ['x'],
            },
            genWorker().worker,
        );
        expect(refusedEdit.isError).toBe(true);
        expect(readText(refusedEdit)).toMatch(/no part called "Bridge"/);
        const refusedRead = await runLyricEdit(
            { file: 'Grace', action: 'read' },
            genWorker({ readReason: 'There is no song called "Grace".' })
                .worker,
        );
        expect(readText(refusedRead)).toBe('There is no song called "Grace".');
        const refusedWrite = await runLyricEdit(
            { file: 'Grace', action: 'transpose', key: 'D' },
            genWorker({
                writeReason: '"Grace" changed while this was being worked out',
            }).worker,
        );
        expect(refusedWrite.isError).toBe(true);
        expect(readText(refusedWrite)).toMatch(/changed while/);
    });
});

describe('the tool and the policy around it', () => {
    it('registers with a short description and its schema', () => {
        const registerTool = vi.fn();
        registerLyricEditTool({ registerTool });
        const [name, options] = registerTool.mock.calls[0];
        expect(name).toBe(LYRIC_EDIT_TOOL_NAME);
        expect(options.description).toBe(LYRIC_EDIT_DESCRIPTION);
        expect(options.inputSchema.action.safeParse('transpose').success).toBe(
            true,
        );
        expect(options.inputSchema.action.safeParse('delete').success).toBe(
            false,
        );
    });

    it('only a read is free of the acting budget; remove-section is a removal', () => {
        expect(
            checkIsActingCall(LYRIC_EDIT_TOOL_NAME, { action: 'read' }),
        ).toBe(false);
        expect(
            checkIsActingCall(LYRIC_EDIT_TOOL_NAME, { action: 'set-lines' }),
        ).toBe(true);
        expect(
            checkIsRemovingCall(LYRIC_EDIT_TOOL_NAME, {
                action: 'remove-section',
            }),
        ).toBe(true);
        expect(
            checkIsRemovingCall(LYRIC_EDIT_TOOL_NAME, { action: 'set-lines' }),
        ).toBe(false);
    });

    it('the banner names the song changed, never its path, and a read is quiet', () => {
        expect(
            describeToolNotice(LYRIC_EDIT_TOOL_NAME, {
                action: 'read',
                file: 'Grace',
            }),
        ).toBeNull();
        expect(
            describeToolNotice(LYRIC_EDIT_TOOL_NAME, {
                action: 'transpose',
                file: SONG_PATH,
            }),
        ).toEqual({
            text: 'changed the song "Grace"',
            key: 'changed a song',
            detail: ['"Grace"'],
        });
        expect(describeToolNotice(LYRIC_EDIT_TOOL_NAME, {}).key).toBe(
            'changed a song',
        );
    });

    it('the chatbot model is offered it only in a conversation about a song', () => {
        const tools = [
            { name: LYRIC_EDIT_TOOL_NAME },
            { name: 'owa_help_search' },
        ];
        expect(MODEL_ON_ASK_TOOL_MAP[LYRIC_EDIT_TOOL_NAME]).toBe('lyric');
        expect(filterModelToolList(tools)).toEqual([
            { name: 'owa_help_search' },
        ]);
        expect(pickAskToolList(tools, 'lyric')).toEqual([
            { name: LYRIC_EDIT_TOOL_NAME },
        ]);
    });
});
