// Shared, dependency-free import advice. No verse text or persistent cache.
export const BIBLE_BOOK_KEYS = (
  'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI ' +
  '1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO ' +
  'OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL ' +
  'EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'
).split(' ');

const LANGUAGE_CODES = {
  km: 'khm',
  en: 'eng',
  fr: 'fra',
  es: 'spa',
  de: 'deu',
  pt: 'por',
  it: 'ita',
  ru: 'rus',
  uk: 'ukr',
  zh: 'cmn',
  ja: 'jpn',
  ko: 'kor',
  th: 'tha',
  vi: 'vie',
  lo: 'lao',
  my: 'mya',
  ar: 'arb',
  hi: 'hin',
  id: 'ind',
  ms: 'zlm',
  nl: 'nld',
  pl: 'pol',
  he: 'heb',
  el: 'ell',
};

export function normalizeBibleLocale(input) {
  let text = String(input ?? '')
    .trim()
    .replaceAll('_', '-');
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  for (const [code, iso] of Object.entries(LANGUAGE_CODES)) {
    if (
      [
        iso,
        names.of(code)?.toLowerCase(),
        code === 'km' ? 'cambodian' : null,
      ].includes(text.toLowerCase())
    )
      text = code;
  }
  try {
    const locale = new Intl.Locale(text);
    return {
      locale: locale.toString(),
      language: locale.language,
      catalogCode: LANGUAGE_CODES[locale.language] ?? locale.language,
    };
  } catch {
    throw new Error('Choose a language code such as km-KH, fr-FR or en-US.');
  }
}

