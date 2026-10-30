import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Every name resolves to a public address, so no test touches the network.
vi.mock('node:dns/promises', () => {
  return {
    lookup: async () => [{ address: '140.82.112.6', family: 4 }],
  };
});

import {
  BIBLE_DRAFT_DIR_NAME,
  BibleXmlProblem,
  clearBibleListingCache,
  downloadBibleXml,
  findBibleNameList,
  getBibleDraftDirPath,
  openBibleUrl,
  readBibleXmlTitles,
  rememberBibleNameLists,
  sweepBibleDrafts,
} from './bibleXmlDraft.mjs';

const XML_HEAD =
  '<?xml version="1.0" encoding="UTF-8"?>\n<bible translation="Khmer Old">';

let dirPath;
beforeEach(async () => {
  dirPath = await mkdtemp(path.join(os.tmpdir(), 'owa-bible-draft-cov-'));
  clearBibleListingCache();
});
afterEach(async () => {
  await rm(dirPath, { recursive: true, force: true });
});

// A response whose body arrives in the chunks given, and can break off.
function streamResponse(chunks, { breakAfter = null, headers = {} } = {}) {
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (breakAfter !== null && index === breakAfter) {
        controller.error(new Error('connection reset'));
        return;
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode(chunks[index]));
      index += 1;
    },
  });
  return new Response(body, { status: 200, headers });
}

async function expectProblem(promise, problem) {
  const error = await promise.catch((caught) => caught);
  expect(error).toBeInstanceOf(BibleXmlProblem);
  expect(error.problem).toBe(problem);
  return error;
}

describe('the drafts folder', () => {
  test('lives in the temp folder under its own name', () => {
    expect(getBibleDraftDirPath()).toBe(
      path.join(os.tmpdir(), BIBLE_DRAFT_DIR_NAME),
    );
    expect(getBibleDraftDirPath(dirPath)).toBe(
      path.join(dirPath, 'open-worship-app-bible-import'),
    );
  });

  test('a sweep of a folder that is not there yet does nothing', async () => {
    await expect(
      sweepBibleDrafts({ dirPath: path.join(dirPath, 'missing') }),
    ).resolves.toBeUndefined();
  });
});

describe('openBibleUrl', () => {
  const url = 'https://example.org/bibles/KhmerBible.xml';

  test('says what each refusal of the site means', async () => {
    const answer = (status) => async () => new Response('no', { status });
    const busy = await expectProblem(
      openBibleUrl(url, { fetchImpl: answer(429) }),
      'busy',
    );
    expect(busy.message).toContain('(429)');
    const server = await expectProblem(
      openBibleUrl(url, { fetchImpl: answer(503) }),
      'server',
    );
    expect(server.message).toBe('That site answered 503 instead of the file.');
    await expectProblem(
      openBibleUrl(url, { fetchImpl: answer(418) }),
      'not-found',
    );
  });

  test('tells a site that cannot be reached from a download that ran out of time', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed');
    };
    const unreachable = await expectProblem(
      openBibleUrl(url, { fetchImpl: failing }),
      'unreachable',
    );
    expect(unreachable.message).toContain('(fetch failed)');
    await expectProblem(
      openBibleUrl(url, { fetchImpl: failing, signal: AbortSignal.abort() }),
      'timeout',
    );
  });
});

describe('readBibleXmlTitles', () => {
  test('reads each title off the head of its file, at most 4 KB of it', async () => {
    const headerList = [];
    const pulled = [];
    const fetchImpl = async (url, options) => {
      headerList.push(options.headers);
      if (url.endsWith('Khmer.xml')) {
        return streamResponse([
          `${XML_HEAD}${' '.repeat(3000)}`,
          ' '.repeat(3000),
          '<never-read/>',
        ]);
      }
      pulled.push(url);
      return streamResponse(['<?xml version="1.0"?><bible>']);
    };
    const titleMap = new Map([['https://example.org/Kept.xml', 'Kept Title']]);
    const files = await readBibleXmlTitles(
      [
        { url: 'https://example.org/Khmer.xml', name: 'Khmer.xml' },
        { url: 'https://example.org/Untitled.xml', name: 'Untitled.xml' },
        { url: 'https://example.org/Kept.xml', name: 'Kept.xml' },
      ],
      { fetchImpl, titleMap },
    );
    expect(files).toEqual([
      {
        url: 'https://example.org/Khmer.xml',
        name: 'Khmer.xml',
        title: 'Khmer Old',
      },
      // No title in it: it keeps its file name.
      { url: 'https://example.org/Untitled.xml', name: 'Untitled.xml' },
      { url: 'https://example.org/Kept.xml', name: 'Kept.xml', title: 'Kept Title' },
    ]);
    // Two reads, both ranged; the remembered one was not read again.
    expect(headerList).toHaveLength(2);
    expect(headerList[0].Range).toBe('bytes=0-2047');
    expect(titleMap.get('https://example.org/Khmer.xml')).toBe('Khmer Old');
    expect(pulled).toEqual(['https://example.org/Untitled.xml']);
  });
});

