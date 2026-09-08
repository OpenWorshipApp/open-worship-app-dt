import { useCallback } from 'react';

import {
    type EventMapperType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { useAppEffect } from '../helper/appHooks';
import { openChatbotPage } from '../helper/domHelpers';
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
 * Renders `null` always; the assistant itself is a separate OS window.
 */
export default function AppAssistantComp() {
    // With the master switch off there is no assistant service to talk to, so
    // the menu item goes with it -- exactly as the Help menu item and the 🤖
    // button already do. Read once per render rather than watched: the setting
    // only takes effect on the next launch, which is the point of it.
    const isAiEnabled = getIsAIEnabled();
    const handleOpening = useCallback(() => {
        if (!getIsAIEnabled()) {
            return;
        }
        // Opened from THIS window rather than by asking the main process to do
        // it, so the help sits beside the window the question is about and its
        // "asking about" picker starts on the right one.
        openChatbotPage();
    }, []);
    const handleMenuItemClicked = useCallback(
        (_event: any, data: { isOpenChatbot?: boolean }) => {
            if (data?.isOpenChatbot !== true) {
                return;
            }
            // The menu-click message reaches every open window; only the one
            // the user is actually looking at should open a help window.
            if (!appProvider.getIsWindowFocused()) {
                return;
            }
            handleOpening();
        },
        [handleOpening],
    );
    useKeyboardRegistering(keyboardEventMappers, handleOpening, []);
    useAppEffect(() => {
        return registerAppMenuClicked(handleMenuItemClicked);
    }, [handleMenuItemClicked]);
    useAppEffect(() => {
        if (!isAiEnabled) {
            // Withdrawn rather than never contributed: the same key may have
            // been registered by a window that loaded while AI was still on.
            setAppMenuItems(MENU_KEY, null);
            return;
        }
        setAppMenuItems(
            MENU_KEY,
            {
                tools: [
                    {
                        label: tran('App Assistant'),
                        accelerator: appProvider.systemUtils.isMac
                            ? 'Command+Shift+A'
                            : 'Ctrl+Shift+A',
                        clickData: { isOpenChatbot: true },
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
