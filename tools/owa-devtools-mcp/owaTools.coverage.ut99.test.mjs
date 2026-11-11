// The branches of `owaTools.mjs` its sibling suite leaves dark: the window's
// language and the labels offered in it, the data tools' refusals and
// failures, the picker and the page switch on fake timers, a press the PAGE
// refuses (logged beside the firewall's own), the real-file drop, and the
// walkthrough card built from a built-in demo or a manual recipe, in English
// and in another language (a made-up one, `xx`).
//
// The translations are a fixture. `tran.mjs` prefers a built
// `electron-build/knowledge/tran.json` over the source packs, so a suite that
// read the real dictionary would answer differently on a machine with a stale
// build. Every key below translates to `xx:<key>`; `Skip`, a button of the
// card, is left out on purpose -- a word the dictionary lacks stays English.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  runInTarget: vi.fn(),
  waitForNewAppPage: vi.fn(),
  readLiveInstances: vi.fn(),
  readHelpPage: vi.fn(),
  bundle: { languages: [], dictionaries: {} },
}));

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
  runInTarget: app.runInTarget,
  waitForNewAppPage: app.waitForNewAppPage,
}));
vi.mock('./discovery.mjs', () => ({
  readLiveInstances: app.readLiveInstances,
}));
vi.mock('./help.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  readHelpPage: app.readHelpPage,
}));
vi.mock('./tran.mjs', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    loadTranBundle: () => app.bundle,
    listTranLanguages: () => app.bundle.languages,
    tranText: (text, langCode, bundle) => {
      return real.tranText(text, langCode, bundle ?? app.bundle);
    },
    resolveTranTemplates: (text, langCode, bundle) => {
      return real.resolveTranTemplates(text, langCode, bundle ?? app.bundle);
    },
  };
});

import { genDropReadExpression } from './domMatch.mjs';
import { genDestructiveReason, getFirewallLog } from './firewall.mjs';
import {
  GUIDE_CARD_HINT_TEMPLATE_LIST,
  GUIDE_CARD_LABEL_KEY_MAP,
  GUIDE_CARD_TITLE_KEY,
  toKeystroke,
} from './guide.mjs';
import { validateOpenLyric } from './openLyric.mjs';
import { registerOwaTools } from './owaTools.mjs';
import { PICKER_HINT_TEMPLATE } from './picker.mjs';
import { getPresenterDemo } from './presenterDemos.mjs';
import { WEBSITE_READ_EVALUATE_TIMEOUT } from './website.mjs';

const xx = (key) => `xx:${key}`;

const XX_KEYS = [
  'Bible Lookup',
  'Bible Reference',
  'Documents',
  'More Options',
  'Settings',
  GUIDE_CARD_TITLE_KEY,
  GUIDE_CARD_HINT_TEMPLATE_LIST[0],
  PICKER_HINT_TEMPLATE,
  ...Object.values(GUIDE_CARD_LABEL_KEY_MAP).filter((key) => key !== 'Skip'),
];
app.bundle = {
  languages: [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'xx', name: 'Xxlang', nativeName: 'Xxlang' },
  ],
  dictionaries: {
    en: {},
    xx: Object.fromEntries(
      XX_KEYS.map((key) => [key.trim().toLowerCase(), xx(key)]),
    ),
  },
};

const handlers = new Map();
registerOwaTools({
  registerTool(name, _schema, handler) {
    handlers.set(name, handler);
  },
});

function call(name, args = {}) {
  return handlers.get(name)(args);
}

function textOf(result) {
  expect(result.isError).not.toBe(true);
  return result.content[0].text;
}

function jsonOf(result) {
  return JSON.parse(textOf(result));
}

