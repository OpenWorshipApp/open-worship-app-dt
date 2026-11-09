import { describe, expect, it, vi } from 'vitest';

import {
    NOTE_EDIT_ACTIONS,
    NOTE_EDIT_DESCRIPTION,
    NOTE_EDIT_KINDS,
    NOTE_EDIT_TOOL_NAME,
    NOTE_WINDOW_OTHER_CODE,
    NOTE_WINDOW_READY_GLOBAL_NAME,
    checkIsNoteWindowUrl,
    registerNoteEditTool,
    runNoteEdit,
    toNoteEditTarget,
} from './agentNoteEdit.mjs';
import {
    NOTE_WINDOW_OTHER_CODE as APP_NOTE_WINDOW_OTHER_CODE,
    NOTE_WINDOW_READY_GLOBAL_NAME as APP_NOTE_WINDOW_READY_GLOBAL_NAME,
} from '../../src/bible-list/note/noteWindowControllerHelpers';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
    MODEL_ON_ASK_TOOL_MAP,
    filterModelToolList,
    pickAskToolList,
} from './modelTools.mjs';
import { NOTE_ADD_KIND_LIST } from '../../src/helper/agentNoteBlockHelpers';

const NOTE_PATH = 'C:\\data\\bible-notes\\Default.own';

function genWorker(answer) {
    const calls = [];
    const worker = vi.fn(async (request, page) => {
        calls.push({ request, page });
        return answer;
    });
    return { worker, calls };
}

function readText(result) {
    return result.content[0].text;
}

describe('which note', () => {
    it('is a whole .own path and a note id', () => {
        expect(toNoteEditTarget(NOTE_PATH, 3)).toEqual({
            filePath: NOTE_PATH,
            noteId: 3,
        });
        expect(toNoteEditTarget('', 3).reason).toMatch(/Name the note/);
        expect(toNoteEditTarget(NOTE_PATH, -1).reason).toMatch(/Name the note/);
        expect(toNoteEditTarget(NOTE_PATH).reason).toMatch(/Name the note/);
        expect(toNoteEditTarget('Default', 3).reason).toMatch(/\.own/);
        expect(toNoteEditTarget('C:\\data\\song.owl', 3).reason).toMatch(
            /\.own/,
        );
        expect(toNoteEditTarget('C:\\data\\..\\x.own', 3).reason).toMatch(
            /may not step out/,
        );
    });

    it('takes the kinds the app takes', () => {
        expect(NOTE_EDIT_KINDS).toEqual([...NOTE_ADD_KIND_LIST]);
    });
});

describe('one call', () => {
    // 2026-11-08: a note is read and changed in its own window only.
    it("finds the note's own window by its address", () => {
        const base = 'https://localhost:3000/bibleNote.html';
        expect(
            checkIsNoteWindowUrl(
                `${base}?file=Default.own&id=3&uuid=x`,
                'Default.own',
                3,
            ),
        ).toBe(true);
        // Another note of the file, another file, another page.
        expect(
            checkIsNoteWindowUrl(
                `${base}?file=Default.own&id=4`,
                'Default.own',
                3,
            ),
        ).toBe(false);
        expect(
            checkIsNoteWindowUrl(
                `${base}?file=sunday.own&id=3`,
                'Default.own',
                3,
            ),
        ).toBe(false);
        expect(
            checkIsNoteWindowUrl(
                'https://localhost:3000/reader.html?file=Default.own&id=3',
                'Default.own',
                3,
            ),
        ).toBe(false);
        // A name with spaces, as the address carries it.
        expect(
            checkIsNoteWindowUrl(
                `${base}?file=My%20Notes.own&id=0`,
                'My Notes.own',
                0,
            ),
        ).toBe(true);
        expect(checkIsNoteWindowUrl('not a url', 'Default.own', 3)).toBe(false);
    });

    it('speaks the note window\'s own words for "ready" and "another note"', () => {
        expect(NOTE_WINDOW_READY_GLOBAL_NAME).toBe(
            APP_NOTE_WINDOW_READY_GLOBAL_NAME,
        );
        expect(NOTE_WINDOW_OTHER_CODE).toBe(APP_NOTE_WINDOW_OTHER_CODE);
    });

    it('reads the note by its file and id, in its own window whatever page is named', async () => {
        const answer = { name: 'Sunday', hash: 'ab12', blocks: [] };
        const { worker, calls } = genWorker(answer);
        const result = await runNoteEdit(
            { action: 'read', file: NOTE_PATH, id: 3, from: 20, page: 'x' },
            worker,
        );
        expect(calls).toEqual([
            {
                request: {
                    action: 'read',
                    filePath: NOTE_PATH,
                    noteId: 3,
                    from: 20,
                },
            },
        ]);
        expect(JSON.parse(readText(result))).toEqual(answer);
    });

    it('hands an edit over whole and answers what the window reads', async () => {
        const answer = {
            name: 'Sunday',
            isChanged: true,
            undoId: 'u1',
            hash: 'cd34',
        };
        const { worker, calls } = genWorker(answer);
        const changes = [{ block: 2, text: 'Grace **alone**' }];
        const result = await runNoteEdit(
            {
                action: 'edit',
                note: 'Sunday',
                file: NOTE_PATH,
                id: 3,
                hash: 'ab12',
                title: 'Sunday sermon',
                bible: 'KJV',
                changes,
            },
            worker,
        );
        expect(calls[0].request).toEqual({
            action: 'edit',
            filePath: NOTE_PATH,
            noteId: 3,
            hash: 'ab12',
            title: 'Sunday sermon',
            bible: 'KJV',
            changes,
        });
        expect(JSON.parse(readText(result))).toEqual(answer);
    });

    it('a refusal is the sentence of the app, and a wrong call never reaches it', async () => {
        const { worker } = genWorker({
            isError: true,
            reason: 'No such block',
        });
        const refused = await runNoteEdit(
            { action: 'edit', file: NOTE_PATH, id: 3, changes: [] },
            worker,
        );
        expect(refused.isError).toBe(true);
        expect(readText(refused)).toBe('No such block');
        const unused = genWorker({});
        expect(
            readText(
                await runNoteEdit(
                    { action: 'delete', file: NOTE_PATH, id: 3 },
                    unused.worker,
                ),
            ),
        ).toMatch(/read, edit/);
        expect(
            (await runNoteEdit({ action: 'read' }, unused.worker)).isError,
        ).toBe(true);
        expect(unused.worker).not.toHaveBeenCalled();
    });
});

