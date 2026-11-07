// The Khmer cases of `tools/owa-devtools-mcp/firewall.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkIsActingTool,
    checkIsAppUrl,
    checkIsRemovingCall,
    checkToolCall,
    filterToolList,
    findDestructiveLabel,
    findDestructiveUid,
    genPressGuard,
    genPressRefusalReason,
    genUidLabelMemory,
    getFirewallLog,
    guardToolCalls,
    recordPressRefusal,
    redactSecrets,
    resetFirewallState,
} from '../../../../../../../../tools/owa-devtools-mcp/firewall.mjs';

// A real fragment of the presenter's snapshot, kept verbatim: the format is
// chrome-devtools', not ours, so a made-up one would stop proving anything the
// day it changes.
const PRESENTER_SNAPSHOT = [
    '## Latest page snapshot',
    'uid=1_0 RootWebArea "Open Worship app - Presenter" url="x"',
    '  uid=1_112 button "Clear All" description="Clear All [F6]"',
    '  uid=1_115 button "Clear Long Text" description="Clear Long Text [F9]"',
    '  uid=1_117 button "Move to Trash" description="Move to Trash"',
    '  uid=1_241 StaticText "and God shall take away and remove his part"',
    '  uid=1_184 textbox "Bible Reference" value="Genesis 1:5"',
].join('\n');

beforeEach(() => {
    resetFirewallState();
    delete process.env.OWA_MCP_FIREWALL;
});

afterEach(() => {
    delete process.env.OWA_MCP_FIREWALL;
});

// Measured 2026-09-14: the label list was English, and every tool that names a
// control to the model names it in the language the window shows.
describe('a press that cannot be undone, in the words the window shows', () => {
    it('refuses it in Khmer', () => {
        for (const find of [
            'ផ្លាស់ទីទៅធុងសំរាម',
            'លុបទាំងអស់',
            'Mini Screen > លុបទាំងអស់ [F6]',
            'បោះបង់ការផ្លាស់ប្តូរ',
        ]) {
            expect(checkToolCall('owa_click', { find }).rule, find).toBe(
                'destructive-label',
            );
        }
    });

    // Clear Background's Khmer is ALSO Remove Background's. The window cannot
    // tell them apart, so the ordinary move stays pressable and the app's
    // confirm stands behind the other.
    it('still presses the ordinary Khmer controls', () => {
        for (const find of [
            'លុបអត្ថបទវែង [F9]',
            'លុបផ្ទៃខាងក្រោយ [F7]',
            'លុបស្លាយ',
            'បង្ហាញ',
        ]) {
            expect(checkToolCall('owa_click', { find }).isAllowed, find).toBe(
                true,
            );
        }
    });

    it('remembers a Khmer control out of a snapshot', () => {
        const memory = genUidLabelMemory();
        memory.remember(
            [
                'uid=3_0 RootWebArea "x"',
                '  uid=3_7 menuitem "ផ្លាស់ទីទៅធុងសំរាម"',
                '  uid=3_8 button "ចាកចេញពីគណនី" description="SongSelect"',
                '  uid=3_9 button "លុបអត្ថបទវែង" description="[F9]"',
            ].join('\n'),
        );
        expect(memory.lookup('3_7')).not.toBeNull();
        // Sign out's Khmer sits inside an ordinary sentence of the
        // dictionary, so it is refused only as a WHOLE name -- which the
        // quotes around it and the description beside it must not hide.
        expect(memory.lookup('3_8')).not.toBeNull();
        expect(memory.lookup('3_9')).toBeNull();
    });
});

describe('the guard a press carries into the page', () => {
    it('carries the rule, and nothing when switched off', () => {
        const guard = genPressGuard();
        expect(guard.rule.patterns.length).toBeGreaterThan(5);
        expect(guard.rule.containPhrases).toContain('ផ្លាស់ទីទៅធុងសំរាម');
        process.env.OWA_MCP_FIREWALL = 'off';
        expect(genPressGuard()).toBeNull();
    });
});
