import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import AiChatAppComp from './aichat/AiChatAppComp';
import {
    plugChatWindowAppFont,
    plugChatWindowLanguage,
    readChatWindowAppFontFamily,
    readChatWindowLanguageFont,
} from './chatbot/chatWindowLanguage';
import {
    setAppFontFamily,
    setLanguageFont,
    toUnicodeRange,
} from './aichat/aiChatGuestFontHelpers';
import { handleError } from './helper/errorHelpers';
import { getReactRoot } from './others/rootHelpers';

const root = getReactRoot();
function renderApp() {
    root.render(
        <StrictMode>
            <AiChatAppComp />
        </StrictMode>,
    );
}

// Drawn once the app's language has loaded, like the help window: its words
// and the tab strip it shares with that window are in the app's language.
// A window whose `init` fails is still drawn, in English.
init(() => {
    plugChatWindowLanguage();
    // And the same face as the sites' pages one, named in front of their
    // body lists (`plugChatWindowAppFont` sets it on this window's own).
    void plugChatWindowAppFont();
    void readChatWindowAppFontFamily().then(setAppFontFamily);
    // And for the sites: the language's face, for its letters only.
    const font = readChatWindowLanguageFont();
    const unicodeRange =
        font === null ? null : toUnicodeRange(font.scriptPatternSource);
    setLanguageFont(
        font === null || unicodeRange === null
            ? null
            : { family: font.family, css: font.css, unicodeRange },
    );
    renderApp();
}).catch((error) => {
    handleError(error);
    renderApp();
});
