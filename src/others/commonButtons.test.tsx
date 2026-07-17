// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    goToPathMock: vi.fn(),
    openSettingPageMock: vi.fn(),
    openExternalURLMock: vi.fn(),
    useKeyboardRegisteringMock: vi.fn(),
    captured: { kbCb: undefined as any },
    appProvider: {
        currentHomePage: '/presenter.html',
        appInfo: { homepage: 'https://owa.app' },
        browserUtils: { openExternalURL: vi.fn() },
        systemUtils: { isDev: false },
    },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    default: {
        filterEventMappersByPlatform: (list: any[]) => list,
    },
    PlatformEnum: { MacOS: 'macOS' },
    toShortcutKey: () => 'Ctrl + B',
    useKeyboardRegistering: (mappers: any, cb: any) => {
        h.captured.kbCb = cb;
        h.useKeyboardRegisteringMock(mappers, cb);
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../router/routeHelpers', () => ({ goToPath: h.goToPathMock }));
vi.mock('../setting/settingHelpers', () => ({
    openSettingPage: h.openSettingPageMock,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));

import {
    BibleLookupButtonComp,
    BibleLookupTogglePopupContext,
    HelpButtonComp,
    QuitCurrentPageComp,
    SettingButtonComp,
    useIsBibleLookupShowingContext,
    useToggleBibleLookupPopupContext,
} from './commonButtons';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

function clickButton() {
    const button = container.querySelector('button')!;
    act(() => {
        button.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
}

describe('others commonButtons', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.appProvider.browserUtils.openExternalURL = h.openExternalURLMock;
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('QuitCurrentPageComp navigates on click', async () => {
        await render(<QuitCurrentPageComp title="Quit" pathname="/home" />);
        clickButton();
        expect(h.goToPathMock).toHaveBeenCalledWith('/home');
    });

    test('SettingButtonComp opens the setting page', async () => {
        await render(<SettingButtonComp />);
        clickButton();
        expect(h.openSettingPageMock).toHaveBeenCalled();
    });

    test('HelpButtonComp opens the help URL', async () => {
        await render(<HelpButtonComp />);
        clickButton();
        expect(h.openExternalURLMock).toHaveBeenCalledWith(
            'https://owa.app/help#presenter',
        );
    });

    test('BibleLookupButtonComp toggles showing on click and shortcut', async () => {
        const setIsShowing = vi.fn();
        await render(
            <BibleLookupTogglePopupContext.Provider
                value={{ isShowing: false, setIsShowing }}
            >
                <BibleLookupButtonComp />
            </BibleLookupTogglePopupContext.Provider>,
        );
        clickButton();
        expect(setIsShowing).toHaveBeenCalledWith(true);
        // fire the registered keyboard shortcut too
        h.captured.kbCb();
        expect(setIsShowing).toHaveBeenCalledTimes(2);
    });

    test('useIsBibleLookupShowingContext throws without a provider', async () => {
        function Probe() {
            try {
                useIsBibleLookupShowingContext();
                return <span>ok</span>;
            } catch (error: any) {
                return <span>{error.message}</span>;
            }
        }
        await render(<Probe />);
        expect(container.textContent).toContain('must be used within');
    });

    test('useToggleBibleLookupPopupContext returns null or a bound setter', async () => {
        let result: any = 'unset';
        function ProbeNull() {
            result = useToggleBibleLookupPopupContext();
            return null;
        }
        await render(<ProbeNull />);
        expect(result).toBeNull();

        const setIsShowing = vi.fn();
        function ProbeBound() {
            const toggle = useToggleBibleLookupPopupContext(false);
            toggle?.();
            return null;
        }
        await act(async () => {
            root?.render(
                <BibleLookupTogglePopupContext.Provider
                    value={{ isShowing: true, setIsShowing }}
                >
                    <ProbeBound />
                </BibleLookupTogglePopupContext.Provider>,
            );
        });
        expect(setIsShowing).toHaveBeenCalledWith(false);
    });
});