function errorOf(result) {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

const LANGUAGE_EXPRESSION =
  "(document.documentElement.lang || 'en').split('-')[0]";

// The window answers its language with `langCode` and every other
// expression with what `route` returns for it.
function routeApp(langCode, route = () => undefined) {
  app.evaluateInApp.mockImplementation(async (expression, options) => {
    if (expression === LANGUAGE_EXPRESSION) {
      return { value: langCode };
    }
    return { value: await route(String(expression), options ?? {}) };
  });
}

function callsOf(predicate) {
  return app.evaluateInApp.mock.calls.filter(([expression]) => {
    return predicate(String(expression));
  });
}

function languageReads() {
  return callsOf((expression) => expression === LANGUAGE_EXPRESSION);
}

function readJson(expression, pattern) {
  const matched = pattern.exec(expression);
  expect(matched, `${pattern} in the expression`).not.toBeNull();
  return JSON.parse(matched[1]);
}

const CLICK_FINDS_PATTERN =
  /dm\.waitForBest\(\s*(\[[^\n]*?\]), \d+, \{ preferPressSafe: true \}/;
const CARD_PATTERN = /return api\.start\((\{[\s\S]*\})\); \}\)\(\)$/;
const NEEDLE_PATTERN = /const asked = dm\.parseNeedle\(("(?:[^"\\]|\\.)*")\)/;
// `genAgentDataExpression` / `genAgentFileExpression` / the foreground's:
// the request rides as one line of JSON.
const REQUEST_PATTERN = /const request = Object\.assign\((.*), \{\r?\n/;

const isCard = (expression) => expression.includes('return api.start(');
const isFindUi = (expression) => NEEDLE_PATTERN.test(expression);
const needleOf = (expression) => readJson(expression, NEEDLE_PATTERN);
const requestOf = (expression) => readJson(expression, REQUEST_PATTERN);
const isPathRead = (expression) => expression === 'location.pathname';

function clickFindsOf(expression) {
  return readJson(expression, CLICK_FINDS_PATTERN);
}

function cardsStarted() {
  return callsOf(isCard).map(([expression, options]) => {
    return { card: readJson(expression, CARD_PATTERN), options };
  });
}

let clock = Date.UTC(2026, 10, 3, 9, 0, 0);

beforeEach(() => {
  vi.resetAllMocks();
  // The window's language is cached for ten seconds (`readAppLanguage`): a
  // fresh minute per test, so no test reads the language of the one before.
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 60 * 1000;
  vi.setSystemTime(clock);
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
  app.readLiveInstances.mockReturnValue([]);
  app.readHelpPage.mockReturnValue(null);
  app.waitForNewAppPage.mockResolvedValue(null);
  routeApp('en');
});

afterEach(() => {
  vi.useRealTimers();
});

// For a tool that waits on its own polls: every timer faked, the clock where
// the test began.
function fakeAllTimers() {
  vi.useFakeTimers();
  vi.setSystemTime(clock);
}

const VALID_SONG = [
  '```ol:Config',
  '- Title: T',
  '- Artist: A',
  '- Copyright: C',
  '- Key: C',
  '- Tempo: 68bpm',
  '- Time: 4/4',
  '- Structure: V1',
  '```',
  '```ol:Verse 1',
  'Amazing grace how sweet the sound',
  '```',
].join('\n');

const SONG_WORDS = [
  'Amazing grace how sweet the sound',
  'That saved a wretch like me',
  'I once was lost but now am found',
  'Was blind but now I see',
  '',
  'Twas grace that taught my heart to fear',
  'And grace my fears relieved',
  'How precious did that grace appear',
  'The hour I first believed',
].join('\n');

describe('the window language a label is offered in', () => {
  it('falls back to English when the window cannot say its language', async () => {
    app.evaluateInApp.mockImplementation(async (expression) => {
      if (expression === LANGUAGE_EXPRESSION) {
        throw new Error('That window closed');
      }
      return { value: { clicked: true, didChange: true } };
    });
    expect(jsonOf(await call('owa_click', { find: 'More Options' }))).toEqual({
      clicked: true,
      didChange: true,
    });
    const [[expression]] = callsOf((one) => one !== LANGUAGE_EXPRESSION);
    expect(clickFindsOf(expression)).toEqual(['More Options']);
  });

  it("offers a whole label in the window's words right after the English", async () => {
    routeApp('xx', () => ({ clicked: true, didChange: true }));
    await call('owa_click', {
      find: ['More Options', 'Not In The Dictionary', 'Unknown > Scope'],
    });
    const [[expression]] = callsOf((one) => one !== LANGUAGE_EXPRESSION);
    // A label the dictionary lacks, whole or in either half, is offered
    // once and as written -- never twice, never blank.
    expect(clickFindsOf(expression)).toEqual([
      'More Options',
      xx('More Options'),
      'Not In The Dictionary',
      'Unknown > Scope',
    ]);
  });

  it('takes a window that names no language for an English one', async () => {
    routeApp('');
    expect(jsonOf(await call('owa_tran', { text: 'More Options' }))).toEqual({
      lang: 'en',
      languages: ['en', 'xx'],
      labels: [{ english: 'More Options', onScreen: 'More Options' }],
    });
  });

  it('asks the window its language once per ten seconds, timed from the read', async () => {
    routeApp('en', () => ({ clicked: true }));
    await call('owa_click', { find: 'Next' });
    vi.setSystemTime(clock + 9000);
    await call('owa_click', { find: 'Next' });
    expect(languageReads()).toHaveLength(1);
    // Ten seconds after the READ, not after the last hit: a hit does not
    // push the expiry forward.
    vi.setSystemTime(clock + 10500);
    await call('owa_click', { find: 'Next' });
    expect(languageReads()).toHaveLength(2);
    // Another window is another question.
    await call('owa_click', { find: 'Next', page: 'reader.html' });
    expect(languageReads()).toHaveLength(3);
    expect(languageReads()[2][1]).toEqual({ match: 'reader.html' });
  });
});

describe('owa_app_state on the Presenter', () => {
  it('folds in what is selected and the run sheet, read from the same window', async () => {
    routeApp('en', (expression) => {
      if (expression.includes('data-bs-theme')) {
        return { title: 'Presenter', page: 'presenter.html', tabs: [] };
      }
      if (expression.includes("'owa-agent-presenter'")) {
        return {
          isAuthoritative: true,
          selectedDocument: { name: 'Amazing Grace', slideCount: 4 },
          runSheet: null,
        };
      }
      return undefined;
    });
    const state = jsonOf(
      await call('owa_app_state', { page: 'presenter.html' }),
    );
    expect(state.mainWindow).toEqual({
      title: 'Presenter',
      page: 'presenter.html',
      tabs: [],
      selectedDocument: { name: 'Amazing Grace', slideCount: 4 },
      runSheet: null,
    });
    const relay = callsOf((one) => one.includes("'owa-agent-presenter'"));
    expect(relay).toHaveLength(1);
    expect(relay[0][1]).toEqual({ port: 9222, match: 'presenter.html' });
  });

  it('says why the selection is missing when the presenter cannot answer', async () => {
    routeApp('en', (expression) => {
      return expression.includes('data-bs-theme')
        ? { page: 'presenter.html', tabs: [] }
        : { isError: true, reason: 'the window did not answer in time' };
    });
    const { mainWindow } = jsonOf(await call('owa_app_state'));
    expect(mainWindow.note).toBe(
      'What is selected could not be read from this window: the window ' +
        'did not answer in time.',
    );
    expect(mainWindow).not.toHaveProperty('selectedDocument');
  });
});

describe('the projector tools', () => {
  it('starts a foreground extra on the presenter, whatever window is in front', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/reader.html' },
      { url: 'http://localhost/presenter.html' },
    ]);
    routeApp('en', () => ({ did: 'started', detail: 'A 5 minute countdown' }));
    expect(
      jsonOf(await call('owa_foreground', { widget: 'countdown', minutes: 5 })),
    ).toEqual({ did: 'started', detail: 'A 5 minute countdown' });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({ widget: 'countdown', minutes: 5 });
    expect(options).toEqual({ port: 9222, match: 'presenter.html' });
  });

  it('asks the main window without a presenter, and returns its refusal as an error', async () => {
    routeApp('en', () => ({
      isError: true,
      reason: 'The Presenter page is not open.',
    }));
    expect(
      errorOf(await call('owa_foreground', { action: 'stop', widget: 'all' })),
    ).toBe('The Presenter page is not open.');
    expect(app.evaluateInApp.mock.calls[0][1]).toEqual({
      port: 9222,
      match: undefined,
    });
  });

  it('reads the screens and puts a passage up through the main window when no presenter is open', async () => {
    routeApp('en', (expression) => {
      return expression.includes('John 3:16')
        ? { isError: true, reason: 'The Presenter page is not open.' }
        : { isAnyShowing: false, needsPage: 'presenter' };
    });
    expect(jsonOf(await call('owa_list_screens'))).toEqual({
      isAnyShowing: false,
      needsPage: 'presenter',
    });
    expect(
      errorOf(await call('owa_present_bible', { reference: 'John 3:16' })),
    ).toBe('The Presenter page is not open.');
    for (const [, options] of app.evaluateInApp.mock.calls) {
      expect(options).toEqual({ port: 9222, match: undefined });
    }
  });

  it('answers a missing app as an error result, asking the window nothing', async () => {
    app.requireLivePort.mockRejectedValue(
      new Error('No running Open Worship App was found.'),
    );
    for (const [name, args] of [
      ['owa_foreground', { widget: 'clock' }],
      ['owa_present_bible', { reference: 'John 3:16' }],
    ]) {
      expect(errorOf(await call(name, args)), name).toBe(
        'No running Open Worship App was found.',
      );
    }
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('answers a picture that could not be taken with the reason', async () => {
    app.evaluateInApp.mockRejectedValue(new Error('Screen 3 is not showing'));
    expect(errorOf(await call('owa_screenshot', { screenId: 3 }))).toBe(
      'Screen 3 is not showing',
    );
  });

  it('hides the one screen asked for -- screen 0 included -- or every screen', async () => {
    routeApp('en', () => ({ sent: 'app:hide-screen' }));
    expect(jsonOf(await call('owa_hide_screens', { screenId: 0 }))).toEqual({
      sent: 'app:hide-screen',
    });
    await call('owa_hide_screens', {});
    const [[one], [all]] = app.evaluateInApp.mock.calls;
    expect(one).toContain('ipcRenderer.send("app:hide-screen", 0);');
    expect(all).toContain('ipcRenderer.send("app:hide-all-screens");');
  });

  it('rings the element a selector names and answers what the page found', async () => {
    const found = {
      found: false,
      reason: 'That control is not on the screen any more.',
    };
    routeApp('en', () => found);
    expect(
      jsonOf(
        await call('owa_highlight_selector', {
          selector: '#clear-all',
          page: 'presenter.html',
        }),
      ),
    ).toEqual(found);
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(expression).toContain('document.querySelector("#clear-all")');
    expect(options).toEqual({ match: 'presenter.html' });
  });
});

describe('owa_read_website', () => {
  it('answers with the text alone when no picture was asked for', async () => {
    routeApp('en', () => ({
      url: 'https://example.org/',
      title: 'Example',
      text: 'Useful source text',
      links: [{ text: 'Home', href: 'https://example.org/' }],
      imageDataUrl: 'data:image/png;base64,aGVsbG8=',
    }));
    const result = await call('owa_read_website', {
      url: 'https://example.org/',
      maxChars: 50,
      links: true,
      page: 'presenter.html',
    });
    expect(result.content).toHaveLength(1);
    const text = textOf(result);
    expect(text).toContain('--- BEGIN WEBSITE TEXT');
    expect(text).toContain('Useful source text');
    expect(text).toContain('- Home -- https://example.org/');
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    // Below the floor, the read is raised to it.
    expect(expression).toContain(
      JSON.stringify({
        url: 'https://example.org/',
        bibleCatalog: false,
        wantsScreenshot: false,
        maxChars: 200,
      }),
    );
    expect(options).toEqual({
      match: 'presenter.html',
      timeout: WEBSITE_READ_EVALUATE_TIMEOUT,
    });
  });

  it('answers a read that failed as an error', async () => {
    app.evaluateInApp.mockRejectedValue(
      new Error('That address is not on the public web.'),
    );
    expect(
      errorOf(await call('owa_read_website', { url: 'https://localhost/' })),
    ).toBe('That address is not on the public web.');
  });
});

describe('owa_lyric_validate', () => {
  it('looks a song up by its title in the app, never from memory', async () => {
    routeApp('en', () => ({
      asked: 'Amazing Grace',
      yours: ['Amazing Grace'],
      found: null,
      nearest: [],
      collectionSize: 30,
    }));
    const text = textOf(
      await call('owa_lyric_validate', {
        mode: 'find',
        title: '  Amazing Grace  ',
      }),
    );
    expect(text).toContain('No song called "Amazing Grace"');
    expect(text).toContain('Already in their songs: "Amazing Grace"');
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      kind: 'lyric',
      action: 'find',
      name: 'Amazing Grace',
    });
  });

  it('says why the app could not look the song up', async () => {
    routeApp('en', () => ({
      isError: true,
      reason: 'The Documents list is not open.',
    }));
    expect(
      errorOf(
        await call('owa_lyric_validate', {
          mode: 'find',
          title: 'Amazing Grace',
        }),
      ),
    ).toBe('The Documents list is not open.');
  });

  it('drafts a song page read whole by the tool itself, keeping its address', async () => {
    routeApp('en', () => ({
      url: 'https://example.org/amazing-grace',
      title: 'Amazing Grace',
      text: SONG_WORDS,
    }));
    const text = textOf(
      await call('owa_lyric_validate', {
        url: ' https://example.org/amazing-grace ',
        title: 'Amazing Grace',
      }),
    );
    expect(text.split('\n')[0]).toBe('Drafted a song from the text.');
    expect(text).toContain('https://example.org/amazing-grace');
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(expression).toContain(
      JSON.stringify({
        url: 'https://example.org/amazing-grace',
        bibleCatalog: false,
        wantsScreenshot: false,
        maxChars: 20000,
      }),
    );
    expect(options).toEqual({ timeout: WEBSITE_READ_EVALUATE_TIMEOUT });
  });

  it('checks notation and drafts plain words when no mode is given', async () => {
    expect(
      textOf(await call('owa_lyric_validate', { text: VALID_SONG })),
    ).toMatch(/^Valid Open Lyric\. No problems found\./);
    const drafted = textOf(
      await call('owa_lyric_validate', {
        text: SONG_WORDS,
        title: 'Amazing Grace',
      }),
    );
    expect(drafted.split('\n')[0]).toBe('Drafted a song from the text.');
    expect(drafted).toContain('```ol:Config');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('owa_lyric_file and owa_slide_file', () => {
  it('writes a valid song through the app and answers with what it did', async () => {
    expect(validateOpenLyric(VALID_SONG).ok).toBe(true);
    routeApp('en', () => ({ created: 'Sunday Song', undoId: 'u1' }));
    expect(
      jsonOf(
        await call('owa_lyric_file', {
          action: 'create',
          name: 'Sunday Song',
          content: VALID_SONG,
          page: 'presenter.html',
        }),
      ),
    ).toEqual({ created: 'Sunday Song', undoId: 'u1' });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({
      kind: 'lyric',
      action: 'create',
      name: 'Sunday Song',
      content: VALID_SONG,
    });
    expect(options).toEqual({ match: 'presenter.html' });
  });

  it('moves a slide by its numbers and returns the app refusal as an error', async () => {
    routeApp('en', () => ({ isError: true, reason: 'There is no slide 9.' }));
    expect(
      errorOf(
        await call('owa_slide_file', {
          action: 'move-slide',
          name: 'Service',
          slide: 9,
          to: 1,
        }),
      ),
    ).toBe('There is no slide 9.');
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      kind: 'slide',
      action: 'move-slide',
      name: 'Service',
      slide: 9,
      to: 1,
    });
  });

  it('checks a rename destination as hard as the name, before asking the app', async () => {
    expect(
      errorOf(
        await call('owa_lyric_file', {
          action: 'rename',
          name: 'Sunday Song',
          newName: '..\\Sunday Song',
        }),
      ),
    ).toContain('A name cannot contain any of');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
    routeApp('en', () => ({ renamed: 'Evening Song' }));
    expect(
      jsonOf(
        await call('owa_lyric_file', {
          action: 'rename',
          name: 'Sunday Song',
          newName: 'Evening Song',
        }),
      ),
    ).toEqual({ renamed: 'Evening Song' });
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      kind: 'lyric',
      action: 'rename',
      name: 'Sunday Song',
      newName: 'Evening Song',
    });
  });

  it('lists with no name, and a window that does not answer is an error result', async () => {
    app.evaluateInApp.mockRejectedValue(
      new Error('Timed out evaluating in presenter.html'),
    );
    expect(errorOf(await call('owa_slide_file', { action: 'list' }))).toBe(
      'Timed out evaluating in presenter.html',
    );
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      kind: 'slide',
      action: 'list',
    });
  });

  it('names five problems of a song it refuses and counts the rest', async () => {
    const song = [
      '```ol:Config',
      '- Title: T',
      '- Key: H#',
      '- Tempo: fast',
      '- Time: 9/9',
      '- Locale: zz',
      '- Bogus: 1',
      '- Other: 2',
      '- Structure: V9',
      '```',
      '```ol:Nonsense',
      'x',
      '```',
    ].join('\n');
    const problemCount = validateOpenLyric(song).problems.length;
    expect(problemCount).toBeGreaterThan(5);
    const text = errorOf(
      await call('owa_lyric_file', {
        action: 'update',
        name: 'Sunday Song',
        content: song,
      }),
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe(
      'That is not a valid Open Lyric song, so nothing was written:',
    );
    expect(lines.filter((line) => /^line \d+: /.test(line))).toHaveLength(5);
    expect(lines).toContain(`...and ${problemCount - 5} more.`);
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('the saved-data tools', () => {
  it('owa_bible_item refuses a path for a new list name, and fails as a result', async () => {
    expect(
      errorOf(
        await call('owa_bible_item', {
          action: 'rename-list',
          list: 'Sunday',
          newName: '../Sunday',
        }),
      ),
    ).toContain('A name cannot contain any of');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
    app.evaluateInApp.mockRejectedValue(
      new Error('This window did not answer.'),
    );
    expect(errorOf(await call('owa_bible_item', { action: 'list' }))).toBe(
      'This window did not answer.',
    );
  });

  describe.each([
    [
      'owa_find_verse',
      { bible: 'KJV', words: 'love one another', page: 'reader.html' },
      'bible-find',
      120000,
      { match: 'reader.html', timeout: 125000 },
    ],
    [
      'owa_lookup_record',
      { kind: 'name', name: 'Ruth', page: 'reader.html' },
      'lookup',
      60000,
      { match: 'reader.html', timeout: 65000 },
    ],
    [
      'owa_bible_suggest',
      { kind: 'reference', prefix: 'Joh', page: 'reader.html' },
      'bible-suggest',
      60000,
      { match: 'reader.html', timeout: 65000 },
    ],
  ])('%s', (name, args, domain, waitMs, options) => {
    it('asks over the data relay and waits longer than the relay does', async () => {
      routeApp('en', () => ({ results: [{ key: 'JHN 13:34' }] }));
      expect(jsonOf(await call(name, args))).toEqual({
        results: [{ key: 'JHN 13:34' }],
      });
      const [[expression, evaluateOptions]] = app.evaluateInApp.mock.calls;
      const { page: _page, ...request } = args;
      expect(requestOf(expression)).toEqual({ ...request, domain });
      expect(expression).toContain(`}, ${waitMs});`);
      expect(evaluateOptions).toEqual(options);
    });

    it('answers an app refusal and a failed call as errors', async () => {
      routeApp('en', () => ({ isError: true, reason: 'No Bible installed.' }));
      expect(errorOf(await call(name, args))).toBe('No Bible installed.');
      app.evaluateInApp.mockRejectedValue(new Error('Timed out'));
      expect(errorOf(await call(name, args))).toBe('Timed out');
    });
  });

  it('owa_resource_file answers words first and each page picture after', async () => {
    routeApp('en', () => ({
      file: 'LUK.6.pdf',
      text: 'Luke 6 notes',
      images: [
        'data:image/png;base64,QUJD',
        'not a picture',
        'data:image/jpeg;base64,REVG',
      ],
      nextPage: 4,
    }));
    const result = await call('owa_resource_file', {
      action: 'read',
      file: 'LUK.6.pdf',
      page: 3,
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      file: 'LUK.6.pdf',
      text: 'Luke 6 notes',
      nextPage: 4,
    });
    expect(result.content.slice(1)).toEqual([
      { type: 'image', mimeType: 'image/png', data: 'QUJD' },
      { type: 'image', mimeType: 'image/jpeg', data: 'REVG' },
    ]);
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({
      action: 'read',
      file: 'LUK.6.pdf',
      page: 3,
      domain: 'resources',
    });
    // `page` is the PDF's page here, never a window to aim at.
    expect(options).toEqual({ timeout: 65000 });
  });

  it('owa_resource_file lists with no pictures, and fails as an error', async () => {
    routeApp('en', () => ({ files: ['LUK.6.pdf'], images: 'none' }));
    const listed = await call('owa_resource_file', {
      action: 'list',
      book: 'Luke',
    });
    expect(listed.content).toHaveLength(1);
    expect(JSON.parse(listed.content[0].text)).toEqual({
      files: ['LUK.6.pdf'],
    });
    routeApp('en', () => ({
      isError: true,
      reason: 'No Resources folder is set.',
    }));
    expect(errorOf(await call('owa_resource_file', { action: 'list' }))).toBe(
      'No Resources folder is set.',
    );
    app.evaluateInApp.mockRejectedValue(new Error('Timed out'));
    expect(errorOf(await call('owa_resource_file', { action: 'list' }))).toBe(
      'Timed out',
    );
  });

  it('owa_bible_note writes while only OTHER windows are open, or none can be asked', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/bibleNote.html?file=Other.own' },
    ]);
    routeApp('en', () => ({ done: true }));
    expect(
      jsonOf(
        await call('owa_bible_note', {
          action: 'add',
          file: 'Sunday',
          title: 'Prayer',
          text: 'Remember',
        }),
      ),
    ).toEqual({ done: true });
    app.requireLivePort.mockRejectedValue(new Error('No running app'));
    expect(
      jsonOf(await call('owa_bible_note', { action: 'delete', id: 2 })),
    ).toEqual({ done: true });
    expect(
      app.evaluateInApp.mock.calls.map(([expression]) => requestOf(expression)),
    ).toEqual([
      {
        action: 'add',
        file: 'Sunday',
        title: 'Prayer',
        text: 'Remember',
        domain: 'note',
      },
      { action: 'delete', id: 2, domain: 'note' },
    ]);
  });

  it('owa_bible_note will not change the Default notes file under its open window', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/bibleNote.html?file=Default.own' },
    ]);
    expect(
      errorOf(
        await call('owa_bible_note', { action: 'update', id: 1, text: 'x' }),
      ),
    ).toContain('The notes file "Default" is open in a note window');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('owa_bible_note refuses a reserved file name first, and fails as an error', async () => {
    expect(
      errorOf(
        await call('owa_bible_note', { action: 'create-file', file: 'CON' }),
      ),
    ).toBe('"CON" is a name this computer reserves for itself.');
    expect(app.listTargets).not.toHaveBeenCalled();
    expect(app.evaluateInApp).not.toHaveBeenCalled();
    app.evaluateInApp.mockRejectedValue(new Error('Timed out'));
    expect(errorOf(await call('owa_bible_note', { action: 'list' }))).toBe(
      'Timed out',
    );
  });

  it.each([
    [
      'owa_presenting_flow',
      'presenting-flow',
      { action: 'add', name: 'Sunday', reference: 'John 3:16', at: 2 },
      { action: 'rename', name: 'Sunday', newName: 'Sun:day' },
    ],
    [
      'owa_media_file',
      'media',
      { action: 'rename', kind: 'image', name: 'bg.png', newName: 'sky.png' },
      { action: 'rename', kind: 'image', name: 'bg.png', newName: 'sky?.png' },
    ],
  ])(
    '%s forwards every field but the window, and refuses a bad name',
    async (name, domain, request, badRequest) => {
      routeApp('en', () => ({ done: true }));
      expect(
        jsonOf(await call(name, { ...request, page: 'presenter.html' })),
      ).toEqual({ done: true });
      const [[expression, options]] = app.evaluateInApp.mock.calls;
      expect(requestOf(expression)).toEqual({ ...request, domain });
      expect(options).toEqual({ match: 'presenter.html' });
      expect(errorOf(await call(name, badRequest))).toContain(
        'A name cannot contain any of',
      );
      expect(app.evaluateInApp).toHaveBeenCalledTimes(1);
      app.evaluateInApp.mockRejectedValue(new Error('Timed out'));
      expect(errorOf(await call(name, request))).toBe('Timed out');
    },
  );

  it('owa_undo asks for the change by its id, and fails as an error', async () => {
    routeApp('en', () => ({ undone: 'u1' }));
    expect(
      jsonOf(await call('owa_undo', { action: 'undo', id: 'u1' })),
    ).toEqual({ undone: 'u1' });
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      action: 'undo',
      id: 'u1',
      domain: 'undo',
    });
    app.evaluateInApp.mockRejectedValue(new Error('Timed out'));
    expect(errorOf(await call('owa_undo', { action: 'list' }))).toBe(
      'Timed out',
    );
    // A page that throws a bare string still says what it threw.
    app.evaluateInApp.mockRejectedValue('Undo store is busy');
    expect(errorOf(await call('owa_undo', { action: 'list' }))).toBe(
      'Undo store is busy',
    );
  });
});

