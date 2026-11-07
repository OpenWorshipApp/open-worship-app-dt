import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listQuestionPageIds,
  loadQuestionOverlays,
  loadQuestionPages,
  matchQuestions,
  outlineQuestions,
} from './questions.mjs';
import { configureLangPacks } from './langPacks.mjs';

// `questions.mjs` reads `questions/` beside it, and each language's own
// `questions.json` in its folder (`langPacks.mjs`): an installed plugin's,
// or -- where no app says what is installed -- a checkout's source package
// (`src/lang/data/online/<code>/`). The knowledge bundle carries none. Here
// all are a few virtual files (or absent), so each case reads exactly what it
// set up and the real corpus -- graded by `questions.test.mjs` -- is not
// involved.
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
      if (rootOf(key) === undefined) {
        return real.readdirSync(target, options);
      }
      if (!checkIsDir(key)) {
        throw toMissing(target);
      }
      return listChildren(key);
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
const QUESTIONS_DIR = path.resolve(HERE, 'questions').replace(/\\/g, '/');
const ONLINE_LANG_DATA_DIR = path
  .resolve(HERE, '..', '..', 'src', 'lang', 'data', 'online')
  .replace(/\\/g, '/');
// Where the app keeps its installed languages, made up.
const INSTALLED_LANG_DIR = path
  .resolve(HERE, '__installed-languages__')
  .replace(/\\/g, '/');

const PAGE_A = {
  page: 'alpha',
  label: 'Alpha window',
  focus: 'presenter',
  sections: [
    {
      id: 'tools',
      label: 'Tools',
      questions: [
        { id: 'clear', text: 'How do I clear the screen?', starter: true },
      ],
    },
  ],
};
const PAGE_B = {
  page: 'beta',
  label: 'Beta window',
  focus: 'reader',
  sections: [
    {
      id: 'reading',
      label: 'Reading',
      questions: [{ id: 'font', text: 'How do I make the text bigger?' }],
    },
  ],
};

// A made-up language written in signs: what is under test is which files
// are read as translations, not any language.
const OVERLAY_XX = {
  code: 'xx',
  sections: {},
  questions: {
    'alpha.tools.clear': {
      en: 'How do I clear the screen?',
      text: '✦ ⌫ ▭ ?',
    },
  },
};

function addVirtualFiles(rootPath, files) {
  if (!fsState.roots.includes(rootPath)) {
    fsState.roots.push(rootPath);
  }
  for (const [relativePath, content] of Object.entries(files)) {
    fsState.files.set(`${rootPath}/${relativePath}`, content);
  }
}

function useCorpus(files) {
  addVirtualFiles(QUESTIONS_DIR, files);
}

// No language installed: nothing to read a translation from.
function useNoTranslations() {
  configureLangPacks(() => {
    return [];
  });
}

// Installed languages, each a folder its `meta.json` names.
function useInstalledLanguages(files) {
  addVirtualFiles(INSTALLED_LANG_DIR, files);
  const codes = [
    ...new Set(
      Object.keys(files).map((relativePath) => {
        return relativePath.split('/')[0];
      }),
    ),
  ];
  configureLangPacks(() => {
    return codes.map((code) => {
      return `${INSTALLED_LANG_DIR}/${code}`;
    });
  });
}

// What every installed language below says of itself.
function toMeta(code) {
  return JSON.stringify({ langCode: code });
}

function useStandardCorpus() {
  useCorpus({
    'beta.json': JSON.stringify(PAGE_B),
    'alpha.json': JSON.stringify(PAGE_A),
    // The shape's own documentation, and files that are no page.
    'schema.json': JSON.stringify({ sections: [] }),
    'notes.txt': 'not a page',
    // One malformed file must not take the corpus down with it.
    'broken.json': '{ "page": ',
    'nosections.json': JSON.stringify({ page: 'empty' }),
  });
  useInstalledLanguages({
    'xx/meta.json': toMeta('xx'),
    'xx/questions.json': JSON.stringify(OVERLAY_XX),
    // One that does not parse, one with no questions in it, a language with
    // no corpus at all and a folder that is no language: none is read.
    'xy/meta.json': toMeta('xy'),
    'xy/questions.json': '{ not json',
    'xz/meta.json': toMeta('xz'),
    'xz/questions.json': JSON.stringify({ sections: {} }),
    'yy/meta.json': toMeta('yy'),
    'zz/questions.json': JSON.stringify(OVERLAY_XX),
  });
}

