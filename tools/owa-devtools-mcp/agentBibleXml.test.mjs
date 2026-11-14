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
  WEBSITE_READ_EVALUATE_TIMEOUT: 1000,
  genReadWebPageExpression: ({ url }) => url,
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
  getBibleNumberChoices: (locale) =>
    locale.startsWith('xx')
      ? [
          ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'],
          ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        ]
      : [['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']],
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

function value(result) {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text);
}

async function call(args) {
  return await state.handler(args);
}

function analysis() {
  return {
    title: 'Xxlang Bible',
    books: 66,
    chapters: 1189,
    verses: 31102,
    missingBooks: [],
    keys: ['XXL', 'XXL2'],
    takenKeys: ['KJV'],
    locales: [{ locale: 'xx-XX', why: 'the verses are Xxlang' }],
    recommendedLocale: 'xx-XX',
    nameLists: [
      {
        label: 'Xxlang names',
        source: 'built in',
        names: ['GEN ✝', 'EXO ✝'],
      },
      {
        label: 'The names in the file',
        source: 'file',
        names: ['Genesis', 'Exodus'],
      },
    ],
  };
}

beforeEach(() => {
  state.handler = null;
  state.requests = [];
  state.lists.clear();
  state.installed = [];
  state.downloaded = {
    kind: 'xml',
    draftId: 'abcdefghijkl',
    xmlPath: '/drafts/abcdefghijkl.xml',
    fileName: 'XxlangBible.xml',
    source: 'https://example.test/XxlangBible.xml',
    bytes: 1048576,
  };
  state.meta = {
    fileName: 'XxlangBible.xml',
    recommended: {
      locale: 'xx-XX',
      digits: 'local',
      bookNames: 'n0',
    },
    fileListId: 'n1',
  };
  state.worker = (request) => {
    if (request.action === 'analyze') return analysis();
    if (request.action === 'list')
      return { bibles: state.installed, downloaded: [] };
    if (request.action === 'score') return { matches: [1, 8] };
    if (request.action === 'info') return { key: request.key, locale: 'xx-XX' };
    if (request.action === 'import')
      return { installed: request.key, undo: 'undo-1' };
    if (request.action === 'update')
      return { changed: ['title'], key: request.key };
    if (request.action === 'delete') return { removed: request.key };
    return {};
  };
  mocks.evaluate.mockImplementation(async (expression) => {
    if (expression === 'true') return { target: { id: 'page' } };
    const request = JSON.parse(expression);
    state.requests.push(request);
    return { value: state.worker(request) };
  });
  mocks.evaluateTarget.mockResolvedValue({ content: 'page' });
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
    registerTool: (name, options, handler) => {
      expect(name).toBe('owa_bible_xml');
      expect(options.inputSchema.action.safeParse('check').success).toBe(true);
      state.handler = handler;
    },
  });
});

