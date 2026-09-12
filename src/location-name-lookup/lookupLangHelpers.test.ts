import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settingMap: new Map<string, string>(),
    langDataList: [] as any[],
    getAllLangsCount: 0,
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settingMap.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settingMap.set(key, value ?? '');
    },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    checkIsValidLangCode: (text: string) => ['en', 'km'].includes(text),
    getAllLangsAsync: async () => {
        h.getAllLangsCount += 1;
        return h.langDataList;
    },
    getLangDataByCodeAsync: async (langCode: string) => {
        return h.langDataList.find((langData) => {
            return langData.langCode === langCode;
        });
    },
    tranByLangData: (_langData: any, text: string) => text,
}));
// Only `useLookupLangPresentation` uses it, and that is a hook — but the real
// module reaches `appProvider`, which touches `document` at load. See the
// `appprovider-mock-node-env` note.
vi.mock('../helper/appHooks', () => ({
    useAppStateAsync: () => [null],
}));

// The selection is memoized at module scope, so a case that needs a different
// starting point needs its own module instance.
async function importFresh() {
    vi.resetModules();
    return await import('./lookupLangHelpers');
}

beforeEach(() => {
    h.settingMap.clear();
    h.getAllLangsCount = 0;
    h.langDataList = [
        { langCode: 'en', getLookupData: async () => null },
        { langCode: 'km', getLookupData: async () => null },
        // Ships translations but no lookup dataset — offering it would only lead
        // to a failed load.
        { langCode: 'xx' },
    ];
});

describe('the selected lookup language', () => {
    test('defaults to English when nothing was ever picked', async () => {
        const { getSelectedLookupLangCode } = await importFresh();

        expect(getSelectedLookupLangCode()).toBe('en');
    });

    test('reads back what was picked, and persists it', async () => {
        const { getSelectedLookupLangCode, setSelectedLookupLangCode } =
            await importFresh();

        setSelectedLookupLangCode('km');

        expect(getSelectedLookupLangCode()).toBe('km');
        expect(h.settingMap.get('location-name-lookup-lang-code')).toBe('km');

        const reloaded = await importFresh();
        expect(reloaded.getSelectedLookupLangCode()).toBe('km');
    });

    // A code a later build stopped shipping would otherwise fail every load with
    // "no lookup data", and the panel offers no way back from inside itself.
    test('falls back to English for a code this build does not ship', async () => {
        h.settingMap.set('location-name-lookup-lang-code', 'zz');
        const { getSelectedLookupLangCode } = await importFresh();

        expect(getSelectedLookupLangCode()).toBe('en');
    });

    test('notifies subscribers, with the new code already readable', async () => {
        const {
            getSelectedLookupLangCode,
            setSelectedLookupLangCode,
            subscribeLookupLangCode,
        } = await importFresh();
        const seen: string[] = [];
        subscribeLookupLangCode(() => {
            seen.push(getSelectedLookupLangCode());
        });

        setSelectedLookupLangCode('km');

        expect(seen).toStrictEqual(['km']);
    });

    // Every subscriber drops a resident copy of a ~34MB dataset, so a set that
    // changes nothing must not make them all reload.
    test('picking the language already in force notifies nobody', async () => {
        const { setSelectedLookupLangCode, subscribeLookupLangCode } =
            await importFresh();
        const listener = vi.fn();
        subscribeLookupLangCode(listener);

        setSelectedLookupLangCode('en');

        expect(listener).not.toHaveBeenCalled();
    });

    test('an unsubscribed listener stops being called', async () => {
        const { setSelectedLookupLangCode, subscribeLookupLangCode } =
            await importFresh();
        const listener = vi.fn();
        subscribeLookupLangCode(listener)();

        setSelectedLookupLangCode('km');

        expect(listener).not.toHaveBeenCalled();
    });
});

describe('the languages on offer', () => {
    test('lists only packages that ship a lookup dataset', async () => {
        const { getLookupLangCodeListAsync } = await importFresh();

        expect(await getLookupLangCodeListAsync()).toStrictEqual(['en', 'km']);
    });

    // Answering it imports every language module, and the button that asks sits
    // in a header that mounts far more often than the menu is opened.
    test('resolves the list at most once', async () => {
        const { getLookupLangCodeListAsync } = await importFresh();

        await Promise.all([
            getLookupLangCodeListAsync(),
            getLookupLangCodeListAsync(),
        ]);
        await getLookupLangCodeListAsync();

        expect(h.getAllLangsCount).toBe(1);
    });
});
