import {
    DEFAULT_LANG_CODE,
    getCurrentLocale,
    getLangCode,
    getLangDataAsync,
} from './lang/langHelpers';
import { PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME } from './helper/constants';
import { handleError } from './helper/errorHelpers';
import { sanitizeCssValue } from './helper/sanitizeHelpers';
import {
    getAppFontFamily,
    getAppFontWeight,
} from './setting/appFontSettingHelpers';
import appProvider from './server/appProvider';
import { appLocalStorage } from './setting/directory-setting/appLocalStorage';

async function initFontFamily() {
    const id = 'app-custom-style';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (style === null) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }
    const fontFamily = await getAppFontFamily();
    if (fontFamily !== null) {
        const safeFontFamily = sanitizeCssValue(fontFamily);
        style.innerHTML = `
        * {
            font-family: '${safeFontFamily}';
        }
    `;
    }
    const fontWeight = await getAppFontWeight();
    if (fontWeight !== null) {
        const safeFontWeight = sanitizeCssValue(String(fontWeight));
        style.innerHTML += `
        * {
            font-weight: ${safeFontWeight};
        }
    `;
    }
}

/**
 * Runs at most once per installation. The marker is claimed BEFORE the work so
 * a second window opening at the same moment cannot run the same moves twice —
 * every step is guarded against a destination that already exists, so a run cut
 * short in the middle is picked up by the next launch rather than undone.
 */
async function initPresentingFlowRenameMigration() {
    if (
        appLocalStorage.getItem(
            PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
        ) !== null
    ) {
        return;
    }
    appLocalStorage.setItem(
        PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
        'true',
    );
    try {
        const { default: migratePresentingFlowRename } =
            await import('./helper/presentingFlowRenameMigration');
        await migratePresentingFlowRename();
    } catch (error) {
        handleError(error);
    }
}

// Kept in the DATA folder's own settings, so the folder is migrated once
// whichever computer first opens it with this version.
const SETTING_KEY_PATH_MIGRATION_SETTING_NAME = 'setting-key-path-migration';

/**
 * Per data folder, once: setting names made from an absolute path are renamed
 * to the relative form (`settingKeyPathMigration`), so panel sizes and run-sheet
 * rows survive the folder moving to another drive or computer. Same claim-first
 * pattern as the migration above.
 */
async function initSettingKeyPathMigration() {
    if (
        appLocalStorage.getItem(SETTING_KEY_PATH_MIGRATION_SETTING_NAME) !==
        null
    ) {
        return;
    }
    appLocalStorage.setItem(SETTING_KEY_PATH_MIGRATION_SETTING_NAME, 'true');
    try {
        const { default: migrateSettingKeyPaths } =
            await import('./helper/settingKeyPathMigration');
        await migrateSettingKeyPaths();
    } catch (error) {
        handleError(error);
    }
}

export async function init(callback: () => void = () => {}) {
    // First, before anything reads a file: the migration below reads settings,
    // and some windows (`lyricEditor`) read their data without awaiting `init`.
    appProvider.sessionData.defaultStorageDirPath =
        appLocalStorage.defaultStorageDirPath;
    await initPresentingFlowRenameMigration();
    await initSettingKeyPathMigration();
    initFontFamily();
    const currentLocale = getCurrentLocale();
    // Keep the document language in sync with the app locale so assistive tech
    // and `:lang()` CSS see Khmer as Khmer; it otherwise stays the HTML default
    // ("en") even in km mode. `init` re-runs on every window (re)load, including
    // the reload `forceReloadAppWindows` triggers after an Apply Settings.
    document.documentElement.lang =
        getLangCode(currentLocale) ?? DEFAULT_LANG_CODE;
    await getLangDataAsync(currentLocale);
    callback();
}
