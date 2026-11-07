// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The small cards of the General tab and the shared credential field: the
// language buttons (the Languages tab's), Apply Settings, the theme and font
// pickers, and the warning shown when no secure credential store exists.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        locale: 'en-US',
        settings: {} as Record<string, string>,
        theme: 'dark',
        isSecureStorageAvailable: true,
        fontProps: null as any,
    },
    mocks: {
        getAllLangs: vi.fn(),
        getLangData: vi.fn(),
        setCurrentLocale: vi.fn(),
        reload: vi.fn(),
        setSetting: vi.fn(),
        setTheme: vi.fn(),
        save: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({
    getAllLangsAsync: mocks.getAllLangs,
    getCurrentLocale: () => state.locale,
    getLangDataAsync: mocks.getLangData,
    setCurrentLocale: mocks.setCurrentLocale,
    tran: (text: string) => text,
}));
vi.mock('../lang/langPluginRegistry', () => ({
    onLangPluginsChanged: () => () => {},
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                void read().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue = '') => {
            const [value, setValue] = useState(
                state.settings[key] ?? defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    mocks.setSetting(key, newValue);
                    setValue(newValue);
                },
            ] as const;
        },
    };
});
vi.mock('./settingHelpers', () => ({
    APP_FONT_FAMILY_SETTING_NAME: 'app-font-family',
    APP_FONT_WEIGHT_SETTING_NAME: 'app-font-weight',
    forceReloadAppWindows: mocks.reload,
}));
// The section's fold reads a stored setting; here it is only its title and
// what it holds.
vi.mock('./SettingOthersSectionComp', () => ({
    default: ({ title, children }: any) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="loading">Loading</div>,
}));
vi.mock('../others/FontFamilyControlComp', () => ({
    default: (props: any) => {
        state.fontProps = props;
        return (
            <div className="font-control">
                {props.fontFamily}/{props.fontWeight}
            </div>
        );
    },
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({
        themeSource: state.theme,
        setThemeSource: mocks.setTheme,
    }),
}));
vi.mock('../server/appSecureStorage', () => ({
    appSecureStorage: {
        checkIsAvailable: () => state.isSecureStorageAvailable,
    },
}));

import SettingApplyComp, { applyStore } from './SettingApplyComp';
import SettingLanguagePickerComp from './SettingLanguagePickerComp';
import SettingGeneralFontFamilyComp from './SettingGeneralFontFamilyComp';
import SettingGeneralThemeComp from './SettingGeneralThemeComp';
import SettingOthersSecureStorageWarningComp from './SettingOthersSecureStorageWarningComp';
import SettingOthersFieldComp from './SettingOthersFieldComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const english = {
    locale: 'en-US',
    name: 'English',
    nativeName: 'English',
    flagSVG: '<svg id="flag-en"></svg>',
};
const other = {
    locale: 'xx-XX',
    name: 'Example',
    nativeName: '✦✧',
    flagSVG: '<svg id="flag-xx"></svg>',
};
const french = { locale: 'fr-FR', name: 'French', flagSVG: '' };

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render(element: ReactNode) {
    await act(async () => {
        root.render(element);
    });
    await wait();
}

function getApplyButton() {
    return container.querySelector(
        'button[title="Will reload the app to apply settings"]',
    ) as HTMLButtonElement;
}

beforeEach(() => {
    state.locale = 'en-US';
    state.settings = {};
    state.theme = 'dark';
    state.isSecureStorageAvailable = true;
    state.fontProps = null;
    mocks.getAllLangs.mockResolvedValue([english, other, french]);
    mocks.getLangData.mockResolvedValue({});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the language card', () => {
    test('lists each language in its own words, the current one pressed', async () => {
        await render(<SettingLanguagePickerComp />);
        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('.options button'),
        );
        expect(
            buttons.map((button) => [
                button.textContent,
                button.title,
                button.getAttribute('aria-pressed'),
            ]),
        ).toEqual([
            ['English', 'English', 'true'],
            ['✦✧', 'Example', 'false'],
            // No name of its own: its English name stands in.
            ['French', 'French', 'false'],
        ]);
        expect(buttons[0].className).toContain('btn-info');
        expect(buttons[1].className).toContain('btn-outline-info');
        expect(buttons[1].querySelector('#flag-xx')).not.toBeNull();
    });

    test('a press switches the language and reloads every window at once', async () => {
        await render(
            <>
                <SettingApplyComp />
                <SettingLanguagePickerComp />
            </>,
        );
        expect(getApplyButton().className).toContain('btn-outline-success');
        expect(getApplyButton().querySelector('.bi-check')).not.toBeNull();
        const otherButton =
            container.querySelectorAll<HTMLButtonElement>('.options button')[1];
        await act(async () => {
            otherButton.click();
        });
        await wait();
        expect(mocks.setCurrentLocale).toHaveBeenCalledWith('xx-XX');
        expect(mocks.getLangData).toHaveBeenCalledWith('xx-XX');
        expect(otherButton.getAttribute('aria-pressed')).toBe('true');
        expect(mocks.reload).toHaveBeenCalledOnce();
        // Nothing is left waiting for Apply Settings.
        expect(getApplyButton().className).toContain('btn-outline-success');
        expect(getApplyButton().querySelector('.bi-check')).not.toBeNull();
    });

    test('says so when no language could be read', async () => {
        mocks.getAllLangs.mockResolvedValue([]);
        await render(<SettingLanguagePickerComp />);
        expect(container.textContent).toContain('No languages available.');
        mocks.getAllLangs.mockResolvedValue(null);
        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        await render(<SettingLanguagePickerComp />);
        expect(container.textContent).toContain('No languages available.');
    });

    test('waits with a spinner while the languages load', async () => {
        mocks.getAllLangs.mockReturnValue(new Promise(() => {}));
        await render(<SettingLanguagePickerComp />);
        expect(container.querySelector('.loading')).not.toBeNull();
        expect(container.textContent).toContain('Language');
    });
});