describe('Bible XML MCP tool', () => {
  test('turns a download problem into a plain explanation', async () => {
    mocks.download.mockRejectedValue(
      new BibleXmlProblem('not-xml', 'This link is not XML.'),
    );
    expect(
      value(await call({ action: 'check', url: 'https://example.test/page' })),
    ).toEqual({
      problem: 'not-xml',
      message: 'This link is not XML.',
    });
  });

  test('marks a catalog item already installed under the same title', async () => {
    state.downloaded = {
      kind: 'page',
      files: [
        { title: '  Xxlang  Bible ', url: 'https://example.test/one.xml' },
        { title: 'Unknown Title', url: 'https://example.test/two.xml' },
      ],
    };
    state.installed = [{ key: 'XXL', title: 'xxlang bible' }];
    const result = value(
      await call({ action: 'check', url: 'https://example.test/page' }),
    );
    expect(result.files[0].installedAs).toBe('XXL');
    expect(result.files[1].installedAs).toBeUndefined();
  });

  test('analyzed XML offers choices, persists the draft and warns about a duplicate title', async () => {
    state.installed = [{ key: 'XXL-OLD', title: 'Xxlang Bible' }];
    const result = value(
      await call({
        action: 'check',
        url: 'https://example.test/XxlangBible.xml',
      }),
    );
    expect(result).toMatchObject({
      kind: 'xml',
      draftId: 'abcdefghijkl',
      installedAs: 'XXL-OLD',
      books: 66,
      recommended: {
        key: 'XXL',
        locale: 'xx-XX',
        digits: 'local',
        bookNames: 'n0',
      },
    });
    expect(result.nameLists).toHaveLength(2);
    expect(mocks.writeMeta).toHaveBeenCalledWith(
      'abcdefghijkl',
      expect.objectContaining({
        fileListId: 'n1',
        // Kept for the installed Bible's note.
        url: 'https://example.test/XxlangBible.xml',
        source: 'https://example.test/XxlangBible.xml',
        bytes: 1048576,
      }),
    );
    expect(state.requests.some((request) => request.action === 'analyze')).toBe(
      true,
    );
  });

  test('an unreadable downloaded XML is removed and reported as a problem', async () => {
    state.worker = (request) =>
      request.action === 'analyze'
        ? {
            isError: true,
            problem: 'not-bible',
            reason: 'No verses were found.',
          }
        : { bibles: [] };
    expect(
      value(
        await call({ action: 'check', url: 'https://example.test/bad.xml' }),
      ),
    ).toEqual({
      problem: 'not-bible',
      message: 'No verses were found.',
    });
    expect(mocks.remove).toHaveBeenCalledWith('abcdefghijkl');
  });

  test('asks for a locale before searching for book names', async () => {
    const result = await call({ action: 'names' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Give the locale');
  });

  test('import requires a chosen key and then uses the saved recommended choices', async () => {
    expect(
      value(await call({ action: 'import', draftId: 'abcdefghijkl' })),
    ).toMatchObject({
      problem: 'key',
    });
    state.lists.set('n0', { names: ['Genesis', 'Exodus'] });
    const result = value(
      await call({ action: 'import', draftId: 'abcdefghijkl', key: 'XXL' }),
    );
    expect(result).toMatchObject({ installed: 'XXL', undo: 'undo-1' });
    expect(result.note).toContain('Undo');
    expect(state.requests.at(-1)).toMatchObject({
      action: 'import',
      key: 'XXL',
      locale: 'xx-XX',
      bookNames: ['Genesis', 'Exodus'],
    });
    expect(mocks.remove).toHaveBeenCalledWith('abcdefghijkl');
  });

  test('import hands the app where the draft came from and which list was chosen', async () => {
    state.meta = {
      ...state.meta,
      url: 'https://github.com/o/r/blob/main/XxlangBible.xml',
      source: 'https://raw.githubusercontent.com/o/r/main/XxlangBible.xml',
      finalUrl: 'https://raw.githubusercontent.com/o/r/main/XxlangBible.xml',
      bytes: 2048,
    };
    state.lists.set('n0', {
      label: 'Xxlang names',
      source: 'https://example.test/names',
      names: ['Genesis', 'Exodus'],
    });
    await call({ action: 'import', draftId: 'abcdefghijkl', key: 'XXL' });
    expect(state.requests.at(-1).origin).toEqual({
      // Registered with no door: an outside agent over stdio.
      by: 'agent',
      url: 'https://github.com/o/r/blob/main/XxlangBible.xml',
      downloadUrl: 'https://raw.githubusercontent.com/o/r/main/XxlangBible.xml',
      finalUrl: 'https://raw.githubusercontent.com/o/r/main/XxlangBible.xml',
      fileName: 'XxlangBible.xml',
      bytes: 2048,
      bookNames: {
        label: 'Xxlang names',
        source: 'https://example.test/names',
      },
    });
  });

  test('the in-app door is the chatbot, and a partial name change says so', async () => {
    registerBibleXmlTool(
      {
        registerTool: (_name, _options, handler) => {
          state.handler = handler;
        },
      },
      { door: 'app' },
    );
    state.lists.set('n1', {
      label: 'The names in the file',
      source: 'file',
      names: ['Genesis', 'Exodus'],
    });
    await call({
      action: 'import',
      draftId: 'abcdefghijkl',
      key: 'XXL',
      bookNames: { GEN: 'New Genesis' },
    });
    expect(state.requests.at(-1).origin).toMatchObject({
      by: 'chatbot',
      bookNames: { label: 'The names in the file, 1 changed', source: 'file' },
    });
  });

  test('a missing saved book list explains how to recover without installing', async () => {
    const result = await call({
      action: 'import',
      draftId: 'abcdefghijkl',
      key: 'XXL',
      bookNames: 'missing',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not a book-name list');
    expect(state.requests.some((request) => request.action === 'import')).toBe(
      false,
    );
  });

  test('a chosen language change uses the file name list as fallback', async () => {
    state.lists.set('n1', { names: ['File Genesis', 'File Exodus'] });
    value(
      await call({
        action: 'import',
        draftId: 'abcdefghijkl',
        key: 'YYL',
        locale: 'yy-YY',
      }),
    );
    expect(state.requests.at(-1)).toMatchObject({
      locale: 'yy-YY',
      bookNames: ['File Genesis', 'File Exodus'],
    });
    expect(state.requests.at(-1).numbers[0]).toBe('0');
  });

  test('update resolves digits from installed locale and merges partial book names', async () => {
    state.lists.set('n1', { names: ['Genesis', 'Exodus'] });
    const result = value(
      await call({
        action: 'update',
        key: 'XXL',
        digits: 'ascii',
        bookNames: { GEN: 'New Genesis' },
      }),
    );
    expect(result).toMatchObject({ changed: ['title'], key: 'XXL' });
    expect(state.requests.map((request) => request.action)).toEqual([
      'info',
      'update',
    ]);
    expect(state.requests[1]).toMatchObject({
      bookNames: { GEN: 'New Genesis' },
    });
    expect(state.requests[1].numbers[0]).toBe('0');
  });

  test('list, info, delete and cancel forward the correct work or release the draft', async () => {
    expect(value(await call({ action: 'list' }))).toMatchObject({ bibles: [] });
    expect(value(await call({ action: 'info', key: 'XXL' }))).toMatchObject({
      key: 'XXL',
    });
    expect(value(await call({ action: 'delete', key: 'XXL' }))).toMatchObject({
      removed: 'XXL',
    });
    expect(
      value(await call({ action: 'cancel', draftId: 'abcdefghijkl' })),
    ).toEqual({
      cancelled: true,
    });
    expect(state.requests.map((request) => request.action)).toEqual([
      'list',
      'info',
      'delete',
    ]);
    expect(mocks.remove).toHaveBeenCalledWith('abcdefghijkl');
  });

  test('worker failures become tool errors without claiming success', async () => {
    state.worker = () => null;
    const result = await call({ action: 'list' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('did not answer');
  });
});

describe('Bible XML MCP tool, the less travelled paths', () => {
  const namesFound = (locale) => ({
    locale,
    bookNames: [['GEN ✝', 'EXO ✝']],
    sources: [{ label: 'Yylang', url: 'https://example.test/yy' }],
    warnings: [],
    moreAvailable: false,
  });

  test('charges each page a name search reads to the network budget', async () => {
    let read = null;
    mocks.findNames.mockImplementation(async (locale, { readPage }) => {
      read = await readPage('https://www.bible.com/bible/1/GEN.1');
      return namesFound(locale);
    });
    const result = value(
      await call({ action: 'names', locale: 'en', draftId: 'abcdefghijkl' }),
    );
    expect(mocks.firewall).toHaveBeenCalledWith('owa_read_website', {
      url: 'https://www.bible.com/bible/1/GEN.1',
    });
    expect(mocks.evaluateTarget).toHaveBeenCalledWith(
      { id: 'page' },
      'https://www.bible.com/bible/1/GEN.1',
      1000,
    );
    expect(read).toEqual({ content: 'page' });
    // A bare language is installed under its whole locale.
    expect(result.locale).toBe('en-US');
  });

  test('stops a name search the network budget refuses', async () => {
    mocks.firewall.mockReturnValue({
      isAllowed: false,
      reason: 'That is ten reads in five minutes.',
    });
    mocks.findNames.mockImplementation(async (locale, { readPage }) => {
      await readPage('https://www.bible.com/bible/1/GEN.1');
      return namesFound(locale);
    });
    const result = await call({ action: 'names', locale: 'yy' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('That is ten reads in five minutes.');
    expect(mocks.evaluateTarget).not.toHaveBeenCalled();
  });

  test('keeps a locale it cannot read as it was written', async () => {
    state.names = namesFound('not a locale!');
    const result = value(
      await call({ action: 'names', locale: 'yy', key: 'YYL' }),
    );
    expect(result.locale).toBe('not a locale!');
    // No draft to score the lists against: they stay in their order.
    expect(result.nameLists[0]).not.toHaveProperty('matches');
    expect(state.requests.some((request) => request.action === 'score')).toBe(
      false,
    );
  });

  test('leaves the lists unranked when the draft cannot score them', async () => {
    state.names = {
      ...namesFound('yy-YY'),
      bookNames: [['A'], ['B']],
      sources: [
        { label: 'First', url: null },
        { label: 'Second', url: null },
      ],
    };
    const worker = state.worker;
    state.worker = (request) => {
      return request.action === 'score' ? {} : worker(request);
    };
    const unscored = value(
      await call({ action: 'names', locale: 'yy-YY', draftId: 'abcdefghijkl' }),
    );
    expect(unscored.nameLists.map((list) => list.label)).toEqual([
      'First',
      'Second',
    ]);
    state.worker = (request) => {
      if (request.action === 'score') {
        throw new Error('The window went away.');
      }
      return worker(request);
    };
    const failed = value(
      await call({ action: 'names', locale: 'yy-YY', draftId: 'abcdefghijkl' }),
    );
    expect(failed.nameLists.map((list) => list.label)).toEqual([
      'First',
      'Second',
    ]);
  });

  test('says a download that failed for no known reason failed', async () => {
    mocks.download.mockRejectedValue(new Error('The disk is full.'));
    const result = await call({
      action: 'check',
      url: 'https://example.test/x.xml',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('The disk is full.');
  });

  test('answers a page with no Bible files on it as it is', async () => {
    state.downloaded = { kind: 'page', files: [], total: 0 };
    expect(
      value(await call({ action: 'check', url: 'https://example.test/p' })),
    ).toEqual({ kind: 'page', files: [], total: 0 });
    expect(state.requests).toEqual([]);
  });

  test('removes the draft when it cannot be read at all', async () => {
    state.worker = (request) => {
      if (request.action === 'analyze') {
        throw new Error('Script failed to execute');
      }
      return {};
    };
    const result = await call({
      action: 'check',
      url: 'https://example.test/XxlangBible.xml',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Script failed to execute');
    expect(mocks.remove).toHaveBeenCalledWith('abcdefghijkl');
  });

  test('says a draft that is gone is gone, and a broken one is broken', async () => {
    mocks.readMeta.mockRejectedValueOnce(
      new BibleXmlProblem('draft-gone', 'That download is no longer there.'),
    );
    expect(
      value(
        await call({ action: 'import', draftId: 'abcdefghijkl', key: 'XXL' }),
      ),
    ).toEqual({
      problem: 'draft-gone',
      message: 'That download is no longer there.',
    });
    mocks.readMeta.mockRejectedValueOnce(new Error('meta.json is not JSON'));
    const broken = await call({
      action: 'import',
      draftId: 'abcdefghijkl',
      key: 'XXL',
    });
    expect(broken.isError).toBe(true);
    expect(broken.content[0].text).toBe('meta.json is not JSON');
  });

  test('asks for the language when the file did not say it', async () => {
    state.meta = {
      ...state.meta,
      recommended: { ...state.meta.recommended, locale: null },
    };
    expect(
      value(
        await call({ action: 'import', draftId: 'abcdefghijkl', key: 'XXL' }),
      ),
    ).toMatchObject({ problem: 'locale' });
    expect(state.requests.some((request) => request.action === 'import')).toBe(
      false,
    );
  });

  test('passes on what the app refused an import for, and keeps the draft', async () => {
    state.lists.set('n0', { names: ['Genesis', 'Exodus'] });
    state.worker = () => {
      return { isError: true, problem: 'key', reason: 'KJV is taken.' };
    };
    expect(
      value(
        await call({ action: 'import', draftId: 'abcdefghijkl', key: 'KJV' }),
      ),
    ).toEqual({ problem: 'key', message: 'KJV is taken.' });
    state.worker = () => ({ isError: true, reason: 'The disk is full.' });
    const failed = await call({
      action: 'import',
      draftId: 'abcdefghijkl',
      key: 'XXL',
    });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toBe('The disk is full.');
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  test('update says so when the Bible to read the digits off is not there', async () => {
    state.worker = (request) => {
      return request.action === 'info'
        ? { isError: true, reason: 'No Bible is installed as "XYZ".' }
        : {};
    };
    const result = await call({
      action: 'update',
      key: 'XYZ',
      digits: 'local',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('No Bible is installed as "XYZ".');
    expect(state.requests.map((request) => request.action)).toEqual(['info']);
  });

  test('update with an empty list id changes no book names', async () => {
    value(
      await call({ action: 'update', key: 'XXL', title: 'K', bookNames: ' ' }),
    );
    expect(state.requests.at(-1)).toEqual({
      action: 'update',
      key: 'XXL',
      title: 'K',
    });
  });

  test('creates the app own KJV, and refuses an action it does not know', async () => {
    const worker = state.worker;
    state.worker = (request) => {
      return request.action === 'create-kjv'
        ? { created: 'KJV' }
        : worker(request);
    };
    expect(value(await call({ action: 'create-kjv' }))).toEqual({
      created: 'KJV',
    });
    const unknown = await call({ action: 'explode' });
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toBe('Unknown action "explode".');
  });
});
