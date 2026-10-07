import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Every name resolves to a public address, so no test touches the network;
// the private-address rule is exercised through address literals instead.
vi.mock('node:dns/promises', () => {
  return {
    lookup: async () => [{ address: '140.82.112.6', family: 4 }],
  };
});

const {
  BibleXmlProblem,
  downloadBibleXml,
  findBibleNameList,
  readBibleDraftMeta,
  rememberBibleNameLists,
  removeBibleDraft,
  sweepBibleDrafts,
  toBibleDraftPaths,
  writeBibleDraftMeta,
} = await import('./bibleXmlDraft.mjs');

const BIBLE_XML =
  '﻿<?xml version="1.0" encoding="UTF-8"?>\n<bible translation="Test">' +
  '<testament><book number="1"><chapter number="1"><verse number="1">' +
  'In the beginning</verse></chapter></book></testament></bible>';

let dirPath;
beforeEach(async () => {
  dirPath = await mkdtemp(path.join(os.tmpdir(), 'owa-bible-draft-test-'));
});
afterEach(async () => {
  await rm(dirPath, { recursive: true, force: true });
});

function genFetch(routeMap) {
  const calledList = [];
  const fetchImpl = async (url, options) => {
    calledList.push(url);
    fetchImpl.headerList.push(options?.headers ?? {});
    const route = routeMap[url];
    if (route === undefined) {
      return new Response('missing', { status: 404 });
    }
    return route();
  };
  fetchImpl.headerList = [];
  return { fetchImpl, calledList };
}

async function expectProblem(promise, problem) {
  const error = await promise.catch((caught) => caught);
  expect(error).toBeInstanceOf(BibleXmlProblem);
  expect(error.problem).toBe(problem);
}

describe('downloading what a link points at', () => {
  test('an XML file is saved as a draft, following a redirect', async () => {
    const { fetchImpl, calledList } = genFetch({
      'https://github.com/a/b/raw/main/KhmerBible.xml': () => {
        return new Response(null, {
          status: 302,
          headers: {
            location:
              'https://raw.githubusercontent.com/a/b/main/KhmerBible.xml',
          },
        });
      },
      'https://raw.githubusercontent.com/a/b/main/KhmerBible.xml': () => {
        return new Response(BIBLE_XML, { status: 200 });
      },
    });
    const result = await downloadBibleXml({
      url: 'https://github.com/a/b/raw/main/KhmerBible.xml',
      fetchImpl,
      dirPath,
    });
    expect(result.kind).toBe('xml');
    expect(result.draftId).toMatch(/^[a-z0-9]{12}$/);
    expect(result.fileName).toBe('KhmerBible.xml');
    expect(calledList).toHaveLength(2);
    expect(await readFile(result.xmlPath, 'utf8')).toBe(BIBLE_XML);
    expect(await readdir(dirPath)).toEqual([`${result.draftId}.xml`]);
  });

  test('a redirect into this machine is refused before it is opened', async () => {
    const { fetchImpl, calledList } = genFetch({
      'https://bibles.example/kjv.xml': () => {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://127.0.0.1:39223/mcp' },
        });
      },
    });
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/kjv.xml',
        fetchImpl,
        dirPath,
      }),
      'blocked',
    );
    expect(calledList).toEqual(['https://bibles.example/kjv.xml']);
  });

  test('not found, too large and not XML are each said as what they are', async () => {
    const { fetchImpl } = genFetch({
      'https://bibles.example/huge.xml': () => {
        return new Response('<?xml', {
          status: 200,
          headers: { 'content-length': String(500 * 1024 * 1024) },
        });
      },
      'https://bibles.example/data.json': () => {
        return new Response('{"books":[]}', { status: 200 });
      },
    });
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/gone.xml',
        fetchImpl,
        dirPath,
      }),
      'not-found',
    );
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/huge.xml',
        fetchImpl,
        dirPath,
      }),
      'too-large',
    );
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/data.json',
        fetchImpl,
        dirPath,
      }),
      'not-xml',
    );
    expect(await readdir(dirPath)).toEqual([]);
  });

  test('a web page answers the Bible files it links, the asked-for one first', async () => {
    const { fetchImpl } = genFetch({
      'https://bibles.example/downloads': () => {
        return new Response(
          '<!DOCTYPE html><html><body>' +
            '<a href="/x/EnglishKJV.xml">KJV</a>' +
            '<a href="/x/KhmerBible.xml">Khmer</a></body></html>',
          { status: 200 },
        );
      },
      'https://bibles.example/empty': () => {
        return new Response('<html><body>Nothing here</body></html>', {
          status: 200,
        });
      },
    });
    const result = await downloadBibleXml({
      url: 'https://bibles.example/downloads',
      find: 'the khmer one',
      fetchImpl,
      dirPath,
    });
    expect(result.kind).toBe('page');
    expect(result.files[0]).toEqual({
      name: 'KhmerBible.xml',
      url: 'https://bibles.example/x/KhmerBible.xml',
    });
    expect(result.matched).toBe(1);
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/empty',
        fetchImpl,
        dirPath,
      }),
      'page-without-files',
    );
  });

  test('a GitHub repository is read through its listing, each file titled from its first bytes', async () => {
    const { fetchImpl, calledList } = genFetch({
      'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/ThaiBible.xml':
        () => {
          return new Response(
            '<?xml version="1.0"?><bible translation="Thai Standard 2011" status="Public Domain">',
            { status: 206 },
          );
        },
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/':
        () => {
          return new Response(
            JSON.stringify([
              {
                download_url:
                  'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/ThaiBible.xml',
              },
            ]),
            { status: 200 },
          );
        },
    });
    const result = await downloadBibleXml({
      url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
      fetchImpl,
      dirPath,
    });
    expect(calledList).toEqual([
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/',
      'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/ThaiBible.xml',
    ]);
    // Only the head of the file is asked for, not the whole Bible.
    expect(fetchImpl.headerList[1].Range).toBe('bytes=0-2047');
    expect(result.files).toEqual([
      {
        name: 'ThaiBible.xml',
        url: 'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/ThaiBible.xml',
        title: 'Thai Standard 2011',
      },
    ]);
  });
});

