import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

// The dictionary as a checkout with no knowledge build reads it: English from
// its own folder, every other language straight out of its pack. The disk is
// real; a test can hide a path from `existsSync` or hand back other bytes for
// one file.
const fsState = vi.hoisted(() => ({ hidden: [], contents: new Map() }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const toPosix = (filePath) => String(filePath).replace(/\\/g, '/');
  return {
    ...actual,
    existsSync: (filePath) => {
      return (
        !fsState.hidden.some((part) => toPosix(filePath).includes(part)) &&
        actual.existsSync(filePath)
      );
    },
    readFileSync: (filePath, ...rest) => {
      for (const [ending, content] of fsState.contents) {
        if (toPosix(filePath).endsWith(ending)) {
          return content;
        }
      }
      return actual.readFileSync(filePath, ...rest);
    },
  };
});

const REPO_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const LANG_DATA_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data');
// Every language but English: installable, one folder each.
const ONLINE_DATA_DIR = path.join(LANG_DATA_DIR, 'online');

// A fresh module per case: the source packs are read once per process. The
// two modules come out of the same fresh registry, so a lister given to the
// one is the one the other reads.
async function loadModules() {
  vi.resetModules();
  const tran = await import('./tran.mjs');
  const langPacks = await import('./langPacks.mjs');
  return { tran, langPacks };
}

