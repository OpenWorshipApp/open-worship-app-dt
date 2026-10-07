// `owa_bible_xml`: install a Bible from an XML address, and change or remove
// the installed ones -- for an old, non-technical person who has a link (or
// half of one) and wants the Bible on the screen.
//
// One tool, eight actions, because they are one errand: `check` downloads and
// describes, `names` finds book-name lists online, `import` installs what the
// person chose, `cancel` drops the download; `list` / `info` / `update` /
// `delete` are the same Bibles after they are installed. It took over from
// `owa_bible_book_names` (now `names`), so the model pays for one schema.
//
// The halves: the download and the remembered choices are here
// (`bibleXmlDraft.mjs` -- this is where the address rules hold); reading the
// file, installing, changing and removing are the app's
// (`src/helper/agentBibleXMLHelpers.ts`, over the `owa-agent-data` relay).
// Every change is backed up first and a removal goes to the trash, and the
// answer says how to undo it.
//
// A link that leads nowhere useful is not a FAILURE of this tool, it is the
// answer about the link: `{problem, message}`, a code the chat window words
// for a person and a sentence the model can use as it is. An error result is
// kept for the app or the tool going wrong.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp, evaluateInTarget } from './cdp.mjs';
import { checkToolCall } from './firewall.mjs';
import { genReadWebPageExpression } from './website.mjs';
import { AGENT_UNDO_TEXT, genAgentDataExpression } from './agentData.mjs';
import { findKnowledgeDirPath } from './help.mjs';
import {
  BIBLE_BOOK_KEYS,
  findBibleBookNames,
  getBibleNumberChoices,
  normalizeBibleLocale,
} from './bibleBookNames.mjs';
import {
  BIBLE_XML_ACTIONS,
  BIBLE_XML_CATALOG_URL,
  toDigitsLabel,
} from './bibleXmlAdvice.mjs';
import {
  BibleXmlProblem,
  downloadBibleXml,
  findBibleNameList,
  readBibleDraftMeta,
  rememberBibleNameLists,
  removeBibleDraft,
  toBibleDraftPaths,
  writeBibleDraftMeta,
} from './bibleXmlDraft.mjs';

// A 15 MB Bible is parsed, checked and written by a renderer on a machine
// chosen for being cheap: the default fifteen seconds is a lie for this one.
const LONG_WORK_MS = 180 * 1000;
const SHORT_WORK_MS = 60 * 1000;

function toTextResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value),
      },
    ],
  };
}

function toErrorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: String(error?.message ?? error) }],
  };
}

function toProblemResult(problem, message) {
  return toTextResult({ problem, message });
}

async function runBibleWorker(request, timeout = SHORT_WORK_MS) {
  const { value } = await evaluateInApp(
    genAgentDataExpression('bible-xml', request, timeout),
    { timeout: timeout + 5000 },
  );
  if (value === null || typeof value !== 'object') {
    throw new Error('The app did not answer.');
  }
  return value;
}

// "French" arrives as `fr`; a Bible is installed under a whole locale, and
// the app's list picks the FIRST French one it knows for a bare language,
// which is not the one anybody means.
function toFullLocale(locale) {
  try {
    const parsed = new Intl.Locale(locale);
    if (parsed.region) {
      return locale;
    }
    const full = parsed.maximize();
    return full.region ? `${full.language}-${full.region}` : locale;
  } catch {
    return locale;
  }
}

/** Each digit choice for a locale, as words a person reads. */
function genDigitChoices(locale) {
  const choiceList = getBibleNumberChoices(locale);
  return choiceList.length > 1
    ? {
        local: toDigitsLabel(choiceList[0]),
        ascii: toDigitsLabel(choiceList[1]),
      }
    : { ascii: toDigitsLabel(choiceList[0]) };
}

/**
 * Each list as a person can tell it from the others: its first names, and
 * -- because two editions often open with the same four books -- a few
 * names no other list on offer has.
 */
