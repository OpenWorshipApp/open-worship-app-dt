import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import ChatbotAppComp from './chatbot/ChatbotAppComp';
import { getReactRoot } from './others/rootHelpers';

// called as async to make quickly load
init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <ChatbotAppComp />
    </StrictMode>,
);
