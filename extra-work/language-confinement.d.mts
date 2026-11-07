// Types for `language-confinement.mjs`, read by the gate's test.

export const FOREIGN_CHARACTER_PATTERN: RegExp;
export const NON_ENGLISH_CODE_PATTERN: RegExp;

/** The repository files the rule is held over, repo-relative with `/`. */
export function listScannedFiles(): string[];

/** What breaks the rule, file by file, with 1-based line numbers. */
export function scanLanguageConfinement(options?: { fileList?: string[] }): {
    foreign: { file: string; lines: number[] }[];
    codes: { file: string; lines: number[] }[];
};
