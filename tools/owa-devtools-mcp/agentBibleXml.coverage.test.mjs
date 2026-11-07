// What `agentBibleXml.test.mjs` leaves out of `owa_bible_xml`: each page the
// name search reads paid for out of the network budget (and refused when it
// is spent), a locale said in full, ranking that falls back to the order
// given, the KJV note when the installed list cannot be read, and every way
// an import, an update or an unknown action fails.
//
// The app, the downloads and the firewall are all stand-ins here; the book
// name and digit rules are the real ones.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
  state: {
    handler: null,
    worker: null,
    downloaded: null,
    meta: null,
    lists: new Map(),
    installed: [],
    names: null,
    requests: [],
  },
  mocks: {
    evaluate: vi.fn(),
    evaluateTarget: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    writeMeta: vi.fn(),
    readMeta: vi.fn(),
    remember: vi.fn(),
    findList: vi.fn(),
    findNames: vi.fn(),
    firewall: vi.fn(),
  },
}));

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: mocks.evaluate,
  evaluateInTarget: mocks.evaluateTarget,
}));
vi.mock('./firewall.mjs', () => ({ checkToolCall: mocks.firewall }));
vi.mock('./website.mjs', () => ({
  WEBSITE_READ_EVALUATE_TIMEOUT: 35000,
  genReadWebPageExpression: (options) => JSON.stringify(options),
}));
vi.mock('./agentData.mjs', () => ({
  AGENT_UNDO_TEXT: 'Use Undo to restore it.',
  genAgentDataExpression: (_kind, request) => JSON.stringify(request),
}));
vi.mock('./help.mjs', () => ({
  findKnowledgeDirPath: () => '/missing-bundle',
}));
vi.mock('./bibleBookNames.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  findBibleBookNames: mocks.findNames,
}));
vi.mock('./bibleXmlDraft.mjs', () => ({
  BibleXmlProblem: class BibleXmlProblem extends Error {
    constructor(problem, message) {
      super(message);
      this.problem = problem;
    }
  },
  downloadBibleXml: mocks.download,
  findBibleNameList: mocks.findList,
  readBibleDraftMeta: mocks.readMeta,
  rememberBibleNameLists: mocks.remember,
  removeBibleDraft: mocks.remove,
  toBibleDraftPaths: (id) => ({ xmlPath: `/drafts/${id}.xml` }),
  writeBibleDraftMeta: mocks.writeMeta,
}));

import { BibleXmlProblem } from './bibleXmlDraft.mjs';
import { registerBibleXmlTool } from './agentBibleXml.mjs';

const DRAFT_ID = 'abcdefghijkl';
const BIBLE_URL = 'https://example.test/KhmerBible.xml';
const ASCII_DIGITS = '0 1 2 3 4 5 6 7 8 9';

function value(result) {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text);
}

function toError(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}

async function call(args) {
  return await state.handler(args);
}

function analysis() {
  return {
    title: 'Khmer Test Bible',
    books: 66,
    chapters: 1189,
    verses: 31102,
    missingBooks: [],
    keys: ['KHM'],
    takenKeys: [],
    locales: [{ locale: 'km-KH', why: 'the verses are Khmer' }],
    recommendedLocale: 'km-KH',
    nameLists: [
      { label: 'Khmer names', source: 'built in', names: ['A', 'B'] },
      { label: 'The names in the file', source: 'file', names: ['C', 'D'] },
    ],
  };
}

function genNamesResult(locale) {
  return {
    locale,
    bookNames: [
      ['Genesis', 'Exodus'],
      ['First Book', 'Second Book'],
    ],
    sources: [
      { label: 'English', url: null },
      { label: 'Khmer', url: 'https://names.example/km' },
    ],
    warnings: [],
    moreAvailable: false,
  };
}

