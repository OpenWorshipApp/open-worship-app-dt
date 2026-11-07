import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No banner is ever drawn here: `evaluateInApp` is a mock, so nothing
// reaches a running app, and the dictionary is a fixture, so which words a
// banner carries is decided by the test.
const { evaluateInAppMock, tranState } = vi.hoisted(() => {
  return {
    evaluateInAppMock: vi.fn(),
    tranState: { bundle: null, error: null, reads: 0 },
  };
});

vi.mock('./cdp.mjs', () => {
  return { evaluateInApp: evaluateInAppMock };
});

vi.mock('./tran.mjs', () => {
  return {
    DEFAULT_LANG_CODE: 'en',
    loadTranBundle: () => {
      tranState.reads += 1;
      if (tranState.error !== null) {
        throw tranState.error;
      }
      return tranState.bundle;
    },
  };
});

const BUNDLE = {
  languages: [{ code: 'en' }, { code: 'km' }, { code: 'fr' }],
  dictionaries: {
    // English is the language the keys are written in: never read.
    en: { 'clicked something': 'EN must not be used' },
    km: {
      assistant: 'KM-Assistant',
      'clicked something': 'KM-clicked',
      'pressed a key': 'KM-pressed',
    },
    // No word for `Assistant`: the app's `App Assistant` stands in.
    fr: { 'app assistant': 'FR-Assistant', 'clicked something': 'FR-clique' },
  },
};

const CLICK_WORDS = {
  en: { who: 'Assistant', what: 'clicked something' },
  km: { who: 'KM-Assistant', what: 'KM-clicked' },
  fr: { who: 'FR-Assistant', what: 'FR-clique' },
};

let savedNotice;

// The module keeps the last banner and a minute of dictionary: a fresh one
// per test.
async function loadNotify() {
  return import('./notify.mjs');
}

beforeEach(() => {
  vi.resetModules();
  tranState.bundle = BUNDLE;
  tranState.error = null;
  tranState.reads = 0;
  evaluateInAppMock.mockResolvedValue(undefined);
  savedNotice = process.env.OWA_MCP_NOTICE;
  delete process.env.OWA_MCP_NOTICE;
});

afterEach(() => {
  vi.useRealTimers();
  if (savedNotice === undefined) {
    delete process.env.OWA_MCP_NOTICE;
  } else {
    process.env.OWA_MCP_NOTICE = savedNotice;
  }
});

