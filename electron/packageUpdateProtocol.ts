// What the main process and every renderer agree on about "an installed
// package has an update" (2026-11-04, the user: _as a user I want the app check
// for installed packages (languages, extra-bin) for available update at launch
// so I can know_ -- a sign on the Setting gear, then on each Settings tab, then
// on the item to update).
//
// The main window looks once per launch (`src/helper/packageUpdateCheckHelpers.ts`)
// and tells main; Settings tells main again whatever its own panels learn (an
// update installed, a catalog read afresh). Main keeps the latest answer for
// the launch and hands it to every window that asks, so a page switch or a
// Settings window opened later neither asks the network again nor shows
// nothing. Pure: no Node, no Electron, so `src/` imports it.

export const PACKAGE_UPDATES_BROADCAST_CHANNEL = 'all:app:package-updates';
export const PACKAGE_UPDATES_RENDERER_CHANNEL = 'main:app:package-updates';
export const PACKAGE_UPDATES_GET_CHANNEL = 'all:app:get-package-updates';

export type PackageUpdatesType = {
    // Installed languages (by code) the catalog has a newer pack of.
    langCodes: string[];
    // The Extra Binaries pack is installed and older than the published one.
    isExtraBinOutdated: boolean;
};

export const NO_PACKAGE_UPDATES: PackageUpdatesType = {
    langCodes: [],
    isExtraBinOutdated: false,
};

// A language code is two or three small letters (`checkIsUsableEntry`); a
// handful at most is installed.
const LANG_CODE_PATTERN = /^[a-z]{2,3}$/;
const MAX_LANG_CODES = 64;

function toValidLangCodes(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const langCodes = value.filter((code): code is string => {
        return typeof code === 'string' && LANG_CODE_PATTERN.test(code);
    });
    return [...new Set(langCodes)].sort().slice(0, MAX_LANG_CODES);
}

/**
 * The state after a report: each half is replaced only when the report carries
 * it, so the Languages tab saying what it knows never clears what the launch
 * check learned of the Extra Binaries, and the reverse.
 */
export function mergePackageUpdates(
    current: PackageUpdatesType | null,
    report: unknown,
): PackageUpdatesType {
    const base = current ?? NO_PACKAGE_UPDATES;
    if (report === null || typeof report !== 'object') {
        return base;
    }
    const { langCodes, isExtraBinOutdated } = report as {
        langCodes?: unknown;
        isExtraBinOutdated?: unknown;
    };
    return {
        langCodes: toValidLangCodes(langCodes) ?? base.langCodes,
        isExtraBinOutdated:
            typeof isExtraBinOutdated === 'boolean'
                ? isExtraBinOutdated
                : base.isExtraBinOutdated,
    };
}

export function checkHasPackageUpdate(state: PackageUpdatesType | null) {
    return (
        state !== null &&
        (state.langCodes.length > 0 || state.isExtraBinOutdated)
    );
}
