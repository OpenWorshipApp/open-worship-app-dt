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
  clearBibleListingCache,
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
  // One listing is remembered for ten minutes: never across two tests.
  clearBibleListingCache();
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
    expect(result.suggestions).toBeUndefined();
    // A word no file has, close to a language the page does have: offered
    // in the answer and in the note the model reads.
    const slipped = await downloadBibleXml({
      url: 'https://bibles.example/downloads',
      find: 'kmer',
      fetchImpl,
      dirPath,
    });
    expect(slipped.matched).toBe(0);
    expect(slipped.files).toEqual([]);
    expect(slipped.suggestions).toEqual(['Khmer']);
    expect(slipped.note).toContain('closest languages it has: Khmer');
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

  // Measured 2026-10-10: every look at the catalog was a 0.9 MB listing out
  // of sixty unsigned reads an hour, and narrowing "Khmer" to "2016" is two.
  test('a listing is read once for ten minutes of choosing, titles too', async () => {
    const listingUrl =
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/';
    const rawUrl = (name) => {
      return `https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/${name}`;
    };
    const { fetchImpl, calledList } = genFetch({
      [listingUrl]: () => {
        return new Response(
          JSON.stringify([
            { download_url: rawUrl('ThaiBible.xml') },
            { download_url: rawUrl('KhmerBible.xml') },
          ]),
          { status: 200 },
        );
      },
      [rawUrl('ThaiBible.xml')]: () => {
        return new Response('<bible translation="Thai Standard">', {
          status: 206,
        });
      },
      [rawUrl('KhmerBible.xml')]: () => {
        return new Response('<bible translation="Khmer Standard">', {
          status: 206,
        });
      },
    });
    const ask = (find, now) => {
      return downloadBibleXml({
        url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
        find,
        fetchImpl,
        dirPath,
        now,
      });
    };
    const startedAt = 1_000_000;
    expect((await ask('thai', startedAt)).files[0].title).toBe('Thai Standard');
    expect(calledList).toEqual([listingUrl, rawUrl('ThaiBible.xml')]);
    // Another language a minute on: the listing is not asked for again...
    const khmer = await ask('khmer', startedAt + 60 * 1000);
    expect(khmer.files[0].title).toBe('Khmer Standard');
    expect(calledList).toEqual([
      listingUrl,
      rawUrl('ThaiBible.xml'),
      rawUrl('KhmerBible.xml'),
    ]);
    // ...nor a title already read.
    await ask('thai', startedAt + 2 * 60 * 1000);
    expect(calledList).toHaveLength(3);
    // Ten minutes after it was read it is read again.
    await ask('thai', startedAt + 10 * 60 * 1000);
    expect(calledList.slice(3)).toEqual([listingUrl, rawUrl('ThaiBible.xml')]);
  });

  test('GitHub out of its hourly reads is "come back later", not "sign in"', async () => {
    const { fetchImpl } = genFetch({
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/':
        () => {
          return new Response('{"message":"API rate limit exceeded"}', {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0' },
          });
        },
      'https://bibles.example/private.xml': () => {
        return new Response('no', { status: 403 });
      },
    });
    await expectProblem(
      downloadBibleXml({
        url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
        fetchImpl,
        dirPath,
      }),
      'busy',
    );
    // A refusal with no such header is still a refusal.
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/private.xml',
        fetchImpl,
        dirPath,
      }),
      'denied',
    );
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
