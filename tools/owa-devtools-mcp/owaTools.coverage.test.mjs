import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

// The app-level tools, against a fake app: every page expression a tool
// sends is answered by `state.answer`, except the window-language read,
// which answers `state.lang`. Same mock surface as `owaTools.test.mjs`.
const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  runInTarget: vi.fn(),
  waitForNewAppPage: vi.fn(),
  readLiveInstances: vi.fn(),
  searchHelp: vi.fn(),
  readHelpPage: vi.fn(),
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
  searchHelp: app.searchHelp,
  readHelpPage: app.readHelpPage,
}));

import { genForegroundExpression } from './agentForeground.mjs';
import { genPresenterStateExpression } from './agentPresenter.mjs';
import { genHighlightSelectorExpression } from './domMatch.mjs';
import {
  genDestructiveReason,
  genPressRefusalReason,
  getFirewallLog,
} from './firewall.mjs';
import {
  GUIDE_CARD_HINT_TEMPLATE_LIST,
  GUIDE_CARD_LABEL_KEY_MAP,
  GUIDE_CARD_TITLE_KEY,
} from './guide.mjs';
import { registerOwaTools } from './owaTools.mjs';
import {
  PICKER_HINT_TEMPLATE,
  genPickerReadExpression,
  genPickerStartExpression,
  genPickerStopExpression,
} from './picker.mjs';
import { resolveTranTemplates, tranText } from './tran.mjs';
import { WEBSITE_READ_EVALUATE_TIMEOUT } from './website.mjs';

const handlers = new Map();
registerOwaTools({
  registerTool(name, schema, handler) {
    handlers.set(name, { schema, handler });
  },
});

function call(name, args = {}) {
  return handlers.get(name).handler(args);
}

function answer(result) {
  expect(result.isError, result.content?.[0]?.text).not.toBe(true);
  return result.content[0].text;
}

function refusal(result) {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

const LANGUAGE_EXPRESSION =
  "(document.documentElement.lang || 'en').split('-')[0]";

const state = {
  lang: 'en',
  isLanguageDown: false,
  answer: () => ({ value: null }),
};

// Every test starts eleven seconds after the last, so the tools' ten-second
// cache of the window's language never carries one test's language into
// another (no test advances its own clock that far).
let clock = Date.UTC(2031, 0, 1);
function useClock(toFake = ['Date']) {
  vi.useFakeTimers({ toFake });
  clock += 11 * 1000;
  vi.setSystemTime(clock);
}

// What reached the app, the language reads left out.
function appCalls() {
  return app.evaluateInApp.mock.calls.filter(([expression]) => {
    return expression !== LANGUAGE_EXPRESSION;
  });
}

// The relay request inside a data or file expression.
function readRequest(expression) {
  const match =
    /const request = Object\.assign\(([\s\S]*?), \{\s*token: Math\.random/.exec(
      expression,
    );
  return match === null ? null : JSON.parse(match[1]);
}

// The walkthrough runtime call at the end of a guide expression.
function readGuideCall(expression) {
  const at = expression.lastIndexOf('return api.');
  if (at === -1 || !expression.endsWith('; })()')) {
    return null;
  }
  return expression.slice(at + 'return api.'.length, -'; })()'.length);
}

function readStartPayload(expression) {
  const guideCall = readGuideCall(expression);
  return guideCall?.startsWith('start(')
    ? JSON.parse(guideCall.slice('start('.length, -1))
    : null;
}

function startCalls() {
  return appCalls()
    .map(([expression, options]) => {
      return { payload: readStartPayload(expression), options };
    })
    .filter((one) => {
      return one.payload !== null;
    });
}

// The text a find expression looks for.
function readFindText(expression) {
  const match = /dm\.parseNeedle\(("(?:[^"\\]|\\.)*")\)/.exec(expression);
  return match === null ? null : JSON.parse(match[1]);
}

beforeEach(() => {
  useClock();
  state.lang = 'en';
  state.isLanguageDown = false;
  state.answer = () => ({ value: null });
  app.evaluateInApp.mockImplementation(async (expression, options) => {
    if (expression === LANGUAGE_EXPRESSION) {
      if (state.isLanguageDown) {
        throw new Error('No running Open Worship App was found.');
      }
      return { value: state.lang };
    }
    return state.answer(expression, options);
  });
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
  app.readLiveInstances.mockReturnValue([]);
  app.waitForNewAppPage.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('labels in the window language', () => {
  it('offers each label with the words on the button beside it', async () => {
    state.lang = 'km';
    state.answer = () => ({ value: { clicked: true, didChange: true } });
    const khmer = tranText('Bible Lookup', 'km');
    expect(khmer).not.toBe('Bible Lookup');
    answer(
      await call('owa_click', {
        find: ['Bible Lookup', 'Zz Unknown', 'Zz One > Zz Two'],
        page: 'km-click.html',
      }),
    );
    const [expression, options] = appCalls()[0];
    expect(options).toEqual({ match: 'km-click.html' });
    expect(expression).toContain(
      JSON.stringify(['Bible Lookup', khmer, 'Zz Unknown', 'Zz One > Zz Two']),
    );
  });

  it('keeps English labels when no window can be asked its language', async () => {
    state.isLanguageDown = true;
    state.answer = () => ({ value: { clicked: true } });
    answer(
      await call('owa_click', { find: 'Bible Lookup', page: 'gone.html' }),
    );
    expect(appCalls()[0][0]).toContain(JSON.stringify(['Bible Lookup']));
  });
});

describe('owa_find_ui', () => {
  it('tries the words on their screen when the English label finds nothing', async () => {
    state.lang = 'km';
    const khmer = tranText('Zoom In', 'km');
    state.answer = (expression) => {
      return readFindText(expression) === khmer
        ? { value: { matches: [{ text: khmer }] } }
        : { value: { matches: [], nearMisses: [] } };
    };
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Zoom In', page: 'km-a.html' })),
    );
    expect(found.matches).toEqual([{ text: khmer }]);
    expect(found.foundAs).toBe(khmer);
    expect(found.note).toBe(
      `On their screen this control reads "${khmer}" -- call it that.`,
    );
  });

  it('answers the first miss when the translation misses too', async () => {
    state.lang = 'km';
    state.answer = () => ({ value: { matches: [], nearMisses: ['Zoom'] } });
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Zoom In', page: 'km-b.html' })),
    );
    expect(found).toEqual({ matches: [], nearMisses: ['Zoom'] });
    expect(appCalls()).toHaveLength(2);
  });

  it('does not search twice in an English window', async () => {
    state.answer = () => ({ value: { matches: [] } });
    answer(await call('owa_find_ui', { text: 'Zoom In' }));
    expect(appCalls()).toHaveLength(1);
  });

  it('reports the closest labels of every window when none matched', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/reader.html' },
    ]);
    app.evaluateInTarget
      .mockResolvedValueOnce({ matches: [], nearMisses: ['Clear Slide'] })
      .mockResolvedValueOnce({ matches: [], nearMisses: ['Clear All'] });
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Clear', anyPage: true })),
    );
    expect(found).toEqual({
      count: 0,
      shownCount: 0,
      matches: [],
      nearMisses: [
        { label: 'Clear Slide', page: 'presenter.html' },
        { label: 'Clear All', page: 'reader.html' },
      ],
    });
  });
});

