// Types for `langPacks.mjs`, which is plain ESM like everything else under
// `tools/`: where the MCP server reads a language's own data -- the installed
// plugins a lister names, or a checkout's source packages.

export type LangPackType = {
  code: string;
  dirPath: string;
  isSource: boolean;
};

export const SOURCE_LANG_PACKS_DIR: string;
export const DEFAULT_LANG_CODE: 'en';
export const LANG_PACK_TRAN_FILE_NAME: string;

/**
 * The lister of installed language folders: an array (empty when nothing is
 * installed) or `null` when it cannot tell, and then the source packs are
 * read. `null` for no lister at all.
 */
export function configureLangPacks(
  lister: (() => string[] | null) | null,
): void;
export function sanitizeTranKey(key: string): string;
export function extractDictionary(source: string): Record<string, string>;
/** A source package's dictionary: its `dictionary.json`, sanitized. */
export function readSourceDictionary(packDir: string): Record<string, string>;
export function listLangPacks(): LangPackType[];
export function findLangPack(langCode: string | null): LangPackType | null;
export function readLangPackJson(
  pack: LangPackType | null | undefined,
  fileName: string,
): any;
export function readLangPackDictionary(
  pack: LangPackType | null | undefined,
): Record<string, string>;
export function readLangPackNames(pack: LangPackType): {
  name: string;
  nativeName: string;
};
