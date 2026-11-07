import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hashManualPage,
  listEnglishManualPages,
  listManualLanguages,
  listManualTranslations,
  readFrontMatter,
} from './manualI18n.mjs';

let rootPath = '';

function writeFile(relativePath, content) {
  const filePath = path.join(rootPath, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

beforeEach(() => {
  rootPath = mkdtempSync(path.join(tmpdir(), 'owa-'));
});

afterEach(() => {
  rmSync(rootPath, { recursive: true, force: true });
});

describe('readFrontMatter', () => {
  it('reads nothing out of a page with no front matter', () => {
    expect(readFrontMatter('# Just a heading\nid: W-01\n')).toEqual({});
    expect(readFrontMatter(undefined)).toEqual({});
  });

  it('reads each field, quotes off, CRLF or not', () => {
    expect(
      readFrontMatter('---\r\nid: W-06\r\ntitle: "Show a verse"\r\n---\r\nx'),
    ).toEqual({ id: 'W-06', title: 'Show a verse' });
  });
});

describe('a manual tree that is not there', () => {
  it('lists no English page and no language', () => {
    const missingPath = path.join(rootPath, 'missing');
    expect(listEnglishManualPages(missingPath).size).toBe(0);
    expect(listManualLanguages(missingPath)).toEqual([]);
  });
});

describe('a translation is current only while its English page is', () => {
  const ENGLISH = '---\nid: W-06\ntitle: Show a verse\n---\n1. Press **F9**.\n';
  const TRANSLATED_TITLE = '✦ ✝ ✧';

  it('marks a translation of the page as it stands current, others stale', () => {
    const sourceDir = path.join(rootPath, 'sources');
    const i18nDir = path.join(rootPath, 'i18n');
    writeFile('sources/presenting/w-06.md', ENGLISH);
    // A page with no id is no page of the manual.
    writeFile('sources/notes.md', '# Notes\n');
    writeFile('sources/README.txt', 'not markdown');
    const englishPageMap = listEnglishManualPages(sourceDir);
    expect([...englishPageMap.keys()]).toEqual(['W-06']);
    const english = englishPageMap.get('W-06');
    expect(english.relativePath).toBe(path.join('presenting', 'w-06.md'));
    // Line endings and edge space never make a page stale.
    expect(english.hash).toBe(hashManualPage(ENGLISH.replace(/\n/g, '\r\n')));

    // A made-up language written in signs: what is under test is which
    // translation is current, not any language.
    writeFile(
      'i18n/xx/manual/presenting/w-06.md',
      `---\nid: W-06\ntitle: ${TRANSLATED_TITLE}\nsection: Presenting\ntranslatedFrom: ${english.hash}\n---\n1. ➜ **F9** ✔\n`,
    );
    writeFile(
      'i18n/xx/manual/presenting/w-07.md',
      '---\nid: W-07\ntranslatedFrom: 0000000000000000\n---\nx\n',
    );
    writeFile(
      'i18n/xx/manual/old.md',
      '---\nid: W-06\ntranslatedFrom: ffffffffffffffff\n---\nold\n',
    );
    // A file beside the language folders is no language, and nor is a
    // package with no manual in it.
    writeFile('i18n/README.md', 'about the translations');
    writeFile('i18n/yy/dictionary.json', '{}');
    expect(listManualLanguages(i18nDir)).toEqual(['xx']);

    const pages = listManualTranslations('xx', { i18nDir, englishPageMap });
    const byPath = new Map(
      pages.map((page) => {
        return [page.relativePath, page];
      }),
    );
    const current = byPath.get(path.join('presenting', 'w-06.md'));
    expect(current).toMatchObject({
      id: 'W-06',
      lang: 'xx',
      title: TRANSLATED_TITLE,
      section: 'Presenting',
      translatedFrom: english.hash,
      isStale: false,
    });
    // No English page of that id at all: stale, with its title from the
    // file name and no section.
    expect(byPath.get(path.join('presenting', 'w-07.md'))).toMatchObject({
      id: 'W-07',
      title: 'w-07',
      section: '',
      isStale: true,
    });
    // Made from words the English page no longer says.
    expect(byPath.get('old.md').isStale).toBe(true);
  });
});
