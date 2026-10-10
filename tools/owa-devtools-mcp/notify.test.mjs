// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  describeToolCall,
  describeToolNotice,
  genNoticeExpression,
  genNoticeWords,
  listNoticeTranKeys,
  watchToolCalls,
} from './notify.mjs';
import { loadTranBundle } from './tran.mjs';

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

    it('names the Bible installed, changed or removed, and where it came from', () => {
        expect(
            describeToolCall('owa_bible_xml', {
                action: 'check',
                url: 'https://github.com/Beblia/x/raw/master/KhmerBible.xml',
            }),
        ).toBe('downloaded a Bible file from github.com');
        expect(
            describeToolCall('owa_bible_xml', { action: 'import', key: 'KSV' }),
        ).toBe('installed the Bible "KSV"');
        expect(
            describeToolCall('owa_bible_xml', { action: 'delete', key: 'KSV' }),
        ).toBe('moved the Bible "KSV" to the trash');
        expect(describeToolCall('owa_bible_xml', { action: 'list' })).toBeNull();
        expect(describeToolCall('owa_bible_xml', { action: 'cancel' })).toBeNull();
    });

    it('announces an undo, and not a look at the list', () => {
        // A key names itself; a run-sheet change names the sheet and what
        // went in. Reading a sheet says nothing; a call with no action at
        // all (the audit script's probe) gets the generic news.
        expect(describeToolCall('owa_press_key', { keys: 'F5' })).toBe(
            'pressed F5',
        );
        expect(describeToolCall('owa_drag', { from: 'a', to: 'b' })).toBe(
            'dragged something',
        );
        expect(
            describeToolCall('owa_menu', { action: 'click', item: 'View > Reload' }),
        ).toBe('chose View > Reload in the menu');
        expect(describeToolCall('owa_scroll', { find: 'Document List' })).toBe(
            'scrolled a list',
        );
        expect(
            describeToolCall('owa_media_file', {
                action: 'delete',
                kind: 'video',
                name: 'bg.mp4',
            }),
        ).toBe('moved the media file "bg.mp4" to the trash');
        expect(
            describeToolCall('owa_media_file', {
                action: 'import',
                kind: 'image',
                path: 'C:\\pics\\sunrise.jpg',
            }),
        ).toBe('imported "C:\\pics\\sunrise.jpg" from the disk');
        expect(
            describeToolCall('owa_media_file', { action: 'list', kind: 'image' }),
        ).toBeNull();
        expect(describeToolCall('owa_menu', { action: 'list' })).toBeNull();
        expect(
            describeToolCall('owa_presenting_flow', {
                action: 'add',
                name: 'Sunday',
                document: 'Amazing Grace',
            }),
        ).toBe('added "Amazing Grace" to the run sheet "Sunday"');
        expect(
            describeToolCall('owa_presenting_flow', {
                action: 'add',
                name: 'Sunday',
                reference: 'John 3:16',
            }),
        ).toBe('added John 3:16 to the run sheet "Sunday"');
        expect(
            describeToolCall('owa_presenting_flow', {
                action: 'remove',
                name: 'Sunday',
                line: 2,
            }),
        ).toBe('removed a line from the run sheet "Sunday"');
        expect(
            describeToolCall('owa_presenting_flow', {
                action: 'delete',
                name: 'Sunday',
            }),
        ).toBe('moved the run sheet "Sunday" to the trash');
        expect(describeToolCall('owa_presenting_flow', {})).toBe(
            'changed a run sheet',
        );
        for (const action of ['list', 'info']) {
            expect(
                describeToolCall('owa_presenting_flow', { action, name: 'x' }),
            ).toBeNull();
        }
        expect(describeToolCall('owa_undo', { action: 'undo' })).toBe(
            'put back an earlier change',
        );
        expect(describeToolCall('owa_undo', { action: 'list' })).toBeNull();
    });
});

