// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    goToPathMock: vi.fn(),
    openSettingPageMock: vi.fn(),
    openChatbotPageMock: vi.fn(),
    openOthersSettingMock: vi.fn(),
    // Typed, so `mock.calls[0][0]` is the title rather than `never`: an
    // untyped `vi.fn` infers an EMPTY parameter tuple and indexing it is a
    // type error.
    showAppConfirmMock: vi.fn(
        async (_title: string, _body: string, _options?: any) => true,
    ),
    openAiChatPageMock: vi.fn(),
    // Typed for the same reason: the tests read the items it was handed.
    showAppContextMenuMock: vi.fn(
        (_event: any, _items: any[], _options?: any) => undefined,
    ),
    popupWidgetManager: { openConfirm: vi.fn() },
    openExternalURLMock: vi.fn(),
    getIsAIEnabledMock: vi.fn(() => true),
    useKeyboardRegisteringMock: vi.fn(),
    captured: { kbCb: undefined as any },
    appProvider: {
        currentHomePage: '/presenter.html',
        appInfo: { homepage: 'https://owa.app' },
        browserUtils: { openExternalURL: vi.fn() },
        systemUtils: { isDev: false },
        // `commonButtons` reaches `appHelpers`, which reads this at module
        // scope through `fileHelpers`; without it the file throws while it is
        // still being imported and the whole suite reports zero tests.
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        // `QuitCurrentPageComp` renders nothing outside the main window, and
        // `checkIsMainWindow` asks over this channel.
        messageUtils: { sendDataSync: vi.fn(() => true) },
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
    openOthersSetting: h.openOthersSettingMock,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
    // The AI caution reads this to decide whether a dialog can be drawn at
    // all; a window with none fails OPEN, so it must be non-null here or
    // these tests would never exercise the confirm.
    popupWidgetManager: h.popupWidgetManager,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
// The real one registers an Escape key on a listener this file mocks away;
// what the Help button hands it is what is under test.
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenuMock,
}));
// `domHelpers` registers IPC listeners at module scope, which the appProvider
// mock above has no channel for.
vi.mock('../helper/domHelpers', () => ({
    openChatbotPage: h.openChatbotPageMock,
    openAiChatPage: h.openAiChatPageMock,
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: h.getIsAIEnabledMock,
}));

// The 🤖's busy point has its own test (`chatbotBusyHelpers.test.tsx`).
// The request Help's third row leaves for the assistant: a settings write
// in the app, a spy here.
const { requestChatbotReportMock } = vi.hoisted(() => ({
    requestChatbotReportMock: vi.fn(),
}));
vi.mock('../helper/ai/chatbotHandoffStoreHelpers', () => ({
    requestChatbotAsk: vi.fn(),
    requestChatbotReport: requestChatbotReportMock,
}));
vi.mock('../helper/ai/chatbotBusyHelpers', () => ({
    useIsChatbotBusy: () => false,
}));

