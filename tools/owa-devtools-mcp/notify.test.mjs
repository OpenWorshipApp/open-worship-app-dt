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

// The verse goes on the congregation's screen, so the banner names it: "put
// a Bible passage on the screen" says nothing the operator can check against
// the wall. A `check` reads the passage and touches no screen, and stays
// quiet like every other read.
describe('presenting a passage names the passage', () => {
    it('names the reference', () => {
        expect(
            describeToolCall('owa_present_bible', { reference: 'John 3:16' }),
        ).toBe('put John 3:16 on the screen');
        expect(describeToolCall('owa_present_bible', {})).toBe(
            'put a Bible passage on the screen',
        );
    });

    it('says nothing for a check', () => {
        expect(
            describeToolCall('owa_present_bible', {
                reference: 'John 3:16',
                action: 'check',
            }),
        ).toBeNull();
    });
});

// A countdown or a message goes on the congregation's screen too, so the
// banner names WHICH extra and how long -- a sentence the operator can check
// against the wall. A check reads and stays quiet.
describe('a foreground extra names the extra', () => {
    it('names the countdown and its length, or its target time', () => {
        expect(
            describeToolCall('owa_foreground', { widget: 'countdown', minutes: 5 }),
        ).toBe('started a 5 minute countdown on the screen');
        expect(
            describeToolCall('owa_foreground', { widget: 'countdown', at: '10:30' }),
        ).toBe('started a countdown to 10:30 on the screen');
        expect(
            describeToolCall('owa_foreground', {
                widget: 'marquee-bottom',
                text: 'Please silence your phones',
            }),
        ).toBe('put a scrolling message on the screen');
        expect(describeToolCall('owa_foreground', { widget: 'clock' })).toBe(
            'put a clock on the screen',
        );
        expect(describeToolCall('owa_foreground', {})).toBe(
            'put a countdown or a message on the screen',
        );
    });

    it('says what came off, and nothing for a check', () => {
        expect(
            describeToolCall('owa_foreground', {
                action: 'stop',
                widget: 'countdown',
            }),
        ).toBe('took the countdown off the screen');
        expect(
            describeToolCall('owa_foreground', { action: 'stop', widget: 'all' }),
        ).toBe('took every foreground extra off the screen');
        expect(
            describeToolCall('owa_foreground', { action: 'check' }),
        ).toBeNull();
    });
});

// Reading a page changes nothing in the window, so by this file's own rule it
// would stay quiet. It announces itself anyway: "what left this computer" is
// the one thing an operator is owed a look at even more than "what was
// pressed", and the site is named because that is the part worth seeing.
describe('reading a website announces where it went', () => {
    it('names the site', () => {
        expect(
            describeToolCall('owa_read_website', {
                url: 'https://en.wikipedia.org/wiki/King_James_Version',
            }),
        ).toBe('read a page on en.wikipedia.org');
    });

    // The path is where an exfiltration attempt puts its payload, and a
    // banner is glanced at rather than read.
    it('never puts the path in the banner', () => {
        const said = describeToolCall('owa_read_website', {
            url: 'https://example.com/collect?data=secret-looking-thing',
        });
        expect(said).not.toContain('secret-looking-thing');
        expect(said).toBe('read a page on example.com');
    });

    it('still announces itself for an unreadable address', () => {
        expect(describeToolCall('owa_read_website', {})).toBe(
            'read a website',
        );
        expect(describeToolCall('owa_read_website', { url: 'not a url' })).toBe(
            'read a website',
        );
    });

    // The drafter reads a page itself when handed an address, through the
    // same window -- so it is announced the same way, and only then: a draft
    // from a paste leaves the computer no more than a spell-check does.
    it('announces a song drafted straight off a page, and only then', () => {
        expect(
            describeToolCall('owa_lyric_validate', {
                url: 'https://example.com/chords/1',
            }),
        ).toBe('read a page on example.com');
        expect(
            describeToolCall('owa_lyric_validate', { url: 'not a url' }),
        ).toBe('read a website');
        expect(
            describeToolCall('owa_lyric_validate', { text: 'a lantern' }),
        ).toBeNull();
        expect(
            describeToolCall('owa_lyric_validate', {
                text: 'a lantern',
                url: '',
            }),
        ).toBeNull();
    });
});

// The data tools write the user's own files, so the banner names WHAT: "moved
// the song "Amazing Grace" to the trash" is something the operator can check;
// "changed a file" is not.
describe('the data tools name what they changed', () => {
    it('says a file went to the trash, and which', () => {
        expect(
            describeToolCall('owa_lyric_file', {
                action: 'delete',
                name: 'Amazing Grace',
            }),
        ).toBe('moved the song "Amazing Grace" to the trash');
        expect(describeToolCall('owa_slide_file', { action: 'delete' })).toBe(
            'moved a slide document to the trash',
        );
        // What the earlier actions always said is unchanged.
        expect(
            describeToolCall('owa_lyric_file', { action: 'create', name: 'X' }),
        ).toBe('made the song "X"');
        expect(
            describeToolCall('owa_slide_file', { action: 'rename', name: 'X' }),
        ).toBe('renamed the slide document "X"');
        expect(describeToolCall('owa_lyric_file', { action: 'update' })).toBe(
            'changed a song',
        );
    });

    it('names the slide a slide action touched', () => {
        expect(
            describeToolCall('owa_slide_file', {
                action: 'update-slide',
                name: 'Sunday',
                slide: 3,
            }),
        ).toBe('changed slide 3 of "Sunday"');
        expect(
            describeToolCall('owa_slide_file', {
                action: 'delete-slide',
                name: 'Sunday',
                slide: 2,
            }),
        ).toBe('removed slide 2 from "Sunday"');
        expect(
            describeToolCall('owa_slide_file', {
                action: 'add-slide',
                name: 'Sunday',
            }),
        ).toBe('added a slide to "Sunday"');
        expect(
            describeToolCall('owa_slide_file', { action: 'slides', name: 'x' }),
        ).toBeNull();
    });

    it('names the passage and its list, the note and its file', () => {
        expect(
            describeToolCall('owa_bible_item', {
                action: 'add',
                reference: 'John 3:16',
            }),
        ).toBe('saved John 3:16 to the Bibles list "Default"');
        expect(
            describeToolCall('owa_bible_item', {
                action: 'delete-list',
                list: 'Easter',
            }),
        ).toBe('moved the Bibles list "Easter" to the trash');
        expect(
            describeToolCall('owa_bible_note', {
                action: 'delete',
                file: 'Sermons',
            }),
        ).toBe('removed a note from "Sermons"');
        expect(describeToolCall('owa_bible_item', { action: 'list' })).toBeNull();
        expect(describeToolCall('owa_bible_note', { action: 'read' })).toBeNull();
    });

    it('announces an undo, and not a look at the list', () => {
        expect(describeToolCall('owa_undo', { action: 'undo' })).toBe(
            'put back an earlier change',
        );
        expect(describeToolCall('owa_undo', { action: 'list' })).toBeNull();
    });
});
