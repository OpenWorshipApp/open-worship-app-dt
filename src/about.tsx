import { StrictMode } from 'react';

import { init } from './boot';
import { getReactRoot } from './others/initHelpers';
import AboutComp from './others/AboutComp';

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <AboutComp />
    </StrictMode>,
);