describe('around the call', () => {
    it('reading is not acting; an edit is, and is no removal of a file', () => {
        expect(checkIsActingCall(NOTE_EDIT_TOOL_NAME, { action: 'read' })).toBe(
            false,
        );
        expect(checkIsActingCall(NOTE_EDIT_TOOL_NAME, { action: 'edit' })).toBe(
            true,
        );
        expect(
            checkIsRemovingCall(NOTE_EDIT_TOOL_NAME, { action: 'edit' }),
        ).toBe(false);
    });

    it('the banner names the note, never its path, and a read is quiet', () => {
        expect(
            describeToolNotice(NOTE_EDIT_TOOL_NAME, {
                action: 'read',
                file: NOTE_PATH,
            }),
        ).toBeNull();
        expect(
            describeToolNotice(NOTE_EDIT_TOOL_NAME, {
                action: 'edit',
                note: 'Sunday',
                file: NOTE_PATH,
            }),
        ).toMatchObject({
            text: 'changed the Bible note "Sunday"',
            key: 'changed a Bible note',
            detail: ['"Sunday"'],
        });
        expect(
            describeToolNotice(NOTE_EDIT_TOOL_NAME, {
                action: 'edit',
                file: NOTE_PATH,
            }).text,
        ).toBe('changed the Bible note "Default"');
        expect(describeToolNotice(NOTE_EDIT_TOOL_NAME, {}).key).toBe(
            'changed a Bible note',
        );
    });

    it('the chatbot model is offered it only in a conversation about a note', () => {
        const tools = [
            { name: NOTE_EDIT_TOOL_NAME },
            { name: 'owa_bible_note' },
            { name: 'owa_help_search' },
            { name: 'owa_help_page' },
            { name: 'owa_find_verse' },
        ];
        expect(MODEL_ON_ASK_TOOL_MAP[NOTE_EDIT_TOOL_NAME]).toBe('note');
        expect(
            filterModelToolList(tools).map((tool) => tool.name),
        ).not.toContain(NOTE_EDIT_TOOL_NAME);
        // Its own tool, the guide (how the editor works), the verse finder
        // and -- for a NEW note only (2026-11-08) -- owa_bible_note.
        expect(pickAskToolList(tools, 'note').map((tool) => tool.name)).toEqual(
            [
                NOTE_EDIT_TOOL_NAME,
                'owa_bible_note',
                'owa_help_search',
                'owa_help_page',
                'owa_find_verse',
            ],
        );
    });

    it('registers with its schema and actions', () => {
        const registerTool = vi.fn();
        registerNoteEditTool({ registerTool });
        const [name, spec] = registerTool.mock.calls[0];
        expect(name).toBe(NOTE_EDIT_TOOL_NAME);
        expect(spec.description).toBe(NOTE_EDIT_DESCRIPTION);
        expect(Object.keys(spec.inputSchema)).toContain('changes');
        // The toolbar's Undo / Redo too (2026-11-08).
        expect(NOTE_EDIT_ACTIONS).toEqual([
            'read',
            'edit',
            'undo',
            'redo',
            'view',
        ]);
    });
});
