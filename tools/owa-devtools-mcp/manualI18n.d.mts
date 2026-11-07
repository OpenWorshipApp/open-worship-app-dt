// Types for `manualI18n.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because a chatbot test reads the manual's translations
// from TypeScript: the known page rides in the person's language block for
// block (`toLocalizedCut`), and the test holds every current translation to
// lining up with its English page.

export const MANUAL_SOURCE_DIR: string;
/** The installable language packages (`src/lang/data/online`); a manual is `<code>/manual/`. */
export const MANUAL_I18N_DIR: string;
export const MANUAL_DIR_NAME: string;
/** A plugin's prebuilt index of its manual, inside its `manual/`. */
export const MANUAL_INDEX_FILE_NAME: string;
export const MANUAL_SEARCH_TEXT_LIMIT: number;
export const MANUAL_HEADINGS_LIMIT: number;

/** A page body's headings and bold leads, one line each, capped. */
export function genManualHeadings(body: string): string;

/** A page's front matter as plain strings by key. */
export function readFrontMatter(content: string): Record<string, string>;

/** The hash a translation's `translatedFrom` names the English page by. */
export function hashManualPage(englishContent: string): string;

/** The English pages by id: their file (relative to the sources) and hash. */
export function listEnglishManualPages(
  sourceDir?: string,
): Map<string, { id: string; relativePath: string; hash: string }>;

/** The languages the manual is translated into. */
export function listManualLanguages(i18nDir?: string): string[];

/** One language's translated pages, each saying whether it is stale. */
export function listManualTranslations(
  langCode: string,
  options?: {
    i18nDir?: string;
    packDir?: string;
    englishPageMap?: Map<
      string,
      { id: string; relativePath: string; hash: string }
    >;
  },
): {
  id: string;
  lang: string;
  title: string;
  section: string;
  relativePath: string;
  absolutePath: string;
  translatedFrom: string | null;
  isStale: boolean;
  content: string;
}[];

/** The search entries of the manual in `<packDir>/manual/`. */
export function genManualIndexEntries(packDir: string): {
  id: string;
  title: string;
  section: string;
  file: string;
  translatedFrom: string | null;
  headings: string;
  searchText: string;
}[];
