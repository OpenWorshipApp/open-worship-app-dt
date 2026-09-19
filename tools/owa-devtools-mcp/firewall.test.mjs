import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
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
} from './firewall.mjs';

// A real fragment of the presenter's snapshot, kept verbatim: the format is
// chrome-devtools', not ours, so a made-up one would stop proving anything the
// day it changes.
const PRESENTER_SNAPSHOT = [
    '## Latest page snapshot',
    'uid=1_0 RootWebArea "Open Worship app - Presenter" url="x"',
    '  uid=1_112 button "Clear All" description="Clear All [F6]"',
    '  uid=1_115 button "Clear Bible" description="Clear Bible [F9]"',
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

describe('checkToolCall', () => {
    // The finding this whole file exists for, reduced to a test: measured
    // against the live app, `evaluate_script` reached `require('fs')` in a
    // renderer with node integration.
    it('refuses the tools that escape the app', () => {
        for (const name of [
            'evaluate_script',
            'take_heapsnapshot',
            'upload_file',
        ]) {
            const verdict = checkToolCall(name, {});
            expect(verdict.isAllowed).toBe(false);
            expect(verdict.rule).toBe('denied-tool');
            // The refusal has to be usable by the model, not just negative.
            expect(verdict.reason.length).toBeGreaterThan(40);
        }
    });

    it('leaves the reading tools alone', () => {
        for (const name of [
            'take_snapshot',
            'list_pages',
            'owa_app_state',
            'owa_help_search',
            'owa_list_ui',
            'owa_find_ui',
        ]) {
            expect(checkToolCall(name, {}).isAllowed).toBe(true);
        }
    });

    it('only lets a navigation land on a page the app itself serves', () => {
        expect(
            checkToolCall('navigate_page', {
                url: 'https://localhost:3000/reader.html',
            }).isAllowed,
        ).toBe(true);
        const verdict = checkToolCall('navigate_page', {
            url: 'https://example.com',
        });
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.rule).toBe('foreign-url');
        expect(checkToolCall('new_page', { url: 'data:text/html,x' }).isAllowed).toBe(
            false,
        );
    });

    // "The assistant may point, the human presses."
    it('refuses to press something that cannot be undone', () => {
        const verdict = checkToolCall('owa_click', { find: 'Move to Trash' });
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.rule).toBe('destructive-label');
        // ...and says what to do instead, so the model does not just give up.
        expect(verdict.reason).toContain('owa_find_ui');
        expect(
            checkToolCall('owa_click', { find: ['Nope', 'Delete'] }).isAllowed,
        ).toBe(false);
    });

    it('still presses the ordinary controls', () => {
        for (const find of [
            'Clear Bible',
            'Reset Widgets Size',
            'Next',
            'Background > Videos',
            'Show',
        ]) {
            expect(checkToolCall('owa_click', { find }).isAllowed).toBe(true);
        }
    });

    it('stops a loop that is hammering the app', () => {
        let last = null;
        for (let index = 0; index < 40; index += 1) {
            last = checkToolCall('owa_click', { find: 'Next' }, { now: 1000 });
        }
        expect(last.isAllowed).toBe(false);
        expect(last.rule).toBe('rate-limit');
        // Reading is never rationed -- the way out of a loop is to look.
        expect(
            checkToolCall('owa_list_ui', {}, { now: 1000 }).isAllowed,
        ).toBe(true);
        // ...and the budget is a rolling window, not a session cap.
        expect(
            checkToolCall('owa_click', { find: 'Next' }, { now: 90000 })
                .isAllowed,
        ).toBe(true);
    });

    it('does not charge a refused call to the budget', () => {
        for (let index = 0; index < 40; index += 1) {
            checkToolCall('evaluate_script', {}, { now: 1000 });
        }
        expect(
            checkToolCall('owa_click', { find: 'Next' }, { now: 1000 })
                .isAllowed,
        ).toBe(true);
    });

    it('stands down entirely when the operator switched it off', () => {
        process.env.OWA_MCP_FIREWALL = 'off';
        expect(checkToolCall('evaluate_script', {}).isAllowed).toBe(true);
        expect(
            checkToolCall('owa_click', { find: 'Delete' }).isAllowed,
        ).toBe(true);
    });
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

    // Clear Bible's Khmer is ALSO Delete Bible's. The window cannot tell them
    // apart, so the ordinary move stays pressable and the app's confirm
    // stands behind the other.
    it('still presses the ordinary Khmer controls', () => {
        for (const find of ['លុបព្រះគម្ពីរ [F9]', 'លុបស្លាយ', 'បង្ហាញ']) {
            expect(checkToolCall('owa_click', { find }).isAllowed, find).toBe(
                true,
            );
        }
    });

    // The matcher folds these before it compares; the patterns did not.
    it('refuses it however the words are spaced', () => {
        for (const find of ['Clear All', 'Clear  All', 'Sign out']) {
            expect(checkToolCall('owa_click', { find }).isAllowed, find).toBe(
                false,
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
                '  uid=3_9 button "លុបព្រះគម្ពីរ" description="[F9]"',
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

    it('says a refusal the page made the way a firewall refusal is said', () => {
        const destructive = genPressRefusalReason({
            refused: 'destructive',
            label: 'Delete this preset',
        });
        expect(destructive).toContain('"Delete this preset"');
        expect(destructive).toContain('owa_find_ui');
        expect(
            genPressRefusalReason(
                { refused: 'destructive', label: 'Clear All [F6]' },
                { isGuide: true },
            ),
        ).toContain('walkthrough card is already ringing it');
        expect(genPressRefusalReason({ refused: 'question' })).toContain(
            'question the app is asking',
        );
    });

    it('logs it beside the refusals made here', () => {
        recordPressRefusal('owa_click', { refused: 'question' });
        expect(getFirewallLog().at(-1)).toMatchObject({
            name: 'owa_click',
            rule: 'question-press',
            isAllowed: false,
        });
    });
});

// Every removal the data tools make goes to the trash with a backup, which is
// why they exist -- and still has a budget of its own, because a loop that
// empties a Documents folder into the trash costs a volunteer their morning.
describe('removing something of the user', () => {
    it('knows a removal by its action, not by its tool', () => {
        expect(
            checkIsRemovingCall('owa_slide_file', { action: 'delete-slide' }),
        ).toBe(true);
        expect(checkIsRemovingCall('owa_lyric_file', { action: 'delete' })).toBe(
            true,
        );
        expect(checkIsRemovingCall('owa_undo', { action: 'undo' })).toBe(true);
        expect(checkIsRemovingCall('owa_bible_item', { action: 'list' })).toBe(
            false,
        );
        expect(checkIsRemovingCall('owa_click', { action: 'delete' })).toBe(
            false,
        );
    });

    it('rations removals far more tightly than presses', () => {
        let last = null;
        for (let index = 0; index < 12; index += 1) {
            last = checkToolCall(
                'owa_bible_note',
                { action: 'delete', id: index },
                { now: 1000 },
            );
        }
        expect(last.isAllowed).toBe(false);
        expect(last.rule).toBe('rate-limit');
        // ...and says what was removed can be put back.
        expect(last.reason).toContain('owa_undo');
        // A change that removes nothing is not charged to it.
        expect(
            checkToolCall(
                'owa_bible_note',
                { action: 'add', title: 'x' },
                { now: 1000 },
            ).isAllowed,
        ).toBe(true);
    });

    it('does not spend a press on a removal it refuses', () => {
        for (let index = 0; index < 10; index += 1) {
            checkToolCall('owa_undo', { action: 'undo' }, { now: 1000 });
        }
        expect(
            checkToolCall('owa_undo', { action: 'undo' }, { now: 1000 })
                .isAllowed,
        ).toBe(false);
        // Ten removals spent ten presses; the refused eleventh spent none, so
        // exactly fifteen of the twenty-five are left.
        for (let index = 0; index < 15; index += 1) {
            expect(
                checkToolCall('owa_click', { find: 'Next' }, { now: 1000 })
                    .isAllowed,
            ).toBe(true);
        }
        expect(
            checkToolCall('owa_click', { find: 'Next' }, { now: 1000 })
                .isAllowed,
        ).toBe(false);
    });

    it('is off with the firewall', () => {
        process.env.OWA_MCP_FIREWALL = 'off';
        for (let index = 0; index < 20; index += 1) {
            expect(
                checkToolCall('owa_undo', { action: 'undo' }, { now: 1000 })
                    .isAllowed,
            ).toBe(true);
        }
    });
});

describe('findDestructiveLabel', () => {
    it('reads the control, not the panel it was narrowed to', () => {
        expect(findDestructiveLabel('Deleted Items > Restore')).toBeNull();
        expect(findDestructiveLabel('Slides > Delete')).toBe('Delete');
    });

    it('matches whole words only', () => {
        expect(findDestructiveLabel('Undelete')).toBeNull();
        expect(findDestructiveLabel('Preset')).toBeNull();
    });
});

describe('checkIsAppUrl', () => {
    it('takes the app own pages and about:blank', () => {
        expect(checkIsAppUrl('https://localhost:3000/presenter.html')).toBe(true);
        expect(checkIsAppUrl('file:///C:/app/electron-build/index.html')).toBe(
            true,
        );
        expect(checkIsAppUrl('http://127.0.0.1:3000/x')).toBe(true);
        expect(checkIsAppUrl('about:blank')).toBe(true);
    });

    it('refuses everything else, including what it never names', () => {
        expect(checkIsAppUrl('https://example.com')).toBe(false);
        expect(checkIsAppUrl('javascript:alert(1)')).toBe(false);
        expect(checkIsAppUrl('data:text/html,<b>x</b>')).toBe(false);
        expect(checkIsAppUrl('')).toBe(false);
        expect(checkIsAppUrl(undefined)).toBe(false);
        expect(checkIsAppUrl('not a url')).toBe(false);
    });
});

describe('redactSecrets', () => {
    // The chatbot calls its provider FROM THE RENDERER with the user's key in
    // a header, so this is what a network log or a snapshot of the settings
    // page actually contains.
    it('takes the provider keys out', () => {
        const text = redactSecrets(
            'x-api-key: sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA and ' +
                'sk-BBBBBBBBBBBBBBBBBBBBBBBBBB',
        );
        expect(text).not.toContain('sk-ant-api03-AAAA');
        expect(text).not.toContain('sk-BBBB');
        expect(text).toContain('redacted');
    });

    it('takes a bearer token and a JWT out', () => {
        expect(
            redactSecrets('authorization: Bearer abcdefghijklmnop0123456789'),
        ).not.toContain('abcdefghijklmnop');
        expect(
            redactSecrets(
                'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefgh12',
            ),
        ).not.toContain('eyJzdWIi');
    });

    it('keeps the name of a credential and drops its value', () => {
        const text = redactSecrets('"apiKey": "0123456789abcdef"');
        expect(text).toContain('apiKey');
        expect(text).not.toContain('0123456789abcdef');
    });

    it('leaves ordinary output exactly as it was', () => {
        const text = '## Pages\n1: Open Worship app - Presenter (🖥️)';
        expect(redactSecrets(text)).toBe(text);
        expect(redactSecrets('')).toBe('');
        expect(redactSecrets(null)).toBeNull();
    });
});

describe('filterToolList', () => {
    it('drops the denied tools so the model never learns they exist', () => {
        const tools = filterToolList([
            { name: 'evaluate_script' },
            { name: 'owa_click' },
            { name: 'take_heapsnapshot' },
        ]);
        expect(tools.map((one) => one.name)).toEqual(['owa_click']);
    });

    it('hands the list back untouched when switched off', () => {
        process.env.OWA_MCP_FIREWALL = 'off';
        expect(filterToolList([{ name: 'evaluate_script' }])).toHaveLength(1);
    });
});

describe('guardToolCalls', () => {
    function genTransport() {
        const seen = [];
        const sent = [];
        const transport = {
            onmessage: (message) => seen.push(message),
            send: (message) => sent.push(message),
        };
        return { transport, seen, sent };
    }

    it('answers a refused call itself and never forwards it', () => {
        const { transport, seen, sent } = genTransport();
        guardToolCalls(transport, { log: () => {} });
        transport.onmessage({
            jsonrpc: '2.0',
            id: 7,
            method: 'tools/call',
            params: { name: 'evaluate_script', arguments: {} },
        });
        expect(seen).toHaveLength(0);
        expect(sent).toHaveLength(1);
        expect(sent[0].id).toBe(7);
        expect(sent[0].result.isError).toBe(true);
        expect(getFirewallLog().at(-1)).toMatchObject({
            name: 'evaluate_script',
            isAllowed: false,
        });
    });

    it('lets an allowed call through untouched', () => {
        const { transport, seen, sent } = genTransport();
        guardToolCalls(transport, { log: () => {} });
        const message = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'owa_app_state', arguments: {} },
        };
        transport.onmessage(message);
        expect(seen).toEqual([message]);
        expect(sent).toHaveLength(0);
    });

    it('filters the tool list and scrubs a tool result on the way out', () => {
        const { transport, sent } = genTransport();
        guardToolCalls(transport, { log: () => {} });
        transport.onmessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        transport.send({
            jsonrpc: '2.0',
            id: 1,
            result: { tools: [{ name: 'evaluate_script' }, { name: 'click' }] },
        });
        expect(sent[0].result.tools.map((one) => one.name)).toEqual(['click']);

        transport.onmessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'list_network_requests', arguments: {} },
        });
        transport.send({
            jsonrpc: '2.0',
            id: 2,
            result: {
                content: [
                    {
                        type: 'text',
                        text: 'x-api-key: sk-ant-api03-QQQQQQQQQQQQQQQQQQQQ',
                    },
                ],
            },
        });
        expect(sent[1].result.content[0].text).not.toContain('QQQQ');
    });

    // Same trap `notify.mjs` documents: the SDK keeps the handler it finds.
    it('does not recurse when the SDK has chained its own handler', () => {
        const seen = [];
        const transport = { onmessage: null, send: () => {} };
        const chained = transport.onmessage;
        transport.onmessage = (message) => {
            seen.push(message.params.name);
            chained?.(message);
        };
        guardToolCalls(transport, { log: () => {} });
        transport.onmessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'owa_app_state', arguments: {} },
        });
        expect(seen).toEqual(['owa_app_state']);
    });

    it('wraps once, however many times it is called', () => {
        const { transport, seen } = genTransport();
        guardToolCalls(transport, { log: () => {} });
        guardToolCalls(transport, { log: () => {} });
        transport.onmessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'owa_app_state' },
        });
        expect(seen).toHaveLength(1);
    });

    it('leaves a transport it cannot wrap alone', () => {
        expect(guardToolCalls(null)).toBeNull();
    });
});

