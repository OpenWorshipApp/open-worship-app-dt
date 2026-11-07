// The Khmer cases of `tools/owa-devtools-mcp/agentBibleXml.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
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

vi.mock('../../../../../../../../tools/owa-devtools-mcp/cdp.mjs', () => ({
  evaluateInApp: mocks.evaluate,
  evaluateInTarget: mocks.evaluateTarget,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/firewall.mjs', () => ({ checkToolCall: mocks.firewall }));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/website.mjs', () => ({
  WEBSITE_READ_EVALUATE_TIMEOUT: 1000,
  genReadWebPageExpression: ({ url }) => url,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/agentData.mjs', () => ({
  AGENT_UNDO_TEXT: 'Use Undo to restore it.',
  genAgentDataExpression: (_kind, request) => JSON.stringify(request),
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/help.mjs', () => ({
  findKnowledgeDirPath: () => '/missing-bundle',
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/bibleBookNames.mjs', async (importOriginal) => ({
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
vi.mock('../../../../../../../../tools/owa-devtools-mcp/bibleXmlDraft.mjs', () => ({
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

import { BibleXmlProblem } from '../../../../../../../../tools/owa-devtools-mcp/bibleXmlDraft.mjs';
import { registerBibleXmlTool } from '../../../../../../../../tools/owa-devtools-mcp/agentBibleXml.mjs';

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
});

// From `tools/owa-devtools-mcp/agentBibleXml.coverage.test.mjs`.
describe('finding book names for Khmer', () => {
  test('with a key and no draft, the lists keep their order, km is said in full and its own digits are offered', async () => {
    state.names = {
      locale: 'km',
      bookNames: [
        ['Genesis', 'Exodus'],
        ['កំណើត', 'និក្ខមនំ'],
      ],
      sources: [
        { label: 'English', url: null },
        { label: 'Khmer', url: 'https://names.example/km' },
      ],
      warnings: [],
      moreAvailable: false,
    };
    const result = value(
      await call({ action: 'names', locale: 'km', key: 'KHM' }),
    );
    expect(result.locale).toBe('km-KH');
    expect(result.digits).toEqual({
      local: '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩',
      ascii: '0 1 2 3 4 5 6 7 8 9',
    });
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
});
