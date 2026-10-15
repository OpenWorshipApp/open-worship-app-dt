export type TranBundle = {
  languages?: { code: string; name: string; nativeName: string }[];
  dictionaries: Record<string, Record<string, string>>;
};

export const DEFAULT_LANG_CODE: 'en';
export function extractDictionary(source: string): Record<string, string>;
export function extractLangMeta(source: string): {
  name: string | null;
  nativeName: string | null;
};
export function loadTranBundle(): TranBundle;
export function listTranLanguages(): NonNullable<TranBundle['languages']>;
export function tranText(
  text: string,
  langCode: string | null,
  bundle?: TranBundle | null,
): string;
export function resolveTranTemplates(
  text: string,
  langCode: string | null,
  bundle?: TranBundle | null,
): string;
export function listTranTemplateKeys(text: string): {
  sourceLang: string;
  kind: string;
  key: string;
}[];