describe('owa_pick_element', () => {
  const isRead = (expression) => {
    return expression.includes('window.__owaPicker.read()');
  };
  const isStop = (expression) => {
    return expression.includes('window.__owaPicker.stop()');
  };

  it('waits for the user to point, then takes the picker down', async () => {
    fakeAllTimers();
    const phases = [
      { phase: 'pointing' },
      { phase: 'picked', result: { label: 'Clear Slide', selector: '#c' } },
    ];
    routeApp('en', (expression) => {
      return isRead(expression) ? phases.shift() : { phase: 'idle' };
    });
    const pending = call('owa_pick_element', { page: 'presenter.html' });
    await vi.advanceTimersByTimeAsync(250);
    expect(jsonOf(await pending)).toEqual({
      picked: true,
      element: { label: 'Clear Slide', selector: '#c' },
    });
    const [start] = callsOf((one) => one.includes('return picker.start('));
    expect(start[0]).toContain(
      `picker.start(${JSON.stringify(PICKER_HINT_TEMPLATE)})`,
    );
    expect(callsOf(isRead)).toHaveLength(2);
    expect(callsOf(isStop)).toHaveLength(1);
    for (const [expression, options] of app.evaluateInApp.mock.calls) {
      expect(options, expression.slice(0, 40)).toEqual({
        match: 'presenter.html',
      });
    }
  });

  it("says nothing was pointed at on a cancel, its line in the window's words", async () => {
    routeApp('xx', (expression) => {
      return isRead(expression) ? { phase: 'cancelled' } : { phase: 'idle' };
    });
    expect(jsonOf(await call('owa_pick_element', {}))).toEqual({
      picked: false,
      reason: 'Nothing was pointed at.',
    });
    const [start] = callsOf((one) => one.includes('return picker.start('));
    expect(start[0]).toContain(
      `picker.start(${JSON.stringify(xx(PICKER_HINT_TEMPLATE))})`,
    );
    expect(callsOf(isStop)).toHaveLength(1);
  });

  it('gives up at its deadline, not before, and shrugs off a window that went away', async () => {
    fakeAllTimers();
    app.evaluateInApp.mockImplementation(async (expression) => {
      if (expression === LANGUAGE_EXPRESSION) {
        return { value: 'en' };
      }
      if (isStop(expression)) {
        throw new Error('That window closed');
      }
      return { value: { phase: 'pointing' } };
    });
    let settled = null;
    call('owa_pick_element', { timeoutSeconds: 5 }).then((result) => {
      settled = result;
    });
    await vi.advanceTimersByTimeAsync(4900);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(jsonOf(settled)).toEqual({
      picked: false,
      reason: 'Nothing was picked in time.',
    });
    expect(callsOf(isStop)).toHaveLength(1);
  });
});