describe('drafts on disk', () => {
  test('only the newest few, and nothing older than two hours, stay', async () => {
    const now = Date.now();
    const ageList = [10, 20, 30, 3 * 60];
    const idList = [
      'aaaaaaaaaaa1',
      'aaaaaaaaaaa2',
      'aaaaaaaaaaa3',
      'aaaaaaaaaaa4',
    ];
    for (const [index, id] of idList.entries()) {
      const filePath = path.join(dirPath, `${id}.xml`);
      await writeFile(filePath, 'x');
      const at = (now - ageList[index] * 60 * 1000) / 1000;
      await utimes(filePath, at, at);
    }
    await writeFile(path.join(dirPath, 'book-names.json'), '[]');
    await sweepBibleDrafts({ dirPath, now });
    expect((await readdir(dirPath)).sort()).toEqual([
      'aaaaaaaaaaa1.xml',
      'aaaaaaaaaaa2.xml',
      'book-names.json',
    ]);
  });

  test('a draft is named by its id only, and its notes come back', async () => {
    expect(() => toBibleDraftPaths('../../setting', dirPath)).toThrow();
    const id = 'abcdefabcdef';
    await writeFile(toBibleDraftPaths(id, dirPath).xmlPath, BIBLE_XML);
    await writeBibleDraftMeta(id, { title: 'Test' }, dirPath);
    expect(await readBibleDraftMeta(id, dirPath)).toEqual({ title: 'Test' });
    await removeBibleDraft(id, dirPath);
    await expectProblem(readBibleDraftMeta(id, dirPath), 'draft-gone');
  });

  test('book-name lists are remembered by an id made of the names', async () => {
    const names = Array.from({ length: 66 }, (_, index) => `Book ${index}`);
    const [kept] = await rememberBibleNameLists(
      [{ label: 'Test names', source: 'built in', names }],
      { dirPath },
    );
    expect(kept.id).toMatch(/^n[0-9a-f]{8}$/);
    expect((await findBibleNameList(kept.id, { dirPath })).names).toEqual(
      names,
    );
    expect(await findBibleNameList('../x', { dirPath })).toBeNull();
  });
});