import {
    BibleLookupButtonComp,
    BibleLookupTogglePopupContext,
    AiChatButtonComp,
    ChatbotButtonComp,
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

// What the Help button's press offered, as `{ menuElement, onSelect }` rows.
function getHelpMenuItems() {
    return h.showAppContextMenuMock.mock.calls.at(-1)?.[1] ?? [];
}

// Choosing a row of that menu; the assistant's row answers a promise.
async function selectHelpMenuItem(label: string) {
    const item = getHelpMenuItems().find((menuItem) => {
        return menuItem.menuElement === label;
    });
    await act(async () => {
        item.onSelect();
    });
}

// The disabled-AI path answers a promise, so the press has to be awaited: the
// confirm is opened in a microtask and the settings window in the one after.
async function clickButtonAndSettle() {
    await act(async () => {
        container
            .querySelector('button')!
            .dispatchEvent(
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

    // Asked for by the user: the question mark offers both kinds of help
    // instead of going straight to the website.
    test('HelpButtonComp asks which help instead of opening one', async () => {
        await render(<HelpButtonComp />);
        clickButton();
        expect(h.openExternalURLMock).not.toHaveBeenCalled();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
        expect(
            getHelpMenuItems().map((menuItem) => menuItem.menuElement),
        ).toEqual(['Open Online Help', 'Open Chatbot', 'Report a Problem']);
    });

    // The third row: the assistant opened already asking what went wrong.
    test('Report a Problem opens the assistant to report, after the caution', async () => {
        requestChatbotReportMock.mockClear();
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Report a Problem');
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        // No problem named: the person is to be asked.
        expect(requestChatbotReportMock).toHaveBeenCalledWith('');
        expect(h.openChatbotPageMock).toHaveBeenCalledTimes(1);
    });

    test('Report a Problem leaves nothing behind when the caution is declined', async () => {
        requestChatbotReportMock.mockClear();
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Report a Problem');
        expect(requestChatbotReportMock).not.toHaveBeenCalled();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    // A press from the keyboard has no pointer position to open the menu at.
    test('HelpButtonComp hangs its menu under the button', async () => {
        await render(<HelpButtonComp />);
        container.querySelector('button')!.getBoundingClientRect = () => {
            return { right: 640, bottom: 32 } as DOMRect;
        };
        clickButton();
        expect(h.showAppContextMenuMock.mock.calls.at(-1)?.[2]).toEqual({
            coord: { x: 640, y: 32 },
        });
    });

    test('Open Online Help opens the help page of this window', async () => {
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Open Online Help');
        expect(h.openExternalURLMock).toHaveBeenCalledWith(
            'https://owa.app/help#presenter',
        );
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    // The same two questions the 🤖 asks, so this way in walks round neither.
    test('Open Chatbot opens the assistant after the caution', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Open Chatbot');
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).toHaveBeenCalledTimes(1);
        expect(h.openExternalURLMock).not.toHaveBeenCalled();
    });

    test('Open Chatbot opens nothing when the caution is declined', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Open Chatbot');
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('Open Chatbot offers Settings when AI is disabled', async () => {
        h.getIsAIEnabledMock.mockReturnValueOnce(false);
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<HelpButtonComp />);
        clickButton();
        await selectHelpMenuItem('Open Chatbot');
        expect(h.showAppConfirmMock.mock.calls[0][0]).toBe(
            'Enable AI features',
        );
        expect(h.openOthersSettingMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('ChatbotButtonComp opens the chatbot window after the caution', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<ChatbotButtonComp />);
        await clickButtonAndSettle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).toHaveBeenCalled();
    });

    // Asked for by the user: the warning comes FIRST, and saying no to it
    // means no window -- not a window with a warning already dismissed.
    test('ChatbotButtonComp opens nothing when the caution is declined', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<ChatbotButtonComp />);
        await clickButtonAndSettle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('AiChatButtonComp asks the caution before opening', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<AiChatButtonComp />);
        await clickButtonAndSettle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openAiChatPageMock).toHaveBeenCalled();
    });

    test('AiChatButtonComp opens nothing when the caution is declined', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<AiChatButtonComp />);
        await clickButtonAndSettle();
        expect(h.openAiChatPageMock).not.toHaveBeenCalled();
    });

    // The switch is the more urgent news, and warning about an assistant that
    // is turned off is two dialogs to reach one fact.
    test('ChatbotButtonComp skips the caution when AI is disabled', async () => {
        h.getIsAIEnabledMock.mockReturnValueOnce(false);
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<ChatbotButtonComp />);
        await clickButtonAndSettle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.showAppConfirmMock.mock.calls[0][0]).toBe(
            'Enable AI features',
        );
    });

    test('ChatbotButtonComp offers Settings when AI is disabled', async () => {
        h.getIsAIEnabledMock.mockReturnValueOnce(false);
        h.showAppConfirmMock.mockResolvedValueOnce(true);
        await render(<ChatbotButtonComp />);
        // The button stays: with nothing to press, nothing says why the
        // assistant is missing.
        expect(container.querySelector('button')).not.toBeNull();
        await clickButtonAndSettle();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openOthersSettingMock).toHaveBeenCalledTimes(1);
    });

    test('ChatbotButtonComp opens nothing when the offer is declined', async () => {
        h.getIsAIEnabledMock.mockReturnValueOnce(false);
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<ChatbotButtonComp />);
        await clickButtonAndSettle();
        expect(h.openOthersSettingMock).not.toHaveBeenCalled();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
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
