import { describe, expect, it, vi } from 'vitest';

import {
    SLIDE_EDIT_ACTIONS,
    SLIDE_EDIT_DESCRIPTION,
    SLIDE_EDIT_TOOL_NAME,
    registerSlideEditTool,
    runSlideEdit,
    toSlideEditTarget,
} from './agentSlideEdit.mjs';
import { checkIsActingCall, checkIsRemovingCall } from './firewall.mjs';
import { describeToolNotice } from './notify.mjs';
import {
    MODEL_ON_ASK_TOOL_MAP,
    filterModelToolList,
    pickAskToolList,
} from './modelTools.mjs';

const SLIDE_PATH = 'C:\\data\\elsewhere\\Preaching.ows';

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

describe('what `file` names', () => {
    it('is a whole .ows path or a Documents name', () => {
        expect(toSlideEditTarget(SLIDE_PATH)).toEqual({
            filePath: SLIDE_PATH,
            name: 'Preaching',
        });
        expect(toSlideEditTarget(' Preaching.ows ')).toEqual({
            name: 'Preaching',
        });
        expect(toSlideEditTarget('').reason).toMatch(/Name the slide document/);
        expect(toSlideEditTarget('C:\\data\\song.owl').reason).toMatch(
            /Only a slide document/,
        );
        expect(toSlideEditTarget('C:\\data\\..\\x.ows').reason).toMatch(
            /may not step out/,
        );
        expect(toSlideEditTarget('a/b').reason).toBeTruthy();
    });
});

describe('one call', () => {
    it('reads every box whole, by the attached path', async () => {
        const { worker, calls } = genWorker({
            name: 'Preaching',
            slideCount: 1,
            slides: [],
        });
        const result = await runSlideEdit(
            { file: SLIDE_PATH, action: 'slides', page: 'presenter' },
            worker,
        );
        expect(calls).toEqual([
            {
                request: {
                    action: 'slides',
                    filePath: SLIDE_PATH,
                    isFullText: true,
                },
                page: 'presenter',
            },
        ]);
        expect(JSON.parse(readText(result))).toEqual({
            name: 'Preaching',
            slideCount: 1,
            slides: [],
        });
    });

    it('hands a batch on as it came and answers what the window reads', async () => {
        const { worker, calls } = genWorker({
            updated: [1, 2],
            slideCount: 2,
            isSaved: false,
            undoId: 'u-1',
            note: 'Unsaved.',
        });
        const changes = [
            { slide: 1, items: [{ id: 1, text: 'Good morning' }] },
            { slide: 2, items: [{ id: 1, fontSize: 80 }] },
        ];
        const result = await runSlideEdit(
            { file: 'Preaching', action: 'update-slides', changes },
            worker,
        );
        expect(calls[0].request).toEqual({
            action: 'update-slides',
            name: 'Preaching',
            changes,
        });
        // The window's undo button reads `name`, `isChanged` and `undoId`.
        expect(JSON.parse(readText(result))).toEqual({
            name: 'Preaching',
            isChanged: true,
            updated: [1, 2],
            slideCount: 2,
            isSaved: false,
            undoId: 'u-1',
            note: 'Unsaved.',
        });
    });

    it('hands a background on with the slides it goes behind', async () => {
        const { worker, calls } = genWorker({
            background: 'picture sunrise.jpg',
            slides: [1, 3],
            isSaved: true,
            undoId: 'u-2',
        });
        const result = await runSlideEdit(
            {
                file: 'Preaching',
                action: 'set-background',
                background: 'sunrise',
                slides: [1, 3],
            },
            worker,
        );
        expect(calls[0].request).toEqual({
            action: 'set-background',
            name: 'Preaching',
            background: 'sunrise',
            slides: [1, 3],
        });
        expect(JSON.parse(readText(result))).toMatchObject({
            name: 'Preaching',
            isChanged: true,
            undoId: 'u-2',
        });
        // It changes the document, so it is an acting call with a banner,
        // and no removal.
        expect(
            checkIsActingCall('owa_slide_edit', { action: 'set-background' }),
        ).toBe(true);
        expect(
            checkIsRemovingCall('owa_slide_edit', {
                action: 'set-background',
            }),
        ).toBe(false);
        expect(
            describeToolNotice('owa_slide_edit', {
                action: 'set-background',
                file: SLIDE_PATH,
            })?.text,
        ).toMatch(/changed the slide document .Preaching./);
    });

    it('says when nothing changed, and passes a refusal on', async () => {
        const unchanged = await runSlideEdit(
            { file: 'Preaching', action: 'update-slide', slide: 1, items: [] },
            genWorker({ didChange: false, note: 'Already so.' }).worker,
        );
        expect(JSON.parse(readText(unchanged))).toMatchObject({
            isChanged: false,
            note: 'Already so.',
        });
        const refused = await runSlideEdit(
            { file: 'Preaching', action: 'delete-slide', slide: 9 },
            genWorker({ isError: true, reason: 'There is no slide 9.' }).worker,
        );
        expect(refused.isError).toBe(true);
        expect(readText(refused)).toBe('There is no slide 9.');
    });

    it('asks the app nothing for a bad file or action', async () => {
        const { worker } = genWorker({});
        expect(
            (await runSlideEdit({ file: '', action: 'slides' }, worker))
                .isError,
        ).toBe(true);
        expect(
            readText(
                await runSlideEdit({ file: 'x', action: 'delete' }, worker),
            ),
        ).toMatch(/`action` is one of/);
        expect(worker).not.toHaveBeenCalled();
    });
});