// Reported 2026-10-06: the banner stayed English in a Khmer window. It is said
// in the language the app is DISPLAYING now, through the app's own dictionary,
// and a phrase the dictionary does not have yet is said in English WHOLE.
describe('the banner speaks the language the app is shown in', () => {
  // A dictionary as `tran.mjs` hands it over: sanitized keys.
  const dictionaries = {
    km: {
      'app assistant': 'ជំនួយការកម្មវិធី',
      'clicked something': 'បានចុចអ្វីមួយ',
      'took a foreground extra off the screen': 'បានដកធាតុផ្ទៃខាងមុខ',
      countdown: 'រាប់ថយក្រោយ',
      'read a website': 'បានអានគេហទំព័រ',
    },
    fr: { assistant: 'Assistant', 'app assistant': "Assistant de l'application" },
  };

  it('carries a name-free key and the names apart from it', () => {
    expect(
      describeToolNotice('owa_read_website', {
        url: 'https://en.wikipedia.org/wiki/KJV',
      }),
    ).toEqual({
      text: 'read a page on en.wikipedia.org',
      key: 'read a website',
      detail: ['en.wikipedia.org'],
    });
    expect(
      describeToolNotice('owa_slide_file', {
        action: 'update-slide',
        name: 'Sunday',
        slide: 3,
      }),
    ).toEqual({
      text: 'changed slide 3 of "Sunday"',
      key: 'changed a slide',
      detail: ['"Sunday"', '#3'],
    });
    // No name given: the detail is empty rather than English filler.
    expect(describeToolNotice('owa_lyric_file', { action: 'delete' })).toEqual(
      {
        text: 'moved a song to the trash',
        key: 'moved a song to the trash',
        detail: [],
      },
    );
  });

  it('translates the phrase, who is acting, and a detail word the dictionary has', () => {
    const words = genNoticeWords(
      describeToolNotice('owa_click', {}),
      dictionaries,
    );
    expect(words.en).toEqual({ who: 'Assistant', what: 'clicked something' });
    // `Assistant` is not in the Khmer dictionary yet: the app's own name for
    // the assistant stands in.
    expect(words.km).toEqual({
      who: 'ជំនួយការកម្មវិធី',
      what: 'បានចុចអ្វីមួយ',
    });
    const stopped = genNoticeWords(
      describeToolNotice('owa_foreground', {
        action: 'stop',
        widget: 'countdown',
      }),
      dictionaries,
    );
    expect(stopped.km.what).toBe('បានដកធាតុផ្ទៃខាងមុខ · រាប់ថយក្រោយ');
    // A site is a site in every language.
    const read = genNoticeWords(
      describeToolNotice('owa_read_website', { url: 'https://example.com/x' }),
      dictionaries,
    );
    expect(read.km.what).toBe('បានអានគេហទំព័រ · example.com');
  });

  it('leaves a language out, never half-translated, when it lacks the phrase', () => {
    const words = genNoticeWords(
      describeToolNotice('owa_click', {}),
      dictionaries,
    );
    // French has who is acting but not "clicked something".
    expect(words.fr).toBeUndefined();
    expect(Object.keys(words).sort()).toEqual(['en', 'km']);
  });

  // The keys only `tools/` asks for are added to `src/lang/data/km` and
  // `fr` by hand. Half a pair is the mistake that would go unnoticed: a
  // French window keeps its English banner and nothing fails.
  it('finds every banner key translated in both km and fr, or in neither', () => {
    const bundle = loadTranBundle();
    const km = bundle.dictionaries.km ?? {};
    const fr = bundle.dictionaries.fr ?? {};
    const halfDone = listNoticeTranKeys().filter((key) => {
      const lowered = key.trim().toLowerCase();
      return (km[lowered] === undefined) !== (fr[lowered] === undefined);
    });
    expect(halfDone).toEqual([]);
  });
});

// The pill itself, evaluated the way the page gets it.
describe('the banner in the page', () => {
  beforeEach(() => {
    delete window.__owaAgentNotice;
    document.getElementById('owa-agent-notice-host')?.remove();
    document.documentElement.lang = 'en';
  });

  function show(words) {
    return new Function(`return (${genNoticeExpression(words)})`)();
  }

  function readPill() {
    const root = document.getElementById('owa-agent-notice-host').shadowRoot;
    return {
      who: root.querySelector('.who').textContent,
      what: root.querySelector('.what').textContent,
      lang: root.querySelector('.pill').lang,
      css: root.querySelector('style').textContent,
    };
  }

  const words = {
    en: { who: 'Assistant', what: 'clicked something' },
    km: { who: 'ជំនួយការ', what: 'បានចុចអ្វីមួយ' },
  };

  it('picks the words for the language the window is displaying', () => {
    document.documentElement.lang = 'km';
    expect(show(words)).toBe(true);
    expect(readPill()).toMatchObject({
      who: 'ជំនួយការ',
      what: 'បានចុចអ្វីមួយ',
      lang: 'km',
    });
  });

  it('falls back to English for a language it has no words for', () => {
    document.documentElement.lang = 'fr';
    show(words);
    expect(readPill()).toMatchObject({
      who: 'Assistant',
      what: 'clicked something',
      lang: 'en',
    });
  });

  // At the top centre it covered the header's Bible Lookup button and the
  // title of every app dialog (2026-10-06).
  it('sits at the bottom centre, clear of the header and dialog titles', () => {
    show(words);
    const pillRule = /\.pill \{([^}]*)\}/.exec(readPill().css)[1];
    expect(pillRule).toContain('bottom: 14px');
    expect(pillRule).not.toMatch(/\btop:/);
  });

  it('replaces a banner an older server left in the page', () => {
    window.__owaAgentNotice = {
      show() {
        return 'old';
      },
    };
    expect(show(words)).toBe(true);
    expect(window.__owaAgentNotice.version).toBeGreaterThan(1);
  });
});
