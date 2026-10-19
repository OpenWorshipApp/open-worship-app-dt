import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import AiChatAppComp from './aichat/AiChatAppComp';
import {
    plugChatWindowLanguage,
    readChatWindowLanguageFont,
} from './chatbot/chatWindowLanguage';
import {
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
