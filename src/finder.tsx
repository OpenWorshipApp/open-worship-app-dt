import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import FinderAppComp from './find/FinderAppComp';
import { getReactRoot } from './others/rootHelpers';
import { stopFindingString } from './find/finderHelpers';

// Closing the bar tears its view down; the page it was searching must not be
// left with the highlight painted on.
globalThis.addEventListener('beforeunload', () => {
    stopFindingString();
});

// called as async to make quickly load
init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <FinderAppComp />
    </StrictMode>,
);
