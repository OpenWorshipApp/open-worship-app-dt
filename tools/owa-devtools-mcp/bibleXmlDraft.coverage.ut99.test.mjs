// What `bibleXmlDraft.test.mjs` leaves out: every way a site can say no, a
// socket that breaks or stalls, a ranged read the server ignores, a page and
// a Bible that arrive in many pieces, a download that never ends, and the
// book-name lists kept between two calls.
//
// No network: every fetch is a function here, and every name resolves to a
// public address (`node:dns/promises` is replaced), so the address rules run
// for real without a lookup. Files go to a fresh temp folder per test.

import fs from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from 'vitest';

vi.mock('node:dns/promises', () => {
  return {
    lookup: async () => [{ address: '140.82.112.6', family: 4 }],
  };
});

const {
  BIBLE_DRAFT_DIR_NAME,
  BIBLE_DRAFT_MAX_BYTES,
  BibleXmlProblem,
  clearBibleListingCache,
  downloadBibleXml,
  findBibleNameList,
  getBibleDraftDirPath,
  openBibleUrl,
  readBibleXmlTitles,
  rememberBibleNameLists,
  sweepBibleDrafts,
} = await import('./bibleXmlDraft.mjs');

const XML_HEAD =
  '<?xml version="1.0" encoding="UTF-8"?>\n<bible translation="Test">';

let dirPath;
beforeEach(async () => {
  dirPath = await mkdtemp(path.join(os.tmpdir(), 'owa-bible-draft-cov-'));
  clearBibleListingCache();
});
afterEach(async () => {
  await rm(dirPath, { recursive: true, force: true });
});

function encode(text) {
  return new TextEncoder().encode(text);
}

/** Routes by address; anything else is a 404, as a real site would say. */
function genFetch(routeMap) {
  const calledList = [];
  const fetchImpl = async (url) => {
    calledList.push(url);
    const route = routeMap[url];
    return route === undefined
      ? new Response('missing', { status: 404 })
      : route();
  };
  return { fetchImpl, calledList };
}

