// Opening the 🤖 help window, and nothing else.
//
// A leaf beside `popupWindowHelpers.ts` (2026-11-11): the Markdown Preview,
// a locked-down reader, opens the help window on its own file, and
// `domHelpers.ts`, where this used to live, brings the context menu, the
// keyboard layers, `tran()` and a handful of module-scope listeners into any
// page that imports it (the rule in `.claude/CLAUDE.md` about startup
// helpers and mixed feature modules). `domHelpers.ts` re-exports it for the
// callers it already had.

import appProvider from '../server/appProvider';
import { openPopupWindow } from './popupWindowHelpers';

export function openChatbotPage() {
    return openPopupWindow(
        appProvider.chatbotHomePage,
        `chatbot_${Date.now()}`,
        'chatbot',
        {
            width: 460,
            height: 640,
            // Beside the app rather than over it: the answers point at
            // controls in the window behind this one -- and the frosted
            // backdrop keeps that window half-visible THROUGH the help, so a
            // step that says "the button below the tabs" can be followed
            // without moving anything out of the way.
            appGlassy: true,
            appAlignHorizontal: 'right',
            appAlignVertical: 'center',
            appFollowScale: true,
            appTopToMain: true,
        },
    );
}
