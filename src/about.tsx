import { StrictMode } from 'react';

import { init } from './boot';
import AboutComp from './others/AboutComp';
import { getReactRoot } from './others/rootHelpers';

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <AboutComp />
    </StrictMode>,
);
