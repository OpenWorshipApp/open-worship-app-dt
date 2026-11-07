import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
import { configureLangPacks } from './langPacks.mjs';
import { hashManualPage } from './manualI18n.mjs';

// What `help.mjs` reads is decided here, not by whether this checkout was
// built: the knowledge bundle is a temp folder (`OWA_KNOWLEDGE_DIR`), the
// question corpus is a few virtual files, and a checkout with NO build is
// the built index hidden plus virtual manual folders.
const { fsState } = vi.hoisted(() => {
  return {
    fsState: {
      // Folders whose contents are ONLY the virtual files below them.
      roots: [],
      // Absolute path (forward slashes) -> file content.
      files: new Map(),
      // Absolute paths (forward slashes) that read as absent, with all
      // that is below them.
      hidden: [],
      // Folders whose listing fails outright.
      broken: [],
    },
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal();
  const { resolve } = await import('node:path');
  const toKey = (target) => {
    return resolve(String(target)).replace(/\\/g, '/');
  };
  const checkIsUnder = (key, root) => {
    return key === root || key.startsWith(`${root}/`);
  };
  const rootOf = (key) => {
    return fsState.roots.find((root) => checkIsUnder(key, root));
  };
  const checkIsHidden = (key) => {
    return fsState.hidden.some((hidden) => checkIsUnder(key, hidden));
  };
  const listChildren = (key) => {
    const names = new Set();
    for (const filePath of fsState.files.keys()) {
      if (filePath.startsWith(`${key}/`)) {
        names.add(filePath.slice(key.length + 1).split('/')[0]);
      }
    }
    return [...names];
  };
  const checkIsDir = (key) => {
    return key === rootOf(key) || listChildren(key).length > 0;
  };
  const toMissing = (target) => {
    return Object.assign(new Error(`ENOENT: ${target}`), { code: 'ENOENT' });
  };
  const fake = {
    existsSync(target) {
      const key = toKey(target);
      if (checkIsHidden(key)) {
        return false;
      }
      if (rootOf(key) === undefined) {
        return real.existsSync(target);
      }
      return fsState.files.has(key) || checkIsDir(key);
    },
    readdirSync(target, options) {
      const key = toKey(target);
      if (fsState.broken.includes(key)) {
        throw Object.assign(new Error(`EIO: ${target}`), { code: 'EIO' });
      }
      if (rootOf(key) === undefined) {
        return real.readdirSync(target, options);
      }
      if (!checkIsDir(key)) {
        throw toMissing(target);
      }
      return listChildren(key);
    },
    statSync(target, options) {
      const key = toKey(target);
      if (rootOf(key) === undefined) {
        return real.statSync(target, options);
      }
      const isFile = fsState.files.has(key);
      if (!isFile && !checkIsDir(key)) {
        throw toMissing(target);
      }
      return {
        isDirectory: () => {
          return !isFile;
        },
        isFile: () => {
          return isFile;
        },
      };
    },
    readFileSync(target, options) {
      const key = toKey(target);
      if (checkIsHidden(key)) {
        throw toMissing(target);
      }
      if (rootOf(key) === undefined) {
        return real.readFileSync(target, options);
      }
      if (!fsState.files.has(key)) {
        throw toMissing(target);
      }
      return fsState.files.get(key);
    },
  };
  return { ...real, ...fake, default: { ...real, ...fake } };
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');

function toKey(target) {
  return path.resolve(target).replace(/\\/g, '/');
}

const QUESTIONS_DIR = toKey(path.join(HERE, 'questions'));
const MANUAL_SOURCES_DIR = toKey(
  path.join(REPO_ROOT, 'docs', 'manual-sources'),
);
// Where a checkout keeps every language but English.
const ONLINE_LANG_DATA_DIR = toKey(
  path.join(REPO_ROOT, 'src', 'lang', 'data', 'online'),
);
const BUILT_KNOWLEDGE_DIR = toKey(
  path.join(REPO_ROOT, 'electron-build', 'knowledge'),
);

function addVirtualFiles(rootPath, files) {
  if (!fsState.roots.includes(rootPath)) {
    fsState.roots.push(rootPath);
  }
  for (const [relativePath, content] of Object.entries(files)) {
    fsState.files.set(`${rootPath}/${relativePath}`, content);
  }
}

// The question corpus: two rows, one filed under W-50. A row's translation
// (`src/lang/data/online/<code>/questions.json`) is in each package's tests.
const QUESTION_PAGE = {
  page: 'presenter',
  label: 'Presenter',
  focus: 'presenter',
  sections: [
    {
      id: 'screens',
      label: 'Screens',
      questions: [
        {
          id: 'clear-verse',
          text: 'How do I take the verse off the screen?',
          resources: { recipe: 'W-50', find: 'Clear Long Text' },
        },
        {
          id: 'show-verse',
          text: 'How do I show a verse?',
          resources: { recipe: 'W-51' },
        },
      ],
    },
  ],
};

function useQuestionCorpus() {
  addVirtualFiles(QUESTIONS_DIR, {
    'presenter.json': JSON.stringify(QUESTION_PAGE),
  });
}

// The bundle: four manual pages (one indexed but missing on disk), a short
// internal note, and English's language entry -- the bundle is English
// alone. Two installed languages beside it, made up and written in signs: one
// with no manual and one whose manual index is broken. A page's translation
// -- current, stale or misaligned -- is in each package's tests.
const W50_BODY = [
  '# Clear the screen',
  '',
  'Press [en:tran:Clear Long Text] to take the verse off the screen.',
  '',
  'The [en:tran:Clear All] button empties every layer of the screen.',
].join('\n');
const W51_BODY =
  '# Show a verse\n\nType a reference, then press [en:tran:Clear Long Text] to take it down.';
const W52_INDEX_TEXT = '# Indexed only\n\nThe index copy of a missing page.';
const W53_BODY =
  '# Clear a background\n\nThe screen background is cleared by its own button.';
const NOTE_BODY = '# short\nA short note about the screen.';

const TRAN_BUNDLE = {
  languages: [
    { code: 'en', name: 'English', nativeName: 'English', assistant: null },
  ],
  dictionaries: { en: {} },
};

let knowledgeDirPath = '';
let brokenKnowledgeDirPath = '';
let packRootDirPath = '';
let savedKnowledgeDir;

function writeKnowledgeFile(relativePath, content) {
  const filePath = path.join(knowledgeDirPath, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function toFrontMatter(fields) {
  return `---\n${Object.entries(fields)
    .map(([key, value]) => {
      return `${key}: ${value}`;
    })
    .join('\n')}\n---\n`;
}

beforeAll(() => {
  knowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-'));
  const manual = (id, title, file, searchText) => {
    return {
      id,
      title,
      section: 'Presenting',
      kind: 'manual',
      surface: 'presenter',
      file,
      // What a translation of it must say it was made from.
      hash: `hash-of-${id}`,
      searchText,
      headings: '',
    };
  };
  const entries = [
    manual('W-50', 'Clear the screen', 'manual/w-50.md', W50_BODY),
    manual('W-51', 'Show a verse', 'manual/w-51.md', W51_BODY),
    manual('W-52', 'Indexed only', 'manual/w-52-missing.md', W52_INDEX_TEXT),
    manual('W-53', 'Clear a background', 'manual/w-53.md', W53_BODY),
    {
      id: 'internal:memory/short.md',
      title: 'memory / short',
      section: '',
      kind: 'internal',
      surface: null,
      file: 'internal/memory/short.md',
      searchText: NOTE_BODY,
      headings: '',
    },
  ];
  writeKnowledgeFile(
    'manual/w-50.md',
    `${toFrontMatter({ id: 'W-50', workflowsVersion: '2026-10-11' })}${W50_BODY}\n`,
  );
  writeKnowledgeFile('manual/w-51.md', `${W51_BODY}\n`);
  writeKnowledgeFile('manual/w-53.md', `${W53_BODY}\n`);
  writeKnowledgeFile('internal/memory/short.md', `${NOTE_BODY}\n`);
  writeKnowledgeFile('index.json', JSON.stringify({ entries }));
  writeKnowledgeFile('tran.json', JSON.stringify(TRAN_BUNDLE));

  brokenKnowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-'));
  writeFileSync(path.join(brokenKnowledgeDirPath, 'index.json'), '{ broken');

  packRootDirPath = mkdtempSync(path.join(tmpdir(), 'owa-packs-'));
  const writePackFile = (relativePath, content) => {
    const filePath = path.join(packRootDirPath, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  };
  writePackFile('xx/meta.json', JSON.stringify({ langCode: 'xx' }));
  writePackFile('xx/manual/index.json', '{ not json');
  writePackFile('xy/meta.json', JSON.stringify({ langCode: 'xy' }));
});

afterAll(() => {
  rmSync(knowledgeDirPath, { recursive: true, force: true });
  rmSync(brokenKnowledgeDirPath, { recursive: true, force: true });
  rmSync(packRootDirPath, { recursive: true, force: true });
});

beforeEach(() => {
  fsState.roots.length = 0;
  fsState.files.clear();
  fsState.hidden.length = 0;
  fsState.broken.length = 0;
  useQuestionCorpus();
  savedKnowledgeDir = process.env.OWA_KNOWLEDGE_DIR;
  process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
  configureLangPacks(() => {
    return [path.join(packRootDirPath, 'xx'), path.join(packRootDirPath, 'xy')];
  });
});

afterEach(() => {
  configureLangPacks(null);
  if (savedKnowledgeDir === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = savedKnowledgeDir;
  }
});

describe('toPageParts', () => {
  // No step to open on and no line to break at: cut at the room itself, so
  // a part is never longer than one read.
  it('cuts a page with no break in it at the limit', () => {
    expect(toPageParts('x'.repeat(25), 10)).toEqual([
      'x'.repeat(10),
      'x'.repeat(10),
      'x'.repeat(5),
    ]);
  });
});

describe('readHelpPage', () => {
  it('hands a short note over whole, with nothing said about a cut', () => {
    const page = readHelpPage('internal:memory/short.md');
    expect(page.body).toBe(NOTE_BODY);
    expect(page.body).not.toContain('longer than what is shown');
    expect(page).toMatchObject({ part: 1, partCount: 1, kind: 'internal' });
  });

  // A partial install: indexed, but its file is gone. The index copy still
  // answers something rather than nothing.
  it('answers from the index copy when the page file is gone', () => {
    const page = readHelpPage('W-52');
    expect(page.body).toBe(W52_INDEX_TEXT);
    expect(page.date).toBeNull();
    expect(page.id).toBe('W-52');
  });

  it('reads the day a page was generated off its front matter', () => {
    const page = readHelpPage('w-50');
    expect(page.date).toBe('2026-10-11');
    expect(page.body).toBe(W50_BODY.replace(/\[en:tran:([^\]]+)\]/g, '$1'));
  });
});

describe('listTranslatedEntries', () => {
  it('lists nothing for a language not installed, with no index or a broken one', () => {
    // Not installed: a checkout's own source packages are not read while
    // the app says what is installed.
    expect(listTranslatedEntries('fr')).toEqual([]);
    // Installed, its manual index broken.
    expect(listTranslatedEntries('xx')).toEqual([]);
    // Installed, with no manual at all.
    expect(listTranslatedEntries('xy')).toEqual([]);
    expect(listTranslatedEntries('en')).toEqual([]);
    expect(listTranslatedEntries(undefined)).toEqual([]);
  });
});

describe('a supported question is a label', () => {
  it('finds the row a question IS, and the recipe it is filed under', () => {
    expect(
      findKnownQuestionRow('How do I take the verse off the screen?')?.id,
    ).toBe('presenter.screens.clear-verse');
    expect(
      findKnownQuestionRecipe('how do i take the verse off the screen'),
    ).toBe('W-50');
    expect(findKnownQuestionRecipe('Something nobody asked')).toBeNull();
  });

  it('answers nothing for a question with no words in it', () => {
    expect(findKnownQuestionRow('  ?! ')).toBeNull();
    expect(findKnownQuestionRecipe('')).toBeNull();
  });

  // No corpus that can be read is no reason for a search to fail.
  it('answers nothing, and the search still answers, when the corpus fails', () => {
    fsState.broken.push(QUESTIONS_DIR);
    expect(
      findKnownQuestionRow('How do I take the verse off the screen?'),
    ).toBeNull();
    const hits = searchHelp('How do I take the verse off the screen?');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].isKnownQuestion).toBeUndefined();
  });
});

describe('a checkout whose bundle cannot be read', () => {
  it('falls back to the manual sources when the index is broken', () => {
    process.env.OWA_KNOWLEDGE_DIR = brokenKnowledgeDirPath;
    addVirtualFiles(MANUAL_SOURCES_DIR, {
      'w-60.md': `${toFrontMatter({ id: 'W-60', title: 'From source' })}Body.\n`,
    });
    expect(findKnowledgeDirPath()).toBe(brokenKnowledgeDirPath);
    expect(
      listKnowledgeEntries().map((entry) => {
        return entry.id;
      }),
    ).toEqual(['W-60']);
  });
});

describe('a source checkout with no build', () => {
  const W60_ENGLISH = `${toFrontMatter({
    id: 'W-60',
    title: 'Clear from source',
    section: 'Presenting',
  })}Press [en:tran:Clear Long Text].\n`;
  const XX_TITLE = '✦ ✧';

  function useNoBuild() {
    delete process.env.OWA_KNOWLEDGE_DIR;
    fsState.hidden.push(BUILT_KNOWLEDGE_DIR);
    // No app says what is installed: the checkout's source packages are read.
    configureLangPacks(null);
    // One language package with a manual and an empty dictionary, so no
    // label is translated. It is made up and written in signs: what is
    // under test is which translation is read, not any language.
    addVirtualFiles(ONLINE_LANG_DATA_DIR, {
      'xx/dictionary.json': '{}',
      // With no app to ask, a source pack the assistant is written for.
      'xx/assistant.json': '{}',
      'xx/manual/presenting/w-60.md': `${toFrontMatter({
        id: 'W-60',
        title: XX_TITLE,
        section: 'Presenting',
        translatedFrom: hashManualPage(W60_ENGLISH),
      })}➜ [en:tran:Clear Long Text] ✔\n`,
      'xx/manual/w-61.md': `${toFrontMatter({
        id: 'W-61',
        translatedFrom: 'aaaaaaaaaaaaaaaa',
      })}stale\n`,
    });
    addVirtualFiles(MANUAL_SOURCES_DIR, {
      'presenting/w-60.md': W60_ENGLISH,
      // No front matter: named after its file.
      'loose-page.md': '# A loose page\n\nWords.\n',
      'notes.txt': 'not a page',
    });
  }

  it('finds no bundle at all', () => {
    useNoBuild();
    expect(findKnowledgeDirPath()).toBeNull();
  });

  it('reads the manual pages straight from their sources', () => {
    useNoBuild();
    const entries = listKnowledgeEntries();
    const byId = new Map(
      entries.map((entry) => {
        return [entry.id, entry];
      }),
    );
    expect([...byId.keys()].sort()).toEqual(['W-60', 'loose-page']);
    expect(byId.get('W-60')).toMatchObject({
      title: 'Clear from source',
      section: 'Presenting',
      kind: 'manual',
      searchText: 'Press [en:tran:Clear Long Text].',
    });
    expect(byId.get('loose-page')).toMatchObject({
      title: 'loose-page',
      section: '',
      kind: 'manual',
    });
    // And a page read from there is the page.
    expect(readHelpPage('W-60').body).toBe('Press Clear Long Text.');
  });

  it('reads the current translations straight from their packages', async () => {
    useNoBuild();
    // The source packages are listed once for the life of the module: a
    // module of its own, so it lists these.
    vi.resetModules();
    const help = await import('./help.mjs');
    const entries = help.listTranslatedEntries('xx');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'W-60',
      lang: 'xx',
      title: XX_TITLE,
      section: 'Presenting',
      kind: 'manual',
      searchText: '➜ [en:tran:Clear Long Text] ✔',
    });
    expect(entries[0].absolutePath.replace(/\\/g, '/')).toBe(
      `${ONLINE_LANG_DATA_DIR}/xx/manual/presenting/w-60.md`,
    );
  });

  it('lists nothing when the manual sources are not there either', () => {
    useNoBuild();
    fsState.hidden.push(MANUAL_SOURCES_DIR);
    expect(listKnowledgeEntries()).toEqual([]);
  });
});
