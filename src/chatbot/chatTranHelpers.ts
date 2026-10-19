// The help window's own words, in the language the app is shown in -- and
// the AI Chat window's, which shares its tab strip.
//
// `tran` here is the app's own `tran()` once the window's entry has plugged
// it in (`plugChatWindowLanguage` in `chatWindowLanguage.ts`, called by
// `src/chatbot.tsx` and `src/aichat.tsx` after `init` has loaded the
// language) and the English words themselves until then -- so a
// node-environment test stays English and never throws. Importing the app's
// `tran` directly would pull `SettingManager` -> `appLocalStorage` ->
// `fileHelpers` -> `appProvider` into every helper here, which a node test
// cannot load, and would throw in a window that rendered before its language
// arrived.
//
// Named `tran` on purpose: `src/lang/tranKeyCoverage.test.ts` reads every
// call of that name with a literal key in `src/`, so each key here is held to
// having its Khmer (and, through the Khmer file, its French) string like any
// other label.
//
// One rule for what may be translated where. Words CODE reads back -- an
// action's label (`WALKTHROUGH_ACTION_PATTERN`, a typed reply matched to a
// button), a note that marks a thread -- stay English in what is stored and
// are translated where they are DRAWN (`tranLabel`). Words nothing reads back
// are translated when they are written.

let strictTranslate = (text: string): string => text;
let lenientTranslate = (text: string): string => text;

/**
 * Plug the app's translators in. `strict` is the app's `tran()`, which throws
 * in dev on a key no dictionary has -- a missing Khmer string is found at once
 * -- and `lenient` answers a word that may or may not be a key (an action
 * label a model wrote, a window's name) with its translation or itself.
 */
export function setChatTranslator(
    strict: (text: string) => string,
    lenient: (text: string) => string,
) {
    strictTranslate = strict;
    lenientTranslate = lenient;
}

/** A label of this window, by its English words (a dictionary key). */
export function tran(text: string): string {
    return strictTranslate(text);
}

/**
 * Words that may be a label of the app or may not -- an action's label, a
 * pressed reply, a window's name: the translation when the dictionary has
 * one, the words as they are when it does not. Never throws.
 */
export function tranLabel(text: string): string {
    return lenientTranslate(text);
}

/**
 * A translated sentence with its gaps filled: `{words}` in the key is
 * replaced by `values.words`. The KEY keeps the gap, so one key serves every
 * value and a translation may put it wherever its own grammar wants it.
 */
export function fillWords(
    text: string,
    values: Record<string, string | number>,
): string {
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = values[name];
        return value === undefined ? match : String(value);
    });
}