function toListPreviews(lists) {
  return lists.map((list) => {
    const otherSet = new Set(
      lists.filter((other) => other !== list).flatMap((other) => other.names),
    );
    const own = list.names.filter((name) => !otherSet.has(name));
    return toListPreview(list, own.slice(0, 3));
  });
}

function toListPreview(list, own = []) {
  return {
    id: list.id,
    label: list.label,
    first: list.names.slice(0, 4),
    ...(own.length > 0 ? { own } : {}),
    // How many of its names the Bible's own verses use: the best evidence
    // there is of which edition's spelling it follows.
    ...(typeof list.matches === 'number' ? { matches: list.matches } : {}),
  };
}

/** The lists, best match for the draft's own words first. */
async function rankForDraft(draftId, lists) {
  if (!draftId || lists.length === 0) {
    return lists;
  }
  try {
    const { xmlPath } = toBibleDraftPaths(draftId);
    const result = await runBibleWorker(
      {
        action: 'score',
        xmlPath,
        lists: lists.map(({ names }) => ({ names })),
      },
      SHORT_WORK_MS,
    );
    if (!Array.isArray(result.matches)) {
      return lists;
    }
    return lists
      .map((list, index) => ({ ...list, matches: result.matches[index] }))
      .sort((one, other) => other.matches - one.matches);
  } catch {
    // Unranked is still a choice.
    return lists;
  }
}

async function readBundledNameSets(locale) {
  try {
    const { language } = normalizeBibleLocale(locale);
    return (
      JSON.parse(
        await readFile(
          path.join(findKnowledgeDirPath(), 'bible-books.json'),
          'utf8',
        ),
      )[language] ?? []
    );
  } catch {
    // Online sources still work without a built bundle.
    return [];
  }
}

async function searchNameLists({ locale, offset, page }) {
  return await findBibleBookNames(locale, {
    bundled: await readBundledNameSets(locale),
    offset,
    readPage: async (url) => {
      // Charge EACH public read to the shared network budget.
      const verdict = checkToolCall('owa_read_website', { url });
      if (!verdict.isAllowed) {
        throw new Error(verdict.reason);
      }
      const { target } = await evaluateInApp('true', { match: page });
      return await evaluateInTarget(
        target,
        genReadWebPageExpression({ url, bibleCatalog: true, maxChars: 200 }),
        35000,
      );
    },
  });
}

/** A list id, a full list, or changes by book id, as 66 names or changes. */
async function resolveBookNames(value, fallbackId) {
  const id = typeof value === 'string' ? value.trim() : fallbackId;
  if (value !== undefined && typeof value !== 'string') {
    return { changes: value };
  }
  if (!id) {
    return { names: null };
  }
  const list = await findBibleNameList(id);
  if (list === null) {
    throw new Error(
      `"${id}" is not a book-name list I still have. Use an id from the ` +
        'last check or names answer, or call names again.',
    );
  }
  return { names: list.names };
}