describe('owa_goto_page', () => {
  const MAIN_ON = (page) => ({ id: 'main', url: `http://localhost/${page}` });
  // A Bible Reader window of its own, listed FIRST as CDP lists the window
  // opened last -- the one the tool sent away in robot run 20261110-1109.
  const READER_WINDOW = {
    id: 'reader-window',
    url: 'http://localhost/reader.html?uuid=reader',
  };

  it('waits for the window to arrive on the page it was sent to', async () => {
    fakeAllTimers();
    routeApp('en', () => ({ switching: true, from: 'presenter.html' }));
    app.listTargets
      .mockResolvedValueOnce([MAIN_ON('presenter.html')])
      .mockResolvedValueOnce([MAIN_ON('presenter.html')])
      .mockResolvedValue([MAIN_ON('reader.html')]);
    const pending = call('owa_goto_page', { page: 'reader.html' });
    await vi.advanceTimersByTimeAsync(400);
    expect(jsonOf(await pending)).toEqual({
      page: 'reader.html',
      switched: true,
      from: 'presenter.html',
    });
    expect(app.listTargets).toHaveBeenCalledTimes(3);
  });

  it('still proves the switch when the page left before it could answer', async () => {
    app.evaluateInApp.mockRejectedValue(
      new Error('Execution context was destroyed'),
    );
    app.listTargets
      .mockResolvedValueOnce([MAIN_ON('reader.html')])
      .mockResolvedValue([MAIN_ON('appDocumentEditor.html')]);
    expect(
      jsonOf(await call('owa_goto_page', { page: 'appDocumentEditor.html' })),
    ).toEqual({
      page: 'appDocumentEditor.html',
      switched: true,
      from: 'reader.html',
    });
  });

  it('answers the page asked for when the window is already there and names none', async () => {
    routeApp('en', () => ({ switching: false }));
    app.listTargets.mockResolvedValue([MAIN_ON('reader.html')]);
    expect(
      jsonOf(await call('owa_goto_page', { page: 'reader.html' })),
    ).toEqual({ page: 'reader.html', switched: false });
    expect(app.listTargets).toHaveBeenCalledTimes(1);
  });

  it('sends the MAIN window, never a Reader window of its own beside it', async () => {
    // Both on the Reader: ranked by page kind they tie, and the one listed
    // first -- the popup -- was the one navigated.
    routeApp('en', () => ({ switching: true, from: 'reader.html' }));
    app.listTargets
      .mockResolvedValueOnce([READER_WINDOW, MAIN_ON('reader.html')])
      .mockResolvedValue([READER_WINDOW, MAIN_ON('presenter.html')]);
    expect(
      jsonOf(await call('owa_goto_page', { page: 'presenter.html' })),
    ).toEqual({ page: 'presenter.html', switched: true, from: 'reader.html' });
    expect(app.evaluateInApp).toHaveBeenCalledTimes(1);
    expect(app.evaluateInApp.mock.calls[0][1]).toEqual({
      port: 9222,
      match: 'main',
    });

    // The main window on the Slide Editor: a Reader window outranked it.
    app.evaluateInApp.mockClear();
    app.listTargets
      .mockReset()
      .mockResolvedValueOnce([READER_WINDOW, MAIN_ON('appDocumentEditor.html')])
      .mockResolvedValue([READER_WINDOW, MAIN_ON('presenter.html')]);
    jsonOf(await call('owa_goto_page', { page: 'presenter.html' }));
    expect(app.evaluateInApp.mock.calls[0][1].match).toBe('main');
  });

  it('does not take a Reader window of its own for the main window arriving', async () => {
    fakeAllTimers();
    routeApp('en', () => ({ switching: true, from: 'presenter.html' }));
    // The main window never leaves the Presenter; a Reader window is open.
    app.listTargets.mockResolvedValue([
      READER_WINDOW,
      MAIN_ON('presenter.html'),
    ]);
    const pending = call('owa_goto_page', { page: 'reader.html' });
    await vi.advanceTimersByTimeAsync(8400);
    expect(errorOf(await pending)).toBe(
      'Asked the window to switch to "reader.html" but it is not there ' +
        'yet -- check owa_app_state and try again.',
    );
  });

  it('switches nothing when no window is the main one', async () => {
    app.listTargets.mockResolvedValue([
      READER_WINDOW,
      { id: 'setting', url: 'http://localhost/setting.html?uuid=setting' },
    ]);
    expect(
      errorOf(await call('owa_goto_page', { page: 'presenter.html' })),
    ).toBe(
      'The main app window was not found among the open windows, so ' +
        'nothing was switched -- check owa_app_state and try again.',
    );
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('says so when the window never arrives', async () => {
    fakeAllTimers();
    routeApp('en', () => ({ switching: true, from: 'presenter.html' }));
    app.listTargets.mockResolvedValue([MAIN_ON('presenter.html')]);
    const pending = call('owa_goto_page', { page: 'reader.html' });
    await vi.advanceTimersByTimeAsync(8400);
    expect(errorOf(await pending)).toBe(
      'Asked the window to switch to "reader.html" but it is not there ' +
        'yet -- check owa_app_state and try again.',
    );
  });
});

describe('owa_find_ui', () => {
  it("retries a miss in the window's words and says what the control is called there", async () => {
    routeApp('xx', (expression) => {
      return needleOf(expression) === xx('More Options')
        ? { matches: [{ label: xx('More Options'), inPanel: 'Document List' }] }
        : { matches: [], nearMisses: ['Documents'] };
    });
    expect(
      jsonOf(
        await call('owa_find_ui', {
          text: 'More Options',
          page: 'presenter.html',
        }),
      ),
    ).toEqual({
      matches: [{ label: xx('More Options'), inPanel: 'Document List' }],
      foundAs: xx('More Options'),
      note: `On their screen this control reads "${xx('More Options')}" -- call it that.`,
    });
    expect(
      callsOf(isFindUi).map(([expression, options]) => [
        needleOf(expression),
        options,
      ]),
    ).toEqual([
      ['More Options', { match: 'presenter.html' }],
      [xx('More Options'), { match: 'presenter.html' }],
    ]);
  });

  it('keeps the first answer when the translation misses too', async () => {
    routeApp('xx', () => ({ matches: [], nearMisses: ['Documents'] }));
    expect(jsonOf(await call('owa_find_ui', { text: 'More Options' }))).toEqual(
      { matches: [], nearMisses: ['Documents'] },
    );
    expect(callsOf(isFindUi)).toHaveLength(2);
  });

  it('does not ask again in an English window', async () => {
    routeApp('en', () => ({ matches: [] }));
    await call('owa_find_ui', { text: 'More Options' });
    expect(callsOf(isFindUi)).toHaveLength(1);
  });

  it('does not ask again for a label the dictionary lacks', async () => {
    routeApp('xx', () => ({ matches: [] }));
    await call('owa_find_ui', { text: 'Not In The Dictionary' });
    expect(callsOf(isFindUi)).toHaveLength(1);
  });

  it('offers near misses from every window only when nothing matched', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/reader.html' },
      // Answers nothing at all: skipped, not an error.
      { url: 'http://localhost/setting.html' },
    ]);
    app.evaluateInTarget
      .mockResolvedValueOnce({ matches: [], nearMisses: ['Clear Slide'] })
      .mockResolvedValueOnce({ matches: [], nearMisses: ['Clear Bible'] });
    expect(
      jsonOf(await call('owa_find_ui', { text: 'Clear', anyPage: true })),
    ).toEqual({
      count: 0,
      shownCount: 0,
      matches: [],
      nearMisses: [
        { label: 'Clear Slide', page: 'presenter.html' },
        { label: 'Clear Bible', page: 'reader.html' },
      ],
    });
  });
});