/** A real response whose body arrives in exactly these pieces. */
function genChunkedResponse(partList) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of partList) {
          controller.enqueue(typeof part === 'string' ? encode(part) : part);
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

/**
 * A response whose body is a hand-made iterator, for what a real stream
 * cannot be made to do cheaply: deliver past 80 MB, break off, or stall.
 * `state` says how far it was read and whether it was let go.
 */
function genIteratedResponse(stepList) {
  const state = { pulled: 0, isReturned: false };
  const iterator = {
    async next() {
      const step = stepList[state.pulled];
      state.pulled += 1;
      return step === undefined ? { done: true, value: undefined } : step();
    },
    async return() {
      state.isReturned = true;
      return { done: true, value: undefined };
    },
  };
  return {
    state,
    response: {
      status: 200,
      ok: true,
      headers: new Headers(),
      body: {
        [Symbol.asyncIterator]: () => {
          return iterator;
        },
      },
    },
  };
}

async function expectProblem(promise, problem, message) {
  const error = await promise.catch((caught) => caught);
  expect(error).toBeInstanceOf(BibleXmlProblem);
  expect(error.problem).toBe(problem);
  expect(error.message).toBe(message);
}

/**
 * The drafts folder once `predicate` holds for it, or as it is after a
 * second. A file being closed can still be listed a moment after it was
 * removed, on Windows, so "nothing is left" is asked of the folder until it
 * settles rather than once.
 */
async function waitForDraftDir(predicate) {
  const deadline = Date.now() + 1000;
  for (;;) {
    const nameList = await readdir(dirPath);
    if (predicate(nameList) || Date.now() > deadline) {
      return nameList;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }
}

/**
 * A step that first waits for the part file to be on disk, as it is long
 * before a real download's next piece arrives -- then does `then`.
 */
function afterPartFileExists(then) {
  return async () => {
    await waitForDraftDir((nameList) => {
      return nameList.some((name) => name.endsWith('.xml.part'));
    });
    return then();
  };
}

describe('where drafts are kept', () => {
  test('in one folder of their own under the temp folder', () => {
    expect(getBibleDraftDirPath()).toBe(
      path.join(os.tmpdir(), BIBLE_DRAFT_DIR_NAME),
    );
    expect(getBibleDraftDirPath(dirPath)).toBe(
      path.join(dirPath, 'open-worship-app-bible-import'),
    );
  });

  test('a sweep before the folder exists does nothing, and makes nothing', async () => {
    await expect(
      sweepBibleDrafts({ dirPath: path.join(dirPath, 'not-yet') }),
    ).resolves.toBeUndefined();
    expect(await readdir(dirPath)).toEqual([]);
  });
});

describe('what a site that would not give the file said', () => {
  test.each([
    {
      status: 429,
      headers: {},
      problem: 'busy',
      message:
        'That site said it is too busy (429). Try again in a few minutes.',
    },
    {
      status: 429,
      headers: { 'x-ratelimit-remaining': '0' },
      problem: 'busy',
      message:
        'That site has answered too many requests from this network for ' +
        'now (its hourly limit). Try again in a while.',
    },
    {
      status: 410,
      headers: {},
      problem: 'not-found',
      message:
        'That address answered "not found" (410). The link is wrong or the ' +
        'file has moved.',
    },
    {
      status: 401,
      headers: {},
      problem: 'denied',
      message:
        'That site refused to give the file out (401). It may need a ' +
        'sign-in, or it may only share it on its own page.',
    },
    {
      status: 503,
      headers: {},
      problem: 'server',
      message: 'That site answered 503 instead of the file.',
    },
    {
      status: 418,
      headers: {},
      problem: 'not-found',
      message: 'That site answered 418 instead of the file.',
    },
  ])(
    'a $status answer is "$problem"',
    async ({ status, headers, problem, message }) => {
      await expectProblem(
        openBibleUrl('https://bibles.example/kjv.xml', {
          fetchImpl: async () => {
            return new Response('no', { status, headers });
          },
        }),
        problem,
        message,
      );
    },
  );

  test('a site that cannot be reached says why; a stopped one that it took too long', async () => {
    await expectProblem(
      openBibleUrl('https://bibles.example/kjv.xml', {
        fetchImpl: async () => {
          throw new Error('getaddrinfo ENOTFOUND bibles.example');
        },
      }),
      'unreachable',
      'That site could not be reached (getaddrinfo ENOTFOUND ' +
        'bibles.example). Check the internet connection and the address.',
    );
    const controller = new AbortController();
    controller.abort();
    await expectProblem(
      openBibleUrl('https://bibles.example/kjv.xml', {
        signal: controller.signal,
        fetchImpl: async () => {
          throw new Error('This operation was aborted');
        },
      }),
      'timeout',
      'The download took too long and was stopped. The site may be slow, ' +
        'or the internet connection is.',
    );
  });
});

describe('the title off the first bytes of each listed file', () => {
  test('a server that ignores the range is read no further than 4 KB', async () => {
    const { state, response } = genIteratedResponse([
      async () => ({
        done: false,
        value: encode('<bible translation="Lantern Test">'),
      }),
      async () => ({ done: false, value: new Uint8Array(5000) }),
      async () => ({ done: false, value: new Uint8Array(5000) }),
    ]);
    const file = { name: 'A.xml', url: 'https://bibles.example/A.xml' };
    expect(
      await readBibleXmlTitles([file], {
        fetchImpl: async () => {
          return response;
        },
      }),
    ).toEqual([{ ...file, title: 'Lantern Test' }]);
    // The third piece was never asked for, and the body was let go.
    expect(state.pulled).toBe(2);
    expect(state.isReturned).toBe(true);
  });

  test('a file whose head names no title keeps its file name, and nothing is remembered', async () => {
    const titleMap = new Map();
    const file = { name: 'B.xml', url: 'https://bibles.example/B.xml' };
    expect(
      await readBibleXmlTitles([file], {
        fetchImpl: async () => {
          return new Response('<bible>', { status: 206 });
        },
        titleMap,
      }),
    ).toEqual([file]);
    expect(titleMap.size).toBe(0);
  });
});

describe('downloading what a link points at', () => {
  test('an empty answer is said to be empty, and nothing is saved', async () => {
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/empty.xml',
        fetchImpl: async () => {
          return new Response('', { status: 200 });
        },
        dirPath,
      }),
      'empty',
      'That address gave back an empty file.',
    );
    expect(await readdir(dirPath)).toEqual([]);
  });

  test('a long web page is read past its first piece for the files it links', async () => {
    const { fetchImpl } = genFetch({
      'https://bibles.example/downloads': () => {
        return genChunkedResponse([
          `<!DOCTYPE html><html><body><p>${'x'.repeat(2100)}</p>`,
          '<a href="/x/KhmerBible.xml">Khmer</a>',
          '</body></html>',
        ]);
      },
    });
    const result = await downloadBibleXml({
      url: 'https://bibles.example/downloads',
      fetchImpl,
      dirPath,
    });
    expect(result.kind).toBe('page');
    // The only link is in the SECOND piece.
    expect(result.files).toEqual([
      {
        name: 'KhmerBible.xml',
        url: 'https://bibles.example/x/KhmerBible.xml',
      },
    ]);
    expect(await readdir(dirPath)).toEqual([]);
  });

  test('a Bible in many large pieces is written whole, waiting on the disk', async () => {
    const pieceList = [
      `${XML_HEAD}<verse>${'a'.repeat(20 * 1024)}</verse>`,
      `<verse>${'b'.repeat(20 * 1024)}</verse>`,
      `<verse>${'c'.repeat(20 * 1024)}</verse>`,
      '</bible>',
    ];
    const { fetchImpl } = genFetch({
      'https://bibles.example/big.xml': () => {
        return genChunkedResponse(pieceList);
      },
    });
    const result = await downloadBibleXml({
      url: 'https://bibles.example/big.xml',
      fetchImpl,
      dirPath,
    });
    const whole = pieceList.join('');
    expect(result).toMatchObject({
      kind: 'xml',
      bytes: Buffer.byteLength(whole),
      fileName: 'big.xml',
    });
    expect(await readFile(result.xmlPath, 'utf8')).toBe(whole);
    // Renamed from its `.part` once complete.
    expect(await readdir(dirPath)).toEqual([`${result.draftId}.xml`]);
  });

  // The three below fail only once the part file is on disk. Failing in the
  // same few microseconds as it is created leaves it behind -- a race in
  // the module, reported by this batch and not asserted here either way.
  test('a download that runs past any Bible is stopped and its part removed', async () => {
    const { state, response } = genIteratedResponse([
      async () => ({
        done: false,
        value: encode(`${XML_HEAD}${' '.repeat(2100)}`),
      }),
      // Its length is all that is read before the cut: no 80 MB is made.
      afterPartFileExists(() => ({
        done: false,
        value: { length: BIBLE_DRAFT_MAX_BYTES },
      })),
    ]);
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/endless.xml',
        fetchImpl: async () => {
          return response;
        },
        dirPath,
      }),
      'too-large',
      'That file is far larger than any Bible, so the download was stopped.',
    );
    expect(state.isReturned).toBe(true);
    expect(await waitForDraftDir((nameList) => nameList.length === 0)).toEqual(
      [],
    );
  });

  test('a download that breaks off says so, and leaves nothing behind', async () => {
    const { response } = genIteratedResponse([
      async () => ({
        done: false,
        value: encode(`${XML_HEAD}${' '.repeat(2100)}`),
      }),
      afterPartFileExists(() => {
        throw new Error('socket hang up');
      }),
    ]);
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/kjv.xml',
        fetchImpl: async () => {
          return response;
        },
        dirPath,
      }),
      'unreachable',
      'The download broke off (socket hang up).',
    );
    expect(await waitForDraftDir((nameList) => nameList.length === 0)).toEqual(
      [],
    );
  });

  // The write stream opens its file a moment after it is made. A body that
  // failed at once was rejected -- and its `.part` "removed" -- before that
  // open had finished, which then left the file behind (2026-11-03). The
  // tests above wait for the file first, so they never saw it.
  test('a download that breaks off at once leaves no part file either', async () => {
    // The open made slow, as a loaded machine (a virus scanner reading every
    // new file) makes it: what the race needs, every time rather than now
    // and then. The stream reads `open` off the `fs` module when it opens.
    const realOpen = fs.open;
    fs.open = (filePath, ...rest) => {
      if (String(filePath).endsWith('.xml.part')) {
        setTimeout(() => {
          realOpen(filePath, ...rest);
        }, 40);
        return;
      }
      realOpen(filePath, ...rest);
    };
    onTestFinished(() => {
      fs.open = realOpen;
    });
    const { response } = genIteratedResponse([
      async () => ({
        done: false,
        value: encode(`${XML_HEAD}${' '.repeat(2100)}`),
      }),
      async () => {
        throw new Error('socket hang up');
      },
    ]);
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/kjv.xml',
        fetchImpl: async () => {
          return response;
        },
        dirPath,
      }),
      'unreachable',
      'The download broke off (socket hang up).',
    );
    // Long enough for an open still in flight to have landed.
    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    expect(await readdir(dirPath)).toEqual([]);
  });

  test('a download still going when its time is up is said to have taken too long', async () => {
    const { response } = genIteratedResponse([
      async () => ({
        done: false,
        value: encode(`${XML_HEAD}${' '.repeat(2100)}`),
      }),
      afterPartFileExists(async () => {
        // Past the 5 ms the download is given below.
        await new Promise((resolve) => {
          setTimeout(resolve, 30);
        });
        throw new Error('The operation was aborted');
      }),
    ]);
    await expectProblem(
      downloadBibleXml({
        url: 'https://bibles.example/kjv.xml',
        fetchImpl: async () => {
          return response;
        },
        dirPath,
        timeoutMs: 5,
      }),
      'timeout',
      'The download took too long and was stopped.',
    );
    expect(await waitForDraftDir((nameList) => nameList.length === 0)).toEqual(
      [],
    );
  });
});

