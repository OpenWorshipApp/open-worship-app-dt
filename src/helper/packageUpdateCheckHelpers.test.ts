import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    plugins: [] as { langCode: string; version: string }[],
    catalog: [] as { langCode: string; version: string }[] | null,
    installedBinVersion: null as string | null,
    binEntry: null as { version: string } | null,
    getCatalog: vi.fn(),
    getBinEntry: vi.fn(),
    report: vi.fn(),
}));

vi.mock('../lang/langPluginRegistry', () => ({
    ensureLangPlugins: async () => h.plugins,
}));
vi.mock('../lang/langPluginInstallHelpers', () => ({
    getLangCatalogEntries: h.getCatalog,
    listLangUpdateCodes: (pluginList: any[], entryList: any[]) => {
        return pluginList
            .filter((plugin) => {
                const entry = entryList.find((item) => {
                    return item.langCode === plugin.langCode;
                });
                return entry !== undefined && entry.version > plugin.version;
            })
            .map((plugin) => {
                return plugin.langCode;
            });
    },
}));
vi.mock('../server/updatingAppHelpers', () => ({
    checkIsVersionOutdated: (current: string, latest: string) => {
        return current < latest;
    },
}));
vi.mock('./extra-bin/extraBinHelpers', () => ({
    getInstalledExtraBinVersion: async () => h.installedBinVersion,
}));
vi.mock('./extra-bin/extraBinInstallHelpers', () => ({
    getExtraBinEntry: h.getBinEntry,
}));
vi.mock('./packageUpdateHelpers', () => ({
    reportPackageUpdates: h.report,
}));

import { checkPackageUpdates } from './packageUpdateCheckHelpers';

describe('checkPackageUpdates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.plugins = [];
        h.catalog = [];
        h.installedBinVersion = null;
        h.binEntry = null;
        h.getCatalog.mockImplementation(async () => h.catalog);
        h.getBinEntry.mockImplementation(async () => h.binEntry);
    });

    test('nothing installed asks the network for nothing, and says so', async () => {
        await checkPackageUpdates();
        expect(h.getCatalog).not.toHaveBeenCalled();
        expect(h.getBinEntry).not.toHaveBeenCalled();
        expect(h.report).toHaveBeenCalledWith({
            langCodes: [],
            isExtraBinOutdated: false,
        });
    });

    test('an installed language and pack are compared with what is published, quietly', async () => {
        h.plugins = [
            { langCode: 'xx', version: '1.0.0' },
            { langCode: 'yy', version: '2.0.0' },
        ];
        h.catalog = [
            { langCode: 'xx', version: '1.0.1' },
            { langCode: 'yy', version: '2.0.0' },
        ];
        h.installedBinVersion = '0.0.3';
        h.binEntry = { version: '0.0.4' };
        await checkPackageUpdates();
        // Quiet: a dev app with no local catalog or pack pops no toast.
        expect(h.getCatalog).toHaveBeenCalledWith(true);
        expect(h.getBinEntry).toHaveBeenCalledWith(true);
        expect(h.report).toHaveBeenCalledWith({
            langCodes: ['xx'],
            isExtraBinOutdated: true,
        });
    });

    test('what could not be told is left out, and the look still reports', async () => {
        h.plugins = [{ langCode: 'xx', version: '1.0.0' }];
        h.catalog = null;
        h.installedBinVersion = '0.0.4';
        h.binEntry = null;
        await checkPackageUpdates();
        // An empty report: main marks the launch looked at, nothing lit.
        expect(h.report).toHaveBeenCalledWith({});
    });

    test('a half that throws does not stop the other', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        h.plugins = [{ langCode: 'xx', version: '1.0.0' }];
        h.getCatalog.mockRejectedValueOnce(new Error('offline'));
        h.installedBinVersion = '0.0.4';
        h.binEntry = { version: '0.0.4' };
        await checkPackageUpdates();
        expect(h.report).toHaveBeenCalledWith({ isExtraBinOutdated: false });
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