describe('downloadBibleXml', () => {
  const url = 'https://example.org/bibles/KhmerBible.xml';

  test('says an empty file is empty', async () => {
    await expectProblem(
      downloadBibleXml({
        url,
        dirPath,
        fetchImpl: async () => streamResponse([]),
      }),
      'empty',
    );
  });

  test('reads a long page to its end for the Bible files it links', async () => {
    const fetchImpl = async (asked) => {
      if (asked === url) {
        return streamResponse([
          `<!DOCTYPE html><html><body>${' '.repeat(2100)}`,
          '<a href="files/KhmerBible.xml">Khmer</a>',
          '<a href="files/ThaiBible.xml">Thai</a></body></html>',
        ]);
      }
      return new Response('missing', { status: 404 });
    };
    const answer = await downloadBibleXml({
      url,
      dirPath,
      fetchImpl,
      find: 'khmer',
    });
    expect(answer.kind).toBe('page');
    expect(answer.files.map((file) => file.url)).toContain(
      'https://example.org/bibles/files/KhmerBible.xml',
    );
    expect(answer.matched).toBe(1);
  });

  test('saves a large file through a slow disk, chunk by chunk', async () => {
    const chunks = [
      `${XML_HEAD}${'a'.repeat(100 * 1024)}`,
      'b'.repeat(100 * 1024),
      '</bible>',
    ];
    const answer = await downloadBibleXml({
      url,
      dirPath,
      fetchImpl: async () => streamResponse(chunks),
    });
    expect(answer).toMatchObject({
      kind: 'xml',
      fileName: 'KhmerBible.xml',
      source: url,
      finalUrl: url,
      bytes: chunks.join('').length,
    });
    expect(await readFile(answer.xmlPath, 'utf8')).toBe(chunks.join(''));
    expect(await readdir(path.dirname(answer.xmlPath))).toEqual([
      `${answer.draftId}.xml`,
    ]);
  });

  test('leaves nothing behind when the download breaks off', async () => {
    const problem = await expectProblem(
      downloadBibleXml({
        url,
        dirPath,
        fetchImpl: async () => {
          return streamResponse(
            [`${XML_HEAD}${' '.repeat(3000)}`, 'more', 'never'],
            { breakAfter: 2 },
          );
        },
      }),
      'unreachable',
    );
    expect(problem.message).toBe(
      'The download broke off (connection reset).',
    );
    expect(await readdir(dirPath)).toEqual([]);
  });
});

describe('remembered book-name lists', () => {
  const genNames = (word) => {
    return Array.from({ length: 66 }, (_one, index) => `${word} ${index + 1}`);
  };

  test('keep one copy of each list, and let the old ones go', async () => {
    const start = Date.UTC(2030, 0, 1);
    const hour = 60 * 60 * 1000;
    const [first, second] = await rememberBibleNameLists(
      [
        { label: 'A', names: genNames('A') },
        { label: 'B', names: genNames('B') },
      ],
      { dirPath, now: start },
    );
    // The same list again an hour later: one copy, with the newer stamp.
    await rememberBibleNameLists([{ label: 'A again', names: genNames('A') }], {
      dirPath,
      now: start + hour,
    });
    const stored = JSON.parse(
      await readFile(path.join(dirPath, 'book-names.json'), 'utf8'),
    );
    expect(stored.map((one) => one.id)).toEqual([first.id, second.id]);
    expect(stored[0]).toMatchObject({ label: 'A again', at: start + hour });
    expect((await findBibleNameList(second.id, { dirPath })).label).toBe('B');

    // Past two hours, neither is offered any more.
    const [third] = await rememberBibleNameLists(
      [{ label: 'C', names: genNames('C') }],
      { dirPath, now: start + 3 * hour },
    );
    expect(await findBibleNameList(second.id, { dirPath })).toBeNull();
    expect(await findBibleNameList(first.id, { dirPath })).toBeNull();
    expect((await findBibleNameList(third.id, { dirPath })).label).toBe('C');
  });
});
