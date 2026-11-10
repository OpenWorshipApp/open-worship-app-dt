// Every language's English name -- English's own table,
// `src/lang/data/en/language-names.json` -- as one pattern a sentence is
// read against: "add the Spanish under each line", "the book buttons in
// Tagalog". Every language is found the same way, and none is named here.
// Built on first use (about 180 names), then kept: the table is English's,
// built into the app, and does not change while a window is open.

import languageNameMap from '../lang/data/en/language-names.json';

let languageNamePattern: RegExp | null = null;

function escapePattern(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Each English name and each of its other names (the table writes
 * "Spanish, Castilian"), the part in brackets left off, longest first so a
 * longer name is not read as a shorter one inside it.
 */
function listLanguageNameWords(): string[] {
    const words = new Set<string>();
    const nameList = Object.values(languageNameMap as Record<string, string>);
    for (const name of nameList) {
        for (const part of name.split(/[,;]/)) {
            const word = part.split('(')[0].trim().toLowerCase();
            if (word.length >= 3) {
                words.add(word);
            }
        }
    }
    return [...words].sort((a, b) => {
        return b.length - a.length;
    });
}

/** Whether the text names a language by its English name, as a whole word. */
export function checkHasLanguageName(text: string): boolean {
    languageNamePattern ??= new RegExp(
        `\\b(?:${listLanguageNameWords().map(escapePattern).join('|')})\\b`,
        'i',
    );
    return languageNamePattern.test(text);
}
