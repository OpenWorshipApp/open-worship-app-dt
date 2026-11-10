import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `tran.mjs` reads English from a built `electron-build/knowledge/tran.json`
// (or, with none, from `src/lang/data/en`) and every other language from its
// own pack -- in a checkout, `src/lang/data/online/<code>/` -- so which one
// a test reads depends on whether this checkout was ever built. Here it is
// decided by the test: the built bundle is hidden, and the packs are a few
// virtual files, so every case below reads exactly what it set up.
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
const REPO_ROOT = path.join(HERE, '..', '..');

function toKey(target) {
  return path.resolve(target).replace(/\\/g, '/');
}

const DATA_DIR = toKey(path.join(REPO_ROOT, 'src', 'lang', 'data'));
const BUILT_TRAN_PATH = toKey(
  path.join(REPO_ROOT, 'electron-build', 'knowledge', 'tran.json'),
);

const AA_DICTIONARY = JSON.stringify({
  'Clear Long Text': 'AA clear',
  'Bible Lookup': 'AA lookup',
  Nested: { not: 'a label' },
});
const AA_FACTS = {
  name: 'Aa facts name',
  scriptPattern: '[\\u2600-\\u26FF]',
};
// A pack's names are its manifest's.
const AA_META = {
  locale: 'aa-AA',
  name: 'Aa language',
  nativeName: 'Aa native',
};
const EN_FACTS = { name: 'English', yes: 'yes' };
const DD_FACTS = { name: 'Dd facts name' };

function useSourcePacks(files) {
  fsState.roots.push(DATA_DIR);
  for (const [relativePath, content] of Object.entries(files)) {
    fsState.files.set(`${DATA_DIR}/${relativePath}`, content);
  }
}

function useStandardPacks() {
  useSourcePacks({
    'en/assistant.json': JSON.stringify(EN_FACTS),
    'online/aa/dictionary.json': AA_DICTIONARY,
    'online/aa/meta.json': JSON.stringify(AA_META),
    'online/aa/assistant.json': JSON.stringify(AA_FACTS),
    // A dictionary that does not parse, and facts that are not JSON.
    'online/bb/dictionary.json': "{ 'Clear Long Text': ( }",
    'online/bb/assistant.json': '{ not json',
    // A folder with no pack in it is no language.
    'online/cc/notes.md': 'nothing here',
    'online/dd/dictionary.json': JSON.stringify({
      'Clear Long Text': 'DD clear',
    }),
    'online/dd/assistant.json': JSON.stringify(DD_FACTS),
    // With no app to say what is installed, only a pack the assistant is
    // written for is read (`langPacks.mjs`): this one has no facts.
    'online/ee/dictionary.json': JSON.stringify({
      'Clear Long Text': 'EE clear',
    }),
  });
}

const ENGLISH = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  assistant: EN_FACTS,
};

let knowledgeDirPath = null;
let savedKnowledgeDir;

function useKnowledgeDir(tranJsonText) {
  knowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-'));
  writeFileSync(path.join(knowledgeDirPath, 'tran.json'), tranJsonText);
  process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
}

async function loadTran() {
  return import('./tran.mjs');
}

beforeEach(() => {
  // The packs are cached for the life of the module: a fresh one per test.
  vi.resetModules();
  fsState.roots.length = 0;
  fsState.files.clear();
  fsState.hidden.length = 0;
  fsState.hidden.push(BUILT_TRAN_PATH);
  savedKnowledgeDir = process.env.OWA_KNOWLEDGE_DIR;
  delete process.env.OWA_KNOWLEDGE_DIR;
});

afterEach(() => {
  if (savedKnowledgeDir === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = savedKnowledgeDir;
  }
  if (knowledgeDirPath !== null) {
    rmSync(knowledgeDirPath, { recursive: true, force: true });
    knowledgeDirPath = null;
  }
});

