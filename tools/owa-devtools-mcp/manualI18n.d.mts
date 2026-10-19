// Types for `manualI18n.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because a chatbot test reads the manual's translations
// from TypeScript: the known page rides in the person's language block for
// block (`toLocalizedCut`), and the test holds every current translation to
// lining up with its English page.

export const MANUAL_SOURCE_DIR: string;
export const MANUAL_I18N_DIR: string;

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