async function handleCheck({ url, find }) {
  let downloaded;
  try {
    downloaded = await downloadBibleXml({
      url,
      find: String(find ?? '').slice(0, 80),
    });
  } catch (error) {
    if (error instanceof BibleXmlProblem) {
      return toProblemResult(error.problem, error.message);
    }
    throw error;
  }
  if (downloaded.kind === 'page') {
    return toTextResult(downloaded);
  }
  let analysis;
  try {
    analysis = await runBibleWorker(
      {
        action: 'analyze',
        xmlPath: downloaded.xmlPath,
        sourceName: downloaded.fileName,
      },
      LONG_WORK_MS,
    );
  } catch (error) {
    await removeBibleDraft(downloaded.draftId);
    throw error;
  }
  if (analysis.isError) {
    await removeBibleDraft(downloaded.draftId);
    return toProblemResult(analysis.problem ?? 'not-bible', analysis.reason);
  }
  const locale = analysis.recommendedLocale;
  const nameLists = await rememberBibleNameLists(analysis.nameLists);
  const fileListId = nameLists[nameLists.length - 1].id;
  const digits = locale
    ? genDigitChoices(locale)
    : { ascii: '0 1 2 3 4 5 6 7 8 9' };
  const recommended = {
    key: analysis.keys[0] ?? null,
    locale,
    digits: digits.local ? 'local' : 'ascii',
    bookNames: nameLists[0].id,
  };
  await writeBibleDraftMeta(downloaded.draftId, {
    source: downloaded.source,
    fileName: downloaded.fileName,
    title: analysis.title,
    recommended,
    fileListId,
  });
  return toTextResult({
    kind: 'xml',
    draftId: downloaded.draftId,
    title: analysis.title,
    source: downloaded.source,
    ...(downloaded.fixed ? { fixed: downloaded.fixed } : {}),
    sizeMB: Math.round((downloaded.bytes / 1048576) * 10) / 10,
    books: analysis.books,
    chapters: analysis.chapters,
    verses: analysis.verses,
    ...(analysis.missingBooks.length > 0
      ? { missingBooks: analysis.missingBooks }
      : {}),
    keys: analysis.keys,
    takenKeys: analysis.takenKeys,
    locales: analysis.locales,
    digits,
    nameLists: toListPreviews(nameLists),
    recommended,
    note:
      'Nothing is installed yet. Ask the user, one choice at a time: the ' +
      'key (a short name such as KJV, shown on the Bible buttons), the ' +
      'language, the digits and the book-name list -- recommended first. ' +
      'Then import with these choices.',
  });
}

async function handleNames({ locale, draftId, key, offset }) {
  if (!locale) {
    throw new Error('Give the locale to find book names for, e.g. km-KH.');
  }
  const result = await searchNameLists({ locale, offset });
  if (!draftId && !key) {
    // The Settings import panel's own shape, unchanged: it shows every
    // list in full and links each source.
    return toTextResult(result);
  }
  const lists = result.bookNames.map((names, index) => {
    const source = result.sources[index];
    return { label: source.label, source: source.url ?? 'built in', names };
  });
  const named = await rankForDraft(
    draftId,
    await rememberBibleNameLists(lists),
  );
  return toTextResult({
    locale: toFullLocale(result.locale),
    digits: genDigitChoices(locale),
    nameLists: toListPreviews(named),
    ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    ...(result.moreAvailable ? { nextOffset: result.nextOffset } : {}),
    note:
      'Lists from other editions differ: show the user the first names of ' +
      'each and let them pick the one that matches their printed Bible.',
  });
}

async function handleImport({
  draftId,
  key,
  locale,
  digits,
  bookNames,
  title,
}) {
  if (!key) {
    return toProblemResult(
      'key',
      'Ask the user for the Bible key first: a short name such as KSV.',
    );
  }
  let meta;
  try {
    meta = await readBibleDraftMeta(draftId);
  } catch (error) {
    if (error instanceof BibleXmlProblem) {
      return toProblemResult(error.problem, error.message);
    }
    throw error;
  }
  const chosenLocale = locale || meta.recommended.locale;
  if (!chosenLocale) {
    return toProblemResult(
      'locale',
      'The language could not be worked out. Ask the user which language ' +
        'this Bible is in.',
    );
  }
  const isRecommendedLocale = chosenLocale === meta.recommended.locale;
  const digitList = getBibleNumberChoices(chosenLocale);
  const digitChoice =
    digits ?? (isRecommendedLocale ? meta.recommended.digits : 'local');
  const numbers =
    digitChoice === 'local' ? digitList[0] : digitList[digitList.length - 1];
  const resolved = await resolveBookNames(
    bookNames,
    isRecommendedLocale ? meta.recommended.bookNames : meta.fileListId,
  );
  let names = resolved.names;
  if (resolved.changes) {
    const base = (await findBibleNameList(meta.fileListId))?.names ?? null;
    names = BIBLE_BOOK_KEYS.map((bookKey, index) => {
      return resolved.changes[bookKey] ?? base?.[index] ?? bookKey;
    });
  }
  const { xmlPath } = toBibleDraftPaths(draftId);
  const result = await runBibleWorker(
    {
      action: 'import',
      xmlPath,
      sourceName: meta.fileName,
      key,
      locale: chosenLocale,
      numbers,
      bookNames: names,
      title,
    },
    LONG_WORK_MS,
  );
  if (result.isError) {
    return result.problem
      ? toProblemResult(result.problem, result.reason)
      : toErrorResult(new Error(result.reason));
  }
  await removeBibleDraft(draftId);
  return toTextResult({
    ...result,
    note:
      'Installed. It is now one of the Bible versions to pick in the ' +
      'Bible Lookup and the Reader. ' +
      AGENT_UNDO_TEXT,
  });
}

