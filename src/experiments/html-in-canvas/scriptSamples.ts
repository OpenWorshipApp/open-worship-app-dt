// Words in scripts other than Latin for the html-in-canvas demos: a script
// that stacks its letters, one written right to left, and ideographs. Read
// from the language plugins INSTALLED, each under its own name (only English
// ships with the app, 2026-11-04), rather than written here, so no word of
// another language sits in the code; a language not installed shows its
// English name. Dev-only.

import { getEnabledLangPlugins } from '../../lang/langPluginRegistry';

/** A language's own name, found by its English one, or the English one. */
function findOwnName(englishName: string) {
    const plugin = getEnabledLangPlugins().find((item) => {
        return item.name === englishName;
    });
    return plugin?.nativeName ?? englishName;
}

export const SCRIPT_SAMPLES = {
    // Subscript consonants and vowel signs around a base letter.
    get stacked() {
        return findOwnName('Khmer');
    },
    get rightToLeft() {
        return findOwnName('Arabic');
    },
    get ideographs() {
        return `${findOwnName('Chinese (Simplified)')} · ${findOwnName('Japanese')}`;
    },
};
