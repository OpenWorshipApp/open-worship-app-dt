import { StrictMode } from 'react';

import AboutComp from './others/AboutComp';
import { getReactRoot } from './others/initHelpers';

const root = getReactRoot();
root.render(
    <StrictMode>
        <AboutComp />
    </StrictMode>,
);
