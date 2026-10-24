import { describe, expect, it } from 'vitest';

import { checkIsActingTool, checkToolCall } from './firewall.mjs';
import {
    MODEL_HIDDEN_TOOL_MAP,
    MODEL_ON_ASK_TOOL_MAP,
    checkIsModelHiddenTool,
    checkIsModelOnAskTool,
    filterModelToolList,
    findModelHiddenReason,
    pickAskToolList,
} from './modelTools.mjs';

describe('what the model is offered', () => {
    it('drops exactly the withheld tools from a list', () => {
        const toolList = [
            { name: 'owa_find_ui' },
            { name: 'click' },
            { name: 'take_snapshot' },
            { name: 'lighthouse_audit' },
        ];
        expect(
            filterModelToolList(toolList).map((one) => {
                return one.name;
            }),
        ).toEqual(['owa_find_ui']);
    });

    // A refusal the model cannot act on costs a whole round and comes back to
    // the user as an apology. Same rule as `firewall.mjs`'s reasons.
    it('always says what to do instead', () => {
        for (const [name, reason] of Object.entries(MODEL_HIDDEN_TOOL_MAP)) {
            expect(reason.length, name).toBeGreaterThan(40);
            expect(findModelHiddenReason(name)).toBe(reason);
        }
        expect(findModelHiddenReason('owa_find_ui')).toBeNull();
    });

    // The chatbot cannot answer at all without these. Withholding one to save
    // tokens is the failure this list is one edit away from at all times.
    it('keeps everything the chatbot answers with', () => {
        for (const name of [
            'owa_app_state',
            'owa_click',
            'owa_find_ui',
            'owa_goto_page',
            'owa_guide_start',
            'owa_guide_status',
            'owa_guide_step',
            'owa_help_page',
            'owa_help_search',
            'owa_hide_screens',
            'owa_list_questions',
            'owa_list_screens',
            'owa_list_ui',
            'owa_tran',
            'owa_type',
        ]) {
            expect(checkIsModelHiddenTool(name), name).toBe(false);
        }
    });

    // Nothing of chrome-devtools' reaches the model any more: measured on the
    // standing corpus 2026-09-08, the ten that still did were called only on
    // the two questions that FAILED -- `press_key` put the congregation's
    // screen on unasked, three `take_snapshot`s ran a panic question to the
    // round cap. The report still reads the console for itself through
    // `callTool`, which this filter never sees, so withholding the tool from
    // the model costs the report nothing.
    it('withholds every chrome-devtools tool, the page readers included', () => {
        for (const name of [
            'take_snapshot',
            'list_pages',
            'select_page',
            'wait_for',
            'list_console_messages',
            'get_console_message',
            'list_network_requests',
            'get_network_request',
        ]) {
            expect(checkIsModelHiddenTool(name), name).toBe(true);
        }
    });

    // A key press carries no label for the destructive interlock to read, and
    // F5 / F6 are the projector. A message box is the user's to answer.
    it('withholds the two acting tools that carry no label at all', () => {
        for (const name of ['press_key', 'handle_dialog']) {
            expect(checkIsModelHiddenTool(name), name).toBe(true);
            expect(checkIsActingTool(name), name).toBe(true);
        }
    });

    // The structural half of `MC-02`. chrome-devtools' acting tools aim by a
    // uid, which the destructive interlock can only read second-hand off a
    // snapshot -- so every one of them is withheld from the model, which has
    // `owa_click` and `owa_type` and no need of them. Re-offering one without
    // saying so here is the regression this test exists to catch.
    it('withholds every acting tool aimed by a snapshot id', () => {
        for (const name of ['click', 'fill', 'fill_form', 'drag', 'hover']) {
            expect(checkIsModelHiddenTool(name), name).toBe(true);
            expect(checkIsActingTool(name), name).toBe(true);
        }
    });

    // ...and the guarded pair it is left with really is guarded, so the
    // withholding above never leaves the model with an unwatched way to press
    // something that cannot be undone.
    it('leaves the model only presses the interlock can read', () => {
        expect(checkToolCall('owa_click', { find: 'Move to Trash' }).rule).toBe(
            'destructive-label',
        );
        expect(checkIsModelHiddenTool('owa_click')).toBe(false);
    });

    // The developer's two label-aimed hands of 2026-10-10 stay the
    // developer's: a key is how a QA run walks a slide list, and the prompt
    // tells the model no tool advances a run; a drag's result cannot be read
    // back where `owa_presenting_flow add` says what it added and can be
    // undone. The run-sheet tool itself IS offered, for exactly that ask.
    it('withholds the key, drag and menu tools, and offers the run-sheet tool', () => {
        for (const name of [
            'owa_press_key',
            'owa_drag',
            'owa_menu',
            'owa_scroll',
            'owa_media_file',
            'owa_drop_files',
        ]) {
            expect(checkIsModelHiddenTool(name), name).toBe(true);
            expect(checkIsActingTool(name), name).toBe(true);
        }
        expect(checkIsModelHiddenTool('owa_presenting_flow')).toBe(false);
    });

    // A tool for one conversation is no tax on every other question: the
    // verse finder goes to a verse-finding ask, and that ask gets it ALONE
    // -- its own short prompt, its own one schema (2026-10-16).
    it('offers an ask-kind tool to its own ask only', () => {
        const toolList = [
            { name: 'owa_find_ui' },
            { name: 'owa_find_verse' },
            { name: 'owa_read_website' },
            { name: 'click' },
        ];
        expect(
            filterModelToolList(toolList).map((one) => {
                return one.name;
            }),
        ).toEqual(['owa_find_ui', 'owa_read_website']);
        // ...plus the web, for a verse the Bible here cannot place.
        expect(
            pickAskToolList(toolList, 'verse-find').map((one) => {
                return one.name;
            }),
        ).toEqual(['owa_find_verse', 'owa_read_website']);
        expect(
            pickAskToolList(
                [
                    { name: 'owa_find_verse' },
                    { name: 'owa_lookup_record' },
                    { name: 'owa_read_website' },
                    { name: 'owa_click' },
                ],
                'lookup',
            ).map((tool) => tool.name),
        ).toEqual([
            'owa_find_verse',
            'owa_lookup_record',
            'owa_read_website',
        ]);
        expect(checkIsModelOnAskTool('owa_lookup_record')).toBe(true);
        // A conversation about a Resources file reads the rest of them.
        expect(
            pickAskToolList(
                [
                    { name: 'owa_lookup_record' },
                    { name: 'owa_resource_file' },
                    { name: 'owa_read_website' },
                    { name: 'owa_click' },
                ],
                'resources',
            ).map((tool) => tool.name),
        ).toEqual([
            'owa_lookup_record',
            'owa_resource_file',
            'owa_read_website',
        ]);
        expect(checkIsModelOnAskTool('owa_resource_file')).toBe(true);
        // A typed Bible-Reader question gets all three, whichever it wants.
        expect(
            pickAskToolList(
                [
                    { name: 'owa_lookup_record' },
                    { name: 'owa_resource_file' },
                    { name: 'owa_find_verse' },
                    { name: 'owa_read_website' },
                    { name: 'owa_click' },
                ],
                'bible-reader',
            ).map((tool) => tool.name),
        ).toEqual([
            'owa_lookup_record',
            'owa_resource_file',
            'owa_find_verse',
            'owa_read_website',
        ]);
        expect(
            filterModelToolList([{ name: 'owa_resource_file' }]),
        ).toEqual([]);
        expect(pickAskToolList(toolList, 'other')).toEqual([]);
        expect(checkIsModelOnAskTool('owa_find_verse')).toBe(true);
        expect(checkIsModelHiddenTool('owa_find_verse')).toBe(false);
        // Hidden and on-ask are two different decisions: a tool in both
        // would be offered to its ask and refused when it called it.
        for (const name of Object.keys(MODEL_ON_ASK_TOOL_MAP)) {
            expect(Object.hasOwn(MODEL_HIDDEN_TOOL_MAP, name), name).toBe(
                false,
            );
        }
    });
});
