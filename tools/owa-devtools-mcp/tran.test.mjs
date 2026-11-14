import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readSourceDictionary } from './langPacks.mjs';
import {
  extractDictionary,
  listTranLanguages,
  listTranTemplateKeys,
  loadTranBundle,
  resolveTranTemplates,
  tranText,
} from './tran.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');
// The language packages on disk: English's folder, and every installable
// language's (`src/lang/data/online/<code>/`), a folder with its
// `dictionary.json`.
const ONLINE_DATA_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data', 'online');
const ONLINE_CODE_LIST = existsSync(ONLINE_DATA_DIR)
  ? readdirSync(ONLINE_DATA_DIR).filter((code) => {
      return existsSync(path.join(ONLINE_DATA_DIR, code, 'dictionary.json'));
    })
  : [];
// The ones read with no app to ask: those the assistant is written for (an
// `assistant.json`, `langPacks.mjs`).
const ASSISTANT_CODE_LIST = ONLINE_CODE_LIST.filter((code) => {
  return existsSync(path.join(ONLINE_DATA_DIR, code, 'assistant.json'));
});

describe('resolveTranTemplates', () => {
  it('leaves the English in place when nothing can translate it', () => {
    // A language the app does not have, no language at all, and a key the
    // dictionary does not carry. The app's own `tran` throws on the last
    // of these in dev; a document must not, or one mistyped label costs
    // the reader the whole answer.
    expect(resolveTranTemplates('[en:tran:Clear Long Text]', 'zz')).toBe(
      'Clear Long Text',
    );
    expect(resolveTranTemplates('[en:tran:Clear Long Text]', null)).toBe(
      'Clear Long Text',
    );
    // Every language the checkout has a dictionary for, and one it has
    // none for.
    for (const code of ['zz', ...ASSISTANT_CODE_LIST]) {
      expect(
        resolveTranTemplates('[en:tran:Not A Real Label]', code),
        code,
      ).toBe('Not A Real Label');
    }
  });

  it('leaves text alone when there is nothing to fill in', () => {
    const plain = 'Press **F9** to clear it.';
    for (const code of ['zz', ...ASSISTANT_CODE_LIST]) {
      expect(resolveTranTemplates(plain, code), code).toBe(plain);
      // A bracket that is not a template must survive verbatim: the
      // manual is full of `[text](link)` and of bracketed asides.
      expect(resolveTranTemplates('[see W-06](w-06.md)', code), code).toBe(
        '[see W-06](w-06.md)',
      );
    }
  });
});

describe('tranText', () => {
  it('answers what one label reads as on screen', () => {
    // Matched the way `tran()` matches: trimmed and case-insensitive.
    expect(tranText('Bible Lookup', 'en')).toBe('Bible Lookup');
  });
});

describe('the language packs', () => {
  it('lifts the dictionary out of a pack without loading it', () => {
    // English writes the keys and translates none.
    expect(
      extractDictionary(
        readFileSync(
          path.join(REPO_ROOT, 'src', 'lang', 'data', 'en', 'index.ts'),
          'utf-8',
        ),
      ),
    ).toEqual({});
    // Every other language keeps the app's whole dictionary in its
    // `dictionary.json`.
    for (const code of ONLINE_CODE_LIST) {
      const dictionary = readSourceDictionary(path.join(ONLINE_DATA_DIR, code));
      expect(Object.keys(dictionary).length, code).toBeGreaterThan(1000);
      // Sanitized to `tran()`'s own key shape.
      expect(dictionary['Clear Long Text'], code).toBeUndefined();
    }
  });

  it('lists what the interface can be shown in', () => {
    // In a checkout with no app to ask, English and every package the
    // assistant is written for (an `assistant.json`, `langPacks.mjs`).
    expect(
      listTranLanguages()
        .map((language) => {
          return language.code;
        })
        .sort(),
    ).toEqual(['en', ...ASSISTANT_CODE_LIST].sort());
    expect(listTranLanguages()[0].code).toBe('en');
  });
});

// The guard this whole mechanism stands on.
//
// A document that says `[en:tran:Clear Bibel]` looks fine in English -- the
// token falls back to its own text -- and silently hands a volunteer reading another language an
// English label they cannot find on their screen. Nothing about reading the
// page shows it up, so it is caught here instead: every key written in the
// corpus has to be a key the app can actually translate.
describe('the knowledge corpus', () => {
  // Everything the knowledge bundle ships: the rules and the project
  // instructions name controls as templates too, and were walked by nothing
  // until the notes were read against the code (2026-10-11).
  const SOURCES = [
    path.join(REPO_ROOT, 'docs', 'manual-sources'),
    path.join(REPO_ROOT, '.claude', 'memory'),
    path.join(REPO_ROOT, '.claude', 'skills'),
    path.join(REPO_ROOT, '.claude', 'rules'),
  ];
  const listMarkdown = (dirPath) => {
    const filePaths = [];
    const walk = (current) => {
      for (const name of readdirSync(current)) {
        const entryPath = path.join(current, name);
        if (statSync(entryPath).isDirectory()) {
          walk(entryPath);
        } else if (name.endsWith('.md')) {
          filePaths.push(entryPath);
        }
      }
    };
    walk(dirPath);
    return filePaths;
  };
  const filePaths = [
    ...SOURCES.flatMap(listMarkdown),
    path.join(REPO_ROOT, '.claude', 'CLAUDE.md'),
  ];

  it('writes label templates that the app can actually translate', () => {
    const bundle = loadTranBundle();
    // English is the language the keys are WRITTEN in, so it translates
    // every key to itself by construction and can prove nothing here.
    const translatable = (bundle.languages ?? []).filter((language) => {
      return (
        ASSISTANT_CODE_LIST.includes(language.code) &&
        bundle.dictionaries?.[language.code] !== undefined
      );
    });
    // Every package read, none in an English-only tree.
    expect(translatable.length).toBe(ASSISTANT_CODE_LIST.length);
    const broken = [];
    let total = 0;
    for (const filePath of filePaths) {
      const content = readFileSync(filePath, 'utf-8');
      for (const token of listTranTemplateKeys(content)) {
        // `[en:tran:…]` is how a note writes "any template": the
        // shape, with no key in it to translate.
        if (token.key.trim() === '…') {
          continue;
        }
        total += 1;
        if (token.sourceLang !== 'en' || token.kind !== 'tran') {
          broken.push(
            `${path.basename(filePath)}: unknown template ` +
              `[${token.sourceLang}:${token.kind}:...]`,
          );
          continue;
        }
        // Asked of the DICTIONARY, not of the translation: a language
        // may write **Documents**, **Images** or **Bible** exactly as
        // English does, and a label that reads the same is still a
        // label the app translates.
        const dictionaryKey = token.key.trim().toLowerCase();
        for (const language of translatable) {
          const dictionary = bundle.dictionaries[language.code];
          if (dictionary[dictionaryKey] === undefined) {
            broken.push(
              `${path.basename(filePath)}: "${token.key}" has ` +
                `no ${language.code} translation`,
            );
          }
        }
      }
    }
    expect(broken).toEqual([]);
    // The templates exist at all: a corpus that lost them would pass the
    // check above by having nothing to check.
    expect(total).toBeGreaterThan(100);
  });
});