/** The worker as the app runs it: one answer per action. */
function genWorker(overrides = {}) {
  return (request) => {
    if (Object.hasOwn(overrides, request.action)) {
      return overrides[request.action](request);
    }
    if (request.action === 'analyze') return analysis();
    if (request.action === 'list') {
      return { bibles: state.installed, downloaded: [] };
    }
    if (request.action === 'import') return { installed: request.key };
    if (request.action === 'update') return { changed: ['title'] };
    return {};
  };
}

beforeEach(() => {
  state.handler = null;
  state.requests = [];
  state.lists.clear();
  state.installed = [];
  state.names = genNamesResult('km-KH');
  state.downloaded = {
    kind: 'xml',
    draftId: DRAFT_ID,
    xmlPath: `/drafts/${DRAFT_ID}.xml`,
    fileName: 'KhmerBible.xml',
    source: BIBLE_URL,
    finalUrl: BIBLE_URL,
    bytes: 1048576,
  };
  state.meta = {
    fileName: 'KhmerBible.xml',
    recommended: { locale: 'km-KH', digits: 'local', bookNames: 'n0' },
    fileListId: 'n1',
  };
  state.worker = genWorker();
  mocks.evaluate.mockImplementation(async (expression) => {
    if (expression === 'true') return { target: { id: 'page' } };
    const request = JSON.parse(expression);
    state.requests.push(request);
    return { value: state.worker(request) };
  });
  mocks.evaluateTarget.mockResolvedValue({ bibleCatalog: { versions: [] } });
  mocks.download.mockImplementation(async () => state.downloaded);
  mocks.remove.mockResolvedValue(undefined);
  mocks.writeMeta.mockResolvedValue(undefined);
  mocks.readMeta.mockImplementation(async () => state.meta);
  mocks.remember.mockImplementation(async (lists) =>
    lists.map((list, index) => {
      const named = { ...list, id: `n${index}` };
      state.lists.set(named.id, named);
      return named;
    }),
  );
  mocks.findList.mockImplementation(async (id) => state.lists.get(id) ?? null);
  mocks.findNames.mockImplementation(async () => state.names);
  mocks.firewall.mockReturnValue({ isAllowed: true });
  registerBibleXmlTool({
    registerTool: (name, _options, handler) => {
      expect(name).toBe('owa_bible_xml');
      state.handler = handler;
    },
  });
});

describe('finding book names', () => {
  test('each page the search reads is charged to the network budget first', async () => {
    mocks.findNames.mockImplementation(async (_locale, { readPage }) => {
      state.read = await readPage('https://www.bible.com/languages/khm');
      return state.names;
    });
    await call({ action: 'names', locale: 'km-KH' });
    expect(mocks.firewall).toHaveBeenCalledWith('owa_read_website', {
      url: 'https://www.bible.com/languages/khm',
    });
    expect(mocks.evaluate).toHaveBeenCalledWith('true', { match: undefined });
    expect(mocks.evaluateTarget).toHaveBeenCalledWith(
      { id: 'page' },
      JSON.stringify({
        url: 'https://www.bible.com/languages/khm',
        bibleCatalog: true,
        maxChars: 200,
      }),
      35000,
    );
    expect(state.read).toEqual({ bibleCatalog: { versions: [] } });
  });

  test('a read the budget refuses ends the search in the budget’s own words', async () => {
    mocks.firewall.mockReturnValue({
      isAllowed: false,
      reason: 'Ten pages were read in five minutes; wait before reading more.',
    });
    mocks.findNames.mockImplementation(async (_locale, { readPage }) => {
      await readPage('https://www.bible.com/languages/khm');
      return state.names;
    });
    expect(await call({ action: 'names', locale: 'km-KH' })).toEqual(
      toError('Ten pages were read in five minutes; wait before reading more.'),
    );
    expect(mocks.evaluateTarget).not.toHaveBeenCalled();
  });

  // A language that writes its digits as ASCII is offered those alone; the
  // language-with-its-own-digits case is in each package's tests.
  test('with a key and no draft, the lists keep their order and the locale is said in full', async () => {
    state.names = genNamesResult('en');
    const result = value(
      await call({ action: 'names', locale: 'en', key: 'KHM' }),
    );
    expect(result.locale).toBe('en-US');
    expect(result.digits).toStrictEqual({ ascii: ASCII_DIGITS });
    expect(
      result.nameLists.map((one) => {
        return [one.label, one.matches];
      }),
    ).toEqual([
      ['English', undefined],
      ['Khmer', undefined],
    ]);
    // Nothing to score against, so the app was not asked.
    expect(state.requests).toEqual([]);
  });

  test('a locale with no region to give it, or none at all, is kept as written', async () => {
    state.names = genNamesResult('zz');
    expect(
      value(await call({ action: 'names', locale: 'km', key: 'K' })).locale,
    ).toBe('zz');
    state.names = genNamesResult('');
    expect(
      value(await call({ action: 'names', locale: 'km', key: 'K' })).locale,
    ).toBe('');
  });

  test('ranking against a draft falls back to the order given when the app cannot score', async () => {
    state.worker = genWorker({ score: () => ({}) });
    const unscored = value(
      await call({ action: 'names', locale: 'km-KH', draftId: DRAFT_ID }),
    );
    expect(unscored.nameLists.map((one) => one.label)).toEqual([
      'English',
      'Khmer',
    ]);
    expect(unscored.nameLists.some((one) => 'matches' in one)).toBe(false);
    mocks.evaluate.mockImplementation(async () => {
      throw new Error('The app did not answer.');
    });
    const failed = value(
      await call({ action: 'names', locale: 'km-KH', draftId: DRAFT_ID }),
    );
    expect(failed.nameLists.map((one) => one.label)).toEqual([
      'English',
      'Khmer',
    ]);
  });
});