describe('Apply Settings', () => {
    test('reloads every window when pressed', async () => {
        await render(<SettingApplyComp />);
        expect(getApplyButton().textContent).toBe('Apply Settings ');
        await act(async () => {
            getApplyButton().click();
        });
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('stops listening for changes once closed', async () => {
        await render(<SettingApplyComp />);
        const listening = applyStore.pendingApply;
        await act(async () => {
            root.unmount();
        });
        expect(applyStore.pendingApply).not.toBe(listening);
        // Nothing is left to update.
        expect(() => applyStore.pendingApply()).not.toThrow();
        root = createRoot(container);
    });
});

describe('the font card', () => {
    test('shows the saved font and saves a new one with Apply asked for', async () => {
        state.settings = {
            'app-font-family': 'Noto Sans',
            'app-font-weight': 'Bold',
        };
        await render(
            <>
                <SettingApplyComp />
                <SettingGeneralFontFamilyComp />
            </>,
        );
        expect(container.querySelector('.font-control')!.textContent).toBe(
            'Noto Sans/Bold',
        );
        expect(state.fontProps.isShowingLabel).toBe(false);
        await act(async () => {
            state.fontProps.setFontFamily('Script Face');
        });
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'app-font-family',
            'Script Face',
        );
        expect(getApplyButton().className).toContain('btn-outline-warning');
        await act(async () => {
            state.fontProps.setFontWeight('Light');
        });
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'app-font-weight',
            'Light',
        );
        expect(container.querySelector('.font-control')!.textContent).toBe(
            'Script Face/Light',
        );
    });
});

describe('the theme card', () => {
    test('shows the current theme and switches to the one picked', async () => {
        await render(<SettingGeneralThemeComp />);
        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select.getAttribute('aria-label')).toBe('Theme');
        expect(select.value).toBe('dark');
        expect(
            Array.from(select.options).map((option) => option.textContent),
        ).toEqual(['Light', 'Dark', 'System']);
        await act(async () => {
            select.value = 'system';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(mocks.setTheme).toHaveBeenCalledWith('system');
    });
});

describe('the secure storage warning', () => {
    test('is shown only when there is no secure credential store', async () => {
        await render(<SettingOthersSecureStorageWarningComp />);
        expect(container.innerHTML).toBe('');
        state.isSecureStorageAvailable = false;
        await render(<SettingOthersSecureStorageWarningComp key="again" />);
        expect(container.textContent).toBe(
            'This system has no secure credential store, so keys are kept only until the app closes',
        );
    });
});

describe('the credential field', () => {
    let scrollIntoView: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // jsdom has no layout, so it has no `scrollIntoView` either.
        scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView as any;
    });

    afterEach(() => {
        delete (Element.prototype as any).scrollIntoView;
    });

    function renderField(props: Record<string, unknown> = {}) {
        return render(
            <SettingOthersFieldComp
                label="API Key"
                hintKey="Where the key is used"
                value="sk-1"
                isSecret
                onSave={mocks.save}
                {...props}
            >
                <span className="extra">extra</span>
            </SettingOthersFieldComp>,
        );
    }

    test('a secret is masked until shown, and hidden again on a second press', async () => {
        await renderField();
        const input = container.querySelector('input') as HTMLInputElement;
        const toggle = container.querySelector(
            'button[aria-pressed]',
        ) as HTMLButtonElement;
        expect(input.type).toBe('password');
        expect(toggle.title).toBe('Show');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        await act(async () => {
            toggle.click();
        });
        expect(input.type).toBe('text');
        expect(toggle.title).toBe('Hide');
        expect(toggle.getAttribute('aria-label')).toBe('Hide');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.querySelector('.bi-eye-slash')).not.toBeNull();
        await act(async () => {
            toggle.click();
        });
        expect(input.type).toBe('password');
        expect(container.querySelector('.extra')).not.toBeNull();
    });

    test('saves the trimmed text when left, and ticks a saved value', async () => {
        await renderField();
        const label = container.querySelector('label') as HTMLLabelElement;
        const input = container.querySelector('input') as HTMLInputElement;
        expect(label.htmlFor).toBe(input.id);
        expect(
            (label.querySelector('.app-setting-others-hint') as HTMLElement)
                .title,
        ).toBe('Where the key is used');
        expect(label.querySelector('.app-setting-others-field-set')).not.toBe(
            null,
        );
        await act(async () => {
            input.value = '  sk-2  ';
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        expect(mocks.save).toHaveBeenCalledWith('sk-2');
    });

    test('a plain field has no show button and no tick while empty', async () => {
        await renderField({ isSecret: false, value: '' });
        expect(
            (container.querySelector('input') as HTMLInputElement).type,
        ).toBe('text');
        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('.app-setting-others-field-set')).toBe(
            null,
        );
    });

    test('takes the cursor only when asked with a new token', async () => {
        await renderField();
        const input = container.querySelector('input') as HTMLInputElement;
        expect(document.activeElement).not.toBe(input);
        expect(scrollIntoView).not.toHaveBeenCalled();
        await renderField({ focusToken: 1 });
        expect(document.activeElement).toBe(input);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
        input.blur();
        await renderField({ focusToken: 2 });
        expect(document.activeElement).toBe(input);
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });
});
