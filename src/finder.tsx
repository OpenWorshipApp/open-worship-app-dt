import { StrictMode } from 'react';

import { init } from './boot';
import FinderAppComp from './find/FinderAppComp';
import { getReactRoot } from './others/rootHelpers';
import { findString } from './find/finderHelpers';

globalThis.addEventListener('beforeunload', () => {
    findString('');
});

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <FinderAppComp />
    </StrictMode>,
);