describe('checking a link', () => {
  test('an error that is not about the link is the tool’s own error', async () => {
    mocks.download.mockRejectedValue(new Error('EACCES: permission denied'));
    expect(await call({ action: 'check', url: BIBLE_URL })).toEqual(
      toError('EACCES: permission denied'),
    );
  });

  test('a page with no Bible files on it is answered as it is, without the app', async () => {
    state.downloaded = {
      kind: 'page',
      source: 'https://example.test/page',
      total: 3,
      matched: 0,
      files: [],
      note: 'None of the 3 files is named with those words.',
    };
    expect(
      value(await call({ action: 'check', url: 'https://example.test/page' })),
    ).toEqual(state.downloaded);
    expect(state.requests).toEqual([]);
  });

  test('a file the app could not read through is not kept', async () => {
    mocks.evaluate.mockImplementation(async (expression, options) => {
      const request = JSON.parse(expression);
      state.requests.push({ ...request, timeout: options.timeout });
      throw new Error('Timed out evaluating in presenter.html');
    });
    expect(await call({ action: 'check', url: BIBLE_URL })).toEqual(
      toError('Timed out evaluating in presenter.html'),
    );
    // A whole Bible is given three minutes, plus the relay's own margin.
    expect(state.requests).toEqual([
      {
        action: 'analyze',
        xmlPath: `/drafts/${DRAFT_ID}.xml`,
        sourceName: 'KhmerBible.xml',
        timeout: 185000,
      },
    ]);
    expect(mocks.remove).toHaveBeenCalledWith(DRAFT_ID);
    expect(mocks.writeMeta).not.toHaveBeenCalled();
  });

  test('the missing KJV is spoken of only when the installed list could be read', async () => {
    const KJV_NOTE = "The app's OWN KJV is not installed";
    // The app away: no claim either way, rather than "it is missing".
    state.worker = genWorker({ list: () => null });
    const unknown = value(await call({ action: 'check', url: BIBLE_URL }));
    expect('hasKjv' in unknown).toBe(false);
    expect(unknown.note).not.toContain(KJV_NOTE);
    state.worker = genWorker();
    state.installed = [{ key: 'KHM-OLD', title: 'Another Bible' }];
    const missing = value(await call({ action: 'check', url: BIBLE_URL }));
    expect(missing.hasKjv).toBe(false);
    expect(missing.note).toContain(KJV_NOTE);
    state.installed = [{ key: 'kjv', title: 'King James Version' }];
    const present = value(await call({ action: 'check', url: BIBLE_URL }));
    expect(present.hasKjv).toBe(true);
    expect(present.note).not.toContain(KJV_NOTE);
  });
});