describe("every label-aimed tool offers the window's words", () => {
  it('owa_scroll scrolls the biggest list without asking the language', async () => {
    routeApp('xx', () => ({ isAtBottom: false, inView: ['Song 12'] }));
    expect(jsonOf(await call('owa_scroll', { to: 'down' }))).toEqual({
      isAtBottom: false,
      inView: ['Song 12'],
    });
    expect(languageReads()).toHaveLength(0);
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('const finds = [];');
  });

  it("owa_scroll, owa_press_key and owa_drag offer each label in the window's language after the English", async () => {
    routeApp('xx', () => ({ didChange: true }));
    await call('owa_scroll', { find: ['Documents'], to: 'top' });
    await call('owa_press_key', { keys: 'Space', find: ['Documents'] });
    await call('owa_drag', { from: ['Bible Lookup'], to: ['Documents'] });
    const [scroll, press, drag] = callsOf((one) => {
      return one !== LANGUAGE_EXPRESSION;
    }).map(([expression]) => expression);
    const documents = JSON.stringify(['Documents', xx('Documents')]);
    expect(scroll).toContain(`const finds = ${documents};`);
    expect(press).toContain(`const finds = ${documents};`);
    expect(drag).toContain(
      `const fromFinds = ${JSON.stringify(['Bible Lookup', xx('Bible Lookup')])};`,
    );
    expect(drag).toContain(`const toFinds = ${documents};`);
    // One window, one read: the rest come from the cache.
    expect(languageReads()).toHaveLength(1);
  });

  it('owa_press_key names what it could not read as a keystroke', async () => {
    expect(errorOf(await call('owa_press_key', { keys: 5 }))).toBe(
      '"" is not a keystroke. Write it as a tooltip does: "F5", "Ctrl+S", ' +
        '"Escape", "ArrowRight", "Space".',
    );
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('a press the page refuses', () => {
  it.each([
    ['owa_click', { find: 'Trash' }],
    ['owa_type', { find: 'Name', value: 'x' }],
    ['owa_press_key', { keys: 'Enter', find: 'Move to Trash' }],
    ['owa_drag', { from: 'Song', to: 'Trash' }],
  ])(
    '%s says why in the firewall’s words and is logged beside its refusals',
    async (name, args) => {
      routeApp('en', () => ({
        refused: 'destructive',
        label: 'Move to Trash',
      }));
      const text = errorOf(await call(name, args));
      expect(text).toBe(genDestructiveReason('Move to Trash'));
      expect(text).toContain(
        'Pressing "Move to Trash" for the user is switched off',
      );
      expect(getFirewallLog().at(-1)).toMatchObject({
        name,
        rule: 'destructive-press',
        isAllowed: false,
      });
    },
  );

  it('leaves a question on screen to the user', async () => {
    routeApp('en', () => ({ refused: 'question' }));
    expect(
      errorOf(await call('owa_type', { find: 'Name', value: 'x' })),
    ).toContain('answering it is theirs to do, never yours');
    expect(getFirewallLog().at(-1)).toMatchObject({
      name: 'owa_type',
      rule: 'question-press',
      isAllowed: false,
    });
  });

  it('owa_guide_step refuses a Do it the page would not press, and only a Do it', async () => {
    routeApp('en', () => ({
      currentStep: 2,
      lastResult: { refused: 'destructive', label: 'Clear All' },
    }));
    const text = errorOf(
      await call('owa_guide_step', { action: 'do', page: 'presenter.html' }),
    );
    expect(text).toContain('Pressing "Clear All" for the user is switched off');
    expect(text).toContain('The walkthrough card is already ringing it');
    expect(getFirewallLog().at(-1)).toMatchObject({
      name: 'owa_guide_step',
      rule: 'destructive-press',
      isAllowed: false,
    });
    expect(
      jsonOf(await call('owa_guide_step', { action: 'back' })).lastResult,
    ).toEqual({ refused: 'destructive', label: 'Clear All' });
    await call('owa_guide_step', { action: 'goto' });
    const [[pressed, options], [back], [goto]] = app.evaluateInApp.mock.calls;
    expect(pressed).toMatch(/return api\.act\(\); \}\)\(\)$/);
    expect(options).toEqual({ match: 'presenter.html' });
    expect(back).toMatch(/return api\.back\(\); \}\)\(\)$/);
    expect(goto).toMatch(/return api\.go\(0\); \}\)\(\)$/);
  });
});

