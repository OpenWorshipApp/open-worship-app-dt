// What the Bible import, the book-name and the lyric tools know about the
// world's languages: ENGLISH's own from the app (`src/lang/data/en/world.json`
// -- its stop words, the names that mean English) and, from each INSTALLED
// language, everything about it: the script and locales it is written in,
// the names it goes by in English and in its own words, its little words,
// its letters and marks (`world.json` in its folder,
// `src/lang/data/online/<code>/world.json`). 2026-11-04, the user:
// _everything related to a language have to be loaded from the language data
// (from language installation catalog), must not ship in the app, except
// english_ -- a language not installed is not known here at all.
//
// Pure, with no I/O, because the renderer bundles it with `bibleXmlAdvice.mjs`
// as the MCP server runs it: where the parts come from is configured by each
// side once -- the server reads the installed plugin folders
// (`langPacks.mjs`, in `server.mjs`), a window its installed languages'
// files (`src/lang/langFileStore.ts`). Unconfigured, English alone.
//
// A list whose first match decides (a script's locales, the Cyrillic letters
// that tell one language from another, the Cyrillic fallbacks) is kept as
// ROWS with the `order` they were written in, so it is rebuilt in that order
// whichever languages are installed.
//
// Kept a few seconds: a Bible's book list asks it once a book, and the
// installed languages change only by a person's press.

import englishWorld from '../../src/lang/data/en/world.json' with { type: 'json' };

const KEEP_MILLISECONDS = 5000;
const OBJECT_KEY_LIST = [
  'nativeLanguageNames',
  'languageAliases',
  'latinStopWords',
  'ownScriptLanguages',
  'localeNameAliases',
];
const LIST_KEY_LIST = ['languageWordPrefixes', 'bookNumberWords'];

let readParts = () => {
  return [];
};
let kept = null;

/** Where the installed languages' `world.json` parts come from. */
export function configureWorldLanguageParts(reader) {
  readParts =
    typeof reader === 'function'
      ? reader
      : () => {
          return [];
        };
  kept = null;
}

function toOrder(row) {
  return Number.isFinite(row?.order) ? row.order : Number.MAX_SAFE_INTEGER;
}

function toRowList(value) {
  return Array.isArray(value)
    ? value.filter((row) => {
        return row !== null && typeof row === 'object';
      })
    : [];
}

function sortRows(rowList) {
  return [...rowList].sort((one, other) => {
    return toOrder(one) - toOrder(other);
  });
}

function mergeWorldLanguages(partList) {
  const world = {
    about: englishWorld.about ?? '',
    languageWordPrefixes: [],
    bookNumberWords: [],
    colonMarks: '',
  };
  for (const key of OBJECT_KEY_LIST) {
    world[key] = {};
  }
  const scriptRowList = [];
  const cyrillicRowList = [];
  const cyrillicDefaultRowList = [];
  for (const part of [englishWorld, ...partList]) {
    if (part === null || typeof part !== 'object') {
      continue;
    }
    for (const key of OBJECT_KEY_LIST) {
      Object.assign(world[key], part[key]);
    }
    for (const key of LIST_KEY_LIST) {
      if (Array.isArray(part[key])) {
        world[key].push(...part[key]);
      }
    }
    scriptRowList.push(...toRowList(part.scriptLocales));
    cyrillicRowList.push(...toRowList(part.cyrillicLetterLocales));
    cyrillicDefaultRowList.push(...toRowList(part.cyrillicDefaultLocales));
    if (typeof part.colonMarks === 'string') {
      world.colonMarks += part.colonMarks;
    }
  }
  world.scriptLocales = {};
  for (const row of sortRows(scriptRowList)) {
    if (typeof row.script === 'string' && Array.isArray(row.locales)) {
      (world.scriptLocales[row.script] ??= []).push(...row.locales);
    }
  }
  // In the order they were written: the first letters found decide.
  world.cyrillicLetterLocales = sortRows(cyrillicRowList)
    .filter((row) => {
      return typeof row.letters === 'string' && Array.isArray(row.locales);
    })
    .map((row) => {
      return [row.letters, row.locales];
    });
  world.cyrillicDefaultLocales = sortRows(cyrillicDefaultRowList)
    .filter((row) => {
      return typeof row.locale === 'string';
    })
    .map((row) => {
      return row.locale;
    });
  return world;
}

/** The world's languages as this app knows them right now. */
export function readWorldLanguages(now = Date.now()) {
  if (kept !== null && now - kept.at < KEEP_MILLISECONDS) {
    return kept.world;
  }
  let partList = [];
  try {
    partList = readParts() ?? [];
  } catch {
    partList = [];
  }
  kept = { at: now, world: mergeWorldLanguages(partList) };
  return kept.world;
}