async function loadTran() {
  return (await loadModules()).tran;
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readEnglishAssistant() {
  return readJsonOrNull(path.join(LANG_DATA_DIR, 'en', 'assistant.json'));
}

// The source packages read with no app to ask: the ones the assistant is
// written for, a folder of `online/` with its `dictionary.json` AND an
// `assistant.json` (`langPacks.mjs`).
function listOnlineCodes() {
  return readdirSync(ONLINE_DATA_DIR)
    .filter((name) => {
      return (
        existsSync(path.join(ONLINE_DATA_DIR, name, 'dictionary.json')) &&
        existsSync(path.join(ONLINE_DATA_DIR, name, 'assistant.json'))
      );
    })
    .sort();
}

let previousDirPath;
let bundleDirPath = '';
let pluginRootPath = '';

function writeBundle(bundle) {
  writeFileSync(
    path.join(bundleDirPath, 'tran.json'),
    typeof bundle === 'string' ? bundle : JSON.stringify(bundle),
  );
  process.env.OWA_KNOWLEDGE_DIR = bundleDirPath;
}

// An installed plugin folder, as `build-lang-plugins.mjs` writes one.
function writePlugin(folderName, files) {
  const dirPath = path.join(pluginRootPath, folderName);
  mkdirSync(dirPath, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(
      path.join(dirPath, fileName),
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  }
  return dirPath;
}

beforeAll(() => {
  bundleDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-tran-'));
  pluginRootPath = mkdtempSync(path.join(os.tmpdir(), 'owa-tran-lang-'));
});

afterAll(() => {
  rmSync(bundleDirPath, { recursive: true, force: true });
  rmSync(pluginRootPath, { recursive: true, force: true });
});

beforeEach(() => {
  previousDirPath = process.env.OWA_KNOWLEDGE_DIR;
  delete process.env.OWA_KNOWLEDGE_DIR;
  fsState.hidden = ['electron-build/knowledge/tran.json'];
  fsState.contents = new Map();
});

afterEach(() => {
  if (previousDirPath === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = previousDirPath;
  }
});

describe('a checkout with no knowledge build', () => {
  it('reads English and every language pack there is, each with its own name, once', async () => {
    const tran = await loadTran();
    const bundle = tran.loadTranBundle();
    // English first, from its own folder; then a pack is a folder of
    // `online/` with its `dictionary.json`, as the loader reads it: the languages a
    // person may only type say how in each language's own `typed.json`
    // (2026-11-03).
    const codes = listOnlineCodes();
    expect(bundle.languages.map((language) => language.code)).toEqual([
      'en',
      ...codes,
    ]);
    const englishFacts = readEnglishAssistant();
    expect(bundle.languages[0]).toEqual({
      code: 'en',
      name: englishFacts?.name ?? 'English',
      nativeName: englishFacts?.nativeName ?? 'English',
      assistant: englishFacts,
    });
    // Each pack with its own facts and its name in its own words, both out
    // of its own folder.
    for (const code of codes) {
      const language = bundle.languages.find((one) => one.code === code);
      const meta = readJsonOrNull(
        path.join(ONLINE_DATA_DIR, code, 'meta.json'),
      );
      expect(language.assistant, code).toEqual(
        readJsonOrNull(path.join(ONLINE_DATA_DIR, code, 'assistant.json')),
      );
      expect(language.name, code).toBe(meta?.name ?? code);
      expect(language.nativeName, code).toBe(
        meta?.nativeName ?? meta?.name ?? code,
      );
    }
    // English is the key language: no dictionary of its own.
    expect(bundle.dictionaries).not.toHaveProperty('en');
    // Read once: the second bundle holds the very same dictionaries.
    const second = tran.loadTranBundle();
    for (const [code, dictionary] of Object.entries(bundle.dictionaries)) {
      expect(second.dictionaries[code], code).toBe(dictionary);
    }
  });

  it('reads English from its folder when the bundle has none', async () => {
    writeBundle({ languages: [] });
    fsState.hidden = [];
    const tran = await loadTran();
    const languageList = tran.listTranLanguages();
    expect(languageList[0].assistant).toEqual(readEnglishAssistant());
    // The source packs answer for the rest, every one of them.
    expect(languageList.length).toBe(1 + listOnlineCodes().length);
  });

  it('believes a bundle for English alone', async () => {
    // What an older build wrote: another language and its dictionary in the
    // bundle. A language that is not in its own folder is not there at all.
    writeBundle({
      languages: [
        {
          code: 'en',
          name: 'English',
          nativeName: 'English',
          assistant: { isBuilt: true },
        },
        { code: 'zz', name: 'Zz', nativeName: 'Zz' },
      ],
      dictionaries: { zz: { 'clear long text': 'ZZ clear' } },
    });
    const tran = await loadTran();
    const bundle = tran.loadTranBundle();
    expect(bundle.languages[0].assistant).toEqual({ isBuilt: true });
    expect(bundle.languages.map((language) => language.code)).not.toContain(
      'zz',
    );
    expect(bundle.dictionaries).not.toHaveProperty('zz');
    expect(tran.tranText('Clear Long Text', 'zz')).toBe('Clear Long Text');
  });

  it('reads English from its folder when the bundle will not parse', async () => {
    writeBundle('{"languages": [');
    const tran = await loadTran();
    expect(tran.listTranLanguages()[0].assistant).toEqual(
      readEnglishAssistant(),
    );
  });

  it('has English alone when there are no language packs at all', async () => {
    fsState.hidden.push('src/lang/data');
    const tran = await loadTran();
    expect(tran.loadTranBundle()).toEqual({
      languages: [
        { code: 'en', name: 'English', nativeName: 'English', assistant: null },
      ],
      dictionaries: {},
    });
    expect(tran.tranText('Clear Long Text', 'zz')).toBe('Clear Long Text');
  });
});

// In the app: the languages INSTALLED, out of their plugin folders, and
// nothing out of a checkout's source -- a language nobody installed has no
// words here, whatever the tree holds.
describe('installed language plugins', () => {
  // A made-up language written in signs.
  const PLUGIN_FILES = {
    'meta.json': { langCode: 'xx', name: 'Signs', nativeName: '✦✦' },
    'tran.json': { 'Clear Long Text': '✦ ⌫', 'Bible Lookup': '✦ ⌕' },
    'assistant.json': { name: 'Signs', yes: '✓' },
  };

  it('reads each one from its own folder, and no source pack', async () => {
    const dirPath = writePlugin('xx@1.0.0', PLUGIN_FILES);
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => [dirPath]);
    const bundle = tran.loadTranBundle();
    expect(bundle.languages.map((language) => language.code)).toEqual([
      'en',
      'xx',
    ]);
    expect(bundle.languages[1]).toEqual({
      code: 'xx',
      name: 'Signs',
      nativeName: '✦✦',
      assistant: { name: 'Signs', yes: '✓' },
    });
    // Sanitized to `tran()`'s own keys, however the plugin wrote them.
    expect(bundle.dictionaries).toEqual({
      xx: { 'clear long text': '✦ ⌫', 'bible lookup': '✦ ⌕' },
    });
    expect(tran.tranText('  bible lookup ', 'xx-YY')).toBe('✦ ⌕');
    expect(tran.readSourceAssistantFacts('xx')).toEqual({
      name: 'Signs',
      yes: '✓',
    });
    langPacks.configureLangPacks(null);
  });

  // Installed a minute ago is read on the next call: an installed folder is
  // never kept, unlike the checkout's source.
  it('reads them afresh on every call', async () => {
    const dirPath = writePlugin('xx@1.0.1', PLUGIN_FILES);
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => [dirPath]);
    expect(tran.tranText('Clear Long Text', 'xx')).toBe('✦ ⌫');
    writeFileSync(
      path.join(dirPath, 'tran.json'),
      JSON.stringify({ 'Clear Long Text': '✦ updated' }),
    );
    expect(tran.tranText('Clear Long Text', 'xx')).toBe('✦ updated');
    langPacks.configureLangPacks(null);
  });

  it('has English alone with none installed, whatever the checkout holds', async () => {
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => []);
    expect(tran.listTranLanguages().map((language) => language.code)).toEqual([
      'en',
    ]);
    // A lister that fails has nothing installed to offer either.
    langPacks.configureLangPacks(() => {
      throw new Error('no app');
    });
    expect(tran.listTranLanguages().map((language) => language.code)).toEqual([
      'en',
    ]);
    langPacks.configureLangPacks(null);
  });

  it('reads the checkout only when the lister cannot tell', async () => {
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => null);
    expect(tran.listTranLanguages().length).toBe(1 + listOnlineCodes().length);
    langPacks.configureLangPacks(null);
  });

  it('takes a language once, and never a folder that is no plugin', async () => {
    const dirPathList = [
      writePlugin('xx@2.0.0', PLUGIN_FILES),
      // The same language a second time: the first found stands.
      writePlugin('xx@0.0.1', {
        ...PLUGIN_FILES,
        'tran.json': { 'Clear Long Text': 'older' },
      }),
      // English is the app's own, never a plugin's.
      writePlugin('en@9.0.0', {
        'meta.json': { langCode: 'en' },
        'tran.json': { 'Clear Long Text': 'not English' },
      }),
      writePlugin('bad-code', { 'meta.json': { langCode: 'X1' } }),
      writePlugin('no-meta', { 'tran.json': { a: 'b' } }),
      path.join(pluginRootPath, 'missing-folder'),
    ];
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => dirPathList);
    const bundle = tran.loadTranBundle();
    expect(bundle.languages.map((language) => language.code)).toEqual([
      'en',
      'xx',
    ]);
    expect(tran.tranText('Clear Long Text', 'xx', bundle)).toBe('✦ ⌫');
    expect(tran.tranText('Clear Long Text', 'en', bundle)).toBe(
      'Clear Long Text',
    );
    langPacks.configureLangPacks(null);
  });
});

