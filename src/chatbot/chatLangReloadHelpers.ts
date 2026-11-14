// When the help window must load again to take the languages it has.
//
// It reads every installed language's small files ONCE, at load: which
// language a line is typed in (`chatLangHelpers.ts`), the window's own
// shortcuts (`languageEditAskHelpers.ts`) and every reader built on a
// package's marks. A language installed, updated, turned on or off while it
// is open -- by its own offer to install one (`langInstallChatHelpers.ts`),
// or from another window -- reaches its list of languages
// (`langPluginRegistry.ts`) and nothing else, so the window loads again, as
// Settings > Languages reloads every window: this window alone, and only once
// nothing is on its way (BN-45, 2026-11-09: a language installed from the
// help window's own offer was not named, and its no-model shortcuts went to a
// model, until the window was opened again).

type LangPluginKeyType = {
    langCode: string;
    version: string;
    isEnabled: boolean;
};

/** The languages a window reads, as one string: each code and version. */
export function toEnabledLangKey(list: readonly LangPluginKeyType[]): string {
    return list
        .filter((plugin) => {
            return plugin.isEnabled;
        })
        .map((plugin) => {
            return `${plugin.langCode}@${plugin.version}`;
        })
        .sort()
        .join(',');
}

// Long enough for the answer that said the language is ready to be drawn
// and saved before the window goes; short enough to be the next thing seen.
export const LANG_RELOAD_DELAY_MILLISECONDS = 600;

/**
 * Whether the window should load again now: the languages differ from the
 * ones it loaded with, and nothing it is doing would be cut off.
 */
export function checkIsLangReloadDue(options: {
    loadedKey: string;
    currentKey: string;
    pendingCount: number;
}) {
    return (
        options.currentKey !== options.loadedKey && options.pendingCount === 0
    );
}
