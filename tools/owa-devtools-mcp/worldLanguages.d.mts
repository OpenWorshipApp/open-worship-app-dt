// Types for `worldLanguages.mjs`, plain ESM like everything else under
// `tools/`: what the Bible import and the lyric tools know of the world's
// languages -- English from the app, an installed language's own words from
// its `world.json`.

export type WorldLanguagesType = {
  about?: string;
  nativeLanguageNames: Record<string, string>;
  languageAliases: Record<string, string>;
  languageWordPrefixes: string[];
  scriptLocales: Record<string, string[]>;
  latinStopWords: Record<string, string>;
  cyrillicLetterLocales: [string, string[]][];
  cyrillicDefaultLocales: string[];
  bookNumberWords: string[];
  ownScriptLanguages: Record<string, string>;
  localeNameAliases: Record<string, string[]>;
  colonMarks: string;
};

/** Where the installed languages' `world.json` parts come from. */
export function configureWorldLanguageParts(
  reader: (() => unknown[]) | null,
): void;
/** The world's languages as this app knows them right now. */
export function readWorldLanguages(now?: number): WorldLanguagesType;
