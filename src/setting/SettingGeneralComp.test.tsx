// @vitest-environment jsdom

// The General tab rendered whole -- language, theme and font cards -- beside
// the real Apply Settings button, which each of them marks as pending.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    allLangsPromise: null as Promise<any> | null,
    currentLocale: 'en-US',
    isOnOwnFolder: false,
    themeSource: 'system',
    settingStore: {} as Record<string, string>,
    fontFamilyControlProps: null as any,
    setCurrentLocaleMock: vi.fn(),
    getLangDataAsyncMock: vi.fn(),
    setThemeSourceMock: vi.fn(),
    setSettingMock: vi.fn(),
    forceReloadAppWindowsMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    getAllLangsAsync: () => h.allLangsPromise,
    getCurrentLocale: () => h.currentLocale,
    getLangDataAsync: h.getLangDataAsyncMock,
    setCurrentLocale: h.setCurrentLocaleMock,
    tran: (text: string) => text,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(callee: () => Promise<T>, deps: any[] = []) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let isActive = true;
                callee().then((newValue) => {
                    if (isActive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});

vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue = '') => {
            const [value, setValue] = react.useState(
                h.settingStore[key] ?? defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    h.setSettingMock(key, newValue);
                    setValue(newValue);
                },
            ];
        },
    };
});

vi.mock('../others/themeHelpers', async () => {
    const react = await import('react');
    return {
        useThemeSource: () => {
            const [themeSource, setThemeSource] = react.useState(h.themeSource);
            return {
                themeSource,
                setThemeSource: (newThemeSource: string) => {
                    h.setThemeSourceMock(newThemeSource);
                    setThemeSource(newThemeSource);
                },
            };
        },
    };
});

vi.mock('./settingHelpers', () => ({
    APP_FONT_FAMILY_SETTING_NAME: 'app-font-family',
    APP_FONT_WEIGHT_SETTING_NAME: 'app-font-weight',
    forceReloadAppWindows: h.forceReloadAppWindowsMock,
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return h.isOnOwnFolder;
        },
    },
}));

// The font picker has its own test; here it only reports what it was given.
vi.mock('../others/FontFamilyControlComp', () => ({
    default: (props: any) => {
        h.fontFamilyControlProps = props;
        return (
            <div data-testid="font-family-control">
                {`${props.fontFamily}|${props.fontWeight}`}
            </div>
        );
    },
}));

vi.mock('./SettingGeneralOtherOptionsComp', () => ({
    default: () => <div data-testid="other-options" />,
}));

import SettingGeneralComp from './SettingGeneralComp';
import SettingApplyComp, { applyStore } from './SettingApplyComp';
import SettingGeneralLanguageComp from './SettingGeneralLanguageComp';

const ENGLISH = {
    locale: 'en-US',
    name: 'English',
    nativeName: 'English',
    flagSVG: '<svg data-flag="en"></svg>',
};
const KHMER = {
    locale: 'km-KH',
    name: 'Khmer',
    nativeName: 'ខ្មែរ',
    flagSVG: '<svg data-flag="km"></svg>',
};
const FRENCH = { locale: 'fr-FR', name: 'French', flagSVG: '' };

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

function getApplyButton() {
    return container.querySelector(
        'button[title="Will reload the app to apply settings"]',
    ) as HTMLButtonElement;
}

