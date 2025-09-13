import { StrictMode } from 'react';

import AboutComp from './others/AboutComp';
import { getReactRoot } from './initHelpers';

const root = getReactRoot();
root.render(
    <StrictMode>
        <AboutComp />
    </StrictMode>,
);