describe('the uid interlock', () => {
    it('remembers only the destructive interactive controls', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        // "Move to Trash" and "Clear All" -- and nothing else. A memory of the
        // whole tree would be a per-session cache of the app's entire UI.
        expect(memory.size).toBe(2);
        expect(memory.lookup('1_112')).toContain('Clear All');
        expect(memory.lookup('1_117')).toContain('Trash');
        expect(memory.lookup('1_115')).toBeNull();
    });

    // The failure the role filter exists to prevent: a Bible verse saying
    // "remove" must not make its own StaticText unpressable.
    it('ignores wording that is content rather than a control', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        expect(memory.lookup('1_241')).toBeNull();
    });

    // chrome-devtools mints fresh uids per snapshot, so a remembered one that
    // is no longer destructive must stop being refused -- a firewall that
    // blocks ordinary work is one the model learns to route around.
    it('replaces a page rather than merging it', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        memory.remember(
            ['uid=1_0 RootWebArea "x"', '  uid=1_112 button "Save"'].join('\n'),
        );
        expect(memory.lookup('1_112')).toBeNull();
        expect(memory.size).toBe(0);
    });

    it('leaves another page alone', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        memory.remember(
            ['uid=2_0 RootWebArea "x"', '  uid=2_5 button "Save"'].join('\n'),
        );
        expect(memory.lookup('1_112')).toContain('Clear All');
    });

    it('costs nothing for a result with no snapshot in it', () => {
        const memory = genUidLabelMemory();
        memory.remember('{"page":"presenter","language":"en"}');
        expect(memory.size).toBe(0);
    });

    it('finds the uid of every acting tool that takes one', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        const lookup = (uid) => {
            return memory.lookup(uid);
        };
        expect(findDestructiveUid('click', { uid: '1_117' }, lookup)).toContain(
            'Trash',
        );
        expect(
            findDestructiveUid('fill', { uid: '1_112' }, lookup),
        ).not.toBeNull();
        expect(
            findDestructiveUid(
                'drag',
                { from_uid: '1_184', to_uid: '1_117' },
                lookup,
            ),
        ).not.toBeNull();
        expect(
            findDestructiveUid(
                'fill_form',
                { elements: [{ uid: '1_184' }, { uid: '1_112' }] },
                lookup,
            ),
        ).not.toBeNull();
        expect(findDestructiveUid('click', { uid: '1_115' }, lookup)).toBeNull();
    });

    // The whole point: the snapshot came back through the firewall, so the
    // click that uses it can be read.
    it('refuses a press aimed by uid at what cannot be undone', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        const lookupUidLabel = (uid) => {
            return memory.lookup(uid);
        };
        const verdict = checkToolCall(
            'click',
            { pageId: 1, uid: '1_117' },
            { lookupUidLabel },
        );
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.rule).toBe('destructive-uid');
        expect(verdict.reason).toContain('press it themselves');
    });

    it('leaves an ordinary press by uid alone', () => {
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        const verdict = checkToolCall(
            'click',
            { pageId: 1, uid: '1_115' },
            {
                lookupUidLabel: (uid) => {
                    return memory.lookup(uid);
                },
            },
        );
        expect(verdict.isAllowed).toBe(true);
    });

    // End to end through the transport, which is the only place the two
    // halves meet: the snapshot goes OUT, the click comes IN.
    it('learns the label from a snapshot flowing through the transport', () => {
        const sentList = [];
        const transport = {
            onmessage: () => {},
            send: (message) => {
                sentList.push(message);
            },
        };
        guardToolCalls(transport, { log: () => {} });
        // The snapshot the model asked for, on its way back.
        transport.onmessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'take_snapshot', arguments: { pageId: 1 } },
        });
        transport.send({
            jsonrpc: '2.0',
            id: 1,
            result: { content: [{ type: 'text', text: PRESENTER_SNAPSHOT }] },
        });
        // ...and the press it enables, on its way in.
        transport.onmessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'click', arguments: { pageId: 1, uid: '1_117' } },
        });
        const refusal = sentList.find((one) => {
            return one.id === 2;
        });
        expect(refusal?.result?.isError).toBe(true);
        expect(refusal.result.content[0].text).toContain('Trash');
        expect(
            getFirewallLog().some((one) => {
                return one.rule === 'destructive-uid';
            }),
        ).toBe(true);
    });

    // Every acting tool takes `includeSnapshot`, so a model could refresh its
    // uids without ever naming `take_snapshot`.
    it('harvests a snapshot that rode along with an acting call', () => {
        const sentList = [];
        const transport = {
            onmessage: () => {},
            send: (message) => {
                sentList.push(message);
            },
        };
        guardToolCalls(transport, { log: () => {} });
        transport.onmessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'hover',
                arguments: { pageId: 1, uid: '1_1', includeSnapshot: true },
            },
        });
        transport.send({
            jsonrpc: '2.0',
            id: 1,
            result: {
                content: [
                    {
                        type: 'text',
                        text: ['hovered', PRESENTER_SNAPSHOT].join('\n'),
                    },
                ],
            },
        });
        transport.onmessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'click', arguments: { pageId: 1, uid: '1_112' } },
        });
        expect(
            sentList.find((one) => {
                return one.id === 2;
            })?.result?.isError,
        ).toBe(true);
    });

    it('is off with the firewall', () => {
        process.env.OWA_MCP_FIREWALL = 'off';
        const memory = genUidLabelMemory();
        memory.remember(PRESENTER_SNAPSHOT);
        expect(
            checkToolCall(
                'click',
                { uid: '1_117' },
                {
                    lookupUidLabel: (uid) => {
                        return memory.lookup(uid);
                    },
                },
            ).isAllowed,
        ).toBe(true);
    });
});