describe('a source checkout with no build', () => {
  it('reads English and every language pack there is, and its facts', async () => {
    useStandardPacks();
    const { loadTranBundle, listTranLanguages } = await loadTran();
    const bundle = loadTranBundle();
    // Sanitized to `tran()`'s own keys; a value that is no label is left
    // out, and a pack that cannot be read has no dictionary at all.
    expect(bundle.dictionaries).toEqual({
      aa: { 'clear long text': 'AA clear', 'bible lookup': 'AA lookup' },
      dd: { 'clear long text': 'DD clear' },
    });
    expect(bundle.languages).toEqual([
      ENGLISH,
      {
        code: 'aa',
        name: 'Aa language',
        nativeName: 'Aa native',
        assistant: AA_FACTS,
      },
      // No manifest: the code stands in for its names.
      { code: 'bb', name: 'bb', nativeName: 'bb', assistant: null },
      { code: 'dd', name: 'dd', nativeName: 'dd', assistant: DD_FACTS },
    ]);
    expect(
      listTranLanguages().map((language) => {
        return language.code;
      }),
    ).toEqual(['en', 'aa', 'bb', 'dd']);
  });

  it('translates through the packs, a locale as readily as a code', async () => {
    useStandardPacks();
    const { resolveTranTemplates, tranText } = await loadTran();
    expect(tranText('Clear Long Text', 'aa')).toBe('AA clear');
    expect(tranText('  bible lookup ', 'aa-XX')).toBe('AA lookup');
    expect(tranText('Clear Long Text', 'dd')).toBe('DD clear');
    // A pack the assistant is not written for is not read with no app.
    expect(tranText('Clear Long Text', 'ee')).toBe('Clear Long Text');
    // The broken pack translates nothing, and costs nothing but that.
    expect(tranText('Clear Long Text', 'bb')).toBe('Clear Long Text');
    expect(resolveTranTemplates('Press [en:tran:Clear Long Text].', 'aa')).toBe(
      'Press AA clear.',
    );
  });

  // Only ever outside the app, in a checkout whose files do not change
  // under it: the packs are read once.
  it('reads the packs once for the life of the module', async () => {
    useStandardPacks();
    const { loadTranBundle, tranText } = await loadTran();
    expect(tranText('Clear Long Text', 'aa')).toBe('AA clear');
    fsState.files.set(
      `${DATA_DIR}/online/aa/dictionary.json`,
      JSON.stringify({ 'Clear Long Text': 'AA changed' }),
    );
    fsState.files.set(
      `${DATA_DIR}/online/aa/meta.json`,
      JSON.stringify({ name: 'Renamed' }),
    );
    expect(tranText('Clear Long Text', 'aa')).toBe('AA clear');
    expect(loadTranBundle().languages[1].name).toBe('Aa language');
  });

  it('answers with English alone when there are no packs', async () => {
    fsState.hidden.push(DATA_DIR);
    const { listTranLanguages, loadTranBundle, tranText } = await loadTran();
    const englishAlone = {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      assistant: null,
    };
    expect(loadTranBundle()).toEqual({
      languages: [englishAlone],
      dictionaries: {},
    });
    expect(listTranLanguages()).toEqual([englishAlone]);
    expect(tranText('Clear Long Text', 'aa')).toBe('Clear Long Text');
  });
});