describe('importing a draft', () => {
  test('a draft that is gone is the answer about it; any other failure is an error', async () => {
    mocks.readMeta.mockRejectedValueOnce(
      new BibleXmlProblem('draft-gone', 'That download is no longer there.'),
    );
    expect(
      value(await call({ action: 'import', draftId: DRAFT_ID, key: 'KHM' })),
    ).toEqual({
      problem: 'draft-gone',
      message: 'That download is no longer there.',
    });
    mocks.readMeta.mockRejectedValueOnce(new Error('EBUSY: resource busy'));
    expect(
      await call({ action: 'import', draftId: DRAFT_ID, key: 'KHM' }),
    ).toEqual(toError('EBUSY: resource busy'));
    expect(state.requests).toEqual([]);
  });

  test('with no language worked out and none given, the person is asked', async () => {
    state.meta = {
      ...state.meta,
      recommended: { ...state.meta.recommended, locale: null },
    };
    expect(
      value(await call({ action: 'import', draftId: DRAFT_ID, key: 'KHM' })),
    ).toEqual({
      problem: 'locale',
      message:
        'The language could not be worked out. Ask the user which language ' +
        'this Bible is in.',
    });
    expect(state.requests).toEqual([]);
  });

  test('the app refusing an import is said, and the draft is kept for another try', async () => {
    state.lists.set('n0', { names: ['Genesis', 'Exodus'] });
    state.worker = genWorker({
      import: () => ({
        isError: true,
        problem: 'key',
        reason: 'KHM is already a Bible here.',
      }),
    });
    expect(
      value(await call({ action: 'import', draftId: DRAFT_ID, key: 'KHM' })),
    ).toEqual({ problem: 'key', message: 'KHM is already a Bible here.' });
    state.worker = genWorker({
      import: () => ({ isError: true, reason: 'Could not write the Bible.' }),
    });
    expect(
      await call({ action: 'import', draftId: DRAFT_ID, key: 'KHM' }),
    ).toEqual(toError('Could not write the Bible.'));
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe('changing an installed Bible', () => {
  test('a blank book-name list id changes no book names', async () => {
    await call({
      action: 'update',
      key: 'KHM',
      title: 'A new title',
      bookNames: '   ',
    });
    expect(state.requests).toEqual([
      { action: 'update', key: 'KHM', title: 'A new title' },
    ]);
    expect(mocks.findList).not.toHaveBeenCalled();
  });

  test('digits with no locale ask the Bible its own, and its refusal is said', async () => {
    state.worker = genWorker({
      info: () => ({ isError: true, reason: 'There is no Bible "ZZZ".' }),
    });
    expect(
      await call({ action: 'update', key: 'ZZZ', digits: 'local' }),
    ).toEqual(toError('There is no Bible "ZZZ".'));
    expect(state.requests.map((one) => one.action)).toEqual(['info']);
  });

  test('the app’s own KJV is made with the long wait', async () => {
    state.worker = genWorker({ 'create-kjv': () => ({ created: 'KJV' }) });
    expect(value(await call({ action: 'create-kjv' }))).toEqual({
      created: 'KJV',
    });
    expect(mocks.evaluate).toHaveBeenCalledWith(
      JSON.stringify({ action: 'create-kjv' }),
      { timeout: 185000 },
    );
  });

  test('an action the tool does not have is an error, not a guess', async () => {
    expect(await call({ action: 'export' })).toEqual(
      toError('Unknown action "export".'),
    );
    expect(state.requests).toEqual([]);
  });
});
