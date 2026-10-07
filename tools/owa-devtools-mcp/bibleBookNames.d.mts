export const BIBLE_BOOK_KEYS: string[];
export function normalizeBibleLocale(input: string): {
  locale: string;
  language: string;
  catalogCode: string;
};
export function guessBibleLocale(fileName: string): string | null;
export function getBibleNumberChoices(locale: string): string[][];