// Found by using the tool, not by reading it: every one of these was refused,
// so an agent could not reload the window it was already looking at.
describe('moving within the app', () => {
    it('allows reload, back and forward', () => {
        for (const type of ['reload', 'back', 'forward']) {
            expect(
                checkToolCall('navigate_page', { pageId: 1, type }).isAllowed,
                type,
            ).toBe(true);
        }
    });

    it('still refuses an address outside the app', () => {
        for (const args of [
            { pageId: 1, url: 'https://example.com' },
            // A type that says history but an address that does not: the
            // address is what gets checked, whatever the type claims.
            { pageId: 1, type: 'reload', url: 'https://example.com' },
            { pageId: 1, type: 'url', url: 'data:text/html,<script>x</script>' },
        ]) {
            expect(
                checkToolCall('navigate_page', args).rule,
                JSON.stringify(args),
            ).toBe('foreign-url');
        }
    });

    // `new_page` has no history to move through -- it only ever opens an
    // address, so it never takes this exemption.
    it('gives new_page no history exemption', () => {
        expect(
            checkToolCall('new_page', { type: 'reload' }).rule,
        ).toBe('foreign-url');
    });
});

// The first tool in this package that reaches OFF the machine. Two rules meet
// here and they answer different threats: the address check stops it reaching
// back IN (the app's own doors are on loopback with no credential), and the
// budget bounds what a looping or injected model can send OUT.
describe('reading a page off the internet', () => {
    beforeEach(() => {
        resetFirewallState();
    });

    it('reads an ordinary public page', () => {
        expect(
            checkToolCall('owa_read_website', {
                url: 'https://en.wikipedia.org/wiki/King_James_Version',
            }).isAllowed,
        ).toBe(true);
    });

    it('refuses the loopback the app serves its own doors on', () => {
        const verdict = checkToolCall('owa_read_website', {
            url: 'https://127.0.0.1:39223/mcp',
        });
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.rule).toBe('foreign-url');
    });

    it.each([
        'https://192.168.1.1/',
        'https://169.254.169.254/latest/meta-data/',
        'https://2130706433/',
        'https://localhost/',
        'file:///etc/passwd',
        'http://example.com/',
    ])('refuses %s', (url) => {
        expect(checkToolCall('owa_read_website', { url }).rule).toBe(
            'foreign-url',
        );
    });

    it('refuses a call with no address at all', () => {
        expect(checkToolCall('owa_read_website', {}).rule).toBe('foreign-url');
    });

    // Its own budget, not the acting one. A walkthrough legitimately presses
    // a dozen things in a minute; a question needing more than a page or two
    // off the internet is already odd, and each read is a hidden browser
    // window plus whatever went out in the address.
    it('rations reads far more tightly than presses', () => {
        let last = null;
        for (let index = 0; index < 12; index += 1) {
            last = checkToolCall(
                'owa_read_website',
                { url: `https://example.com/${index}` },
                { now: 1000 },
            );
        }
        expect(last.isAllowed).toBe(false);
        expect(last.rule).toBe('rate-limit');
        // Pressing things in the app is untouched by it: they are separate
        // counters protecting separate things.
        expect(
            checkToolCall('owa_click', { find: 'Next' }, { now: 1000 })
                .isAllowed,
        ).toBe(true);
        // ...and it is a rolling window like the other one.
        expect(
            checkToolCall(
                'owa_read_website',
                { url: 'https://example.com/' },
                { now: 1000 + 6 * 60 * 1000 },
            ).isAllowed,
        ).toBe(true);
    });

    // The drafter reaches out only when handed an address. Without one it is
    // the local tool it always was -- never refused for having no url, never
    // charged a network slot -- and with one it is screened and rationed
    // exactly like `owa_read_website`, because it opens the same window.
    it('screens and rations a song draft that carries an address', () => {
        expect(
            checkToolCall('owa_lyric_validate', { text: 'a lantern' })
                .isAllowed,
        ).toBe(true);
        expect(
            checkToolCall('owa_lyric_validate', {
                url: 'https://example.com/chords/1',
            }).isAllowed,
        ).toBe(true);
        expect(
            checkToolCall('owa_lyric_validate', {
                url: 'https://127.0.0.1:39223/mcp',
            }).rule,
        ).toBe('foreign-url');
        expect(
            checkToolCall('owa_lyric_validate', {
                url: 'http://example.com/chords/1',
            }).rule,
        ).toBe('foreign-url');
        // One budget for both doors out: ten reads, whichever tool made them.
        for (let index = 0; index < 10; index += 1) {
            checkToolCall(
                'owa_read_website',
                { url: `https://example.com/${index}` },
                { now: 1000 },
            );
        }
        expect(
            checkToolCall(
                'owa_lyric_validate',
                { url: 'https://example.com/chords/2' },
                { now: 1000 },
            ).rule,
        ).toBe('rate-limit');
        // ...and a draft from a paste is untouched by the exhausted budget.
        expect(
            checkToolCall(
                'owa_lyric_validate',
                { text: 'a lantern', url: '  ' },
                { now: 1000 },
            ).isAllowed,
        ).toBe(true);
    });

    it('does not charge a refused address to the budget', () => {
        for (let index = 0; index < 30; index += 1) {
            checkToolCall(
                'owa_read_website',
                { url: 'https://127.0.0.1/' },
                { now: 1000 },
            );
        }
        expect(
            checkToolCall(
                'owa_read_website',
                { url: 'https://example.com/' },
                { now: 1000 },
            ).isAllowed,
        ).toBe(true);
    });
});
