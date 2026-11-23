import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import AboutComp from './others/AboutComp';
import { handleError } from './helper/errorHelpers';
import { getReactRoot } from './others/rootHelpers';

function renderApp() {
    const root = getReactRoot();
    root.render(
        <StrictMode>
            <AboutComp />
        </StrictMode>,
    );
}

// Drawn once the app's language has loaded: the window's words go through
// `tran()`, which THROWS in dev when this renderer has no language data yet --
// drawing first left the About window black in a non-English app.
init(renderApp).catch((error) => {
    handleError(error);
    renderApp();
});
