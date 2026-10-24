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
    locale.startsWith('km')
      ? [
          ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
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
    title: 'Khmer Bible',
    books: 66,
    chapters: 1189,
    verses: 31102,
    missingBooks: [],
    keys: ['KHM', 'KHM2'],
    takenKeys: ['KJV'],
    locales: [{ locale: 'km-KH', why: 'the verses are Khmer' }],
    recommendedLocale: 'km-KH',
    nameLists: [
      {
        label: 'Khmer names',
        source: 'built in',
        names: ['កំណើត', 'និក្ខមនំ'],
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
    fileName: 'KhmerBible.xml',
    source: 'https://example.test/KhmerBible.xml',
    bytes: 1048576,
  };
  state.meta = {
    fileName: 'KhmerBible.xml',
    recommended: {
      locale: 'km-KH',
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
    if (request.action === 'info') return { key: request.key, locale: 'km-KH' };
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
        { title: '  Khmer  Bible ', url: 'https://example.test/one.xml' },
        { title: 'Unknown Title', url: 'https://example.test/two.xml' },
      ],
    };
    state.installed = [{ key: 'KHM', title: 'khmer bible' }];
    const result = value(
      await call({ action: 'check', url: 'https://example.test/page' }),
    );
    expect(result.files[0].installedAs).toBe('KHM');
    expect(result.files[1].installedAs).toBeUndefined();
  });

  test('analyzed XML offers choices, persists the draft and warns about a duplicate title', async () => {
    state.installed = [{ key: 'KHM-OLD', title: 'Khmer Bible' }];
    const result = value(
      await call({
        action: 'check',
        url: 'https://example.test/KhmerBible.xml',
      }),
    );
    expect(result).toMatchObject({
      kind: 'xml',
      draftId: 'abcdefghijkl',
      installedAs: 'KHM-OLD',
      books: 66,
      recommended: {
        key: 'KHM',
        locale: 'km-KH',
        digits: 'local',
        bookNames: 'n0',
      },
    });
    expect(result.nameLists).toHaveLength(2);
    expect(result.digits.local).toContain('០');
    expect(mocks.writeMeta).toHaveBeenCalledWith(
      'abcdefghijkl',
      expect.objectContaining({
        fileListId: 'n1',
        // Kept for the installed Bible's note.
        url: 'https://example.test/KhmerBible.xml',
        source: 'https://example.test/KhmerBible.xml',
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

  test('names returns full settings lists or ranked short previews for a draft', async () => {
    state.names = {
      locale: 'km-KH',
      bookNames: [
        ['Genesis', 'Exodus'],
        ['កំណើត', 'និក្ខមនំ'],
      ],
      sources: [
        { label: 'English', url: null },
        { label: 'Khmer', url: 'https://example.test' },
      ],
      warnings: [],
      moreAvailable: false,
    };
    expect(
      value(await call({ action: 'names', locale: 'km-KH' })).bookNames,
    ).toHaveLength(2);
    const ranked = value(
      await call({ action: 'names', locale: 'km-KH', draftId: 'abcdefghijkl' }),
    );
    expect(ranked.nameLists[0]).toMatchObject({ label: 'Khmer', matches: 8 });
    expect(ranked.nameLists[0].own).toContain('កំណើត');
    expect(state.requests).toContainEqual(
      expect.objectContaining({
        action: 'score',
        xmlPath: '/drafts/abcdefghijkl.xml',
      }),
    );
  });

  test('import requires a chosen key and then uses the saved recommended choices', async () => {
    expect(
      value(await call({ action: 'import', draftId: 'abcdefghijkl' })),
    ).toMatchObject({
      problem: 'key',
    });
    state.lists.set('n0', { names: ['Genesis', 'Exodus'] });
    const result = value(
      await call({ action: 'import', draftId: 'abcdefghijkl', key: 'KHM' }),
    );
    expect(result).toMatchObject({ installed: 'KHM', undo: 'undo-1' });
    expect(result.note).toContain('Undo');
    expect(state.requests.at(-1)).toMatchObject({
      action: 'import',
      key: 'KHM',
      locale: 'km-KH',
      bookNames: ['Genesis', 'Exodus'],
    });
    expect(state.requests.at(-1).numbers[0]).toBe('០');
    expect(mocks.remove).toHaveBeenCalledWith('abcdefghijkl');
  });

  test('import hands the app where the draft came from and which list was chosen', async () => {
    state.meta = {
      ...state.meta,
      url: 'https://github.com/o/r/blob/main/KhmerBible.xml',
      source: 'https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
      finalUrl: 'https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
      bytes: 2048,
    };
    state.lists.set('n0', {
      label: 'Khmer names',
      source: 'https://example.test/names',
      names: ['Genesis', 'Exodus'],
    });
    await call({ action: 'import', draftId: 'abcdefghijkl', key: 'KHM' });
    expect(state.requests.at(-1).origin).toEqual({
      // Registered with no door: an outside agent over stdio.
      by: 'agent',
      url: 'https://github.com/o/r/blob/main/KhmerBible.xml',
      downloadUrl: 'https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
      finalUrl: 'https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
      fileName: 'KhmerBible.xml',
      bytes: 2048,
      bookNames: { label: 'Khmer names', source: 'https://example.test/names' },
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
      key: 'KHM',
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
      key: 'KHM',
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
        key: 'FRE',
        locale: 'fr-FR',
      }),
    );
    expect(state.requests.at(-1)).toMatchObject({
      locale: 'fr-FR',
      bookNames: ['File Genesis', 'File Exodus'],
    });
    expect(state.requests.at(-1).numbers[0]).toBe('0');
  });

  test('update resolves digits from installed locale and merges partial book names', async () => {
    state.lists.set('n1', { names: ['Genesis', 'Exodus'] });
    const result = value(
      await call({
        action: 'update',
        key: 'KHM',
        digits: 'ascii',
        bookNames: { GEN: 'New Genesis' },
      }),
    );
    expect(result).toMatchObject({ changed: ['title'], key: 'KHM' });
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
    expect(value(await call({ action: 'info', key: 'KHM' }))).toMatchObject({
      key: 'KHM',
    });
    expect(value(await call({ action: 'delete', key: 'KHM' }))).toMatchObject({
      removed: 'KHM',
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