export function guessBibleLocale(fileName) {
  let name;
  try {
    name = decodeURIComponent(
      String(fileName).split(/[?#]/)[0].split('/').pop(),
    );
  } catch {
    return null;
  }
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  for (const code of Object.keys(LANGUAGE_CODES)) {
    const language = names.of(code);
    if (language && name.toLowerCase().startsWith(language.toLowerCase())) {
      const expanded = new Intl.Locale(code).maximize();
      return `${expanded.language}-${expanded.region}`;
    }
  }
  const match = name.match(/^([a-z]{2,3}(?:[-_][A-Z]{2})?)[-_.]/);
  if (!match) return null;
  try {
    const expanded = new Intl.Locale(
      normalizeBibleLocale(match[1]).locale,
    ).maximize();
    return `${expanded.language}-${expanded.region}`;
  } catch {
    return null;
  }
}

export function getBibleNumberChoices(locale) {
  try {
    const { language } = normalizeBibleLocale(locale);
    const numberingSystem = { km: 'khmr', th: 'thai', lo: 'laoo', my: 'mymr' }[
      language
    ];
    const formatter = new Intl.NumberFormat(locale, {
      useGrouping: false,
      numberingSystem,
    });
    const local = Array.from({ length: 10 }, (_, i) => formatter.format(i));
    const ascii = Array.from({ length: 10 }, (_, i) => String(i));
    return local.join('') === ascii.join('') ? [ascii] : [local, ascii];
  } catch {
    return [Array.from({ length: 10 }, (_, i) => String(i))];
  }
}

// Runs ONLY in the sandboxed public-web reader. Stable book ids determine
// order; extra Catholic books are never allowed to shift the 66-book map.
export function extractBibleCatalog() {
  const books = [];
  const versions = [];
  const isBible = location.hostname === 'www.bible.com';
  const isWordproject = location.hostname === 'www.wordproject.org';
  if (!isBible && !isWordproject) return { books, versions };
  const seen = new Set();
  for (const anchor of document.querySelectorAll('a[href]')) {
    // `innerText` where the page is laid out: an edition link is three
    // spans (abbreviation, name, publisher), and `textContent` runs them
    // together into "BFCBible en français courantFrench Bible Society".
    const text = (anchor.innerText || anchor.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length > 160) continue;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin) continue;
    const version =
      isBible && url.pathname.match(/^\/(?:[a-z-]+\/)?versions\/(\d+)/i);
    if (version && versions.length < 100 && !seen.has(version[1])) {
      seen.add(version[1]);
      versions.push({
        label: text,
        url: `https://www.bible.com/versions/${version[1]}`,
      });
    }
    const book =
      isBible &&
      anchor.closest('h3') &&
      url.pathname.match(/\/bible\/\d+\/([1-3]?[A-Z]{2,3})\.\d/i);
    const number =
      isWordproject && url.pathname.match(/\/bibles\/[^/]+\/(\d{2})\/1\.htm$/);
    if (books.length < 100 && (book || number)) {
      books.push({
        key: book ? book[1].toUpperCase() : Number(number[1]),
        name: text,
      });
    }
  }
  return { books, versions };
}

export function toCompleteBibleBookList(books) {
  const map = new Map();
  for (const book of books ?? []) {
    const key =
      typeof book.key === 'number' ? BIBLE_BOOK_KEYS[book.key - 1] : book.key;
    if (!BIBLE_BOOK_KEYS.includes(key) || typeof book.name !== 'string')
      continue;
    const name = book.name.trim();
    if (!name || name.length > 160 || (map.has(key) && map.get(key) !== name))
      return null;
    map.set(key, name);
  }
  return map.size === 66 ? BIBLE_BOOK_KEYS.map((key) => map.get(key)) : null;
}

export async function findBibleBookNames(
  locale,
  { readPage, bundled = [], offset = 0 },
) {
  const normalized = normalizeBibleLocale(locale);
  const bookNames = [];
  const sources = [];
  const warnings = [];
  const add = (books, label, url) => {
    if (
      !Array.isArray(books) ||
      books.length !== 66 ||
      books.some((name) => typeof name !== 'string' || !name.trim())
    )
      return;
    const index = bookNames.findIndex(
      (list) => JSON.stringify(list) === JSON.stringify(books),
    );
    if (index >= 0) {
      sources[index].references.push({ label, url });
      return;
    }
    bookNames.push(books);
    sources.push({ label, url, references: [] });
  };
  for (const set of bundled) add(set.books, set.keys.join(' / '), null);
  const read = async (url) => {
    try {
      return await readPage(url);
    } catch {
      warnings.push(`Could not read ${url}`);
      return null;
    }
  };
  const catalogUrl = `https://www.bible.com/languages/${normalized.catalogCode}`;
  const catalog = await read(catalogUrl);
  // One catalog, up to three editions, then an independent publisher.
  // Sequential reads keep only one hidden browser alive on low-spec PCs.
  const editions = catalog?.bibleCatalog?.versions ?? [];
  let nextOffset = offset;
  for (const edition of editions.slice(offset, offset + 3)) {
    if (!/^https:\/\/www\.bible\.com\/versions\/\d+$/.test(edition.url)) {
      nextOffset++;
      continue;
    }
    const page = await read(edition.url);
    // A failed or quota-limited page must be retried, not silently skipped.
    if (page === null) break;
    nextOffset++;
    const books = toCompleteBibleBookList(page?.bibleCatalog?.books);
    if (books) add(books, edition.label, edition.url);
    else warnings.push(`No complete 66-book list at ${edition.url}`);
  }
  const wordprojectUrl = `https://www.wordproject.org/bibles/${normalized.language}/index.htm`;
  if (offset === 0) {
    const page = await read(wordprojectUrl);
    const books = toCompleteBibleBookList(page?.bibleCatalog?.books);
    if (books) add(books, 'Wordproject', wordprojectUrl);
    else warnings.push(`No complete 66-book list at ${wordprojectUrl}`);
  }
  return {
    locale: normalized.locale,
    bookKeys: BIBLE_BOOK_KEYS,
    bookNames,
    sources,
    warnings,
    moreAvailable: catalog === null || editions.length > nextOffset,
    nextOffset,
    searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${new Intl.DisplayNames(['en'], { type: 'language' }).of(normalized.language)} Bible book names list`)}`,
  };
}
