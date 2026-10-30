import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The banner as it is raised: which calls raise one, in which window, how
// often, and in which words -- against a fake app and a small dictionary.
const mocks = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  loadTranBundle: vi.fn(),
}));

vi.mock('./cdp.mjs', () => ({ evaluateInApp: mocks.evaluateInApp }));
vi.mock('./tran.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTranBundle: mocks.loadTranBundle,
}));

import {
  describeToolCall,
  describeToolNotice,
  genNoticeExpression,
  notifyToolCall,
  watchToolCalls,
} from './notify.mjs';

const BUNDLE = {
  dictionaries: {
    en: { 'clicked something': 'clicked something' },
    km: {
      'clicked something': 'បានចុចអ្វីមួយ',
      'pressed a key': 'បានចុចគ្រាប់ចុច',
      assistant: 'ជំនួយការ',
      'not a banner word': 'x',
    },
    fr: { 'clicked something': 'a cliqué quelque chose' },
  },
};

const KHMER_CLICK_WORDS = {
  en: { who: 'Assistant', what: 'clicked something' },
  km: { who: 'ជំនួយការ', what: 'បានចុចអ្វីមួយ' },
  fr: { who: 'Assistant', what: 'a cliqué quelque chose' },
};

// Five minutes between tests (none moves its own clock that far): the
// banner's one-minute dictionary and 1.2-second repeat guard start empty.
let clock = Date.UTC(2032, 0, 1);
let previousNotice;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 5 * 60 * 1000;
  vi.setSystemTime(clock);
  previousNotice = process.env.OWA_MCP_NOTICE;
  delete process.env.OWA_MCP_NOTICE;
  mocks.evaluateInApp.mockResolvedValue({ value: true });
  mocks.loadTranBundle.mockReturnValue(BUNDLE);
});

afterEach(() => {
  vi.useRealTimers();
  if (previousNotice === undefined) {
    delete process.env.OWA_MCP_NOTICE;
  } else {
    process.env.OWA_MCP_NOTICE = previousNotice;
  }
});

describe('notifyToolCall', () => {
  it('raises the banner in every language the dictionary has, in the window acted on', () => {
    notifyToolCall('owa_click', { find: 'Clear', page: 'reader.html' });
    expect(mocks.evaluateInApp).toHaveBeenCalledWith(
      genNoticeExpression(KHMER_CLICK_WORDS),
      { match: 'reader.html' },
    );
  });

  it('stays quiet for a read, and when the operator switched banners off', () => {
    notifyToolCall('owa_app_state', {});
    notifyToolCall('owa_lyric_file', { action: 'list' });
    process.env.OWA_MCP_NOTICE = '0';
    notifyToolCall('owa_click', { find: 'Clear' });
    expect(mocks.evaluateInApp).not.toHaveBeenCalled();
  });

  it('says the same news in the same window once while it is still up', () => {
    notifyToolCall('owa_click', { find: 'A' });
    notifyToolCall('owa_click', { find: 'B' });
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(1);
    // Another window is owed its own banner.
    notifyToolCall('owa_click', { find: 'C', page: 'reader.html' });
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(2);
    // ...and so is the first window once its banner has gone.
    vi.setSystemTime(clock + 1300);
    notifyToolCall('owa_click', { find: 'D', page: 'reader.html' });
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(3);
    expect(mocks.evaluateInApp.mock.calls[2][1]).toEqual({
      match: 'reader.html',
    });
  });

  it('reads the dictionary once a minute, keeping only the banner words', () => {
    notifyToolCall('owa_click', {});
    notifyToolCall('owa_press_key', { keys: 'F5' });
    expect(mocks.loadTranBundle).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateInApp.mock.calls[1][0]).toBe(
      genNoticeExpression({
        en: { who: 'Assistant', what: 'pressed F5' },
        km: { who: 'ជំនួយការ', what: 'បានចុចគ្រាប់ចុច · F5' },
      }),
    );
    vi.setSystemTime(clock + 61 * 1000);
    notifyToolCall('owa_click', {});
    expect(mocks.loadTranBundle).toHaveBeenCalledTimes(2);
  });

  it('falls back to English when the dictionary cannot be read', () => {
    mocks.loadTranBundle.mockImplementation(() => {
      throw new Error('tran.json is half written');
    });
    notifyToolCall('owa_click', {});
    expect(mocks.evaluateInApp).toHaveBeenCalledWith(
      genNoticeExpression({
        en: { who: 'Assistant', what: 'clicked something' },
      }),
      { match: undefined },
    );
  });

  it('never turns a closed window into a failed tool call', async () => {
    mocks.evaluateInApp.mockRejectedValue(new Error('The app has closed.'));
    expect(notifyToolCall('owa_click', {})).toBeUndefined();
    // The rejection is swallowed, not left unhandled.
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(1);
  });

  it('is raised for a tool call arriving on a watched transport', () => {
    const inner = vi.fn(() => 'handled');
    const transport = { onmessage: inner };
    watchToolCalls(transport);
    const message = {
      method: 'tools/call',
      params: { name: 'owa_click', arguments: { find: 'Clear' } },
    };
    expect(transport.onmessage(message, { authInfo: null })).toBe('handled');
    expect(inner).toHaveBeenCalledWith(message, { authInfo: null });
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(1);
    // A message that is not a tool call says nothing.
    transport.onmessage({ method: 'tools/list' });
    expect(mocks.evaluateInApp).toHaveBeenCalledTimes(1);
  });
});