describe('the tool and the policy around it', () => {
    it('registers with its description and schema', () => {
        const registerTool = vi.fn();
        registerSlideEditTool({ registerTool });
        const [name, options] = registerTool.mock.calls[0];
        expect(name).toBe(SLIDE_EDIT_TOOL_NAME);
        expect(options.description).toBe(SLIDE_EDIT_DESCRIPTION);
        for (const action of SLIDE_EDIT_ACTIONS) {
            expect(options.inputSchema.action.safeParse(action).success).toBe(
                true,
            );
        }
        expect(options.inputSchema.action.safeParse('delete').success).toBe(
            false,
        );
        expect(
            options.inputSchema.changes.safeParse([
                { items: [{ text: 'Welcome', fontWeight: 'bold' }] },
            ]).success,
        ).toBe(true);
    });

    it('only a read is free of the acting budget; delete-slide is a removal', () => {
        expect(
            checkIsActingCall(SLIDE_EDIT_TOOL_NAME, { action: 'slides' }),
        ).toBe(false);
        expect(
            checkIsActingCall(SLIDE_EDIT_TOOL_NAME, {
                action: 'update-slides',
            }),
        ).toBe(true);
        expect(
            checkIsRemovingCall(SLIDE_EDIT_TOOL_NAME, {
                action: 'delete-slide',
            }),
        ).toBe(true);
        expect(
            checkIsRemovingCall(SLIDE_EDIT_TOOL_NAME, {
                action: 'add-slides',
            }),
        ).toBe(false);
    });

    it('the banner names the document, never its path, and a read is quiet', () => {
        expect(
            describeToolNotice(SLIDE_EDIT_TOOL_NAME, {
                action: 'slides',
                file: SLIDE_PATH,
            }),
        ).toBeNull();
        expect(
            describeToolNotice(SLIDE_EDIT_TOOL_NAME, {
                action: 'update-slides',
                file: SLIDE_PATH,
            }),
        ).toMatchObject({
            text: 'changed the slide document "Preaching"',
            key: 'changed a slide document',
        });
        expect(
            describeToolNotice(SLIDE_EDIT_TOOL_NAME, {
                action: 'update-slide',
                file: 'Preaching',
                slide: 2,
            }),
        ).toMatchObject({ text: 'changed slide 2 of "Preaching"' });
        expect(
            describeToolNotice(SLIDE_EDIT_TOOL_NAME, {
                action: 'add-slides',
                file: 'Preaching',
            }).key,
        ).toBe('added a slide');
        expect(describeToolNotice(SLIDE_EDIT_TOOL_NAME, {}).key).toBe(
            'changed a slide document',
        );
    });

    it('the chatbot model is offered it only in a conversation about slides', () => {
        const tools = [
            { name: SLIDE_EDIT_TOOL_NAME },
            { name: 'owa_slide_file' },
            { name: 'owa_help_search' },
        ];
        expect(MODEL_ON_ASK_TOOL_MAP[SLIDE_EDIT_TOOL_NAME]).toBe('slide');
        expect(filterModelToolList(tools)).toEqual([
            { name: 'owa_slide_file' },
            { name: 'owa_help_search' },
        ]);
        expect(pickAskToolList(tools, 'slide')).toEqual([
            { name: SLIDE_EDIT_TOOL_NAME },
        ]);
    });
});
