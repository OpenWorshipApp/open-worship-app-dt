export const BIBLE_XML_ACTIONS: string[];
export const BIBLE_DRAFT_ID_PATTERN: RegExp;
export const BIBLE_NAME_LIST_ID_PATTERN: RegExp;
export function toBibleXmlDownloadUrl(input: string): {
  url: string;
  note: string | null;
};
export function toGithubListingUrl(input: string): string | null;
export function extractBibleXmlLinks(
  text: string,
  baseUrl: string,
): { name: string; url: string }[];
export function rankBibleXmlLinks(
  links: { name: string; url: string }[],
  words: string,
  limit?: number,
): {
  links: { name: string; url: string }[];
  matched: number;
  total: number;
  words: string[];
};
export function checkIsLikelyHtml(head: string): boolean;
export function checkIsLikelyXml(head: string): boolean;
export function guessBibleLocalesFromText(sample: string): {
  script: string | null;
  locales: string[];
};
export function genBibleKeyChoices(options: {
  keyAttribute?: string | null;
  title?: string;
  sourceName?: string;
  locale?: string;
  isTaken?: (key: string) => boolean;
  isValid?: (key: string) => boolean;
  limit?: number;
}): string[];
export function toBibleNameListId(names: string[]): string;
export function toDigitsLabel(digits: string[]): string;
export function scoreNameLists(
  text: string,
  lists: { names: string[] }[],
): number[];
export const BIBLE_XML_CATALOG_URL: string;
export function toCatalogLanguageWord(
  word: string,
  canBeCode?: boolean,
): string | null;
export function toBibleSearchWords(text: string): string[];
export function readBibleXmlTitle(head: string): string | null;