describe('owa_drop_files', () => {
  let fixtureDir;
  let fixturePath;
  const target = {
    id: 'T1',
    url: 'http://localhost/presenter.html',
    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/T1',
  };

  beforeAll(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-'));
    fixturePath = path.join(fixtureDir, 'slide.png');
    fs.writeFileSync(fixturePath, 'png');
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  function aimAt(aim) {
    app.evaluateInApp.mockImplementation(async (expression) => {
      return expression === LANGUAGE_EXPRESSION
        ? { value: 'en' }
        : { target, value: aim };
    });
  }

  it('needs a control to drop on before it asks the window anything', async () => {
    expect(
      errorOf(await call('owa_drop_files', { paths: [fixturePath], to: '' })),
    ).toBe('Pass the label of the control to drop on.');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('is refused by the page and logged, and drops nothing', async () => {
    aimAt({ refused: 'destructive', label: 'Move to Trash' });
    expect(
      errorOf(
        await call('owa_drop_files', { paths: [fixturePath], to: 'Trash' }),
      ),
    ).toContain('Pressing "Move to Trash" for the user is switched off');
    expect(getFirewallLog().at(-1)).toMatchObject({
      name: 'owa_drop_files',
      rule: 'destructive-press',
    });
    expect(app.runInTarget).not.toHaveBeenCalled();
  });

  it('answers what the page said when there is nothing to drop on', async () => {
    aimAt({ found: false, nearMisses: ['Document List'] });
    expect(
      jsonOf(
        await call('owa_drop_files', { paths: [fixturePath], to: 'Documents' }),
      ),
    ).toEqual({ found: false, nearMisses: ['Document List'] });
    expect(app.runInTarget).not.toHaveBeenCalled();
  });

  it('drops the real file as one gesture, then reads back what took it', async () => {
    aimAt({ point: { x: 40, y: 60 }, onto: 'Document List' });
    app.runInTarget.mockResolvedValue([]);
    app.evaluateInTarget.mockResolvedValue({
      accepted: true,
      dropped: true,
      landedOn: 'Document List',
    });
    expect(
      jsonOf(
        await call('owa_drop_files', {
          paths: [fixturePath],
          to: ['Document List'],
          page: 'presenter.html',
        }),
      ),
    ).toEqual({
      files: ['slide.png'],
      onto: 'Document List',
      accepted: true,
      dropped: true,
      landedOn: 'Document List',
    });
    const at = {
      x: 40,
      y: 60,
      data: {
        items: [],
        files: [fs.realpathSync(fixturePath)],
        dragOperationsMask: 1,
      },
    };
    const event = (type) => {
      return { method: 'Input.dispatchDragEvent', params: { type, ...at } };
    };
    expect(app.runInTarget).toHaveBeenCalledWith(target, [
      event('dragEnter'),
      event('dragOver'),
      { waitMs: 500 },
      event('dragOver'),
      { waitMs: 300 },
      event('drop'),
    ]);
    expect(app.evaluateInTarget).toHaveBeenCalledWith(
      target,
      genDropReadExpression(),
    );
    expect(app.runInTarget.mock.invocationCallOrder[0]).toBeLessThan(
      app.evaluateInTarget.mock.invocationCallOrder[0],
    );
    const [aimCall] = callsOf((one) => one !== LANGUAGE_EXPRESSION);
    expect(aimCall[0]).toContain('const finds = ["Document List"];');
    expect(aimCall[1]).toEqual({ match: 'presenter.html' });
  });

  it('says so when nothing there took the drop', async () => {
    aimAt({ point: { x: 1, y: 2 }, onto: 'Resources' });
    app.runInTarget.mockResolvedValue([]);
    app.evaluateInTarget.mockResolvedValue({
      accepted: false,
      dropped: false,
      landedOn: null,
    });
    expect(
      jsonOf(
        await call('owa_drop_files', { paths: [fixturePath], to: 'Resources' }),
      ).unverified,
    ).toBe(
      'Nothing there took the drop. Check the list the files were meant ' +
        'for before saying it worked.',
    );
  });
});

describe('owa_menu', () => {
  it('presses the item by its trimmed path, and a window that is gone is an error', async () => {
    app.evaluateInApp.mockRejectedValue(new Error('That window closed'));
    expect(
      errorOf(
        await call('owa_menu', { action: 'click', item: ' View > Reload ' }),
      ),
    ).toBe('That window closed');
    expect(app.evaluateInApp.mock.calls[0][0]).toContain(
      'ipcRenderer.sendSync("main:app:agent-menu-click", "View > Reload")',
    );
  });

  it('returns what the main process refused as an error, and a press as it answered', async () => {
    routeApp('en', () => ({
      isError: true,
      reason: 'Quit is pressed by the user only.',
    }));
    expect(
      errorOf(await call('owa_menu', { action: 'click', item: 'File > Quit' })),
    ).toBe('Quit is pressed by the user only.');
    routeApp('en', () => ({ clicked: 'View > Reload' }));
    expect(
      jsonOf(
        await call('owa_menu', { action: 'click', item: 'View > Reload' }),
      ),
    ).toEqual({ clicked: 'View > Reload' });
  });
});

describe('owa_help_page', () => {
  it('says which part a later part is, and dates the copy beside its newest address', async () => {
    app.readHelpPage.mockReturnValue({
      kind: 'manual',
      file: 'manual/presenter/W-06 Bible.md',
      date: '2026-10-11',
      title: 'Present a Bible Verse',
      body: '# W-06 — Present a Bible Verse\n\nPress Lookup.',
      part: 2,
      partCount: 3,
    });
    const text = textOf(await call('owa_help_page', { id: 'W-06', part: 2 }));
    expect(text.split('\n')[0]).toBe('# Present a Bible Verse (part 2 of 3)');
    expect(text).toContain(
      'read its newest copy with owa_read_website: ' +
        'https://raw.githubusercontent.com/OpenWorshipApp/' +
        'open-worship-app-dt/main/docs/manual-sources/presenter/' +
        'W-06%20Bible.md -- this copy is dated 2026-10-11;',
    );
    expect(app.readHelpPage).toHaveBeenCalledWith('W-06', 'en', 2);
  });

  it('marks a developer note as one, with no address to read it from', async () => {
    app.readHelpPage.mockReturnValue({
      kind: 'internal',
      file: 'internal/memory/note.md',
      title: 'A note',
      body: 'Body text',
      part: 1,
      partCount: 1,
    });
    const text = textOf(
      await call('owa_help_page', { id: 'internal:memory/note.md' }),
    );
    expect(text).toContain('_(A DEVELOPER note, not user documentation.');
    expect(text).toContain('Body text');
    expect(text).not.toContain('owa_read_website');
  });
});

describe('owa_guide_start', () => {
  const DEMO_ID = 'presenter-lookup-reference';
  const demoSource = getPresenterDemo(DEMO_ID);

  // A demo or recipe card: the window says where it is and starts the card.
  function routeCard(langCode, route = () => undefined, pathname = null) {
    const answers = [];
    routeApp(langCode, (expression, options) => {
      if (isPathRead(expression)) {
        return pathname ?? `/${options.match ?? 'presenter.html'}`;
      }
      if (isCard(expression)) {
        return answers.shift() ?? { currentStep: 1, isTargetFound: true };
      }
      return route(expression, options);
    });
    return answers;
  }

  it('leaves out a demo step whose control is already open', async () => {
    routeCard('en', (expression) => {
      return isFindUi(expression)
        ? { matches: [{ label: 'Bible Reference', isVisible: true }] }
        : undefined;
    });
    expect(jsonOf(await call('owa_guide_start', { demoId: DEMO_ID }))).toEqual({
      currentStep: 1,
      isTargetFound: true,
    });
    expect(
      callsOf(isFindUi).map(([expression, options]) => [
        needleOf(expression),
        options,
      ]),
    ).toEqual([['Bible Reference', { match: 'presenter.html' }]]);
    const [{ card, options }] = cardsStarted();
    expect(options).toEqual({ match: 'presenter.html' });
    expect(card.mode).toBe('demo');
    expect(card.title).toBe(demoSource.title);
    expect(card.labels).toEqual({});
    expect(card.steps.map((step) => step.text)).toEqual(
      demoSource.steps.slice(1).map((step) => step.text),
    );
    expect(JSON.stringify(card.steps)).not.toContain('skipIfVisible');
  });

  it('keeps that step when its control is not open', async () => {
    routeCard('en', (expression) => {
      return isFindUi(expression)
        ? { matches: [{ label: 'Bible Reference', isVisible: false }] }
        : undefined;
    });
    await call('owa_guide_start', { demoId: DEMO_ID });
    const [{ card }] = cardsStarted();
    expect(card.steps).toHaveLength(demoSource.steps.length);
    expect(card.steps[0].finds).toEqual(['Bible Lookup']);
  });

  it("looks for the open control in both languages and speaks the card in the window's language", async () => {
    routeCard('xx', (expression) => {
      if (!isFindUi(expression)) {
        return undefined;
      }
      return {
        matches: [
          { isVisible: needleOf(expression) === xx('Bible Reference') },
        ],
      };
    });
    await call('owa_guide_start', { demoId: DEMO_ID });
    expect(
      callsOf(isFindUi).map(([expression]) => needleOf(expression)),
    ).toEqual(['Bible Reference', xx('Bible Reference')]);
    const [{ card }] = cardsStarted();
    expect(card.steps).toHaveLength(demoSource.steps.length - 1);
    // Only the words the dictionary has: Skip stays the card's own English.
    expect(card.labels).toEqual({
      next: xx('Next'),
      back: xx('Back'),
      done: xx('Done'),
      step: xx('Walkthrough step'),
      act: xx('Do it'),
    });
    expect(card.words).toEqual({
      [GUIDE_CARD_HINT_TEMPLATE_LIST[0]]: xx(GUIDE_CARD_HINT_TEMPLATE_LIST[0]),
    });
  });

  it("turns a custom step's shortcut into the keys it presses, under the card's own title", async () => {
    // The path read answers nothing: a window that cannot say where it is
    // keeps every step, the trip to it included.
    routeApp('xx', (expression) => {
      return isCard(expression) ? { currentStep: 1 } : undefined;
    });
    await call('owa_guide_start', {
      steps: [
        { text: 'Open the Presenter tab.', find: 'Presenter' },
        { text: 'Save it.', press: 'Ctrl+S' },
        { text: 'Look at the list.', press: 'not a key' },
      ],
      mode: 'demo',
      page: 'presenter.html',
    });
    const [{ card, options }] = cardsStarted();
    expect(options).toEqual({ match: 'presenter.html' });
    expect(card.steps.map((step) => step.text)).toEqual([
      'Open the Presenter tab.',
      'Save it.',
      'Look at the list.',
    ]);
    expect(card.steps[0]).not.toHaveProperty('keys');
    expect(card.steps[1].keys).toEqual(toKeystroke('Ctrl+S'));
    expect(card.steps[1].keys.ctrlKey).toBe(true);
    expect(card.steps[2].keys).toBeNull();
    expect(card.title).toBe(xx(GUIDE_CARD_TITLE_KEY));
    expect(card.mode).toBe('demo');
  });

  it('refuses an unknown demo, a demo of a recipe, a recipe it does not have and no steps', async () => {
    expect(
      errorOf(await call('owa_guide_start', { demoId: 'no-such-demo' })),
    ).toBe('Unknown built-in demo "no-such-demo".');
    expect(
      errorOf(
        await call('owa_guide_start', { manualId: 'W-90', mode: 'demo' }),
      ),
    ).toContain('A recipe can point but cannot safely do the task.');
    expect(app.readHelpPage).not.toHaveBeenCalled();
    expect(errorOf(await call('owa_guide_start', { manualId: 'W-99' }))).toBe(
      'No knowledge document "W-99"',
    );
    const nothing =
      'Nothing to guide: pass `steps`, or a `manualId` whose recipe has ' +
      'numbered steps.';
    expect(errorOf(await call('owa_guide_start', { steps: [] }))).toBe(nothing);
    expect(errorOf(await call('owa_guide_start', {}))).toBe(nothing);
    expect(cardsStarted()).toEqual([]);
  });

  const W90 = {
    title: 'Practice',
    lang: 'en',
    body: [
      '# W-90 — Practice',
      '',
      '1. Open the **Settings** window from the gear.',
      '2. Click **Bible Lookup** to open the lookup (see **W-31**).',
      '3. In the **Documents** panel, press **More Options** to see the ' +
        'file actions.',
      '',
    ].join('\n'),
  };
  const W90_STEP_3_FINDS = [
    'Documents > More Options',
    'Documents panel',
    'Documents',
    'More Options',
  ];
  // The page's translation, in the stand-in language: its words are signs,
  // its button names the stand-in dictionary's (`xx:<key>`).
  const W90_LOCAL = {
    title: '✎',
    lang: 'xx',
    body: [
      '# W-90 — ✎',
      '',
      '1. ⚙ **[en:tran:Settings]** ✓',
      '2. ➜ **[en:tran:Bible Lookup]** (➜ **W-31**) ✓',
      '3. ▤ **[en:tran:Documents]** ➜ **[en:tran:More Options]** ✓',
      '',
    ].join('\n'),
  };

  // `readHelpPage(id, lang, 'whole', options)`: the English page as the
  // card's rules read it, the same page with its templates kept, and the
  // page's translation (`W-90@xx`).
  function servePages({ english, withTemplates = english, local = null }) {
    app.readHelpPage.mockImplementation((id, _lang, _part, options) => {
      if (id.endsWith('@xx')) {
        return local;
      }
      return options?.keepTemplates === true ? withTemplates : english;
    });
  }

  it('walks a recipe in the window its first step names, past the trip there, without ids', async () => {
    servePages({ english: W90 });
    routeCard('en');
    await call('owa_guide_start', { manualId: 'W-90', page: 'presenter.html' });
    expect(app.readHelpPage).toHaveBeenCalledWith('W-90', 'en', 'whole');
    const [{ card, options }] = cardsStarted();
    expect(options).toEqual({ match: 'setting.html' });
    // The window is asked where it is, not assumed from the recipe.
    expect(callsOf(isPathRead)[0][1]).toEqual({ match: 'setting.html' });
    expect(card.title).toBe('Practice');
    expect(card.mode).toBe('show');
    expect(card.steps.map(({ text, finds }) => ({ text, finds }))).toEqual([
      {
        text: 'Click Bible Lookup to open the lookup.',
        finds: ['Bible Lookup'],
      },
      {
        text:
          'In the Documents panel, press More Options to see the file ' +
          'actions.',
        finds: W90_STEP_3_FINDS,
      },
    ]);
  });

  it("puts a recipe card into the window's language: its translation, the window's controls first", async () => {
    servePages({ english: W90, local: W90_LOCAL });
    routeCard('xx');
    await call('owa_guide_start', { manualId: 'W-90' });
    const [{ card, options }] = cardsStarted();
    expect(options).toEqual({ match: 'setting.html' });
    expect(card.title).toBe('✎');
    expect(card.labels.next).toBe(xx('Next'));
    expect(card.steps.map(({ text, finds }) => ({ text, finds }))).toEqual([
      {
        text: `➜ ${xx('Bible Lookup')} ✓`,
        finds: [xx('Bible Lookup'), 'Bible Lookup'],
      },
      {
        text: `▤ ${xx('Documents')} ➜ ${xx('More Options')} ✓`,
        finds: [
          `${xx('Documents')} > ${xx('More Options')}`,
          // The panel's English name, which it answers to in every language.
          `Documents > ${xx('More Options')}`,
          'Documents > More Options',
          'Documents panel',
          xx('Documents'),
          'Documents',
          xx('More Options'),
          'More Options',
        ],
      },
    ]);
    expect(JSON.stringify(card.steps)).not.toContain('localText');
  });

  it("reads the English page's own templates when the translation is stale", async () => {
    const withTemplates = {
      ...W90,
      body: W90.body.replace('**Bible Lookup**', '**[en:tran:Bible Lookup]**'),
    };
    servePages({
      english: W90,
      withTemplates,
      local: { ...W90_LOCAL, lang: 'en' },
    });
    routeCard('xx');
    await call('owa_guide_start', { manualId: 'W-90' });
    const [{ card }] = cardsStarted();
    expect(card.title).toBe('Practice');
    expect(card.steps[0].text).toBe(
      `Click ${xx('Bible Lookup')} to open the lookup.`,
    );
  });

  it('keeps the English steps when no copy of the page lines up with them', async () => {
    servePages({ english: W90, withTemplates: null });
    routeCard('xx');
    await call('owa_guide_start', { manualId: 'W-90' });
    const [{ card }] = cardsStarted();
    expect(card.steps[0]).toMatchObject({
      text: 'Click Bible Lookup to open the lookup.',
      finds: [xx('Bible Lookup'), 'Bible Lookup'],
    });
  });

  const W91 = {
    title: 'Find the file actions',
    lang: 'en',
    body: [
      '# W-91 — Find the file actions',
      '',
      '1. Click **Bible Lookup** in the header.',
      '2. Choose the verse you want in the list.',
      '3. In the **Documents** panel, press **More Options** to see the ' +
        'file actions.',
      '',
    ].join('\n'),
  };
  const W91_TEXTS = [
    'Click Bible Lookup in the header.',
    'Choose the verse you want in the list.',
    'In the Documents panel, press More Options to see the file actions.',
  ];

  it('starts the step a topic names, then the way to it when its control is not there', async () => {
    servePages({ english: W91 });
    const answers = routeCard('en');
    answers.push(
      { currentStep: 1, isTargetFound: false },
      { currentStep: 1, stepCount: 3, isTargetFound: true },
    );
    expect(
      jsonOf(
        await call('owa_guide_start', {
          manualId: 'W-91',
          topic: 'see the file actions',
        }),
      ),
    ).toEqual({ currentStep: 1, stepCount: 3, isTargetFound: true });
    expect(
      cardsStarted().map(({ card }) => card.steps.map((step) => step.text)),
    ).toEqual([[W91_TEXTS[2]], W91_TEXTS]);
  });

  it('starts the topic step alone when its control is on screen', async () => {
    servePages({ english: W91 });
    routeCard('en');
    await call('owa_guide_start', {
      manualId: 'W-91',
      topic: 'see the file actions',
    });
    expect(
      cardsStarted().map(({ card }) => card.steps.map((step) => step.text)),
    ).toEqual([[W91_TEXTS[2]]]);
  });

  it('starts the step naming the control asked about, that control first', async () => {
    servePages({ english: W91 });
    const answers = routeCard('en');
    answers.push({ isTargetFound: false });
    await call('owa_guide_start', { manualId: 'W-91', find: ' More Options ' });
    const [first, second] = cardsStarted().map(({ card }) => card.steps);
    const reordered = [
      'More Options',
      'Documents > More Options',
      'Documents panel',
      'Documents',
    ];
    expect(first.map((step) => step.finds)).toEqual([reordered]);
    expect(second.map((step) => step.finds)).toEqual([
      ['Bible Lookup'],
      [],
      reordered,
    ]);
  });

  it('puts the control asked about first on every step when no step names it', async () => {
    servePages({ english: W91 });
    const answers = routeCard('en');
    answers.push({ isTargetFound: false });
    await call('owa_guide_start', { manualId: 'W-91', find: 'Stay Awake' });
    const cards = cardsStarted();
    // No deeper step to find the way to, so no second card.
    expect(cards).toHaveLength(1);
    expect(cards[0].card.steps.map((step) => step.finds[0])).toEqual([
      'Stay Awake',
      'Stay Awake',
      'Stay Awake',
    ]);
  });
});
