// @vitest-environment jsdom

// The Others and AI Providers tabs' frames, the warning they show on a
// machine with no credential store, and the credential field every row uses.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    checkIsAvailableMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `t(${text})`,
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
    };
});

vi.mock('../server/appSecureStorage', () => ({
    appSecureStorage: { checkIsAvailable: h.checkIsAvailableMock },
}));

// Each row has its own test; the frames only have to hold them.
vi.mock('./SettingOthersAIComp', () => ({
    default: () => <section data-testid="ai-providers" />,
}));
vi.mock('./SettingOthersExtraBinComp', () => ({
    default: () => <section data-testid="extra-bin" />,
}));
vi.mock('../plugins/song-select/SettingOthersSongSelectComp', () => ({
    default: () => <section data-testid="song-select" />,
}));

import SettingAIComp from './SettingAIComp';
import SettingOthersComp from './SettingOthersComp';
import SettingOthersFieldComp from './SettingOthersFieldComp';
import SettingOthersSecureStorageWarningComp from './SettingOthersSecureStorageWarningComp';

let container: HTMLDivElement;
let root: Root;

function getRackRows() {
    return Array.from(
        container.querySelectorAll('.app-setting-others-rack > section'),
    ).map((section) => {
        return section.getAttribute('data-testid');
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.checkIsAvailableMock.mockReturnValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('the Others and AI Providers tabs', () => {
    test('AI Providers holds its one section in the rack', async () => {
        await act(async () => root.render(<SettingAIComp />));
        expect(getRackRows()).toEqual(['ai-providers']);
    });

    test('Others stacks SongSelect above the extra binaries', async () => {
        await act(async () => root.render(<SettingOthersComp />));
        expect(getRackRows()).toEqual(['song-select', 'extra-bin']);
    });
});

describe('SettingOthersSecureStorageWarningComp', () => {
    test('says nothing where credentials can be kept safely', async () => {
        await act(async () =>
            root.render(<SettingOthersSecureStorageWarningComp />),
        );
        expect(container.innerHTML).toBe('');
    });

    test('warns that keys last only until the app closes', async () => {
        h.checkIsAvailableMock.mockReturnValue(false);
        await act(async () =>
            root.render(<SettingOthersSecureStorageWarningComp />),
        );
        const warning = container.querySelector('.app-setting-others-warning')!;
        expect(warning.textContent).toBe(
            't(This system has no secure credential store, so keys are kept' +
                ' only until the app closes)',
        );
    });
});

describe('SettingOthersFieldComp', () => {
    function getInput() {
        return container.querySelector('input') as HTMLInputElement;
    }

    test('a secret is masked until revealed, and hidden again', async () => {
        await act(async () =>
            root.render(
                <SettingOthersFieldComp
                    label="API Key"
                    hintKey="Where to find the key"
                    value="sk-123"
                    isSecret
                    onSave={vi.fn()}
                />,
            ),
        );
        const toggle = container.querySelector('button') as HTMLButtonElement;
        expect(getInput().type).toBe('password');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.getAttribute('aria-label')).toBe('t(Show)');

        await act(async () => toggle.click());

        expect(getInput().type).toBe('text');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.getAttribute('aria-label')).toBe('t(Hide)');
        expect(toggle.querySelector('.bi-eye-slash')).not.toBeNull();

        await act(async () => toggle.click());

        expect(getInput().type).toBe('password');
    });

    test('a saved value carries a tick, and leaving the box saves it trimmed', async () => {
        const onSave = vi.fn();
        await act(async () =>
            root.render(
                <SettingOthersFieldComp
                    label="User Name"
                    hintKey="Your SongSelect user"
                    value="volunteer"
                    onSave={onSave}
                />,
            ),
        );
        const label = container.querySelector('label')!;
        expect(label.htmlFor).toBe(getInput().id);
        expect(label.querySelector('.app-setting-others-hint')!).toHaveProperty(
            'title',
            't(Your SongSelect user)',
        );
        expect(
            label.querySelector('.app-setting-others-field-set'),
        ).not.toBeNull();
        // Not a secret: plain text and no reveal button.
        expect(getInput().type).toBe('text');
        expect(container.querySelector('button')).toBeNull();

        await act(async () => {
            getInput().value = '  pastor  ';
            getInput().dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });

        expect(onSave).toHaveBeenCalledWith('pastor');
    });

    test('takes the cursor when another window asks for this box', async () => {
        const field = (focusToken?: number) => (
            <SettingOthersFieldComp
                label="API Key"
                hintKey="hint"
                value=""
                focusToken={focusToken}
                onSave={vi.fn()}
            />
        );
        await act(async () => root.render(field()));
        const input = getInput();
        expect(document.activeElement).not.toBe(input);
        // jsdom has no layout, so no `scrollIntoView` either.
        input.scrollIntoView = vi.fn();

        await act(async () => root.render(field(1)));

        expect(document.activeElement).toBe(input);
        expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });

    test('an empty value has no tick', async () => {
        await act(async () =>
            root.render(
                <SettingOthersFieldComp
                    label="API Key"
                    hintKey="hint"
                    value=""
                    onSave={vi.fn()}
                />,
            ),
        );
        expect(
            container.querySelector('.app-setting-others-field-set'),
        ).toBeNull();
    });
});
