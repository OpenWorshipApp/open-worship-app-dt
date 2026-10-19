import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import ChatbotAppComp from './chatbot/ChatbotAppComp';
import { plugChatWindowLanguage } from './chatbot/chatWindowLanguage';
import { handleError } from './helper/errorHelpers';
import { getReactRoot } from './others/rootHelpers';

const root = getReactRoot();
function renderApp() {
    root.render(
        <StrictMode>
            <ChatbotAppComp />
        </StrictMode>,
    );
}

// Drawn once the app's language has loaded (`init` awaits it), so every word
// of this window can be in that language. `init` already loaded it on every
// launch; the first paint now waits for it rather than racing it. A window
// whose `init` fails is still drawn, in English, rather than not at all.
init(() => {
    plugChatWindowLanguage();
    renderApp();
}).catch((error) => {
    handleError(error);
    renderApp();
});
