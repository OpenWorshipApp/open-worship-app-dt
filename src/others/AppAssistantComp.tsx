import { useCallback } from 'react';

import {
    type EventMapperType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { askAiCaution } from '../helper/ai/aiCautionHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { useAppEffect } from '../helper/appHooks';
import { openAiChatPage, openChatbotPage } from '../helper/domHelpers';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';

// Module-level so the mapper array keeps one identity for the life of the
// process -- this component is mounted in every window for the whole session.
// Every platform is spelled out because `toShortcutKey` THROWS on a mapper that
// carries another platform's control keys and none of its own, and that throw
// would happen during this component's render, in every window.
const keyboardEventMappers: EventMapperType[] = [
    {
        key: 'A',
        mControlKey: ['Meta', 'Shift'],
        wControlKey: ['Ctrl', 'Shift'],
        lControlKey: ['Ctrl', 'Shift'],
    },
];

const MENU_KEY = 'chatbot-assistant';

/**
 * The way into the in-app assistant from a window that has no room for a
 * button.
 *
 * The 🤖 button only ever existed on the three pages with a header -- the
 * presenter, the reader and the document editor. A volunteer who opened
 * Settings, a Bible Note or the Lyric Editor to do the very thing they were
 * stuck on had no way to ask about it. This component is the button's
 * equivalent for everywhere else: a Tools entry and a shortcut, and nothing
 * drawn on screen.
 *
 * The AI Chat window rides the same entry: a second Tools item, with no
 * shortcut and no gate, since that window holds no key and asks nothing of
 * the assistant service the switch turns off.
 *
 * Renders `null` always; the assistant itself is a separate OS window.
 */
export default function AppAssistantComp() {
    // With the master switch off there is no assistant service to talk to, so
    // the menu item goes with it -- exactly as the Help menu item and the 🤖
    // button already do. Read once per render rather than watched: the setting
    // only takes effect on the next launch, which is the point of it.
    const isAiEnabled = getIsAIEnabled();
    const handleOpening = useCallback(async () => {
        if (!getIsAIEnabled()) {
            return;
        }
        // The same caution the 🤖 button asks, because this entry and that
        // button open the same window -- a warning a menu item walks around
        // is a warning nobody is actually given. It fails open in a window
        // with no popup host (see askAiCaution), which is what keeps the
        // shortcut working in Local Web Share and the Lyric Editor.
        if (!(await askAiCaution('assistant'))) {
            return;
        }
        // Opened from THIS window rather than by asking the main process to do
        // it, so the help sits beside the window the question is about and its
        // "asking about" picker starts on the right one.
        openChatbotPage();
    }, []);
    const handleMenuItemClicked = useCallback(
        (
            _event: any,
            data: { isOpenChatbot?: boolean; isOpenAiChat?: boolean },
        ) => {
            const isOpenChatbot = data?.isOpenChatbot === true;
            const isOpenAiChat = data?.isOpenAiChat === true;
            if (!isOpenChatbot && !isOpenAiChat) {
                return;
            }
            // The menu-click message reaches every open window; only the one
            // the user is actually looking at should open a help window.
            if (!appProvider.getIsWindowFocused()) {
                return;
            }
            if (isOpenAiChat) {
                void (async () => {
                    if (await askAiCaution('aichat')) {
                        openAiChatPage();
                    }
                })();
                return;
            }
            void handleOpening();
        },
        [handleOpening],
    );
    useKeyboardRegistering(keyboardEventMappers, handleOpening, []);
    useAppEffect(() => {
        return registerAppMenuClicked(handleMenuItemClicked);
    }, [handleMenuItemClicked]);
    useAppEffect(() => {
        // Always contributed, because the AI Chat entry does not go with the
        // switch; with the switch off the assistant's own item is simply not
        // in the list -- re-registered rather than withdrawn, so a window that
        // loaded while AI was still on is corrected too.
        setAppMenuItems(
            MENU_KEY,
            {
                tools: [
                    ...(isAiEnabled
                        ? [
                              {
                                  label: tran('App Assistant'),
                                  accelerator: appProvider.systemUtils.isMac
                                      ? 'Command+Shift+A'
                                      : 'Ctrl+Shift+A',
                                  clickData: { isOpenChatbot: true },
                              },
                          ]
                        : []),
                    {
                        label: tran('AI Chat'),
                        clickData: { isOpenAiChat: true },
                    },
                ],
            },
            // Every window contributes this key, so only the last one to load
            // is remembered. Without focus routing the press would reach that
            // window and no other.
            { isRoutedToFocusedWindow: true },
        );
    }, [isAiEnabled]);

    return null;
}
