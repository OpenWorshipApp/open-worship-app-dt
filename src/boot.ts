import { getCurrentLocale, getLangDataAsync } from './lang/langHelpers';
import { PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME } from './helper/constants';
import { handleError } from './helper/errorHelpers';
import { sanitizeCssValue } from './helper/sanitizeHelpers';
import { getSetting, setSetting } from './helper/settingHelpers';
import { getAppFontFamily, getAppFontWeight } from './setting/settingHelpers';

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
    if (getSetting(PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME) !== null) {
        return;
    }
    setSetting(PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME, 'true');
    try {
        const { default: migratePresentingFlowRename } =
            await import('./helper/presentingFlowRenameMigration');
        await migratePresentingFlowRename();
    } catch (error) {
        handleError(error);
    }
}

export async function init(callback: () => void = () => {}) {
    await initPresentingFlowRenameMigration();
    initFontFamily();
    const currentLocale = getCurrentLocale();
    await getLangDataAsync(currentLocale);
    callback();
}
