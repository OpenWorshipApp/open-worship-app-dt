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
vi.mock('./questions.mjs', async (importOriginal) => {
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
} from './help.mjs';
import { listManualTranslations, readFrontMatter } from './manualI18n.mjs';
import { flattenQuestions } from './questionMatch.mjs';
import { loadQuestionOverlays, loadQuestionPages } from './questions.mjs';
import { tranText } from './tran.mjs';

const REPO_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

let knowledgeDirPath = '';
let brokenDirPath = '';
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
  writeFile(knowledgeDirPath, 'manual-km/w-01.md', W01_KM);
  writeFile(knowledgeDirPath, 'manual-km/w-03.md', W03_KM);
  writeFile(knowledgeDirPath, 'internal/memory/short.md', NOTE);
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
        entry('W-01', 'Find a passage', 'manual/w-01.md', toBody(W01_EN)),
        // Indexed, but its file never made it onto the disk.
        entry(
          'W-02',
          'Clear the screen',
          'manual/w-02.md',
          'Clear the screen with **[en:tran:Clear Long Text]**.',
        ),
        entry('W-03', 'Hide the screen', 'manual/w-03.md', W03_EN),
        entry('internal:memory/short.md', 'memory / short', '', NOTE, {
          kind: 'internal',
          file: 'internal/memory/short.md',
        }),
      ],
    }),
  );
  writeFile(
    knowledgeDirPath,
    'index.km.json',
    JSON.stringify({
      entries: [
        entry('W-01', 'រកវគ្គបទ', 'manual-km/w-01.md', toBody(W01_KM), {
          lang: 'km',
          isStale: false,
        }),
        entry('W-02', 'សម្អាតអេក្រង់', 'manual-km/w-02.md', 'x', {
          lang: 'km',
          isStale: true,
        }),
        entry('W-03', 'លាក់អេក្រង់', 'manual-km/w-03.md', W03_KM, {
          lang: 'km',
          isStale: false,
        }),
      ],
    }),
  );
  writeFile(knowledgeDirPath, 'index.de.json', '{not json');
  brokenDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-help-broken-'));
  writeFile(brokenDirPath, 'index.json', '{"entries": [');
  previousDirPath = process.env.OWA_KNOWLEDGE_DIR;
});

