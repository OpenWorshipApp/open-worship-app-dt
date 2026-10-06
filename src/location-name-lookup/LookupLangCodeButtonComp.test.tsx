// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    menu: vi.fn(),
    setSetting: vi.fn(),
    languages: vi.fn(async () => [
        { langCode: 'en', getLookupData: () => null },
        { langCode: 'km', getLookupData: () => null },
    ]),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.menu,
}));
vi.mock('../helper/appHooks', () => ({ useAppStateAsync: vi.fn() }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => 'en',
    setSetting: h.setSetting,
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    checkIsValidLangCode: () => true,
    getAllLangsAsync: h.languages,
    getLangDataByCodeAsync: vi.fn(),
    tranByLangData: vi.fn(),
    tran: (text: string) => text,
    getLanguageTitle: ({ langCode }: { langCode: string }) => langCode,
}));

import LookupLangCodeButtonComp from './LookupLangCodeButtonComp';
import {
    getSelectedLookupLangCode,
    LookupLangContext,
    setSelectedLookupLangCode,
} from './lookupLangHelpers';

const host = document.createElement('div');
let root = createRoot(host);

afterEach(async () => {
    await act(async () => root.unmount());
    root = createRoot(host);
    setSelectedLookupLangCode('en');
    vi.clearAllMocks();
});

describe('lookup language menu', () => {
    test('a detail header uses its language and opens a sibling without changing the setting', async () => {
        const onSelect = vi.fn();
        await act(async () => {
            root.render(
                <LookupLangContext value="km">
                    <LookupLangCodeButtonComp
                        isDetailHeader
                        onSelect={onSelect}
                    />
                </LookupLangContext>,
            );
        });
        expect(host.querySelector('button')?.textContent).toBe('km');
        expect(h.languages).not.toHaveBeenCalled();
        await act(async () => {
            host.querySelector('button')!.click();
        });
        const items = h.menu.mock.calls[0][1];
        expect(items.map((item: { id: string }) => item.id)).toEqual([
            'en',
            'km',
        ]);
        expect(items[0].childBefore).toBeUndefined();
        expect(items[1].childBefore).toBeDefined();
        items[0].onSelect();
        expect(onSelect).toHaveBeenCalledWith('en');
        expect(getSelectedLookupLangCode()).toBe('en');
        expect(h.setSetting).not.toHaveBeenCalled();
    });

    test('the lookup toolbar still changes the global language', async () => {
        await act(async () => root.render(<LookupLangCodeButtonComp />));
        await act(async () => host.querySelector('button')!.click());
        const items = h.menu.mock.calls[0][1];
        await act(async () => items[1].onSelect());
        expect(getSelectedLookupLangCode()).toBe('km');
        expect(host.querySelector('button')?.textContent).toBe('km');
        expect(h.setSetting).toHaveBeenCalledWith(
            'location-name-lookup-lang-code',
            'km',
        );
    });
});