// Every write names WHAT it changed: "changed a note" is not a sentence the
// operator can check, "removed a note from Default" is. `key` is the same
// news with the names out, the dictionary's key; `detail` the names.
describe('describeToolNotice for every write', () => {
  const CASES = [
    [
      'owa_lyric_file',
      { action: 'revert', name: 'Amazing Grace' },
      'put the song "Amazing Grace" back as saved',
      'put a song back as saved',
      ['"Amazing Grace"'],
    ],
    // No name: "the song a song" is tidied, never said.
    [
      'owa_lyric_file',
      { action: 'revert' },
      'put a song back as saved',
      'put a song back as saved',
      [],
    ],
    [
      'owa_slide_file',
      { action: 'move-slide', name: 'Sermon', slide: 3 },
      'moved slide 3 of "Sermon"',
      'moved a slide',
      ['"Sermon"', '#3'],
    ],
    [
      'owa_slide_file',
      { action: 'duplicate-slide', name: 'Sermon' },
      'copied a slide of "Sermon"',
      'copied a slide',
      ['"Sermon"'],
    ],
    [
      'owa_bible_item',
      { action: 'update', list: 'Easter' },
      'changed a saved passage in "Easter"',
      'changed a saved Bible passage',
      ['"Easter"'],
    ],
    // No list named is the Default list.
    [
      'owa_bible_item',
      { action: 'delete' },
      'removed a saved passage from "Default"',
      'removed a saved Bible passage',
      ['"Default"'],
    ],
    [
      'owa_bible_item',
      { action: 'create-list', list: 'Easter' },
      'made the Bibles list "Easter"',
      'made a Bibles list',
      ['"Easter"'],
    ],
    [
      'owa_bible_item',
      { action: 'rename-list', list: 'Easter' },
      'renamed the Bibles list "Easter"',
      'renamed a Bibles list',
      ['"Easter"'],
    ],
    [
      'owa_bible_note',
      { action: 'add', file: 'Lent' },
      'added a note to "Lent"',
      'added a Bible note',
      ['"Lent"'],
    ],
    [
      'owa_bible_note',
      { action: 'update' },
      'changed a note in "Default"',
      'changed a Bible note',
      ['"Default"'],
    ],
    [
      'owa_bible_note',
      { action: 'create-file', file: 'Lent' },
      'made the notes file "Lent"',
      'made a notes file',
      ['"Lent"'],
    ],
    [
      'owa_bible_note',
      { action: 'rename-file', file: 'Lent' },
      'renamed the notes file "Lent"',
      'renamed a notes file',
      ['"Lent"'],
    ],
    [
      'owa_bible_note',
      { action: 'delete-file', file: 'Lent' },
      'moved the notes file "Lent" to the trash',
      'moved a notes file to the trash',
      ['"Lent"'],
    ],
    [
      'owa_presenting_flow',
      { action: 'create', name: 'Sunday' },
      'made the run sheet "Sunday"',
      'made a run sheet',
      ['"Sunday"'],
    ],
    // A sheet with no name read is tidied, not left hanging.
    [
      'owa_presenting_flow',
      { action: 'create' },
      'made the run sheet',
      'made a run sheet',
      [],
    ],
    [
      'owa_presenting_flow',
      { action: 'rename', name: 'Sunday' },
      'renamed the run sheet "Sunday"',
      'renamed a run sheet',
      ['"Sunday"'],
    ],
    [
      'owa_presenting_flow',
      { action: 'move', name: 'Sunday' },
      'moved a line in the run sheet "Sunday"',
      'moved a line in a run sheet',
      ['"Sunday"'],
    ],
    [
      'owa_presenting_flow',
      { action: 'duplicate', name: 'Sunday' },
      'copied a line in the run sheet "Sunday"',
      'copied a line in a run sheet',
      ['"Sunday"'],
    ],
    [
      'owa_presenting_flow',
      { action: 'park', name: 'Sunday' },
      'parked a line in the run sheet "Sunday"',
      'parked a line in a run sheet',
      ['"Sunday"'],
    ],
    [
      'owa_presenting_flow',
      { action: 'unpark', name: 'Sunday' },
      'put a line of the run sheet "Sunday" back in play',
      'put a line of a run sheet back in play',
      ['"Sunday"'],
    ],
    [
      'owa_media_file',
      { action: 'create', name: 'notice.html' },
      'made the web page "notice.html"',
      'made a web page',
      ['"notice.html"'],
    ],
    [
      'owa_media_file',
      { action: 'update', name: 'notice.html' },
      'changed the web page "notice.html"',
      'changed a web page',
      ['"notice.html"'],
    ],
    [
      'owa_media_file',
      { action: 'rename', name: 'clip.mp4' },
      'renamed the media file "clip.mp4"',
      'renamed a media file',
      ['"clip.mp4"'],
    ],
    [
      'owa_bible_xml',
      { action: 'update', key: 'KJV' },
      'changed the Bible "KJV"',
      'changed a Bible',
      ['"KJV"'],
    ],
    // With no key the banner said "installed the Bible a Bible" (2026-11-03):
    // the plain news, then, as every other action says it.
    [
      'owa_bible_xml',
      { action: 'import' },
      'installed a Bible',
      'installed a Bible',
      [],
    ],
    [
      'owa_bible_xml',
      { action: 'update', key: '  ' },
      'changed a Bible',
      'changed a Bible',
      [],
    ],
    [
      'owa_bible_xml',
      { action: 'delete' },
      'moved a Bible to the trash',
      'moved a Bible to the trash',
      [],
    ],
    // An extra the banner has no name for is taken off by the generic news.
    [
      'owa_foreground',
      { action: 'stop', widget: 'banner' },
      'took a foreground extra off the screen',
      'took a foreground extra off the screen',
      [],
    ],
    [
      'owa_foreground',
      { action: 'stop' },
      'took a foreground extra off the screen',
      'took a foreground extra off the screen',
      [],
    ],
  ];

  it.each(CASES)('%s %j', async (name, args, text, key, detail) => {
    const { describeToolCall, describeToolNotice } = await loadNotify();
    expect(describeToolNotice(name, args)).toEqual({ text, key, detail });
    expect(describeToolCall(name, args)).toBe(text);
  });

  it('every key a write says is a key the banner asks the dictionary for', async () => {
    const { describeToolNotice, listNoticeTranKeys } = await loadNotify();
    const keys = new Set(listNoticeTranKeys());
    for (const [name, args] of CASES) {
      expect(keys.has(describeToolNotice(name, args).key), name).toBe(true);
    }
  });
});

describe('the banner words, out of the app dictionary', () => {
  it('says each language its own words, and never reads the English one', async () => {
    const { describeToolNotice, genNoticeWords } = await loadNotify();
    expect(genNoticeWords(describeToolNotice('click', {}))).toEqual(
      CLICK_WORDS,
    );
  });

  // Never half a sentence in another language: a phrase missing from a
  // dictionary is that whole language left to English.
  it('leaves out a language that lacks the phrase, and carries the names', async () => {
    const { describeToolNotice, genNoticeWords } = await loadNotify();
    const words = genNoticeWords(
      describeToolNotice('owa_press_key', { keys: 'F5' }),
    );
    expect(words).toEqual({
      en: { who: 'Assistant', what: 'pressed F5' },
      km: { who: 'KM-Assistant', what: 'KM-pressed · F5' },
    });
  });

  // A banner rides every acting call; the dictionary is read once a
  // minute, counted from the READ -- a reuse never pushes it on.
  it('keeps the words for one minute from the read, never longer', async () => {
    const { describeToolNotice, genNoticeWords } = await loadNotify();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    const notice = describeToolNotice('click', {});
    expect(genNoticeWords(notice).km.what).toBe('KM-clicked');
    expect(tranState.reads).toBe(1);
    tranState.bundle = {
      ...BUNDLE,
      dictionaries: { km: { 'clicked something': 'KM-changed' } },
    };
    vi.advanceTimersByTime(30_000);
    expect(genNoticeWords(notice).km.what).toBe('KM-clicked');
    vi.advanceTimersByTime(29_000);
    expect(genNoticeWords(notice).km.what).toBe('KM-clicked');
    expect(tranState.reads).toBe(1);
    vi.advanceTimersByTime(2_000);
    expect(genNoticeWords(notice).km.what).toBe('KM-changed');
    expect(tranState.reads).toBe(2);
  });

  it('reads no language from a bundle that has no dictionaries', async () => {
    tranState.bundle = {};
    const { describeToolNotice, genNoticeWords } = await loadNotify();
    expect(genNoticeWords(describeToolNotice('click', {}))).toEqual({
      en: CLICK_WORDS.en,
    });
  });
});