afterAll(() => {
  rmSync(knowledgeDirPath, { recursive: true, force: true });
  rmSync(brokenDirPath, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
  fsState.hidden = [];
  questionState.loadPages = null;
  questionState.loadOverlays = null;
});

afterEach(() => {
  if (previousDirPath === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = previousDirPath;
  }
});

describe('a page in the window language', () => {
  it('lists only the translations that are still current', () => {
    const entries = listTranslatedEntries('km-KH');
    expect(entries.map((one) => one.id)).toEqual(['W-01', 'W-03']);
    expect(entries[0].absolutePath).toBe(
      path.join(knowledgeDirPath, 'manual-km/w-01.md'),
    );
    expect(listTranslatedEntries('en')).toEqual([]);
    expect(listTranslatedEntries(null)).toEqual([]);
    // No index for the language, or one that does not parse.
    expect(listTranslatedEntries('fr')).toEqual([]);
    expect(listTranslatedEntries('de')).toEqual([]);
  });

  it('reads the translation of a page asked for as W-01@km', () => {
    const page = readHelpPage('W-01@km');
    expect(page.lang).toBe('km');
    expect(page.title).toBe('រកវគ្គបទ');
    expect(page.body).toContain(
      `ចុច **${tranText('Bible Lookup', 'km')}** ដើម្បីបើក។`,
    );
    expect(page.date).toBeNull();
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

  it('reads a Khmer question by the English labels it names', () => {
    const khmer = tranText('Bible Lookup', 'km');
    const [hit] = searchHelp(`${khmer} bible`, 5, 'auto', null, 'km');
    expect(hit.id).toBe('W-01');
  });
});

describe('readHelpPage', () => {
  it('hands over a short developer note whole', () => {
    const page = readHelpPage('internal:memory/short.md');
    expect(page.body).toBe(NOTE.trim());
    expect(page.part).toBe(1);
    expect(page.partCount).toBe(1);
  });

  it('carries the day the page was generated', () => {
    expect(readHelpPage('W-01').date).toBe('2026-10-20');
  });
});

it('toPageParts cuts at the limit when a part has no line to cut at', () => {
  expect(toPageParts('x'.repeat(250), 100)).toEqual([
    'x'.repeat(100),
    'x'.repeat(100),
    'x'.repeat(50),
  ]);
});

describe('a checkout whose bundle is broken or missing', () => {
  function readSourcePage(entry) {
    const content = readFileSync(entry.absolutePath, 'utf-8');
    return { content, frontMatter: readFrontMatter(content) };
  }

  it('reads the manual sources when the index does not parse', () => {
    process.env.OWA_KNOWLEDGE_DIR = brokenDirPath;
    expect(findKnowledgeDirPath()).toBe(brokenDirPath);
    const entries = listKnowledgeEntries();
    expect(entries.length).toBeGreaterThan(10);
    const sourceDirPath = path.join(REPO_ROOT, 'docs', 'manual-sources');
    for (const entry of entries) {
      expect(entry.kind).toBe('manual');
      expect(entry.absolutePath.startsWith(sourceDirPath)).toBe(true);
    }
    const sample = entries.find((entry) => entry.id === 'W-11') ?? entries[0];
    const { content, frontMatter } = readSourcePage(sample);
    expect(sample.title).toBe(frontMatter.title);
    expect(sample.section).toBe(frontMatter.section ?? '');
    // The front matter is not something a search should match.
    expect(content.startsWith('---')).toBe(true);
    expect(sample.searchText.startsWith('---')).toBe(false);
  });

  it('reads the manual and its translations from the checkout with no build', () => {
    delete process.env.OWA_KNOWLEDGE_DIR;
    fsState.hidden = ['electron-build/'];
    expect(findKnowledgeDirPath()).toBeNull();
    const entries = listKnowledgeEntries();
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.every((entry) => entry.kind === 'manual')).toBe(true);

    const translated = listTranslatedEntries('km');
    const current = listManualTranslations('km').filter((page) => {
      return !page.isStale;
    });
    expect(translated.map((one) => one.id)).toEqual(
      current.map((page) => page.id),
    );
    expect(translated.length).toBeGreaterThan(0);
    for (const entry of translated) {
      expect(entry.lang).toBe('km');
      expect(entry.kind).toBe('manual');
      expect(entry.searchText.startsWith('---')).toBe(false);
    }
  });
});

describe('a supported question is a label', () => {
  const rows = flattenQuestions(loadQuestionPages());

  it('is not found for words that are no words', () => {
    expect(findKnownQuestionRow('  ?! ')).toBeNull();
    expect(findKnownQuestionRow(undefined)).toBeNull();
  });

  it('is not found when the corpus cannot be read, rather than failing', () => {
    questionState.loadPages = () => {
      throw new Error('questions/presenter.json does not parse');
    };
    expect(findKnownQuestionRow(rows[0].text)).toBeNull();
  });

  it('files a corpus question under its recipe', () => {
    const row = rows.find((one) => typeof one.resources?.recipe === 'string');
    expect(findKnownQuestionRow(row.text.toUpperCase())).toEqual(row);
    expect(findKnownQuestionRecipe(row.text)).toBe(row.resources.recipe);
    expect(findKnownQuestionRecipe('something nobody asked')).toBeNull();
  });

  it('knows a chip pressed in Khmer as the row it translates', () => {
    const overlay = loadQuestionOverlays().find((one) => {
      return one.lang === 'km';
    });
    const [id, words] = Object.entries(overlay.questions).find(
      ([rowId, one]) => {
        return rows.some((row) => row.id === rowId && row.text === one.en);
      },
    );
    expect(findKnownQuestionRow(words.text)?.id).toBe(id);
  });

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
