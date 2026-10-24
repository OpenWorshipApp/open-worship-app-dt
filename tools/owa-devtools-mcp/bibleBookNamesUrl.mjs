// A supplied source is an explicit lookup, never a reason to substitute the
// language catalog or manufacture missing book names. Reads stay sequential.
import {
  BIBLE_BOOK_KEYS,
  normalizeBibleLocale,
  toCompleteBibleBookList,
} from './bibleBookNames.mjs';
import { checkWebUrl } from './webUrlPolicy.mjs';

export function toBibleBookIndexUrl(input) {
  const verdict = checkWebUrl(input);
  if (!verdict.isAllowed) throw new Error(verdict.reason);
  const url = new URL(verdict.href);
  if (url.username || url.password)
    throw new Error('Use a public link without sign-in credentials.');
  const host = url.hostname.toLowerCase();
  if (host === 'bible.com' || host === 'www.bible.com') {
    const id = url.pathname.match(
      /^\/(?:[a-z-]+\/)?(?:bible|versions)\/(\d+)(?:[/.\-]|$)/i,
    )?.[1];
    if (id) return `https://www.bible.com/versions/${id}`;
    url.hostname = 'www.bible.com';
  }
  if (host === 'wordproject.org' || host === 'www.wordproject.org') {
    const language = url.pathname.match(/^\/bibles\/([a-z_-]+)\//i)?.[1];
    if (language)
      return `https://www.wordproject.org/bibles/${language}/index.htm`;
  }
  url.hash = '';
  return url.href;
}

function matchesLanguage(books, language, sourceLanguage) {
  if (sourceLanguage) {
    try {
      if (normalizeBibleLocale(sourceLanguage).language !== language)
        return false;
    } catch {
      /* No trustworthy language metadata; check the names below. */
    }
  }
  const script = {
    km: /\p{Script=Khmer}/u,
    th: /\p{Script=Thai}/u,
    lo: /\p{Script=Lao}/u,
    my: /\p{Script=Myanmar}/u,
  }[language];
  return !script || books.every((name) => script.test(name));
}

export async function findBibleBookNamesFromUrl(url, locale, { readPage }) {
  const normalized = normalizeBibleLocale(locale);
  const firstUrl = toBibleBookIndexUrl(url);
  const queue = [firstUrl];
  const visited = new Set();
  const bookNames = [];
  const sources = [];
  const warnings = [];
  let mostBooks = [];
  let languageMismatch = false;
  for (let index = 0; index < queue.length && index < 4; index++) {
    const sourceUrl = queue[index];
    if (visited.has(sourceUrl)) continue;
    visited.add(sourceUrl);
    let page;
    try {
      page = await readPage(sourceUrl);
    } catch {
      warnings.push(`Could not read ${sourceUrl}`);
      continue;
    }
    const catalog = page?.bibleCatalog ?? {};
    const found = (catalog.books ?? []).filter((book) =>
      BIBLE_BOOK_KEYS.includes(
        typeof book.key === 'number' ? BIBLE_BOOK_KEYS[book.key - 1] : book.key,
      ),
    );
    const keys = [
      ...new Set(
        found.map((book) =>
          typeof book.key === 'number'
            ? BIBLE_BOOK_KEYS[book.key - 1]
            : book.key,
        ),
      ),
    ];
    if (keys.length > mostBooks.length) mostBooks = keys;
    const complete = toCompleteBibleBookList(found);
    const names = complete && new Set(complete).size === 66 ? complete : null;
    if (
      names &&
      !matchesLanguage(names, normalized.language, catalog.language)
    ) {
      languageMismatch = true;
      warnings.push(
        `The names at ${sourceUrl} do not match the selected language ${normalized.locale}.`,
      );
    } else if (
      names &&
      !bookNames.some((list) => JSON.stringify(list) === JSON.stringify(names))
    ) {
      bookNames.push(names);
      sources.push({
        label: String(page.title || new URL(sourceUrl).hostname).slice(0, 160),
        url: sourceUrl,
        requestedUrl: url,
        references: [],
      });
    }
    if (names) continue;
    // Only follow edition indexes that the page actually names, on its own
    // origin, at most three. Every read still goes through the network wall.
    for (const edition of (catalog.versions ?? []).slice(0, 100)) {
      try {
        const next = toBibleBookIndexUrl(edition.url);
        if (
          new URL(next).origin === new URL(sourceUrl).origin &&
          !queue.includes(next) &&
          queue.length < 4
        )
          queue.push(next);
      } catch {
        /* A webpage cannot widen the public-address policy. */
      }
    }
  }
  return {
    locale: normalized.locale,
    bookKeys: BIBLE_BOOK_KEYS,
    bookNames,
    sources,
    requestedUrl: url,
    warnings,
    moreAvailable: false,
    ...(bookNames.length
      ? {}
      : {
          problem: languageMismatch ? 'names-language' : 'names-incomplete',
          foundBooks: mostBooks.length,
          missingBooks: BIBLE_BOOK_KEYS.filter(
            (key) => !mostBooks.includes(key),
          ),
          message: languageMismatch
            ? 'This source uses a different language. Keep the selected language and ask for another source or an explicit language change.'
            : 'No complete, unambiguous 66-book list was found. Keep the existing choices; ask for the edition index or another source. Never fill missing names by guessing.',
        }),
  };
}