async function handleUpdate({ key, title, locale, digits, bookNames }) {
  let numbers;
  if (digits !== undefined) {
    let digitLocale = locale;
    if (!digitLocale) {
      const info = await runBibleWorker({ action: 'info', key });
      if (info.isError) {
        return toErrorResult(new Error(info.reason));
      }
      digitLocale = info.locale;
    }
    const digitList = getBibleNumberChoices(digitLocale);
    numbers =
      digits === 'local' ? digitList[0] : digitList[digitList.length - 1];
  }
  let names;
  if (bookNames !== undefined) {
    const resolved = await resolveBookNames(bookNames);
    names = resolved.changes ?? resolved.names ?? undefined;
  }
  const result = await runBibleWorker(
    { action: 'update', key, title, locale, numbers, bookNames: names },
    LONG_WORK_MS,
  );
  return result.isError
    ? toErrorResult(new Error(result.reason))
    : toTextResult(result);
}

export function registerBibleXmlTool(server) {
  server.registerTool(
    'owa_bible_xml',
    {
      description:
        'Bibles from XML: install, list, change, remove. `check` a `url` ' +
        `(no link: ${BIBLE_XML_CATALOG_URL}, the language in \`find\`): ` +
        'a page answers its .xml files; a file a `draftId` and choices ' +
        'for the user to pick -- `keys`, `locales`, `digits`, `nameLists` ' +
        '(ids), `recommended`. `names`: more lists for `locale` (web, ' +
        'slow). `import` the draft with `key`, `locale`, `digits`, ' +
        '`bookNames` id; `cancel`. `info`, `update` (title, locale, ' +
        'digits, bookNames: id or {"GEN": name}), `delete` take `key`. A ' +
        '`problem` is about the link or key: say it plainly. ' +
        AGENT_UNDO_TEXT,
      inputSchema: {
        action: z.enum(BIBLE_XML_ACTIONS),
        url: z.string().max(600).optional(),
        // No lengths spelled out but the address's: each is checked again
        // where it is used (the draft id by pattern, the key by the app),
        // and every character of a schema is paid for on every round.
        find: z.string().optional(),
        draftId: z.string().optional(),
        key: z.string().optional(),
        locale: z.string().optional(),
        digits: z.enum(['local', 'ascii']).optional(),
        bookNames: z.union([z.string(), z.record(z.string())]).optional(),
        title: z.string().optional(),
        offset: z.number().int().min(0).max(99).optional(),
      },
    },
    async (args) => {
      try {
        switch (args.action) {
          case 'check':
            return await handleCheck(args);
          case 'names':
            return await handleNames(args);
          case 'import':
            return await handleImport(args);
          case 'cancel':
            await removeBibleDraft(args.draftId);
            return toTextResult({ cancelled: true });
          case 'list':
            return toTextResult(await runBibleWorker({ action: 'list' }));
          case 'info':
          case 'delete': {
            const result = await runBibleWorker(
              { action: args.action, key: args.key },
              LONG_WORK_MS,
            );
            return result.isError
              ? toErrorResult(new Error(result.reason))
              : toTextResult(result);
          }
          case 'update':
            return await handleUpdate(args);
          default:
            throw new Error(`Unknown action "${String(args.action)}".`);
        }
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
