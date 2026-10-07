// `owa_bible_xml`: fetching a Bible's XML for an import, and keeping it on
// disk -- not in memory -- while the person chooses its name, language and
// book names.
//
// Downloaded HERE, in the MCP server, rather than in the app window, for one
// reason: this is where the address rules can be enforced at the moment the
// socket opens. The address came from a model (or from a person reading a
// model's answer), so every hop of every redirect is put through
// `webUrlPolicy.mjs` with DNS -- the same two halves the website reader uses
// -- and nothing on this machine or this network can be reached by naming it.
//
// A whole Bible is 5-20 MB and the choices take minutes, so the file goes to
// a temp folder and the app reads it twice (once to describe it, once to
// install it) instead of holding a parsed copy in a window between questions
// on a machine with no memory to spare. At most three drafts, for two hours,
// swept every time a new one starts; a finished or cancelled import removes
// its own. Book-name lists found online are remembered the same way, in one
// small file, so a choice can be passed back as an id instead of a model
// retyping sixty-six names in a script it may not write well.

import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { checkWebUrlIsFetchable } from './webUrlPolicy.mjs';
import {
  BIBLE_DRAFT_ID_PATTERN,
  BIBLE_NAME_LIST_ID_PATTERN,
  checkIsLikelyHtml,
  checkIsLikelyXml,
  extractBibleXmlLinks,
  rankBibleXmlLinks,
  readBibleXmlTitle,
  toBibleNameListId,
  toBibleXmlDownloadUrl,
  toGithubListingUrl,
} from './bibleXmlAdvice.mjs';

export const BIBLE_DRAFT_DIR_NAME = 'open-worship-app-bible-import';
// The largest Bible XML files in the wild (with Strong's numbers) are ~40 MB.
// Anything past this is not a Bible, and a download that never ends must not
// fill the disk of a machine chosen for being cheap.
export const BIBLE_DRAFT_MAX_BYTES = 80 * 1024 * 1024;
const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_REDIRECTS = 5;
const DRAFT_KEEP_COUNT = 3;
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const NAME_LIST_KEEP_COUNT = 24;
const PAGE_FILE_LIMIT = 12;
const TITLE_TIMEOUT_MS = 15 * 1000;
const NAME_LIST_FILE_NAME = 'book-names.json';
const USER_AGENT = 'OpenWorshipApp (Bible import)';

/**
 * A link that does not lead to a Bible. Not a failure of the tool: the
 * answer about the link, with a code the chat window words for a person and
 * a sentence the model can use as it is.
 */
export class BibleXmlProblem extends Error {
  constructor(problem, message) {
    super(message);
    this.problem = problem;
  }
}

export function getBibleDraftDirPath(tmpDirPath = os.tmpdir()) {
  return path.join(tmpDirPath, BIBLE_DRAFT_DIR_NAME);
}

export function toBibleDraftPaths(draftId, dirPath = getBibleDraftDirPath()) {
  if (!BIBLE_DRAFT_ID_PATTERN.test(String(draftId ?? ''))) {
    throw new Error(
      `"${String(draftId)}" is not a draft id. Call action "check" with ` +
        'the address first; its answer carries the draftId.',
    );
  }
  return {
    xmlPath: path.join(dirPath, `${draftId}.xml`),
    metaPath: path.join(dirPath, `${draftId}.json`),
  };
}

export function genBibleDraftId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(12), (byte) => {
    return alphabet[byte % alphabet.length];
  }).join('');
}

/**
 * Old drafts out: anything past two hours, and all but the newest few. Run
 * before a new download, so a person who started five imports and finished
 * none leaves three files behind at most -- and those for two hours.
 */