describe('notifyToolCall', () => {
  it('raises a banner for an acting call, in the window it acted on', async () => {
    const { genNoticeExpression, notifyToolCall } = await loadNotify();
    notifyToolCall('click', { page: 'reader.html' });
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
    expect(evaluateInAppMock).toHaveBeenCalledWith(
      genNoticeExpression(CLICK_WORDS),
      { match: 'reader.html' },
    );
  });

  it('stays quiet for a read, and when the banner is switched off', async () => {
    const { notifyToolCall } = await loadNotify();
    notifyToolCall('take_snapshot', {});
    notifyToolCall('owa_app_state', {});
    process.env.OWA_MCP_NOTICE = '0';
    notifyToolCall('click', {});
    expect(evaluateInAppMock).not.toHaveBeenCalled();
    expect(tranState.reads).toBe(0);
  });

  // Same phrase, same window, while the first is still up: one banner.
  // Two windows are two things happening, each owed its own.
  it('raises one banner for a repeat, and one per window', async () => {
    const { notifyToolCall } = await loadNotify();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    notifyToolCall('click', {});
    notifyToolCall('click', {});
    vi.advanceTimersByTime(1_199);
    notifyToolCall('click', {});
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    notifyToolCall('click', {});
    expect(evaluateInAppMock).toHaveBeenCalledTimes(2);
    notifyToolCall('click', { page: 'reader.html' });
    notifyToolCall('owa_press_key', { keys: 'F5' });
    expect(evaluateInAppMock).toHaveBeenCalledTimes(4);
    expect(
      evaluateInAppMock.mock.calls.map((call) => {
        return call[1].match;
      }),
    ).toEqual([undefined, undefined, 'reader.html', undefined]);
  });

  // A dictionary that cannot be read costs the banner its translation,
  // never the banner.
  it('falls back to English when the dictionary cannot be read', async () => {
    tranState.error = new Error('unreadable');
    const { genNoticeExpression, notifyToolCall } = await loadNotify();
    notifyToolCall('click', {});
    expect(evaluateInAppMock).toHaveBeenCalledWith(
      genNoticeExpression({ en: CLICK_WORDS.en }),
      { match: undefined },
    );
  });

  // Fire and forget: an app that closed since must not turn a banner into a
  // failed tool call, or into an unhandled rejection.
  it('swallows a banner the app could not show', async () => {
    evaluateInAppMock.mockRejectedValue(new Error('The app has no open page'));
    const { notifyToolCall } = await loadNotify();
    expect(notifyToolCall('click', {})).toBeUndefined();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
  });
});

describe('watchToolCalls with the banner on', () => {
  it('announces a tool call and still hands every message on', async () => {
    const { watchToolCalls } = await loadNotify();
    const inner = vi.fn((message) => {
      return `handled ${message.id}`;
    });
    const transport = { onmessage: inner };
    watchToolCalls(transport);
    const call = {
      id: 7,
      method: 'tools/call',
      params: {
        name: 'owa_click',
        arguments: { find: 'Save', page: 'presenter.html' },
      },
    };
    expect(transport.onmessage(call, { sessionId: 's' })).toBe('handled 7');
    expect(inner).toHaveBeenCalledWith(call, { sessionId: 's' });
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
    expect(evaluateInAppMock.mock.calls[0][1]).toEqual({
      match: 'presenter.html',
    });
    // Only a tool call is announced.
    expect(transport.onmessage({ id: 8, method: 'tools/list' })).toBe(
      'handled 8',
    );
    expect(evaluateInAppMock).toHaveBeenCalledTimes(1);
  });

  // A banner is never a reason for a tool call not to happen.
  it('hands the call on when the banner itself throws', async () => {
    const { watchToolCalls } = await loadNotify();
    const inner = vi.fn(() => {
      return 'handled';
    });
    const transport = { onmessage: inner };
    watchToolCalls(transport);
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('no reading this');
        },
      },
    );
    const call = {
      id: 9,
      method: 'tools/call',
      params: { name: 'click', arguments: hostile },
    };
    expect(transport.onmessage(call)).toBe('handled');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(evaluateInAppMock).not.toHaveBeenCalled();
  });
});