describe('what each change says', () => {
  it('names the document and the slide a file action touched', () => {
    expect(
      describeToolNotice('owa_lyric_file', { action: 'revert', name: 'Grace' }),
    ).toEqual({
      text: 'put the song "Grace" back as saved',
      key: 'put a song back as saved',
      detail: ['"Grace"'],
    });
    expect(
      describeToolCall('owa_slide_file', {
        action: 'move-slide',
        name: 'Sunday',
        slide: 3,
      }),
    ).toBe('moved slide 3 of "Sunday"');
    expect(
      describeToolNotice('owa_slide_file', {
        action: 'duplicate-slide',
        name: 'Sunday',
        slide: 2,
      }),
    ).toEqual({
      text: 'copied slide 2 of "Sunday"',
      key: 'copied a slide',
      detail: ['"Sunday"', '#2'],
    });
    expect(
      describeToolCall('owa_slide_file', { action: 'move-slide', name: 'S' }),
    ).toBe('moved a slide of "S"');
  });

  it('names the Bibles list a saved passage changed in', () => {
    const say = (action, list) => {
      return describeToolCall('owa_bible_item', { action, list });
    };
    expect(say('update', 'Easter')).toBe('changed a saved passage in "Easter"');
    expect(say('delete')).toBe('removed a saved passage from "Default"');
    expect(say('create-list', 'Easter')).toBe('made the Bibles list "Easter"');
    expect(say('rename-list', 'Easter')).toBe(
      'renamed the Bibles list "Easter"',
    );
    expect(describeToolNotice('owa_bible_item', { action: 'update' })).toEqual({
      text: 'changed a saved passage in "Default"',
      key: 'changed a saved Bible passage',
      detail: ['"Default"'],
    });
  });

  it('names the notes file a note changed in', () => {
    const say = (action, file) => {
      return describeToolCall('owa_bible_note', { action, file });
    };
    expect(say('add')).toBe('added a note to "Default"');
    expect(say('update', 'Ruth')).toBe('changed a note in "Ruth"');
    expect(say('create-file', 'Ruth')).toBe('made the notes file "Ruth"');
    expect(say('rename-file', 'Ruth')).toBe('renamed the notes file "Ruth"');
    expect(say('delete-file', 'Ruth')).toBe(
      'moved the notes file "Ruth" to the trash',
    );
  });

  it('names the run sheet a line changed in, and tidies a nameless one', () => {
    const say = (action, name) => {
      return describeToolCall('owa_presenting_flow', { action, name });
    };
    expect(say('create', 'Sunday')).toBe('made the run sheet "Sunday"');
    expect(say('create')).toBe('made the run sheet');
    expect(say('rename', 'Sunday')).toBe('renamed the run sheet "Sunday"');
    expect(say('move', 'Sunday')).toBe('moved a line in the run sheet "Sunday"');
    expect(say('duplicate', 'Sunday')).toBe(
      'copied a line in the run sheet "Sunday"',
    );
    expect(say('park', 'Sunday')).toBe(
      'parked a line in the run sheet "Sunday"',
    );
    expect(say('unpark', 'Sunday')).toBe(
      'put a line of the run sheet "Sunday" back in play',
    );
    expect(say('info', 'Sunday')).toBeNull();
  });

  it('names the media file or web page it changed', () => {
    const say = (action, name) => {
      return describeToolCall('owa_media_file', { action, name });
    };
    expect(say('create', 'notice.html')).toBe(
      'made the web page "notice.html"',
    );
    expect(say('update', 'notice.html')).toBe(
      'changed the web page "notice.html"',
    );
    expect(say('rename', 'bg.mp4')).toBe('renamed the media file "bg.mp4"');
  });

  it('says a foreground extra came off even when it cannot name which', () => {
    expect(
      describeToolNotice('owa_foreground', { action: 'stop', widget: 'odd' }),
    ).toEqual({
      text: 'took a foreground extra off the screen',
      key: 'took a foreground extra off the screen',
      detail: [],
    });
  });

  it('names the Bible it changed', () => {
    expect(
      describeToolNotice('owa_bible_xml', { action: 'update', key: 'KJV' }),
    ).toEqual({
      text: 'changed the Bible "KJV"',
      key: 'changed a Bible',
      detail: ['"KJV"'],
    });
  });
});
