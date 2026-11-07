// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Own mocks: two tiny language packages, a settings map, and the real
// `appHooks` running on plain `useEffect`.
const h = vi.hoisted(() => {
    return {
        settingMap: new Map<string, string>(),
        langDataByCode: {} as Record<string, any>,
        askedLangCodeList: [] as string[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../helper/loggerHelpers', () => ({ appWarning: () => undefined }));
vi.mock('../helper/errorHelpers', () => ({ handleError: () => undefined }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settingMap.set(key, value);
    },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    checkIsValidLangCode: (langCode: string) => {
        return ['en', 'km'].includes(langCode);
    },
    getAllLangsAsync: async () => [],
    getLangDataByCodeAsync: async (langCode: string) => {
        h.askedLangCodeList.push(langCode);
        return h.langDataByCode[langCode] ?? null;
    },
    // A package translates by prefixing its code; none leaves the text as is.
    tranByLangData: (langData: any, text: string) => {
        return langData ? `${langData.langCode}:${text}` : text;
    },
}));

import type { LookupLangPresentationType } from './lookupLangHelpers';
import {
    LookupLangContext,
    getSelectedLookupLangCode,
    setSelectedLookupLangCode,
    useLookupLangPresentation,
} from './lookupLangHelpers';

describe('useLookupLangPresentation', () => {
    let container: HTMLDivElement;
    let root: Root;
    let presentationList: LookupLangPresentationType[];

    function PresentationHostComp(_props: Readonly<{ revision: number }>) {
        const presentation = useLookupLangPresentation();
        presentationList.push(presentation);
        return (
            <span>
                {`${presentation.fontFamily ?? 'app font'}|` +
                    presentation.translate('People')}
            </span>
        );
    }

    async function flush() {
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.settingMap.clear();
        h.askedLangCodeList = [];
        h.langDataByCode = {
            en: { langCode: 'en' },
            km: { langCode: 'km', fontFamily: 'Khmer OS' },
        };
        presentationList = [];
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        setSelectedLookupLangCode('en');
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('writes in the app font until the package resolves, then in its own', async () => {
        setSelectedLookupLangCode('km');
        act(() => {
            root.render(<PresentationHostComp revision={1} />);
        });
        expect(container.textContent).toBe('app font|People');
        await flush();
        expect(h.askedLangCodeList).toEqual(['km']);
        expect(container.textContent).toBe('Khmer OS|km:People');
    });

    test('a package naming no font keeps the app font but still translates', async () => {
        expect(getSelectedLookupLangCode()).toBe('en');
        act(() => {
            root.render(<PresentationHostComp revision={1} />);
        });
        await flush();
        expect(container.textContent).toBe('app font|en:People');
    });

    test('a pinned panel language wins over the setting', async () => {
        act(() => {
            root.render(
                <LookupLangContext value="km">
                    <PresentationHostComp revision={1} />
                </LookupLangContext>,
            );
        });
        await flush();
        expect(getSelectedLookupLangCode()).toBe('en');
        expect(h.askedLangCodeList).toEqual(['km']);
        expect(container.textContent).toBe('Khmer OS|km:People');
    });

    test('the same package hands out the same presentation across renders', async () => {
        act(() => {
            root.render(<PresentationHostComp revision={1} />);
        });
        await flush();
        const loaded = presentationList.at(-1);
        act(() => {
            root.render(<PresentationHostComp revision={2} />);
        });
        expect(presentationList.at(-1)).toBe(loaded);
        expect(h.askedLangCodeList).toEqual(['en']);

        // A language switch re-reads and hands out a new one.
        act(() => {
            setSelectedLookupLangCode('km');
        });
        await flush();
        expect(h.askedLangCodeList).toEqual(['en', 'km']);
        expect(presentationList.at(-1)).not.toBe(loaded);
        expect(container.textContent).toBe('Khmer OS|km:People');
    });
});