describe('owa_app_state', () => {
  it('adds what the user has selected when the main window is the Presenter', async () => {
    app.listTargets.mockResolvedValue([
      { id: 'P', title: 'Presenter', url: 'http://localhost/presenter.html' },
    ]);
    const selected = { name: 'Amazing Grace', kind: 'lyric', slideCount: 3 };
    state.answer = (expression) => {
      return expression === genPresenterStateExpression()
        ? { value: { selectedDocument: selected, runSheet: null } }
        : { value: { page: 'presenter.html', language: 'en', tabs: [] } };
    };
    const result = JSON.parse(answer(await call('owa_app_state', {})));
    expect(result.mainWindow).toEqual({
      page: 'presenter.html',
      language: 'en',
      tabs: [],
      selectedDocument: selected,
      runSheet: null,
    });
    expect(appCalls()[1]).toEqual([
      genPresenterStateExpression(),
      { port: 9222, match: undefined },
    ]);
  });
});

describe('the projector tools', () => {
  it('starts a foreground extra on the Presenter and says what is up', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
    ]);
    state.answer = () => ({ value: { did: 'started', screens: [] } });
    const started = JSON.parse(
      answer(await call('owa_foreground', { widget: 'countdown', minutes: 5 })),
    );
    expect(started).toEqual({ did: 'started', screens: [] });
    expect(appCalls()[0]).toEqual([
      genForegroundExpression({ widget: 'countdown', minutes: 5 }),
      { port: 9222, match: 'presenter.html' },
    ]);
  });

  it('passes on a foreground refusal and a missing app as errors', async () => {
    state.answer = () => ({
      value: { isError: true, reason: 'No screen is ticked.' },
    });
    expect(refusal(await call('owa_foreground', { widget: 'clock' }))).toBe(
      'No screen is ticked.',
    );
    // Without the Presenter open the main window is asked instead.
    expect(appCalls()[0][1]).toEqual({ port: 9222, match: undefined });

    app.requireLivePort.mockRejectedValue(new Error('No app is running.'));
    expect(refusal(await call('owa_foreground', { action: 'check' }))).toBe(
      'No app is running.',
    );
    expect(
      refusal(await call('owa_present_bible', { reference: 'John 3:16' })),
    ).toBe('No app is running.');
  });

  it('hides every screen, or one screen by id', async () => {
    state.answer = (expression) => ({ value: { sentFrom: expression } });
    answer(await call('owa_hide_screens', {}));
    answer(await call('owa_hide_screens', { screenId: 2 }));
    const [[all], [one]] = appCalls();
    expect(all).toContain('ipcRenderer.send("app:hide-all-screens")');
    expect(one).toContain('ipcRenderer.send("app:hide-screen", 2)');
    expect(one).toContain('return { sent: "app:hide-screen" }');
  });

  it('turns a failed capture into an error result', async () => {
    state.answer = () => {
      throw new Error('That screen is not showing.');
    };
    expect(refusal(await call('owa_screenshot', { screenId: 1 }))).toBe(
      'That screen is not showing.',
    );
  });
});

describe('owa_read_website', () => {
  it('answers with the text alone unless a picture was asked for', async () => {
    state.answer = () => ({
      value: {
        url: 'https://example.org/',
        title: 'Example',
        text: 'Plain words',
        imageDataUrl: 'data:image/png;base64,aGVsbG8=',
      },
    });
    const result = await call('owa_read_website', {
      url: 'https://example.org/',
      page: 'reader.html',
    });
    expect(result.content).toHaveLength(1);
    expect(answer(result)).toContain('Plain words');
    const [expression, options] = appCalls()[0];
    expect(expression).toContain('https://example.org/');
    expect(options).toEqual({
      match: 'reader.html',
      timeout: WEBSITE_READ_EVALUATE_TIMEOUT,
    });
  });

  it('turns a page that could not be read into an error result', async () => {
    state.answer = () => {
      throw new Error('Timed out evaluating in reader.html');
    };
    expect(
      refusal(await call('owa_read_website', { url: 'https://example.org/' })),
    ).toBe('Timed out evaluating in reader.html');
  });
});

