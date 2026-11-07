// The Khmer cases of `tools/owa-devtools-mcp/tran.coverage.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { pathToFileURL as toSourceUrl } from 'node:url';
import { join as joinSourcePath } from 'node:path';
const SOURCE_URL = toSourceUrl(joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp/tran.coverage.test.mjs')).href;
import {
  existsSync,
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

// The dictionary as a checkout with no knowledge build reads it: straight out
// of the language packs. The disk is real; a test can hide a path from
// `existsSync` or hand back other bytes for one file.
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
  path.dirname(fileURLToPath(SOURCE_URL)),
  '..',
  '..',
);
// Every language but English: installable, one folder each -- this one's
// among them.
const ONLINE_DATA_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data', 'online');

// A fresh module per case: the source packs are read once per process. The
// two modules come out of the same fresh registry.
async function loadModules() {
  vi.resetModules();
  const tran = await import('../../../../../../../../tools/owa-devtools-mcp/tran.mjs');
  const langPacks = await import(
    '../../../../../../../../tools/owa-devtools-mcp/langPacks.mjs'
  );
  return { tran, langPacks };
}

async function loadTran() {
  return (await loadModules()).tran;
}

function readPackJson(langCode, fileName) {
  return JSON.parse(
    readFileSync(path.join(ONLINE_DATA_DIR, langCode, fileName), 'utf-8'),
  );
}

let previousDirPath;
let bundleDirPath = '';

beforeAll(() => {
  bundleDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-tran-'));
});

afterAll(() => {
  rmSync(bundleDirPath, { recursive: true, force: true });
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
  it('reads every language pack there is, with its own name, once', async () => {
    const tran = await loadTran();
    const bundle = tran.loadTranBundle();
    // English first, then a pack is a folder of `online/` with its
    // `dictionary.json` and an `assistant.json`, as the loader reads it with no app
    // to ask: the languages a person may only type say how in each
    // language's own `typed.json`, 2026-11-03).
    const codes = readdirSync(ONLINE_DATA_DIR)
      .filter((name) => {
        return (
          existsSync(path.join(ONLINE_DATA_DIR, name, 'dictionary.json')) &&
          existsSync(path.join(ONLINE_DATA_DIR, name, 'assistant.json'))
        );
      })
      .sort();
    expect(bundle.languages.map((language) => language.code)).toEqual([
      'en',
      ...codes,
    ]);
    const khmer = bundle.languages.find((language) => language.code === 'km');
    const meta = readPackJson('km', 'meta.json');
    expect(khmer.assistant).toEqual(readPackJson('km', 'assistant.json'));
    // Its name in its own words, from its manifest.
    expect(khmer.name).toBe(meta.name);
    expect(khmer.nativeName).toBe(meta.nativeName);
    expect(khmer.nativeName).toBe('ខ្មែរ');
    expect(bundle.dictionaries.km['clear long text']).toBe('លុបអត្ថបទវែង');
    expect(tran.tranText('Clear Long Text', 'km', bundle)).toBe('លុបអត្ថបទវែង');
    // Read once: the second bundle holds the very same dictionary.
    expect(tran.loadTranBundle().dictionaries.km).toBe(bundle.dictionaries.km);
  });

  it('reads Khmer from its own folder, whatever the bundle says of it', async () => {
    // A bundle an older build wrote, with a Khmer dictionary of its own: the
    // bundle is English alone now, and Khmer is the package's.
    writeFileSync(
      path.join(bundleDirPath, 'tran.json'),
      JSON.stringify({
        languages: [{ code: 'en' }, { code: 'km', name: 'Old' }],
        dictionaries: { km: { 'clear long text': 'old words' } },
      }),
    );
    process.env.OWA_KNOWLEDGE_DIR = bundleDirPath;
    fsState.hidden = [];
    const tran = await loadTran();
    expect(tran.tranText('Clear Long Text', 'km')).toBe('លុបអត្ថបទវែង');
    const khmerList = tran.listTranLanguages().filter((language) => {
      return language.code === 'km';
    });
    expect(khmerList).toHaveLength(1);
    expect(khmerList[0].name).toBe('Khmer');
  });

  it('falls through a bundle that does not parse', async () => {
    fsState.hidden = [];
    fsState.contents.set('electron-build/knowledge/tran.json', '{"diction');
    const tran = await loadTran();
    expect(tran.tranText('Clear Long Text', 'km')).toBe('លុបអត្ថបទវែង');
  });
});

// The user's rule (2026-11-04): a language is the app's only once installed.
describe('in the app', () => {
  it('has no Khmer until Khmer is installed, whatever the checkout holds', async () => {
    const { tran, langPacks } = await loadModules();
    langPacks.configureLangPacks(() => []);
    expect(tran.tranText('Clear Long Text', 'km')).toBe('Clear Long Text');
    expect(
      tran.resolveTranTemplates('[en:tran:Clear Long Text]', 'km-KH'),
    ).toBe('Clear Long Text');
    expect(tran.getLanguageFacts('km')).toBeNull();
    langPacks.configureLangPacks(null);
  });
});

describe('readSourceAssistantFacts and getLanguageFacts', () => {
  it('picks one language out of a bundle by code or locale', async () => {
    const tran = await loadTran();
    const bundle = {
      languages: [
        { code: 'km', assistant: { yes: 'បាទ' } },
        { code: 'fr' },
      ],
    };
    expect(tran.getLanguageFacts('km-KH', bundle)).toEqual({ yes: 'បាទ' });
    expect(tran.getLanguageFacts('fr', bundle)).toBeNull();
    expect(tran.getLanguageFacts(undefined, bundle)).toBeNull();
    expect(tran.getLanguageFacts('km', {})).toBeNull();
    // With no bundle given, the one on disk.
    expect(tran.getLanguageFacts('km')).toEqual(
      readPackJson('km', 'assistant.json'),
    );
  });
});

describe('the template and label helpers', () => {
  it('leaves a key written in another language as it was written', async () => {
    const tran = await loadTran();
    expect(
      tran.resolveTranTemplates('[fr:tran:Effacer] / [en:tran:Clear Long Text]', 'km'),
    ).toBe('Effacer / លុបអត្ថបទវែង');
    expect(tran.resolveTranTemplates('[en:tran:Clear Long Text]', 'en')).toBe(
      'Clear Long Text',
    );
    expect(tran.resolveTranTemplates(null, 'km')).toBeNull();
    expect(
      tran.listTranTemplateKeys('[en:tran:A] and [fr:tran:B]'),
    ).toEqual([
      { sourceLang: 'en', kind: 'tran', key: 'A' },
      { sourceLang: 'fr', kind: 'tran', key: 'B' },
    ]);
  });
});

describe("a checkout with no knowledge build", () => {

  it('skips a folder with no pack, and keeps a pack that will not parse with no words', async () => {
    fsState.hidden.push('src/lang/data/online/fr/dictionary.json');
    fsState.contents.set(
      'src/lang/data/online/km/dictionary.json',
      '{ broken: }',
    );
    const tran = await loadTran();
    const bundle = tran.loadTranBundle();
    const codeList = bundle.languages.map((language) => language.code);
    expect(codeList).not.toContain('fr');
    // Still a language, with no dictionary to read.
    expect(codeList).toContain('km');
    expect(bundle.dictionaries).not.toHaveProperty('fr');
    expect(bundle.dictionaries).not.toHaveProperty('km');
    // A label no dictionary has stays in English rather than going blank.
    expect(tran.tranText('Clear Long Text', 'km', bundle)).toBe(
      'Clear Long Text',
    );
  });
});

describe("readSourceAssistantFacts and getLanguageFacts", () => {
  it('reads a language assistant facts, or null when there are none to read', async () => {
    const tran = await loadTran();
    expect(tran.readSourceAssistantFacts('km')).toEqual(
      readPackJson('km', 'assistant.json'),
    );
    expect(tran.readSourceAssistantFacts('zz')).toBeNull();
    fsState.contents.set('src/lang/data/online/km/assistant.json', '{not json');
    expect(tran.readSourceAssistantFacts('km')).toBeNull();
  });
});
