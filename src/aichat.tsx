import { StrictMode, type ComponentType } from 'react';

import './bootstrapCss';
import { init } from './boot';
import { handleError } from './helper/errorHelpers';
import { ensureLangFiles } from './lang/langFileStore';
import { getReactRoot } from './others/rootHelpers';

const root = getReactRoot();
let AiChatAppComp: ComponentType | null = null;
function renderApp() {
    if (AiChatAppComp === null) {
        return;
    }
    root.render(
        <StrictMode>
            <AiChatAppComp />
        </StrictMode>,
    );
}

// The window shares the help window's language modules, which read every
// language's `assistant.json` and `typed.json` as they are evaluated -- and
// every language but English is a plugin whose files come with it
// (`src/chatbot.tsx`). So they are imported once `init` has read the plugins
// and their files are here.
async function start(isInitDone: boolean) {
    await Promise.all([
        ensureLangFiles('assistant.json'),
        ensureLangFiles('typed.json'),
    ]).catch(handleError);
    const [appModule, languageModule, guestFontModule] = await Promise.all([
        import('./aichat/AiChatAppComp'),
        import('./chatbot/chatWindowLanguage'),
        import('./aichat/aiChatGuestFontHelpers'),
    ]);
    AiChatAppComp = appModule.default;
    if (isInitDone) {
        languageModule.plugChatWindowLanguage();
        // And the same face as the sites' pages one, named in front of their
        // body lists (`plugChatWindowAppFont` sets it on this window's own).
        void languageModule.plugChatWindowAppFont();
        void languageModule
            .readChatWindowAppFontFamily()
            .then(guestFontModule.setAppFontFamily);
        // And for the sites: the language's face, for its letters only.
        const font = languageModule.readChatWindowLanguageFont();
        const unicodeRange =
            font === null
                ? null
                : guestFontModule.toUnicodeRange(font.scriptPatternSource);
        guestFontModule.setLanguageFont(
            font === null || unicodeRange === null
                ? null
                : { family: font.family, css: font.css, unicodeRange },
        );
    }
    renderApp();
}

// Drawn once the app's language has loaded, like the help window: its words
// and the tab strip it shares with that window are in the app's language.
// A window whose `init` fails is still drawn, in English.
init(() => {
    start(true).catch(handleError);
}).catch((error) => {
    handleError(error);
    start(false).catch(handleError);
});