export async function sweepBibleDrafts({
  dirPath = getBibleDraftDirPath(),
  now = Date.now(),
  keep = DRAFT_KEEP_COUNT - 1,
} = {}) {
  let fileNameList;
  try {
    fileNameList = await readdir(dirPath);
  } catch {
    return;
  }
  const draftMap = new Map();
  for (const fileName of fileNameList) {
    const id = /^([a-z0-9]{12})\.(?:xml|json|xml\.part)$/.exec(fileName)?.[1];
    if (id === undefined) {
      continue;
    }
    try {
      const { mtimeMs } = await stat(path.join(dirPath, fileName));
      const known = draftMap.get(id) ?? { at: 0, fileNameList: [] };
      known.at = Math.max(known.at, mtimeMs);
      known.fileNameList.push(fileName);
      draftMap.set(id, known);
    } catch {
      // Gone already.
    }
  }
  const sorted = Array.from(draftMap.values()).sort((one, other) => {
    return other.at - one.at;
  });
  for (const [index, draft] of sorted.entries()) {
    if (index < keep && now - draft.at < DRAFT_MAX_AGE_MS) {
      continue;
    }
    for (const fileName of draft.fileNameList) {
      await rm(path.join(dirPath, fileName), { force: true });
    }
  }
}

export async function removeBibleDraft(
  draftId,
  dirPath = getBibleDraftDirPath(),
) {
  const { xmlPath, metaPath } = toBibleDraftPaths(draftId, dirPath);
  await rm(xmlPath, { force: true });
  await rm(`${xmlPath}.part`, { force: true });
  await rm(metaPath, { force: true });
}

export async function readBibleDraftMeta(
  draftId,
  dirPath = getBibleDraftDirPath(),
) {
  const { xmlPath, metaPath } = toBibleDraftPaths(draftId, dirPath);
  try {
    await stat(xmlPath);
    return JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    throw new BibleXmlProblem(
      'draft-gone',
      'That download is no longer there -- drafts are kept for two hours. ' +
        'Call action "check" with the address again.',
    );
  }
}

export async function writeBibleDraftMeta(
  draftId,
  meta,
  dirPath = getBibleDraftDirPath(),
) {
  const { metaPath } = toBibleDraftPaths(draftId, dirPath);
  await writeFile(metaPath, JSON.stringify(meta), 'utf8');
}

// --- the network ------------------------------------------------------------

function describeHttpStatus(status) {
  if (status === 404 || status === 410) {
    return new BibleXmlProblem(
      'not-found',
      `That address answered "not found" (${status}). The link is wrong or ` +
        'the file has moved.',
    );
  }
  if (status === 401 || status === 403) {
    return new BibleXmlProblem(
      'denied',
      `That site refused to give the file out (${status}). It may need a ` +
        'sign-in, or it may only share it on its own page.',
    );
  }
  if (status === 429) {
    return new BibleXmlProblem(
      'busy',
      'That site said it is too busy (429). Try again in a few minutes.',
    );
  }
  return new BibleXmlProblem(
    status >= 500 ? 'server' : 'not-found',
    `That site answered ${status} instead of the file.`,
  );
}

/**
 * Open an address, following redirects by hand so each hop is judged by the
 * address rules -- with DNS -- before a socket is opened to it.
 */