// A language package's own tests read its facts; these read English's, the
// one package every tree has.
describe('readSourceAssistantFacts and getLanguageFacts', () => {
  it('reads a language assistant facts, or null when there are none to read', async () => {
    const tran = await loadTran();
    expect(tran.readSourceAssistantFacts('en')).toEqual(readEnglishAssistant());
    expect(tran.readSourceAssistantFacts('zz')).toBeNull();
    fsState.contents.set('src/lang/data/en/assistant.json', '{not json');
    expect(tran.readSourceAssistantFacts('en')).toBeNull();
  });

  it('picks one language out of a bundle by code or locale', async () => {
    const tran = await loadTran();
    const bundle = { languages: [{ code: 'xx' }] };
    expect(tran.getLanguageFacts('xx-YY', bundle)).toBeNull();
    expect(tran.getLanguageFacts(undefined, bundle)).toBeNull();
    expect(tran.getLanguageFacts('en', {})).toBeNull();
    // With no bundle given, the one on disk; a locale reads its language.
    expect(tran.getLanguageFacts('en-US')).toEqual(readEnglishAssistant());
  });
});

describe('the template and label helpers', () => {
  it('lifts nothing out of text that holds no dictionary, or a broken one', async () => {
    const tran = await loadTran();
    expect(tran.extractDictionary('export const name = "xx";')).toEqual({});
    expect(
      tran.extractDictionary('const dictionary = { a: "b", c: { d: 1 }'),
    ).toEqual({});
    expect(
      tran.extractDictionary(
        'const dictionary = { "Clear All": "x", count: 3, nested: { a: 1 } };',
      ),
    ).toEqual({ 'clear all': 'x' });
  });

  it('gives back what is not a label to translate', async () => {
    const tran = await loadTran();
    expect(tran.tranText(undefined, 'xx')).toBeUndefined();
    expect(tran.tranText('   ', 'xx')).toBe('   ');
    expect(tran.tranText(42, 'xx')).toBe(42);
  });
});
