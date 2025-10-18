import { StrictMode } from 'react';

import { getReactRoot } from './initHelpers';
import LWShareAppComp from './lwShare/LWShareAppComp';

const root = getReactRoot();
root.render(
    <StrictMode>
        <LWShareAppComp />
    </StrictMode>,
);
