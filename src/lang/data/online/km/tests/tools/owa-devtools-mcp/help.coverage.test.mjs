// The Khmer cases of `tools/owa-devtools-mcp/help.coverage.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { pathToFileURL as toSourceUrl } from 'node:url';
import { join as joinSourcePath } from 'node:path';
const SOURCE_URL = toSourceUrl(joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp/help.coverage.test.mjs')).href;
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// The knowledge reader against a fixture bundle with a Khmer translation,
// against a broken bundle, and against a checkout with no bundle at all --
// the last one by hiding the built folder from `existsSync`, everything else
// on the disk left as it is.
const fsState = vi.hoisted(() => ({ hidden: [] }));
const questionState = vi.hoisted(() => ({
  loadPages: null,
  loadOverlays: null,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: (filePath) => {
      const posix = String(filePath).split(path.sep).join('/');
      return (
        !fsState.hidden.some((part) => posix.includes(part)) &&
        actual.existsSync(filePath)
      );
    },
  };
});
vi.mock('../../../../../../../../tools/owa-devtools-mcp/questions.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadQuestionPages: (...args) => {
      return (questionState.loadPages ?? actual.loadQuestionPages)(...args);
    },
    loadQuestionOverlays: (...args) => {
      return (questionState.loadOverlays ?? actual.loadQuestionOverlays)(
        ...args,
      );
    },
  };
});

import {
  findKnowledgeDirPath,
  findKnownQuestionRecipe,
  findKnownQuestionRow,
  listKnowledgeEntries,
  listTranslatedEntries,
  readHelpPage,
  searchHelp,
  toPageParts,
} from '../../../../../../../../tools/owa-devtools-mcp/help.mjs';
import { configureLangPacks, readSourceDictionary } from '../../../../../../../../tools/owa-devtools-mcp/langPacks.mjs';
import { hashManualPage, listManualTranslations, readFrontMatter } from '../../../../../../../../tools/owa-devtools-mcp/manualI18n.mjs';
import { flattenQuestions } from '../../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs';
import { loadQuestionOverlays, loadQuestionPages } from '../../../../../../../../tools/owa-devtools-mcp/questions.mjs';
import { tranText } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

const REPO_ROOT = path.join(
  path.dirname(fileURLToPath(SOURCE_URL)),
  '..',
  '..',
);

let knowledgeDirPath = '';
let brokenDirPath = '';
// An INSTALLED Khmer language, the way its plugin lays it out: the manual
// and its index in its own folder, never in the knowledge bundle.
let khmerPackDirPath = '';
// An installed language whose manual index does not parse.
let germanPackDirPath = '';
let previousDirPath;

const W01_EN = [
  '---',
  'id: W-01',
  'title: "Find a passage"',
  'workflowsVersion: "2026-10-20"',
  '---',
  '# W-01 — Find a passage',
  '',
  '1. Press **[en:tran:Bible Lookup]** to open the lookup.',
  '',
  '2. Type the reference and press Enter to see the passage.',
  '',
].join('\n');
const W01_KM = [
  '---',
  'id: W-01',
  'title: "រកវគ្គបទ"',
  '---',
  '# W-01 — រកវគ្គបទ',
  '',
  '1. ចុច **[en:tran:Bible Lookup]** ដើម្បីបើក។',
  '',
  '2. វាយឯកសារយោង ហើយចុច Enter។',
  '',
].join('\n');
const W03_EN = [
  '# W-03 — Hide the screen',
  '',
  '1. Press **Hide Screen** to take the projector off.',
  '',
  '2. Press it again to show the projector.',
  '',
].join('\n');
const W03_KM = '# W-03 — លាក់អេក្រង់\n\nចុចប៊ូតុងដើម្បីលាក់។\n';
const NOTE = '# memory / short\nA short note about the projector.\n';