let savedKnowledgeDir;

beforeEach(() => {
  fsState.roots.length = 0;
  fsState.files.clear();
  fsState.hidden.length = 0;
  savedKnowledgeDir = process.env.OWA_KNOWLEDGE_DIR;
});

afterEach(() => {
  configureLangPacks(null);
  if (savedKnowledgeDir === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = savedKnowledgeDir;
  }
});

describe('a corpus folder that is not there', () => {
  it('lists no page, loads no page and no translation', () => {
    fsState.hidden.push(QUESTIONS_DIR);
    useNoTranslations();
    expect(listQuestionPageIds()).toEqual([]);
    expect(loadQuestionPages()).toEqual([]);
    expect(loadQuestionOverlays()).toEqual([]);
    expect(matchQuestions('clear')).toEqual([]);
    expect(outlineQuestions()).toEqual([]);
  });

  it('loads no translation when only the translations are missing', () => {
    useCorpus({ 'alpha.json': JSON.stringify(PAGE_A) });
    useNoTranslations();
    expect(loadQuestionPages()).toEqual([PAGE_A]);
    expect(loadQuestionOverlays()).toEqual([]);
  });
});

describe('the corpus on disk', () => {
  // The file name IS the page id, so the listing parses nothing -- a
  // malformed file is still listed by its name.
  it('lists the page ids from the file names alone', () => {
    useStandardCorpus();
    expect(listQuestionPageIds()).toEqual([
      'alpha',
      'beta',
      'broken',
      'nosections',
    ]);
  });

  it('loads every well-formed page, in a stable order', () => {
    useStandardCorpus();
    expect(loadQuestionPages()).toEqual([PAGE_A, PAGE_B]);
  });

  it('loads every well-formed translation, and nothing else', () => {
    useStandardCorpus();
    expect(loadQuestionOverlays()).toEqual([OVERLAY_XX]);
  });

  // A checkout's own source packages are no installation: while the app
  // says what is installed, they are not read.
  it('reads no translation the app has not installed', () => {
    useStandardCorpus();
    addVirtualFiles(ONLINE_LANG_DATA_DIR, {
      'xw/dictionary.json': '{}',
      'xw/questions.json': JSON.stringify({ ...OVERLAY_XX, code: 'xw' }),
    });
    useNoTranslations();
    expect(loadQuestionOverlays()).toEqual([]);
  });

  // Where no app says, a checkout's source packages are read: a folder with
  // a `dictionary.json` and an `assistant.json` (a language the assistant
  // is written for), beside one without facts, one with no dictionary and
  // a file that is no package.
  it('reads the source packages when no app says what is installed', async () => {
    useStandardCorpus();
    addVirtualFiles(ONLINE_LANG_DATA_DIR, {
      'xx/dictionary.json': '{}',
      'xx/assistant.json': '{}',
      'xx/questions.json': JSON.stringify(OVERLAY_XX),
      'ww/dictionary.json': '{}',
      'ww/questions.json': JSON.stringify(OVERLAY_XX),
      'yy/dictionary.json': '{}',
      'yy/assistant.json': '{}',
      'zz/questions.json': JSON.stringify(OVERLAY_XX),
      'README.md': '# languages',
    });
    configureLangPacks(null);
    // The source packages are listed once for the life of the module: a
    // module of its own, so it lists these.
    vi.resetModules();
    const questions = await import('./questions.mjs');
    expect(questions.loadQuestionOverlays()).toEqual([OVERLAY_XX]);
  });

  it('ranks and outlines the corpus on disk unless handed one', () => {
    useStandardCorpus();
    expect(
      matchQuestions('clear screen').map((row) => {
        return row.id;
      }),
    ).toEqual(['alpha.tools.clear']);
    expect(
      matchQuestions('bigger', { focus: 'reader' }).map((row) => {
        return row.id;
      }),
    ).toEqual(['beta.reading.font']);
    expect(
      outlineQuestions({ focus: 'reader' }).map((page) => {
        return page.page;
      }),
    ).toEqual(['beta']);
    // Handed its own pages, it reads nothing off the disk.
    expect(matchQuestions('clear screen', { pages: [PAGE_B] })).toEqual([]);
    expect(
      outlineQuestions({ pages: [PAGE_B] }).map((page) => {
        return page.page;
      }),
    ).toEqual(['beta']);
  });
});
