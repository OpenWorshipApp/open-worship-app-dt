import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import FinderAppComp from './find/FinderAppComp';
import { handleError } from './helper/errorHelpers';
import { getReactRoot } from './others/rootHelpers';
import { stopFindingString } from './find/finderHelpers';

// Closing the bar tears its view down; the page it was searching must not be
// left with the highlight painted on.
globalThis.addEventListener('beforeunload', () => {
    stopFindingString();
});

function renderApp() {
    const root = getReactRoot();
    root.render(
        <StrictMode>
            <FinderAppComp />
        </StrictMode>,
    );
}

// Drawn once the app's language has loaded, like the AI Chat window: the bar's
// words go through `tran()`, which THROWS in dev when this renderer has no
// language data yet -- rendering first left an empty white view nobody could
// close, so `Ctrl/Cmd+F` looked like it did nothing in a non-English app.
init(renderApp).catch((error) => {
    handleError(error);
    renderApp();
});