function toBody(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function writeFile(dirPath, relativePath, content) {
  const filePath = path.join(dirPath, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

beforeAll(() => {
  knowledgeDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-help-'));
  writeFile(knowledgeDirPath, 'manual/w-01.md', W01_EN);
  writeFile(knowledgeDirPath, 'manual/w-03.md', W03_EN);
  writeFile(knowledgeDirPath, 'internal/memory/short.md', NOTE);
  khmerPackDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-help-km-'));
  const khmerSourceDirPath = path.join(
    REPO_ROOT,
    'src',
    'lang',
    'data',
    'online',
    'km',
  );
  writeFile(
    khmerPackDirPath,
    'meta.json',
    JSON.stringify({ langCode: 'km', name: 'Khmer' }),
  );
  writeFile(
    khmerPackDirPath,
    'tran.json',
    JSON.stringify(readSourceDictionary(khmerSourceDirPath)),
  );
  writeFile(
    khmerPackDirPath,
    'assistant.json',
    readFileSync(path.join(khmerSourceDirPath, 'assistant.json'), 'utf-8'),
  );
  writeFile(khmerPackDirPath, 'manual/w-01.md', W01_KM);
  writeFile(khmerPackDirPath, 'manual/w-03.md', W03_KM);
  germanPackDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-help-de-'));
  writeFile(
    germanPackDirPath,
    'meta.json',
    JSON.stringify({ langCode: 'de', name: 'German' }),
  );
  writeFile(germanPackDirPath, 'manual/index.json', '{not json');
  const entry = (id, title, file, searchText, extra = {}) => {
    return {
      id,
      title,
      section: 'Bible',
      kind: 'manual',
      surface: 'presenter',
      file,
      searchText,
      headings: '',
      ...extra,
    };
  };
  writeFile(
    knowledgeDirPath,
    'index.json',
    JSON.stringify({
      entries: [
        // Each English page carries the hash a translation of it must name.
        entry('W-01', 'Find a passage', 'manual/w-01.md', toBody(W01_EN), {
          hash: hashManualPage(W01_EN),
        }),
        // Indexed, but its file never made it onto the disk.
        entry(
          'W-02',
          'Clear the screen',
          'manual/w-02.md',
          'Clear the screen with **[en:tran:Clear Long Text]**.',
          { hash: 'english-as-it-is-now' },
        ),
        entry('W-03', 'Hide the screen', 'manual/w-03.md', W03_EN, {
          hash: hashManualPage(W03_EN),
        }),
        entry('internal:memory/short.md', 'memory / short', '', NOTE, {
          kind: 'internal',
          file: 'internal/memory/short.md',
        }),
      ],
    }),
  );
  // The plugin's own index of its manual: `file` under its `manual/`.
  writeFile(
    khmerPackDirPath,
    'manual/index.json',
    JSON.stringify({
      entries: [
        entry('W-01', 'រកវគ្គបទ', 'w-01.md', toBody(W01_KM), {
          translatedFrom: hashManualPage(W01_EN),
        }),
        // Made from an English W-02 that has changed since: stale.
        entry('W-02', 'សម្អាតអេក្រង់', 'w-02.md', 'x', {
          translatedFrom: 'english-as-it-was',
        }),
        entry('W-03', 'លាក់អេក្រង់', 'w-03.md', W03_KM, {
          translatedFrom: hashManualPage(W03_EN),
        }),
      ],
    }),
  );
  brokenDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-help-broken-'));
  writeFile(brokenDirPath, 'index.json', '{"entries": [');
  previousDirPath = process.env.OWA_KNOWLEDGE_DIR;
});

afterAll(() => {
  rmSync(knowledgeDirPath, { recursive: true, force: true });
  rmSync(brokenDirPath, { recursive: true, force: true });
  rmSync(khmerPackDirPath, { recursive: true, force: true });
  rmSync(germanPackDirPath, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
  configureLangPacks(() => [khmerPackDirPath, germanPackDirPath]);
  fsState.hidden = [];
  questionState.loadPages = null;
  questionState.loadOverlays = null;
});

afterEach(() => {
  configureLangPacks(null);
  if (previousDirPath === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = previousDirPath;
  }
});

describe('a page in the window language', () => {
  it('reads the translation of a page asked for as W-01@km', () => {
    const page = readHelpPage('W-01@km');
    expect(page.lang).toBe('km');
    expect(page.title).toBe('រកវគ្គបទ');
    expect(page.body).toContain(
      `ចុច **${tranText('Bible Lookup', 'km')}** ដើម្បីបើក។`,
    );
    expect(page.date).toBeNull();
  });

  it('quotes the same passage out of the translation beside a search hit', () => {
    const [hit] = searchHelp('bible lookup', 5, 'manual', null, 'km');
    expect(hit.id).toBe('W-01');
    expect(hit.titleInLanguage).toBe('រកវគ្គបទ');
    expect(hit.excerptInLanguage).toContain('ចុច');
    expect(hit.excerptInLanguage).toContain(tranText('Bible Lookup', 'km'));
    expect(hit.excerptInLanguage).not.toContain('[en:tran:');
    // A translation whose passages do not line up is not quoted.
    const [hidden] = searchHelp('hide screen projector', 5, 'manual', null, 'km');
    expect(hidden.id).toBe('W-03');
    expect(hidden).not.toHaveProperty('titleInLanguage');
    // An English search reads no translation at all.
    expect(searchHelp('bible lookup', 5, 'manual')[0]).not.toHaveProperty(
      'excerptInLanguage',
    );
  });
});

describe('a supported question is a label', () => {
  const rows = flattenQuestions(loadQuestionPages());

  it('does not take a translation of words the row no longer says', () => {
    const [row] = rows;
    questionState.loadOverlays = () => [
      {
        questions: {
          [row.id]: { en: `${row.text} (old)`, text: 'សំណួរចាស់មួយ' },
        },
      },
    ];
    expect(findKnownQuestionRow('សំណួរចាស់មួយ')).toBeNull();
    // A Latin-letter question is never looked up in the translations.
    questionState.loadOverlays = () => {
      throw new Error('must not be read');
    };
    expect(findKnownQuestionRow('words nobody asked')).toBeNull();
  });
});

describe("a page in the window language", () => {
  it('lists only the translations that are still current', () => {
    const entries = listTranslatedEntries('km-KH');
    expect(entries.map((one) => one.id)).toEqual(['W-01', 'W-03']);
    expect(entries[0]).toMatchObject({ lang: 'km', kind: 'manual' });
    expect(entries[0].absolutePath).toBe(
      path.join(khmerPackDirPath, 'manual', 'w-01.md'),
    );
    expect(listTranslatedEntries('en')).toEqual([]);
    expect(listTranslatedEntries(null)).toEqual([]);
    // A language not installed, and one whose index does not parse.
    expect(listTranslatedEntries('fr')).toEqual([]);
    expect(listTranslatedEntries('de')).toEqual([]);
    // Nothing installed: the Khmer pages are gone with the language.
    configureLangPacks(() => []);
    expect(listTranslatedEntries('km')).toEqual([]);
  });

  it('falls back to the English page, in Khmer labels, when the translation is stale', () => {
    // W-02's file is not on the disk either: the index copy answers.
    const page = readHelpPage('W-02@km');
    expect(page.title).toBe('Clear the screen');
    expect(page.body).toBe(
      `Clear the screen with **${tranText('Clear Long Text', 'km')}**.`,
    );
    expect(page.date).toBeNull();
  });

  it('reads a Khmer question by the English labels it names', () => {
    const khmer = tranText('Bible Lookup', 'km');
    const [hit] = searchHelp(`${khmer} bible`, 5, 'auto', null, 'km');
    expect(hit.id).toBe('W-01');
  });
});

// From `tools/owa-devtools-mcp/help.coverage.ut99.test.mjs`.
describe('searchHelp in a Khmer window', () => {
  // The guide's offline answer quotes the hit in the window's language: the
  // English excerpt too, with its labels as the Khmer buttons read.
  it('gives the English excerpt the Khmer labels, and quotes no stale translation', () => {
    const khmer = tranText('Bible Lookup', 'km');
    expect(khmer).not.toBe('Bible Lookup');
    const [hit] = searchHelp('bible lookup', 5, 'manual', null, 'km');
    expect(hit.id).toBe('W-01');
    expect(hit.excerpt).toContain(khmer);
    expect(hit.excerpt).not.toContain('[en:tran:');
    // W-02's translation is stale: neither its title nor a passage of it.
    const stale = searchHelp('clear screen', 5, 'manual', null, 'km').find(
      (one) => one.id === 'W-02',
    );
    expect(stale).toBeDefined();
    expect(stale).not.toHaveProperty('titleInLanguage');
    expect(stale).not.toHaveProperty('excerptInLanguage');
  });

  it('puts the recipe a supported question is filed under first, with its title in Khmer', () => {
    const asked = 'How do I find a passage in the lookup?';
    questionState.loadPages = () => [
      {
        page: 'presenter',
        label: 'Presenter',
        focus: 'presenter',
        sections: [
          {
            id: 'lookup',
            label: 'Lookup',
            questions: [
              { id: 'find', text: asked, resources: { recipe: 'W-01' } },
            ],
          },
        ],
      },
    ];
    questionState.loadOverlays = () => [];
    const hits = searchHelp(asked, 5, 'manual', null, 'km');
    expect(hits[0]).toMatchObject({ id: 'W-01', isKnownQuestion: true });
    expect(hits[0].titleInLanguage).toBe('រកវគ្គបទ');
  });

  // A Khmer label is read as its English key, and an English word beside
  // it that the label already said counts once, not twice.
  it('counts an English word the Khmer label already says once', () => {
    const khmer = tranText('Bible Lookup', 'km');
    const mixed = searchHelp(`lookup ${khmer}`, 5, 'auto', null, 'km');
    const alone = searchHelp(khmer, 5, 'auto', null, 'km');
    expect(mixed[0].id).toBe('W-01');
    expect(alone[0].id).toBe('W-01');
    expect(mixed[0].score).toBe(alone[0].score);
  });
});
