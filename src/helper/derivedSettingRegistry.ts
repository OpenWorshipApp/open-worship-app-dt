// Deliberately import-free. The test setup calls `releaseAllDerivedSettings`
// before every test, and pulling `settingHelpers` (and through it `appProvider`)
// into the setup file would load the whole app graph into node-environment
// tests that never touch it.

const releaseList: (() => void)[] = [];

export function registerDerivedSettingRelease(release: () => void) {
    releaseList.push(release);
}

/**
 * Drop every derived-setting entry.
 *
 * Tests swap `getSetting` out from under these readers, so a test that returns
 * the same setting string while expecting a different parse would otherwise be
 * served the previous test's value. Also the honest reset for anything that
 * invalidates settings wholesale, such as switching the data directory.
 */
export function releaseAllDerivedSettings() {
    for (const release of releaseList) {
        release();
    }
}
