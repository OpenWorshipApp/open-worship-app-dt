import { beforeEach, describe, expect, it } from 'vitest';

import { describeToolCall, watchToolCalls } from './notify.mjs';

// No banner is drawn here: the app may not be running, and a test must not
// reach out to it. The transport seam is what matters.
beforeEach(() => {
    process.env.OWA_MCP_NOTICE = '0';
});

describe('describeToolCall', () => {
    it('names what an acting tool did, in the user of the app words', () => {
        expect(describeToolCall('click', {})).toBe('clicked something');
        expect(describeToolCall('owa_hide_screens', {})).toBe(
            'took content off a screen',
        );
    });

    it('stays quiet for a tool that only reads', () => {
        expect(describeToolCall('take_snapshot', {})).toBeNull();
        expect(describeToolCall('owa_app_state', {})).toBeNull();
        // ...including the one tool that is a read or a draw by argument.
        expect(describeToolCall('owa_find_ui', { text: 'KJV' })).toBeNull();
        expect(
            describeToolCall('owa_find_ui', { text: 'KJV', highlight: true }),
        ).toBe('pointed out a control');
    });
});

describe('watchToolCalls', () => {
    // The bug this exists for: the MCP SDK keeps the handler it finds and
    // calls it from the new one. Wrapping with an accessor that answers
    // "me" made every message recurse, and the whole MCP host answered 500.
    it('does not recurse when the SDK has chained its own handler', () => {
        const seen = [];
        const transport = { onmessage: null };
        // `server.connect` -- the SDK chains whatever was there.
        const chained = transport.onmessage;
        transport.onmessage = (message) => {
            seen.push(message.params.name);
            chained?.(message);
        };
        watchToolCalls(transport);
        transport.onmessage({
            method: 'tools/call',
            params: { name: 'click', arguments: {} },
        });
        expect(seen).toEqual(['click']);
    });

    it('wraps once, however many times it is called', () => {
        const seen = [];
        const transport = { onmessage: (message) => seen.push(message) };
        watchToolCalls(transport);
        watchToolCalls(transport);
        transport.onmessage({ method: 'tools/call', params: { name: 'click' } });
        expect(seen).toHaveLength(1);
    });

    it('leaves a transport it cannot wrap alone', () => {
        expect(watchToolCalls(null)).toBeNull();
    });
});