const VALID_SONG = [
  '```ol:Config',
  '- Title: Grace',
  '- Artist: A',
  '- Copyright: Public Domain',
  '- Key: C',
  '- Tempo: 68bpm',
  '- Time: 4/4',
  '- Structure: V1',
  '```',
  '```ol:Verse 1',
  'Amazing grace how sweet the sound',
  '```',
].join('\n');

describe('owa_lyric_validate', () => {
  it('finds a song by title among their songs and the hymns', async () => {
    state.answer = () => ({
      value: {
        asked: 'Grace',
        yours: ['Grace'],
        nearest: ['Amazing Grace'],
        collectionSize: 400,
      },
    });
    const text = answer(
      await call('owa_lyric_validate', { mode: 'find', title: '  Grace ' }),
    );
    expect(text).toContain('already in their Documents list');
    expect(text).toContain('Amazing Grace');
    expect(readRequest(appCalls()[0][0])).toEqual({
      kind: 'lyric',
      action: 'find',
      name: 'Grace',
    });

    state.answer = () => ({
      value: { isError: true, reason: 'The songs could not be listed.' },
    });
    expect(
      refusal(await call('owa_lyric_validate', { mode: 'find', title: 'X' })),
    ).toBe('The songs could not be listed.');
  });

  it('drafts a song straight off a page, keeping where it came from', async () => {
    state.answer = () => ({
      value: {
        url: 'https://example.org/hymn',
        title: 'Amazing Grace',
        text: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
      },
    });
    const draft = answer(
      await call('owa_lyric_validate', {
        url: ' https://example.org/hymn ',
        title: 'Amazing Grace',
      }),
    );
    expect(draft).toMatch(/^Drafted a song from the text\./);
    expect(draft).toContain('the address the words came from is kept');
    const [expression, options] = appCalls()[0];
    expect(expression).toContain('https://example.org/hymn');
    expect(options).toEqual({ timeout: WEBSITE_READ_EVALUATE_TIMEOUT });
  });

  it('checks notation and drafts plain words without asking the app', async () => {
    expect(
      answer(await call('owa_lyric_validate', { text: VALID_SONG })),
    ).toContain('Valid Open Lyric. No problems found.');
    expect(
      answer(
        await call('owa_lyric_validate', {
          text: 'Amazing grace how sweet the sound\nThat saved a wretch',
          title: 'Grace',
        }),
      ),
    ).toMatch(/^Drafted a song from the text\./);
    expect(
      answer(
        await call('owa_lyric_validate', { text: 'words', mode: 'check' }),
      ),
    ).toContain('Not valid Open Lyric');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('the document file tools', () => {
  it('writes a valid song through the app and passes on its answer', async () => {
    state.answer = () => ({ value: { created: 'Grace' } });
    expect(
      JSON.parse(
        answer(
          await call('owa_lyric_file', {
            action: 'create',
            name: 'Grace',
            content: VALID_SONG,
            page: 'presenter.html',
          }),
        ),
      ),
    ).toEqual({ created: 'Grace' });
    const [expression, options] = appCalls()[0];
    expect(readRequest(expression)).toEqual({
      kind: 'lyric',
      action: 'create',
      name: 'Grace',
      content: VALID_SONG,
    });
    expect(options).toEqual({ match: 'presenter.html' });
  });

  it('lists and edits slides, passing the box changes along', async () => {
    state.answer = () => ({ value: { slides: [] } });
    answer(await call('owa_slide_file', { action: 'list' }));
    answer(
      await call('owa_slide_file', {
        action: 'update-slide',
        name: 'Sunday',
        slide: 2,
        items: [{ id: 1, text: 'Welcome', color: '#FFFFFF' }],
      }),
    );
    expect(readRequest(appCalls()[1][0])).toEqual({
      kind: 'slide',
      action: 'update-slide',
      name: 'Sunday',
      slide: 2,
      items: [{ id: 1, text: 'Welcome', color: '#FFFFFF' }],
    });

    state.answer = () => ({
      value: { isError: true, reason: 'There is no slide 9.' },
    });
    expect(
      refusal(
        await call('owa_slide_file', {
          action: 'delete-slide',
          name: 'Sunday',
          slide: 9,
        }),
      ),
    ).toBe('There is no slide 9.');

    state.answer = () => {
      throw new Error('This window did not answer.');
    };
    expect(
      refusal(await call('owa_slide_file', { action: 'info', name: 'Sunday' })),
    ).toBe('This window did not answer.');
  });

  it('checks the new name of a rename before anything else', async () => {
    const result = await call('owa_lyric_file', {
      action: 'rename',
      name: 'Grace',
      newName: '../Grace',
    });
    expect(result.isError).toBe(true);
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('lists the first five problems of a broken song and counts the rest', async () => {
    const broken = [
      '```ol:Config',
      '- Title: T',
      '- Tempo: fast',
      '- Time: x',
      '- Key: H',
      '- Structure: V1 V2',
      '```',
      '```ol:Bogus',
      'x',
      '```',
      '```ol:Weird',
      'y',
      '```',
      '```ol:Other',
      'z',
      '```',
    ].join('\n');
    const text = refusal(
      await call('owa_lyric_file', {
        action: 'update',
        name: 'Grace',
        content: broken,
      }),
    );
    expect(text).toMatch(/^That is not a valid Open Lyric song/);
    expect(text).toContain('line 3: Tempo must match');
    expect(text).toContain('Digits then "bpm" with no space');
    expect(text).toContain('...and 2 more.');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('the data tools', () => {
  it('refuses a list name that leaves its folder before asking the app', async () => {
    for (const [name, args] of [
      ['owa_bible_item', { action: 'create-list', list: '../x' }],
      ['owa_bible_note', { action: 'add', file: 'a/b', text: 'x' }],
      [
        'owa_presenting_flow',
        { action: 'rename', name: 'Sun', newName: 'C:x' },
      ],
      ['owa_media_file', { action: 'rename', kind: 'image', name: '..' }],
    ]) {
      expect((await call(name, args)).isError, name).toBe(true);
    }
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('sends each request to its own domain and passes refusals on', async () => {
    state.answer = (expression) => ({
      value: { echo: readRequest(expression) },
    });
    const cases = [
      [
        'owa_presenting_flow',
        { action: 'add', name: 'Sunday', reference: 'John 3:16', at: 2 },
        { action: 'add', name: 'Sunday', reference: 'John 3:16', at: 2 },
        'presenting-flow',
      ],
      [
        'owa_media_file',
        { action: 'list', kind: 'video', page: 'presenter.html' },
        { action: 'list', kind: 'video' },
        'media',
      ],
      [
        'owa_undo',
        { action: 'undo', id: 'c1' },
        { action: 'undo', id: 'c1' },
        'undo',
      ],
    ];
    for (const [name, args, request, domain] of cases) {
      const result = JSON.parse(answer(await call(name, args)));
      expect(result.echo, name).toEqual({ ...request, domain });
    }
    expect(appCalls()[1][1]).toEqual({ match: 'presenter.html' });

    state.answer = () => ({
      value: { isError: true, reason: 'Nothing to undo.' },
    });
    expect(refusal(await call('owa_undo', { action: 'undo' }))).toBe(
      'Nothing to undo.',
    );
    state.answer = () => {
      throw new Error('This window did not answer.');
    };
    for (const [name, args] of [
      ['owa_bible_item', { action: 'list' }],
      ['owa_presenting_flow', { action: 'list' }],
      ['owa_media_file', { action: 'list', kind: 'audio' }],
      ['owa_undo', { action: 'list' }],
    ]) {
      expect(refusal(await call(name, args)), name).toBe(
        'This window did not answer.',
      );
    }
  });

  it('writes a note when the only note window open is another file', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/bibleNote.html?file=Other.own' },
    ]);
    state.answer = (expression) => ({ value: readRequest(expression) });
    const written = JSON.parse(
      answer(
        await call('owa_bible_note', {
          action: 'add',
          file: 'Sunday',
          title: 'Prayer',
          text: 'Remember',
        }),
      ),
    );
    expect(written).toEqual({
      action: 'add',
      file: 'Sunday',
      title: 'Prayer',
      text: 'Remember',
      domain: 'note',
    });
  });

  it('writes a note when no window can be listed, and reports a dead app', async () => {
    app.requireLivePort.mockRejectedValue(new Error('No app'));
    state.answer = () => ({ value: { added: true } });
    answer(await call('owa_bible_note', { action: 'add', text: 'x' }));
    state.answer = () => {
      throw new Error('No app');
    };
    expect(refusal(await call('owa_bible_note', { action: 'list' }))).toBe(
      'No app',
    );
  });
});

describe('the Bible reading tools', () => {
  const readTimeout = (expression) => {
    return Number(
      /\}, (\d+)\);\s*document\.addEventListener\('owa-agent-data-answer'/.exec(
        expression,
      )?.[1],
    );
  };

  it('searches, reads and suggests with the long waits they need', async () => {
    state.answer = (expression) => ({
      value: { echo: readRequest(expression) },
    });
    const cases = [
      [
        'owa_find_verse',
        { bible: 'KJV', words: 'love enemies', page: 'reader.html' },
        { bible: 'KJV', words: 'love enemies', domain: 'bible-find' },
        120000,
        { match: 'reader.html', timeout: 125000 },
      ],
      [
        'owa_lookup_record',
        { kind: 'name', name: 'Noah', lang: 'km' },
        { kind: 'name', name: 'Noah', lang: 'km', domain: 'lookup' },
        60000,
        { match: undefined, timeout: 65000 },
      ],
      [
        'owa_bible_suggest',
        { kind: 'reference', prefix: 'Jo', limit: 5 },
        { kind: 'reference', prefix: 'Jo', limit: 5, domain: 'bible-suggest' },
        60000,
        { match: undefined, timeout: 65000 },
      ],
    ];
    for (const [name, args, request, pageWait, options] of cases) {
      app.evaluateInApp.mockClear();
      expect(JSON.parse(answer(await call(name, args))).echo, name).toEqual(
        request,
      );
      const [expression, sentOptions] = appCalls()[0];
      expect(readTimeout(expression), name).toBe(pageWait);
      expect(sentOptions, name).toEqual(options);
    }
  });

  it('passes on what the app refused and what failed', async () => {
    for (const name of [
      'owa_find_verse',
      'owa_lookup_record',
      'owa_bible_suggest',
    ]) {
      state.answer = () => ({
        value: { isError: true, reason: 'Genesis 3 has 24 verses.' },
      });
      expect(refusal(await call(name, { kind: 'verse' })), name).toBe(
        'Genesis 3 has 24 verses.',
      );
      state.answer = () => {
        throw new Error('No Bible is installed.');
      };
      expect(refusal(await call(name, { kind: 'verse' })), name).toBe(
        'No Bible is installed.',
      );
    }
  });
});

describe('owa_resource_file', () => {
  it('answers a PDF read as words, then its pages as pictures', async () => {
    state.answer = () => ({
      value: {
        file: 'pdf/LUK.6.pdf',
        nextPage: 9,
        images: [
          'data:image/png;base64,UEFHRTE=',
          'not a picture',
          'data:image/jpeg;base64,UEFHRTI=',
        ],
      },
    });
    const result = await call('owa_resource_file', {
      action: 'read',
      file: 'LUK.6.pdf',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ file: 'pdf/LUK.6.pdf', nextPage: 9 }),
      },
      { type: 'image', mimeType: 'image/png', data: 'UEFHRTE=' },
      { type: 'image', mimeType: 'image/jpeg', data: 'UEFHRTI=' },
    ]);
    const [expression, options] = appCalls()[0];
    expect(readRequest(expression)).toEqual({
      action: 'read',
      file: 'LUK.6.pdf',
      domain: 'resources',
    });
    expect(options).toEqual({ timeout: 65000 });
  });

  it('answers a list as words alone, and a refusal as an error', async () => {
    state.answer = () => ({ value: { files: ['pdf/JHN.3.pdf'] } });
    const listed = await call('owa_resource_file', {
      action: 'list',
      ref: 'John 3',
    });
    expect(listed.content).toEqual([
      { type: 'text', text: JSON.stringify({ files: ['pdf/JHN.3.pdf'] }) },
    ]);
    state.answer = () => ({
      value: { isError: true, reason: 'No such file in Resources.' },
    });
    expect(
      refusal(await call('owa_resource_file', { action: 'read', file: 'x' })),
    ).toBe('No such file in Resources.');
    state.answer = () => {
      throw new Error('MuPDF failed');
    };
    expect(
      refusal(await call('owa_resource_file', { action: 'read', file: 'x' })),
    ).toBe('MuPDF failed');
  });
});

describe('owa_pick_element', () => {
  it('waits for the person to point, then takes the picker down', async () => {
    useClock(['Date', 'setTimeout']);
    const reads = [
      { phase: 'picking' },
      { phase: 'picked', result: { label: 'Clear Slide', selector: '#a' } },
    ];
    state.answer = (expression) => {
      return expression === genPickerReadExpression()
        ? { value: reads.shift() }
        : { value: true };
    };
    const pending = call('owa_pick_element', { timeoutSeconds: 30 });
    await vi.advanceTimersByTimeAsync(300);
    expect(JSON.parse(answer(await pending))).toEqual({
      picked: true,
      element: { label: 'Clear Slide', selector: '#a' },
    });
    const sent = appCalls().map(([expression]) => expression);
    expect(sent[0]).toBe(genPickerStartExpression(PICKER_HINT_TEMPLATE));
    expect(sent.slice(1, 3)).toEqual([
      genPickerReadExpression(),
      genPickerReadExpression(),
    ]);
    expect(sent[3]).toBe(genPickerStopExpression());
  });

  it('says nothing was pointed at when the person pressed Escape', async () => {
    state.lang = 'km';
    state.answer = (expression) => {
      if (expression === genPickerStopExpression()) {
        throw new Error('The window went away.');
      }
      return expression === genPickerReadExpression()
        ? { value: { phase: 'cancelled' } }
        : { value: true };
    };
    expect(
      JSON.parse(
        answer(await call('owa_pick_element', { page: 'km-pick.html' })),
      ),
    ).toEqual({ picked: false, reason: 'Nothing was pointed at.' });
    // Its line is in the window's language.
    const khmerHint = tranText(PICKER_HINT_TEMPLATE, 'km');
    expect(khmerHint).not.toBe(PICKER_HINT_TEMPLATE);
    expect(appCalls()[0]).toEqual([
      genPickerStartExpression(khmerHint),
      { match: 'km-pick.html' },
    ]);
  });

  it('gives up when nothing was picked in time', async () => {
    useClock(['Date', 'setTimeout']);
    state.answer = (expression) => {
      return expression === genPickerReadExpression()
        ? { value: { phase: 'picking' } }
        : { value: true };
    };
    const pending = call('owa_pick_element', { timeoutSeconds: 1 });
    await vi.advanceTimersByTimeAsync(1600);
    expect(JSON.parse(answer(await pending))).toEqual({
      picked: false,
      reason: 'Nothing was picked in time.',
    });
    expect(appCalls().at(-1)[0]).toBe(genPickerStopExpression());
  });
});

it('owa_highlight_selector rings exactly the selector it was given', async () => {
  state.answer = () => ({ value: { found: true } });
  expect(
    JSON.parse(
      answer(
        await call('owa_highlight_selector', {
          selector: '[data-widget-name="Bibles"]',
          page: 'reader.html',
        }),
      ),
    ),
  ).toEqual({ found: true });
  expect(appCalls()[0]).toEqual([
    genHighlightSelectorExpression('[data-widget-name="Bibles"]', true),
    { match: 'reader.html' },
  ]);
});

describe('owa_goto_page', () => {
  it('waits for the window to arrive when the page left before answering', async () => {
    useClock(['Date', 'setTimeout']);
    state.answer = () => {
      throw new Error('Execution context was destroyed.');
    };
    app.listTargets
      .mockResolvedValueOnce([{ url: 'http://localhost/presenter.html' }])
      .mockResolvedValueOnce([{ url: 'http://localhost/reader.html' }]);
    const pending = call('owa_goto_page', { page: 'reader.html' });
    await vi.advanceTimersByTimeAsync(500);
    expect(JSON.parse(answer(await pending))).toEqual({
      page: 'reader.html',
      switched: true,
      from: null,
    });
    expect(app.listTargets).toHaveBeenCalledTimes(2);
  });

  it('says so when the window never got there', async () => {
    useClock(['Date', 'setTimeout']);
    state.answer = () => ({
      value: { switching: true, from: 'presenter.html' },
    });
    const pending = call('owa_goto_page', { page: 'reader.html' });
    await vi.advanceTimersByTimeAsync(9000);
    expect(refusal(await pending)).toBe(
      'Asked the window to switch to "reader.html" but it is not there yet ' +
        '-- check owa_app_state and try again.',
    );
  });
});

describe('a press the page refused', () => {
  const destructive = { refused: 'destructive', label: 'Move to Trash' };
  const question = { refused: 'question', label: 'Yes' };

  it('is said the way the firewall says it, and logged beside its refusals', async () => {
    const cases = [
      ['owa_click', { find: 'Move to Trash' }, destructive],
      ['owa_type', { find: 'Name', value: 'x' }, question],
      ['owa_press_key', { keys: 'Enter', find: 'Move to Trash' }, destructive],
      ['owa_drag', { from: 'Song', to: 'Trash' }, destructive],
    ];
    for (const [name, args, refused] of cases) {
      state.answer = () => ({ value: refused });
      expect(refusal(await call(name, args)), name).toBe(
        genPressRefusalReason(refused),
      );
    }
    expect(genPressRefusalReason(destructive)).toBe(
      genDestructiveReason('Move to Trash'),
    );
    expect(
      getFirewallLog()
        .slice(-4)
        .map(({ name, rule, isAllowed }) => {
          return { name, rule, isAllowed };
        }),
    ).toEqual([
      { name: 'owa_click', rule: 'destructive-press', isAllowed: false },
      { name: 'owa_type', rule: 'question-press', isAllowed: false },
      { name: 'owa_press_key', rule: 'destructive-press', isAllowed: false },
      { name: 'owa_drag', rule: 'destructive-press', isAllowed: false },
    ]);
  });

  it('is said for the card when the walkthrough was told to do it', async () => {
    const lastResult = { refused: 'destructive', label: 'Clear All [F6]' };
    state.answer = () => ({ value: { currentStep: 2, lastResult } });
    const text = refusal(await call('owa_guide_step', { action: 'do' }));
    expect(text).toBe(genPressRefusalReason(lastResult, { isGuide: true }));
    expect(text).toContain('The walkthrough card is already ringing it');
    expect(readGuideCall(appCalls()[0][0])).toBe('act()');
    expect(getFirewallLog().at(-1).name).toBe('owa_guide_step');

    // Only a press is a refusal: moving on past it is not.
    expect(
      JSON.parse(answer(await call('owa_guide_step', { action: 'next' }))),
    ).toEqual({ currentStep: 2, lastResult });
  });
});

describe('owa_drop_files', () => {
  let dirPath = '';
  let filePath = '';

  beforeAll(() => {
    dirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-drop-'));
    filePath = path.join(dirPath, 'song.owl');
    writeFileSync(filePath, 'x');
  });

  afterAll(() => {
    rmSync(dirPath, { recursive: true, force: true });
  });

  it('needs a control to drop on', async () => {
    expect(
      refusal(await call('owa_drop_files', { paths: [filePath], to: '' })),
    ).toBe('Pass the label of the control to drop on.');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('refuses a drop onto a control that cannot be undone', async () => {
    const refused = { refused: 'destructive', label: 'Trash' };
    state.answer = () => ({ target: { id: 'T' }, value: refused });
    expect(
      refusal(await call('owa_drop_files', { paths: [filePath], to: 'Trash' })),
    ).toBe(genPressRefusalReason(refused));
    expect(getFirewallLog().at(-1).name).toBe('owa_drop_files');
    expect(app.runInTarget).not.toHaveBeenCalled();
  });

  it('answers the aim when no control was found to drop on', async () => {
    state.answer = () => ({
      target: { id: 'T' },
      value: { found: false, nearMisses: ['Document List'] },
    });
    expect(
      JSON.parse(
        answer(
          await call('owa_drop_files', { paths: [filePath], to: 'Documents' }),
        ),
      ),
    ).toEqual({ found: false, nearMisses: ['Document List'] });
    expect(app.runInTarget).not.toHaveBeenCalled();
  });

  it('drops the real files as one gesture and reads what took them', async () => {
    const target = { id: 'T', url: 'http://localhost/presenter.html' };
    state.answer = () => ({
      target,
      value: { point: { x: 40, y: 60 }, onto: 'Document List' },
    });
    app.runInTarget.mockResolvedValue([]);
    app.evaluateInTarget.mockResolvedValueOnce({
      accepted: true,
      dropped: false,
      landedOn: 'Document List',
    });
    const result = JSON.parse(
      answer(
        await call('owa_drop_files', {
          paths: [filePath],
          to: ['Document List'],
        }),
      ),
    );
    expect(result).toEqual({
      files: ['song.owl'],
      onto: 'Document List',
      accepted: true,
      dropped: false,
      landedOn: 'Document List',
      unverified:
        'Nothing there took the drop. Check the list the files were meant ' +
        'for before saying it worked.',
    });
    const [sentTarget, steps] = app.runInTarget.mock.calls[0];
    expect(sentTarget).toBe(target);
    expect(steps.map((step) => step.waitMs ?? step.params.type)).toEqual([
      'dragEnter',
      'dragOver',
      500,
      'dragOver',
      300,
      'drop',
    ]);
    expect(steps[0].params).toEqual({
      type: 'dragEnter',
      x: 40,
      y: 60,
      data: {
        items: [],
        files: [realpathSync(filePath)],
        dragOperationsMask: 1,
      },
    });
    expect(app.evaluateInTarget.mock.calls[0][0]).toBe(target);

    app.evaluateInTarget.mockResolvedValueOnce({
      accepted: true,
      dropped: true,
      landedOn: 'Document List',
    });
    const dropped = JSON.parse(
      answer(
        await call('owa_drop_files', {
          paths: [filePath],
          to: 'Document List',
        }),
      ),
    );
    expect(dropped.dropped).toBe(true);
    expect(dropped).not.toHaveProperty('unverified');
  });
});

it('owa_menu turns a failed press into an error result', async () => {
  state.answer = () => {
    throw new Error('This window has node integration switched off.');
  };
  expect(
    refusal(await call('owa_menu', { action: 'click', item: 'View > Reload' })),
  ).toBe('This window has node integration switched off.');
});

// A recipe as `readHelpPage` hands it out: resolved for a model, or with its
// `[en:tran:…]` templates kept for the card to put into the window's language.
const PAGES = {
  'W-77': {
    title: 'Cast a virtual display',
    body: [
      '# W-77 — Cast a virtual display',
      '',
      '1. Press **Mini Screen Options** to open its menu.',
      '2. Choose **Virtual Screens** in the menu.',
      '3. Press **Add Virtual Display** beside **Virtual Screens Manager**.',
      '4. Press **Cast to a TV** on the new card.',
    ].join('\n'),
  },
  'W-78': {
    title: 'Play a background video',
    body: [
      '1. Open the **[en:tran:Background]** panel and press **[en:tran:Zoom In]**.',
      '2. Double-click a clip to play it.',
    ].join('\n'),
  },
  'W-79': {
    title: 'Find a passage',
    body: [
      '1. Press **[en:tran:Bible Lookup]** to open it.',
      '2. Type the passage, see W-06.',
    ].join('\n'),
  },
  'W-80': {
    title: 'Choose the data folder',
    body: [
      '1. Open **Settings** with the gear at the top right.',
      '2. Press **Path Settings** to see the data folder.',
    ].join('\n'),
  },
};
const TRANSLATED_PAGES = {
  'W-79@km': {
    lang: 'km',
    title: 'រកវគ្គបទគម្ពីរ',
    body: [
      '1. ចុច **[en:tran:Bible Lookup]** ដើម្បីបើក។',
      '2. វាយវគ្គបទគម្ពីរ។',
    ].join('\n'),
  },
};

function fakeHelpPages() {
  app.readHelpPage.mockImplementation((id, langCode, _part, options = {}) => {
    if (TRANSLATED_PAGES[id] !== undefined) {
      return TRANSLATED_PAGES[id];
    }
    const page = PAGES[id.split('@')[0]];
    if (page === undefined) {
      return null;
    }
    return {
      kind: 'manual',
      title: page.title,
      body: options.keepTemplates
        ? page.body
        : resolveTranTemplates(page.body, langCode ?? 'en'),
    };
  });
}

function fakeGuideWindow({ pathname = '/presenter.html', starts = [] } = {}) {
  state.answer = (expression) => {
    if (expression === 'location.pathname') {
      return { value: pathname };
    }
    if (readStartPayload(expression) !== null) {
      return {
        value: starts.shift() ?? { currentStep: 1, isTargetFound: true },
      };
    }
    return { value: null };
  };
}

describe('owa_guide_start from a recipe', () => {
  beforeEach(() => {
    fakeHelpPages();
  });

  it('starts at the step a topic names, and walks the way there when its control is not up', async () => {
    fakeGuideWindow({ starts: [{ currentStep: 1, isTargetFound: false }] });
    answer(
      await call('owa_guide_start', {
        manualId: 'W-77',
        topic: 'cast to a TV',
        page: 'presenter.html',
      }),
    );
    const [only, path] = startCalls();
    expect(only.payload.steps.map((step) => step.text)).toEqual([
      'Press Cast to a TV on the new card.',
    ]);
    expect(path.payload.steps).toHaveLength(4);
    expect(path.payload.steps[0].finds).toEqual(['Mini Screen Options']);
    expect(path.options).toEqual({ match: 'presenter.html' });
    expect(only.payload.mode).toBe('show');
    expect(only.payload.title).toBe('Cast a virtual display');
  });

  it('starts the one step when the control a topic names is already up', async () => {
    fakeGuideWindow({ starts: [{ currentStep: 1, isTargetFound: true }] });
    answer(
      await call('owa_guide_start', {
        manualId: 'W-77',
        topic: 'cast to a TV',
      }),
    );
    expect(startCalls()).toHaveLength(1);
  });

  it('puts the control a question is about first, on the step that names it', async () => {
    fakeGuideWindow({ starts: [{ currentStep: 1, isTargetFound: false }] });
    answer(
      await call('owa_guide_start', {
        manualId: 'W-77',
        find: ' Virtual Screens Manager ',
      }),
    );
    const [only, path] = startCalls();
    expect(only.payload.steps).toHaveLength(1);
    expect(only.payload.steps[0].finds).toEqual([
      'Virtual Screens Manager',
      'Add Virtual Display',
    ]);
    expect(path.payload.steps.map((step) => step.finds)).toEqual([
      ['Mini Screen Options'],
      ['Virtual Screens'],
      ['Virtual Screens Manager', 'Add Virtual Display'],
    ]);
  });

  it('finds the step by its words when no control of it is named so', async () => {
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', { manualId: 'W-77', find: 'the new card' }),
    );
    const [only] = startCalls();
    expect(only.payload.steps.map((step) => step.finds)).toEqual([
      ['the new card', 'Cast to a TV'],
    ]);
  });

  it('walks a Settings recipe in the Settings window, past the step already done', async () => {
    fakeGuideWindow({ pathname: '/setting.html' });
    answer(
      await call('owa_guide_start', {
        manualId: 'W-80',
        page: 'presenter.html',
      }),
    );
    const [only] = startCalls();
    expect(only.options).toEqual({ match: 'setting.html' });
    expect(only.payload.steps.map((step) => step.text)).toEqual([
      'Press Path Settings to see the data folder.',
    ]);
  });

  it('reads a Khmer window its own translation of the steps and the title', async () => {
    state.lang = 'km';
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', { manualId: 'W-79', page: 'km-g1.html' }),
    );
    const [only] = startCalls();
    const khmer = tranText('Bible Lookup', 'km');
    expect(only.payload.title).toBe('រកវគ្គបទគម្ពីរ');
    expect(only.payload.steps[0].text).toBe(`ចុច ${khmer} ដើម្បីបើក។`);
    expect(only.payload.steps[0].finds).toEqual([khmer, 'Bible Lookup']);
    expect(only.payload.steps[1].text).toBe('វាយវគ្គបទគម្ពីរ។');
    // The card's own words, in the window's language.
    const labels = {};
    for (const [slot, key] of Object.entries(GUIDE_CARD_LABEL_KEY_MAP)) {
      if (tranText(key, 'km') !== key) {
        labels[slot] = tranText(key, 'km');
      }
    }
    expect(labels.next).toBeDefined();
    expect(only.payload.labels).toEqual(labels);
    const template = GUIDE_CARD_HINT_TEMPLATE_LIST[0];
    expect(only.payload.words[template]).toBe(tranText(template, 'km'));
  });

  it('puts the button names of an untranslated page into the window language', async () => {
    state.lang = 'km';
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', { manualId: 'W-78', page: 'km-g2.html' }),
    );
    const [only] = startCalls();
    const background = tranText('Background', 'km');
    const zoom = tranText('Zoom In', 'km');
    // Not a dictionary key as a whole, so each half is translated.
    expect(tranText('Background > Zoom In', 'km')).toBe('Background > Zoom In');
    expect(only.payload.title).toBe('Play a background video');
    expect(only.payload.steps.map((step) => step.text)).toEqual([
      `Open the ${background} panel and press ${zoom}.`,
      'Double-click a clip to play it.',
    ]);
    // The window's words first; the panel keeps its English name beside the
    // translated control; each English label comes after its translation.
    expect(only.payload.steps[0].finds).toEqual([
      `${background} > ${zoom}`,
      `Background > ${zoom}`,
      'Background > Zoom In',
      tranText('Background panel', 'km'),
      'Background panel',
      background,
      'Background',
      zoom,
      'Zoom In',
    ]);
  });

  it('refuses what it cannot walk', async () => {
    fakeGuideWindow();
    expect(refusal(await call('owa_guide_start', { manualId: 'W-00' }))).toBe(
      'No knowledge document "W-00"',
    );
    expect(
      refusal(
        await call('owa_guide_start', { manualId: 'W-77', mode: 'demo' }),
      ),
    ).toContain('A recipe can point but cannot safely do the task.');
    expect(refusal(await call('owa_guide_start', { steps: [] }))).toContain(
      'Nothing to guide',
    );
    expect(
      refusal(await call('owa_guide_start', { demoId: 'no-such-demo' })),
    ).toBe('Unknown built-in demo "no-such-demo".');
    expect(startCalls()).toEqual([]);
  });

  it('never rings a recipe id a step cites', async () => {
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', {
        title: 'See W-06',
        steps: [{ text: 'Open Lookup (see W-06).', find: 'Bible Lookup' }],
      }),
    );
    const [only] = startCalls();
    expect(only.payload.title).not.toContain('W-06');
    expect(only.payload.steps[0].text).not.toContain('W-06');
  });
});

describe('owa_guide_start with a built-in lesson', () => {
  it('skips the opening step when its panel is already up', async () => {
    state.answer = (expression) => {
      if (expression === 'location.pathname') {
        return { value: '/presenter.html' };
      }
      if (readFindText(expression) === 'Bible Reference') {
        return { value: { matches: [{ isVisible: true }] } };
      }
      return { value: { currentStep: 1, isTargetFound: true } };
    };
    answer(
      await call('owa_guide_start', { demoId: 'presenter-lookup-reference' }),
    );
    const [only] = startCalls();
    expect(only.options).toEqual({ match: 'presenter.html' });
    expect(only.payload.mode).toBe('demo');
    expect(only.payload.title).toBe(
      'Type a complete reference in Bible Lookup',
    );
    expect(only.payload.steps).toHaveLength(2);
    expect(only.payload.steps[0].text).toMatch(/^Check the Bible version/);
  });

  it('keeps it, without the skip rule, when the panel is shut', async () => {
    state.answer = (expression) => {
      if (expression === 'location.pathname') {
        return { value: '/presenter.html' };
      }
      if (readFindText(expression) !== null) {
        return { value: { matches: [{ isVisible: false }] } };
      }
      return { value: { currentStep: 1 } };
    };
    answer(
      await call('owa_guide_start', { demoId: 'presenter-lookup-reference' }),
    );
    const [only] = startCalls();
    expect(only.payload.steps).toHaveLength(3);
    expect(only.payload.steps[0].finds).toEqual(['Bible Lookup']);
    expect(only.payload.steps[0]).not.toHaveProperty('skipIfVisible');
  });

  it('looks for the panel under its Khmer name too', async () => {
    state.lang = 'km';
    const khmerReference = tranText('Bible Reference', 'km');
    expect(khmerReference).not.toBe('Bible Reference');
    const looked = [];
    state.answer = (expression) => {
      if (expression === 'location.pathname') {
        return { value: '/presenter.html' };
      }
      const asked = readFindText(expression);
      if (asked !== null) {
        looked.push(asked);
        return {
          value: { matches: [{ isVisible: asked === khmerReference }] },
        };
      }
      return { value: { currentStep: 1 } };
    };
    answer(
      await call('owa_guide_start', {
        demoId: 'presenter-lookup-reference',
        page: 'presenter.html',
      }),
    );
    expect(looked).toEqual(['Bible Reference', khmerReference]);
    const [only] = startCalls();
    expect(only.payload.steps).toHaveLength(2);
    expect(only.payload.title).toBe(
      tranText('Type a complete reference in Bible Lookup', 'km'),
    );
  });
});

it('the walkthrough card title defaults to the window language', async () => {
  state.lang = 'km';
  fakeGuideWindow();
  answer(
    await call('owa_guide_start', {
      steps: [{ text: 'Press Next.', find: 'Next' }],
      page: 'km-g3.html',
    }),
  );
  expect(startCalls()[0].payload.title).toBe(
    tranText(GUIDE_CARD_TITLE_KEY, 'km'),
  );
});
