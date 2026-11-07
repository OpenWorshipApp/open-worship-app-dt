import { StrictMode, type ComponentType } from 'react';

import './bootstrapCss';
import { init } from './boot';
import { handleError } from './helper/errorHelpers';
import { ensureLangFiles } from './lang/langFileStore';
import { getReactRoot } from './others/rootHelpers';

const root = getReactRoot();
let ChatbotAppComp: ComponentType | null = null;
function renderApp() {
    if (ChatbotAppComp === null) {
        return;
    }
    root.render(
        <StrictMode>
            <ChatbotAppComp />
        </StrictMode>,
    );
}

// The window's modules read every language's `assistant.json`, `typed.json`
// and `bibleSource.json` as they are evaluated (`chatLangHelpers.ts`,
// `wordStudyHelpers.ts`), and every language but English is a plugin whose
// files come with it: so they are imported only once `init` has read the
// plugins and their files are here.
async function start(isInitDone: boolean) {
    await Promise.all([
        ensureLangFiles('assistant.json'),
        ensureLangFiles('typed.json'),
        ensureLangFiles('bibleSource.json'),
    ]).catch(handleError);
    const [appModule, languageModule] = await Promise.all([
        import('./chatbot/ChatbotAppComp'),
        import('./chatbot/chatWindowLanguage'),
    ]);
    ChatbotAppComp = appModule.default;
    if (isInitDone) {
        languageModule.plugChatWindowLanguage();
        void languageModule.plugChatWindowAppFont();
    }
    renderApp();
}

// Drawn once the app's language has loaded (`init` awaits it), so every word
// of this window can be in that language. `init` already loaded it on every
// launch; the first paint now waits for it rather than racing it. A window
// whose `init` fails is still drawn, in English, rather than not at all.
init(() => {
    start(true).catch(handleError);
}).catch((error) => {
    handleError(error);
    start(false).catch(handleError);
});
