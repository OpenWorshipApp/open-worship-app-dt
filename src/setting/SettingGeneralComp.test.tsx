// @vitest-environment jsdom

// The General tab rendered whole -- theme and font cards -- and the language
// picker that moved to the Languages tab, each beside the real Apply Settings
// button, which each of them marks as pending.

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
    pluginsChangedListener: null as null | (() => void),
}));

vi.mock('../lang/langHelpers', () => ({
    getAllLangsAsync: () => h.allLangsPromise,
    getCurrentLocale: () => h.currentLocale,
    getLangDataAsync: h.getLangDataAsyncMock,
    setCurrentLocale: h.setCurrentLocaleMock,
    tran: (text: string) => text,
}));

// What an install, update, delete or switch in Settings > Languages ends in:
// every window re-reads its languages and tells whoever listens.
vi.mock('../lang/langPluginRegistry', () => ({
    onLangPluginsChanged: (listener: () => void) => {
        h.pluginsChangedListener = listener;
        return () => {
            h.pluginsChangedListener = null;
        };
    },
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

// The section's fold reads a stored setting; here it is only its title and
// what it holds.
vi.mock('./SettingOthersSectionComp', () => ({
    default: ({ title, children }: any) => (
        <section data-title={title}>{children}</section>
    ),
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
import SettingLanguagePickerComp from './SettingLanguagePickerComp';

const ENGLISH = {
    locale: 'en-US',
    name: 'English',
    nativeName: 'English',
    flagSVG: '<svg data-flag="en"></svg>',
};
const KHMER = {
    locale: 'km-KH',
    name: 'Khmer',
    nativeName: '✝✝',
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

async function renderPicker() {
    await act(async () => {
        root.render(
            <>
                <SettingApplyComp />
                <SettingLanguagePickerComp />
            </>,
        );
    });
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
        ).toEqual(['Theme', 'Font Family']);
        // The language picker is the Languages tab's now.
        expect(container.querySelector('.options')).toBeNull();
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

describe('SettingLanguagePickerComp', () => {
    test('names each language in its own script and marks the one in force', async () => {
        await renderPicker();
        expect(
            container.querySelector('section')?.getAttribute('data-title'),
        ).toBe('Language');
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
            ['✝✝', 'Khmer', 'false'],
            // No native name: the English one stands in.
            ['French', 'French', 'false'],
        ]);
        expect(buttons[0].className).toContain('btn-info');
        expect(buttons[1].className).toContain('btn-outline-info');
        expect(buttons[1].querySelector('svg[data-flag="km"]')).not.toBeNull();
    });

    test('choosing a language loads it, marks it and reloads every window at once', async () => {
        await renderPicker();
        expect(getApplyButton().className).toContain('btn-outline-success');

        await act(async () => findButton('✝✝')!.click());

        expect(h.setCurrentLocaleMock).toHaveBeenCalledWith('km-KH');
        expect(h.getLangDataAsyncMock).toHaveBeenCalledWith('km-KH');
        // Loaded before it is stored: `tran` throws in dev on a language this
        // window has not loaded.
        expect(h.getLangDataAsyncMock.mock.invocationCallOrder[0]).toBeLessThan(
            h.setCurrentLocaleMock.mock.invocationCallOrder[0],
        );
        expect(findButton('✝✝')!.getAttribute('aria-pressed')).toBe('true');
        expect(findButton('English')!.getAttribute('aria-pressed')).toBe(
            'false',
        );
        // Applied at once, nothing left waiting for Apply Settings -- and
        // only once the choice is stored.
        expect(h.forceReloadAppWindowsMock).toHaveBeenCalledOnce();
        expect(h.setCurrentLocaleMock.mock.invocationCallOrder[0]).toBeLessThan(
            h.forceReloadAppWindowsMock.mock.invocationCallOrder[0],
        );
        expect(getApplyButton().className).toContain('btn-outline-success');
    });

    test('pressing the language already in force reloads nothing', async () => {
        await renderPicker();
        await act(async () => findButton('English')!.click());
        expect(h.getLangDataAsyncMock).not.toHaveBeenCalled();
        expect(h.setCurrentLocaleMock).not.toHaveBeenCalled();
        expect(h.forceReloadAppWindowsMock).not.toHaveBeenCalled();
    });

    test('a language installed or turned off below is offered, or not, with no reload', async () => {
        h.currentLocale = 'fr-FR';
        await renderPicker();
        const readButtons = () => {
            return Array.from(
                container.querySelectorAll<HTMLButtonElement>(
                    '.options button',
                ),
            ).map((button) => {
                return [button.title, button.getAttribute('aria-pressed')];
            });
        };
        expect(readButtons()).toEqual([
            ['English', 'false'],
            ['Khmer', 'false'],
            ['French', 'true'],
        ]);

        // French turned off while the app is in it: the stored choice went
        // back to English, and the list no longer has it.
        h.allLangsPromise = Promise.resolve([ENGLISH, KHMER]);
        h.currentLocale = 'en-US';
        await act(async () => h.pluginsChangedListener!());
        expect(readButtons()).toEqual([
            ['English', 'true'],
            ['Khmer', 'false'],
        ]);

        // Unmounted, it listens no more.
        act(() => root.unmount());
        expect(h.pluginsChangedListener).toBeNull();
        root = createRoot(container);
    });

    test('shows loading, then says when there is no language to offer', async () => {
        let resolveLangs!: (langs: any) => void;
        h.allLangsPromise = new Promise((resolve) => {
            resolveLangs = resolve;
        });
        await act(async () => root.render(<SettingLanguagePickerComp />));
        expect(container.querySelector('img[alt="Loading..."]')).not.toBeNull();

        await act(async () => resolveLangs([]));
        expect(container.textContent).toContain('No languages available.');

        h.allLangsPromise = Promise.resolve(null);
        await act(async () =>
            root.render(<SettingLanguagePickerComp key="null" />),
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