async function renderGeneral() {
    await act(async () => {
        root.render(
            <>
                <SettingApplyComp />
                <SettingGeneralComp />
            </>,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.allLangsPromise = Promise.resolve([ENGLISH, KHMER, FRENCH]);
    h.currentLocale = 'en-US';
    h.isOnOwnFolder = false;
    h.themeSource = 'system';
    h.settingStore = {};
    h.fontFamilyControlProps = null;
    h.getLangDataAsyncMock.mockResolvedValue({});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingGeneralComp', () => {
    test('shows the font and other options only for a data folder', async () => {
        await renderGeneral();
        expect(
            Array.from(container.querySelectorAll('.card-header')).map(
                (header) => {
                    return header.textContent;
                },
            ),
        ).toEqual(['Language', 'Theme', 'Font Family']);
        expect(
            container.querySelector('[data-testid="other-options"]'),
        ).not.toBeNull();

        h.isOnOwnFolder = true;
        await act(async () => root.render(<SettingGeneralComp key="own" />));
        expect(
            container.querySelector('[data-testid="font-family-control"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-testid="other-options"]'),
        ).toBeNull();
    });
});

describe('SettingGeneralLanguageComp', () => {
    test('names each language in its own script and marks the one in force', async () => {
        await renderGeneral();
        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('.options button'),
        );
        expect(
            buttons.map((button) => {
                return [
                    button.textContent,
                    button.title,
                    button.getAttribute('aria-pressed'),
                ];
            }),
        ).toEqual([
            ['English', 'English', 'true'],
            ['ខ្មែរ', 'Khmer', 'false'],
            // No native name: the English one stands in.
            ['French', 'French', 'false'],
        ]);
        expect(buttons[0].className).toContain('btn-info');
        expect(buttons[1].className).toContain('btn-outline-info');
        expect(buttons[1].querySelector('svg[data-flag="km"]')).not.toBeNull();
    });

    test('choosing a language loads it, marks it and asks for Apply', async () => {
        await renderGeneral();
        expect(getApplyButton().className).toContain('btn-outline-success');

        await act(async () => findButton('ខ្មែរ')!.click());

        expect(h.setCurrentLocaleMock).toHaveBeenCalledWith('km-KH');
        expect(h.getLangDataAsyncMock).toHaveBeenCalledWith('km-KH');
        expect(findButton('ខ្មែរ')!.getAttribute('aria-pressed')).toBe('true');
        expect(findButton('English')!.getAttribute('aria-pressed')).toBe(
            'false',
        );
        expect(getApplyButton().className).toContain('btn-outline-warning');
        expect(getApplyButton().querySelector('.bi-asterisk')).not.toBeNull();
    });

    test('shows loading, then says when there is no language to offer', async () => {
        let resolveLangs!: (langs: any) => void;
        h.allLangsPromise = new Promise((resolve) => {
            resolveLangs = resolve;
        });
        await act(async () => root.render(<SettingGeneralLanguageComp />));
        expect(container.querySelector('img[alt="Loading..."]')).not.toBeNull();

        await act(async () => resolveLangs([]));
        expect(container.textContent).toContain('No languages available.');

        h.allLangsPromise = Promise.resolve(null);
        await act(async () =>
            root.render(<SettingGeneralLanguageComp key="null" />),
        );
        expect(container.textContent).toContain('No languages available.');
    });
});

describe('SettingGeneralThemeComp', () => {
    test('shows the theme in force and switches it', async () => {
        h.themeSource = 'dark';
        await renderGeneral();
        const select = container.querySelector(
            'select[aria-label="Theme"]',
        ) as HTMLSelectElement;
        expect(select.value).toBe('dark');
        expect(
            Array.from(select.options).map((option) => {
                return [option.value, option.textContent];
            }),
        ).toEqual([
            ['light', 'Light'],
            ['dark', 'Dark'],
            ['system', 'System'],
        ]);

        await act(async () => {
            select.value = 'light';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(h.setThemeSourceMock).toHaveBeenCalledWith('light');
        expect(select.value).toBe('light');
    });
});

describe('SettingGeneralFontFamilyComp', () => {
    test('saves the font and its weight, each marking Apply as pending', async () => {
        h.settingStore = {
            'app-font-family': 'Arial',
            'app-font-weight': '400',
        };
        await renderGeneral();
        expect(h.fontFamilyControlProps).toMatchObject({
            fontFamily: 'Arial',
            fontWeight: '400',
            isShowingLabel: false,
        });

        await act(async () =>
            h.fontFamilyControlProps.setFontFamily('Noto Sans Khmer'),
        );

        expect(h.setSettingMock).toHaveBeenCalledWith(
            'app-font-family',
            'Noto Sans Khmer',
        );
        expect(getApplyButton().className).toContain('btn-outline-warning');
        expect(
            container.querySelector('[data-testid="font-family-control"]')!
                .textContent,
        ).toBe('Noto Sans Khmer|400');

        await act(async () => h.fontFamilyControlProps.setFontWeight('700'));

        expect(h.setSettingMock).toHaveBeenCalledWith('app-font-weight', '700');
    });
});

describe('SettingApplyComp', () => {
    test('reloads the windows on the press and lets go of the store when gone', async () => {
        await act(async () => root.render(<SettingApplyComp />));
        expect(getApplyButton().textContent).toBe('Apply Settings ');
        expect(getApplyButton().querySelector('.bi-check')).not.toBeNull();

        await act(async () => getApplyButton().click());
        expect(h.forceReloadAppWindowsMock).toHaveBeenCalledOnce();

        const pendingWhileMounted = applyStore.pendingApply;
        act(() => root.unmount());
        // Unmounted, a late "pending" lands nowhere.
        expect(applyStore.pendingApply).not.toBe(pendingWhileMounted);
        expect(() => applyStore.pendingApply()).not.toThrow();
        root = createRoot(container);
    });
});