describe('book-name lists kept between two calls', () => {
  test('newest first, each list once, and none older than two hours', async () => {
    const at = 1_700_000_000_000;
    const filePath = path.join(dirPath, 'book-names.json');
    await writeFile(
      filePath,
      JSON.stringify([
        {
          id: 'n00000001',
          label: 'Stale',
          names: ['x'],
          at: at - 3 * 60 * 60 * 1000,
        },
        // Written before lists were dated: as old as can be.
        { id: 'n00000002', label: 'Undated', names: ['y'] },
      ]),
    );
    const first = {
      label: 'First',
      source: 'built in',
      names: ['Genesis', 'Exodus'],
    };
    const second = {
      label: 'Second',
      source: 'https://names.example/xx',
      names: ['First Book', 'Second Book'],
    };
    const [one] = await rememberBibleNameLists([first], { dirPath, now: at });
    const [two] = await rememberBibleNameLists([second], {
      dirPath,
      now: at + 60 * 1000,
    });
    // The first list found again is moved to the front, not kept twice.
    await rememberBibleNameLists([first], { dirPath, now: at + 120 * 1000 });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual([
      { ...first, id: one.id, at: at + 120 * 1000 },
      { ...second, id: two.id, at: at + 60 * 1000 },
    ]);
    expect(await findBibleNameList('n00000001', { dirPath })).toBeNull();
    expect((await findBibleNameList(two.id, { dirPath })).label).toBe('Second');
  });
});