export async function openBibleUrl(
  url,
  { fetchImpl = fetch, signal, headers = {} } = {},
) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await checkWebUrlIsFetchable(current);
    if (!verdict.isAllowed) {
      throw new BibleXmlProblem('blocked', verdict.reason);
    }
    let response;
    try {
      response = await fetchImpl(verdict.href, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/xml, text/xml, application/json, text/html, */*',
          ...headers,
        },
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new BibleXmlProblem(
          'timeout',
          'The download took too long and was stopped. The site may be ' +
            'slow, or the internet connection is.',
        );
      }
      throw new BibleXmlProblem(
        'unreachable',
        `That site could not be reached (${String(error?.message ?? error)}). ` +
          'Check the internet connection and the address.',
      );
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel?.().catch(() => {});
      current = new URL(location, verdict.href).href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel?.().catch(() => {});
      throw describeHttpStatus(response.status);
    }
    return { response, finalUrl: verdict.href };
  }
  throw new BibleXmlProblem(
    'unreachable',
    'That address sent the download round too many redirects.',
  );
}

async function readAllText(response, maxBytes) {
  const chunkList = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) {
      break;
    }
    chunkList.push(chunk);
  }
  return Buffer.concat(chunkList).toString('utf8');
}

/**
 * Each listed file's own title, off its first 2 KB -- a ranged request, so a
 * dozen of them cost less than one page of the catalog. Best effort and
 * bounded in time: a file that does not answer keeps its file name.
 */
export async function readBibleXmlTitles(files, { fetchImpl = fetch } = {}) {
  const signal = AbortSignal.timeout(TITLE_TIMEOUT_MS);
  return await Promise.all(
    files.map(async (file) => {
      try {
        const { response } = await openBibleUrl(file.url, {
          fetchImpl,
          signal,
          headers: { Range: 'bytes=0-2047' },
        });
        const title = readBibleXmlTitle(await readAllText(response, 4096));
        return title === null ? file : { ...file, title };
      } catch {
        return file;
      }
    }),
  );
}

async function genPageAnswer({
  text,
  baseUrl,
  source,
  find,
  fixed,
  fetchImpl,
}) {
  const links = extractBibleXmlLinks(text, baseUrl);
  if (links.length === 0) {
    throw new BibleXmlProblem(
      'page-without-files',
      'That address is a web page, and no Bible XML file is linked on it. ' +
        'Ask the user to open the page, find the Bible file (its name ends ' +
        'in .xml) and copy the address of THAT link -- on GitHub, open the ' +
        'file and use the "Raw" button.',
    );
  }
  // Every file in the language asked for, not a sample: a person choosing
  // between seven Khmer Bibles has to see all seven.
  const ranked = rankBibleXmlLinks(links, find, PAGE_FILE_LIMIT);
  return {
    kind: 'page',
    source,
    ...(fixed ? { fixed } : {}),
    total: ranked.total,
    matched: ranked.matched,
    ...(ranked.words.length > 0 ? { searchedFor: ranked.words } : {}),
    files: await readBibleXmlTitles(ranked.links, { fetchImpl }),
    note:
      ranked.matched === 0
        ? `None of the ${ranked.total} files is named with those words. ` +
          'Ask the user which language or translation they want, and call ' +
          'check again with the same url and that word in `find`.'
        : 'This is a page, not a Bible. Let the user pick a file, then call ' +
          'check with its url.',
  };
}

/**
 * Fetch whatever `url` is and say what it turned out to be:
 *
 *  - `{kind: 'xml', draftId, …}` -- a file that starts like XML, saved to the
 *    drafts folder for the app to read;
 *  - `{kind: 'page', files, …}` -- a web page or a GitHub folder, with the
 *    Bible files it names, the ones matching `find` first;
 *  - a `BibleXmlProblem` -- anything else, in a sentence.
 */
export async function downloadBibleXml({
  url,
  find = '',
  fetchImpl = fetch,
  dirPath = getBibleDraftDirPath(),
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
} = {}) {
  const fixedUrl = toBibleXmlDownloadUrl(url);
  const signal = AbortSignal.timeout(timeoutMs);
  const listingUrl = toGithubListingUrl(fixedUrl.url);
  if (listingUrl !== null) {
    const { response } = await openBibleUrl(listingUrl, { fetchImpl, signal });
    return await genPageAnswer({
      text: await readAllText(response, PAGE_MAX_BYTES),
      baseUrl: listingUrl,
      source: fixedUrl.url,
      find,
      fixed: null,
      fetchImpl,
    });
  }
  const { response, finalUrl } = await openBibleUrl(fixedUrl.url, {
    fetchImpl,
    signal,
  });
  const declaredSize = Number(response.headers.get('content-length'));
  if (declaredSize > BIBLE_DRAFT_MAX_BYTES) {
    await response.body?.cancel?.().catch(() => {});
    throw new BibleXmlProblem(
      'too-large',
      `That file is ${Math.round(declaredSize / 1048576)} MB, far larger ` +
        'than any Bible. It is not one.',
    );
  }
  const iterator = response.body[Symbol.asyncIterator]();
  const headList = [];
  let headSize = 0;
  let isDone = false;
  while (headSize < 2048) {
    const next = await iterator.next();
    if (next.done) {
      isDone = true;
      break;
    }
    headList.push(Buffer.from(next.value));
    headSize += next.value.length;
  }
  const head = Buffer.concat(headList).toString('utf8');
  if (headSize === 0) {
    throw new BibleXmlProblem('empty', 'That address gave back an empty file.');
  }
  if (checkIsLikelyHtml(head)) {
    const restList = [...headList];
    let size = headSize;
    while (!isDone && size < PAGE_MAX_BYTES) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      restList.push(Buffer.from(next.value));
      size += next.value.length;
    }
    await iterator.return?.();
    return await genPageAnswer({
      text: Buffer.concat(restList).toString('utf8'),
      baseUrl: finalUrl,
      source: fixedUrl.url,
      find,
      fixed: fixedUrl.note,
      fetchImpl,
    });
  }
  if (!checkIsLikelyXml(head)) {
    await iterator.return?.();
    throw new BibleXmlProblem(
      'not-xml',
      'The file at that address is not XML, so it is not a Bible file this ' +
        'app can install. Ask for the address of the .xml file itself.',
    );
  }
  await mkdir(dirPath, { recursive: true });
  await sweepBibleDrafts({ dirPath });
  const draftId = genBibleDraftId();
  const { xmlPath } = toBibleDraftPaths(draftId, dirPath);
  const partPath = `${xmlPath}.part`;
  let size = 0;
  try {
    await new Promise((resolve, reject) => {
      const stream = createWriteStream(partPath);
      stream.on('error', reject);
      const pump = async () => {
        for (const chunk of headList) {
          size += chunk.length;
          if (!stream.write(chunk)) {
            await new Promise((done) => stream.once('drain', done));
          }
        }
        while (!isDone) {
          const next = await iterator.next();
          if (next.done) {
            break;
          }
          size += next.value.length;
          if (size > BIBLE_DRAFT_MAX_BYTES) {
            await iterator.return?.();
            throw new BibleXmlProblem(
              'too-large',
              'That file is far larger than any Bible, so the download ' +
                'was stopped.',
            );
          }
          // Back-pressure: on a slow disk the network must wait, or the
          // whole file ends up in memory anyway.
          if (!stream.write(Buffer.from(next.value))) {
            await new Promise((done) => stream.once('drain', done));
          }
        }
        stream.end(resolve);
      };
      pump().catch((error) => {
        stream.destroy();
        reject(error);
      });
    });
    await rename(partPath, xmlPath);
  } catch (error) {
    await rm(partPath, { force: true });
    if (error instanceof BibleXmlProblem) {
      throw error;
    }
    throw new BibleXmlProblem(
      signal.aborted ? 'timeout' : 'unreachable',
      signal.aborted
        ? 'The download took too long and was stopped.'
        : `The download broke off (${String(error?.message ?? error)}).`,
    );
  }
  return {
    kind: 'xml',
    draftId,
    xmlPath,
    bytes: size,
    source: fixedUrl.url,
    finalUrl,
    fileName: decodeURIComponent(
      new URL(fixedUrl.url).pathname.split('/').pop() || 'bible.xml',
    ),
    ...(fixedUrl.note ? { fixed: fixedUrl.note } : {}),
  };
}

// --- remembered book-name lists ----------------------------------------------

function toNameListFilePath(dirPath) {
  return path.join(dirPath, NAME_LIST_FILE_NAME);
}

async function readNameLists(dirPath) {
  try {
    const list = JSON.parse(
      await readFile(toNameListFilePath(dirPath), 'utf8'),
    );
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Keep the lists a person may choose between, newest first, and answer them
 * with their ids. Bounded by count and by age: this is a hand-off between two
 * calls of one conversation, not a library.
 */
export async function rememberBibleNameLists(
  lists,
  { dirPath = getBibleDraftDirPath(), now = Date.now() } = {},
) {
  const named = lists.map((list) => {
    return { ...list, id: toBibleNameListId(list.names) };
  });
  const kept = (await readNameLists(dirPath)).filter((old) => {
    return (
      now - (old.at ?? 0) < DRAFT_MAX_AGE_MS &&
      !named.some((one) => one.id === old.id)
    );
  });
  const stamped = named.map((one) => ({ ...one, at: now }));
  await mkdir(dirPath, { recursive: true });
  await writeFile(
    toNameListFilePath(dirPath),
    JSON.stringify([...stamped, ...kept].slice(0, NAME_LIST_KEEP_COUNT)),
    'utf8',
  );
  return named;
}

export async function findBibleNameList(
  id,
  { dirPath = getBibleDraftDirPath() } = {},
) {
  if (!BIBLE_NAME_LIST_ID_PATTERN.test(String(id ?? ''))) {
    return null;
  }
  return (
    (await readNameLists(dirPath)).find((one) => {
      return one.id === id;
    }) ?? null
  );
}
