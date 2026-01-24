import { StrictMode } from 'react';

import { getReactRoot } from './others/initHelpers';
import { init } from './boot';
import LWShareAppComp from './lwShare/LWShareAppComp';

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <LWShareAppComp />
    </StrictMode>,
);
