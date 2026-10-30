import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const LANG_DATA_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data');

// A fresh module per case: the packs are read once per process.
async function loadTran() {
  vi.resetModules();
  return import('./tran.mjs');
}

function readAssistant(langCode) {
  return JSON.parse(
    readFileSync(path.join(LANG_DATA_DIR, langCode, 'assistant.json'), 'utf-8'),
  );
}

let previousDirPath;
let bundleDirPath = '';

beforeAll(() => {
  bundleDirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-tran-'));
  // A bundle with no dictionaries in it: not a bundle to read labels from.
  writeFileSync(path.join(bundleDirPath, 'tran.json'), '{"languages":[]}');
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
    const codes = readdirSync(LANG_DATA_DIR).sort();
    expect(
      bundle.languages.map((language) => language.code).sort(),
    ).toEqual(codes);
    const khmer = bundle.languages.find((language) => language.code === 'km');
    const facts = readAssistant('km');
    expect(khmer.assistant).toEqual(facts);
    expect(khmer.name).toBe(facts.name ?? 'km');
    expect(khmer.nativeName).toBe(facts.nativeName ?? 'km');
    expect(bundle.dictionaries.km['clear long text']).toBe('លុបអត្ថបទវែង');
    expect(tran.tranText('Clear Long Text', 'km', bundle)).toBe('លុបអត្ថបទវែង');
    // Read once: the second bundle holds the very same dictionaries.
    expect(tran.loadTranBundle().dictionaries).toBe(bundle.dictionaries);
  });

  it('falls through a bundle that carries no dictionaries', async () => {
    process.env.OWA_KNOWLEDGE_DIR = bundleDirPath;
    fsState.hidden = [];
    const tran = await loadTran();
    expect(tran.tranText('Clear Long Text', 'km')).toBe('លុបអត្ថបទវែង');
    expect(tran.listTranLanguages().length).toBeGreaterThan(1);
  });

  it('falls through a bundle that does not parse', async () => {
    fsState.hidden = [];
    fsState.contents.set('electron-build/knowledge/tran.json', '{"diction');
    const tran = await loadTran();
    expect(tran.tranText('Clear Long Text', 'km')).toBe('លុបអត្ថបទវែង');
  });

  it('skips a folder with no pack, and keeps a pack that will not parse empty', async () => {
    fsState.hidden.push('src/lang/data/fr/index.ts');
    fsState.contents.set(
      'src/lang/data/km/index.ts',
      'const dictionary = { broken: };',
    );
    const tran = await loadTran();
    const bundle = tran.loadTranBundle();
    expect(bundle.dictionaries).not.toHaveProperty('fr');
    expect(bundle.dictionaries.km).toEqual({});
    // A label no dictionary has stays in English rather than going blank.
    expect(tran.tranText('Clear Long Text', 'km', bundle)).toBe(
      'Clear Long Text',
    );
  });

  it('has nothing to offer when there are no language packs at all', async () => {
    fsState.hidden.push('src/lang/data');
    const tran = await loadTran();
    expect(tran.loadTranBundle()).toEqual({ languages: [], dictionaries: {} });
    expect(tran.tranText('Clear Long Text', 'km')).toBe('Clear Long Text');
  });
});

describe('readSourceAssistantFacts and getLanguageFacts', () => {
  it('reads a language assistant facts, or null when there are none to read', async () => {
    const tran = await loadTran();
    expect(tran.readSourceAssistantFacts('km')).toEqual(readAssistant('km'));
    expect(tran.readSourceAssistantFacts('zz')).toBeNull();
    fsState.contents.set('src/lang/data/km/assistant.json', '{not json');
    expect(tran.readSourceAssistantFacts('km')).toBeNull();
  });

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
    expect(tran.getLanguageFacts('km')).toEqual(readAssistant('km'));
  });
});

describe('the template and label helpers', () => {
  it('lifts nothing out of text that holds no dictionary, or a broken one', async () => {
    const tran = await loadTran();
    expect(tran.extractDictionary('export const name = "km";')).toEqual({});
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
    expect(tran.tranText(undefined, 'km')).toBeUndefined();
    expect(tran.tranText('   ', 'km')).toBe('   ');
    expect(tran.tranText(42, 'km')).toBe(42);
  });

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