describe('a built bundle', () => {
  it('is English alone: every other language comes from its pack', async () => {
    useStandardPacks();
    useKnowledgeDir(
      JSON.stringify({
        languages: [
          {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            assistant: { isBuilt: true },
          },
          { code: 'aa', name: 'Built', nativeName: 'Built' },
          { code: 'zz', name: 'Gone', nativeName: 'Gone' },
        ],
        dictionaries: {
          aa: { 'clear long text': 'AA built' },
          zz: { 'clear long text': 'ZZ built' },
        },
      }),
    );
    const { listTranLanguages, tranText } = await loadTran();
    expect(tranText('Clear Long Text', 'aa')).toBe('AA clear');
    // A language that is not in its own folder is not there at all.
    expect(tranText('Clear Long Text', 'zz')).toBe('Clear Long Text');
    const languageList = listTranLanguages();
    expect(languageList[0]).toEqual({
      code: 'en',
      name: 'English',
      nativeName: 'English',
      assistant: { isBuilt: true },
    });
    expect(
      languageList.map((language) => {
        return [language.code, language.name];
      }),
    ).toEqual([
      ['en', 'English'],
      ['aa', 'Aa language'],
      ['bb', 'bb'],
      ['dd', 'dd'],
    ]);
  });

  it('that cannot be read gives English from its folder', async () => {
    useStandardPacks();
    useKnowledgeDir('{ not json');
    const { listTranLanguages, tranText } = await loadTran();
    expect(listTranLanguages()[0]).toEqual(ENGLISH);
    expect(tranText('Clear Long Text', 'aa')).toBe('AA clear');
  });

  it('with no English in it gives English from its folder', async () => {
    useStandardPacks();
    useKnowledgeDir(JSON.stringify({ languages: [] }));
    const { loadTranBundle } = await loadTran();
    const bundle = loadTranBundle();
    expect(bundle.languages[0]).toEqual(ENGLISH);
    expect(Object.keys(bundle.dictionaries)).toEqual(['aa', 'dd']);
  });
});

describe('readSourceAssistantFacts', () => {
  it('reads a language facts, or null when it has none or they are broken', async () => {
    useStandardPacks();
    const { readSourceAssistantFacts } = await loadTran();
    expect(readSourceAssistantFacts('en')).toEqual(EN_FACTS);
    expect(readSourceAssistantFacts('aa')).toEqual(AA_FACTS);
    expect(readSourceAssistantFacts('bb')).toBeNull();
    expect(readSourceAssistantFacts('zz')).toBeNull();
  });
});

describe('getLanguageFacts', () => {
  const bundle = {
    languages: [
      { code: 'en', assistant: null },
      { code: 'xx', assistant: { scriptPattern: 'x' } },
    ],
  };

  it('reads one language facts out of a bundle, locale or code', async () => {
    const { getLanguageFacts } = await loadTran();
    expect(getLanguageFacts('xx-XX', bundle)).toEqual({ scriptPattern: 'x' });
    expect(getLanguageFacts('xx', bundle)).toEqual({ scriptPattern: 'x' });
  });

  it('answers null for a language with none, or none at all', async () => {
    const { getLanguageFacts } = await loadTran();
    expect(getLanguageFacts('en', bundle)).toBeNull();
    expect(getLanguageFacts('zz', bundle)).toBeNull();
    expect(getLanguageFacts(undefined, bundle)).toBeNull();
    expect(getLanguageFacts('xx', {})).toBeNull();
  });

  it('reads the bundle itself when given none', async () => {
    useStandardPacks();
    const { getLanguageFacts } = await loadTran();
    expect(getLanguageFacts('aa')).toEqual(AA_FACTS);
  });
});

describe('extractDictionary', () => {
  it('finds nothing in a file that has no dictionary literal', async () => {
    const { extractDictionary } = await loadTran();
    expect(extractDictionary("export const name = 'Aa';")).toEqual({});
  });

  it('finds nothing in a literal that never closes', async () => {
    const { extractDictionary } = await loadTran();
    expect(extractDictionary("const dictionary = { 'A': 'a',")).toEqual({});
  });
});

describe('tranText edges', () => {
  // A made-up language written in signs.
  const bundle = {
    dictionaries: { xx: { 'clear long text': '✦ ⌫' } },
  };

  it('hands back what is not text, or is only space', async () => {
    const { tranText } = await loadTran();
    expect(tranText(null, 'xx', bundle)).toBeNull();
    expect(tranText(42, 'xx', bundle)).toBe(42);
    expect(tranText('   ', 'xx', bundle)).toBe('   ');
    // And what is text is the dictionary's, so the edges above are edges.
    expect(tranText('Clear Long Text', 'xx', bundle)).toBe('✦ ⌫');
  });
});
