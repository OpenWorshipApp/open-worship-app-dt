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

// The knowledge reader against a fixture bundle with a translation,
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
import {
  listManualLanguages,
  listManualTranslations,
  readFrontMatter,
} from './manualI18n.mjs';
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
const W03_EN = [
  '# W-03 — Hide the screen',
  '',
  '1. Press **Hide Screen** to take the projector off.',
  '',
  '2. Press it again to show the projector.',
  '',
].join('\n');
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

    // Every language package with a manual (`src/lang/data/online/<code>/manual/`).
    for (const code of listManualLanguages()) {
      const translated = listTranslatedEntries(code);
      const current = listManualTranslations(code).filter((page) => {
        return !page.isStale;
      });
      expect(translated.map((one) => one.id), code).toEqual(
        current.map((page) => page.id),
      );
      expect(translated.length, code).toBeGreaterThan(0);
      for (const entry of translated) {
        expect(entry.lang).toBe(code);
        expect(entry.kind).toBe('manual');
        expect(entry.searchText.startsWith('---')).toBe(false);
      }
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

  // Read only for a question that is not in Latin letters: every language
  // whose corpus words are in a script of its own.
  it('knows a chip pressed in another script as the row it translates', () => {
    const otherScript = /(?=\p{L})\P{Script=Latin}/u;
    for (const overlay of loadQuestionOverlays()) {
      const found = Object.entries(overlay.questions ?? {}).find(
        ([rowId, one]) => {
          return (
            otherScript.test(one.text) &&
            rows.some((row) => row.id === rowId && row.text === one.en)
          );
        },
      );
      if (found === undefined) {
        continue;
      }
      const [id, words] = found;
      expect(findKnownQuestionRow(words.text)?.id, overlay.lang).toBe(id);
    }
  });

  it('does not take a translation of words the row no longer says', () => {
    const [row] = rows;
    questionState.loadOverlays = () => [
      {
        questions: {
        },
      },
    ];
    // A Latin-letter question is never looked up in the translations.
    questionState.loadOverlays = () => {
      throw new Error('must not be read');
    };
    expect(findKnownQuestionRow('words nobody asked')).toBeNull();
  });
});
