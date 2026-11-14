// Words in scripts other than Latin for the html-in-canvas demos: a script
// that stacks its letters, one written right to left, and ideographs. Read
// from the language plugins INSTALLED -- each one's own name for itself --
// chosen by what its letters ARE, never by which language it is, so every
// language is found the same way and none is named here (only English ships
// with the app, 2026-11-04). A kind no installed language has shows a
// sentence saying so. Dev-only.

import { getEnabledLangPlugins } from '../../lang/langPluginRegistry';

const STACKED_PATTERN = /\p{L}\p{M}{2,}|\p{M}\p{L}\p{M}/u;
const IDEOGRAPH_PATTERN = /\p{Script=Han}/u;

type LangPluginItemType = ReturnType<typeof getEnabledLangPlugins>[number];

/** Each installed language's own name that fits, or the kind in English. */
function findOwnNames(
    check: (plugin: LangPluginItemType) => boolean,
    missing: string,
    count = 1,
) {
    const found = getEnabledLangPlugins()
        .filter(check)
        .map((plugin) => {
            return plugin.nativeName;
        })
        .slice(0, count);
    return found.length > 0 ? found.join(' · ') : missing;
}

export const SCRIPT_SAMPLES = {
    // Subscript consonants and vowel signs around a base letter.
    get stacked() {
        return findOwnNames((plugin) => {
            return (
                plugin.direction !== 'rtl' &&
                STACKED_PATTERN.test(plugin.nativeName)
            );
        }, '(no installed language stacks its letters)');
    },
    get rightToLeft() {
        return findOwnNames((plugin) => {
            return plugin.direction === 'rtl';
        }, '(no installed language is written right to left)');
    },
    get ideographs() {
        return findOwnNames(
            (plugin) => {
                return IDEOGRAPH_PATTERN.test(plugin.nativeName);
            },
            '(no installed language is written in ideographs)',
            2,
        );
    },
};
