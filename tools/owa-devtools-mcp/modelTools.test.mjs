import { describe, expect, it } from 'vitest';

import { checkIsActingTool, checkToolCall } from './firewall.mjs';
import {
    MODEL_HIDDEN_TOOL_MAP,
    checkIsModelHiddenTool,
    filterModelToolList,
    findModelHiddenReason,
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
});
