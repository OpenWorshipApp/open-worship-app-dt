import { StrictMode } from 'react';

import { init } from './boot';
import LWShareAppComp from './lwShare/LWShareAppComp';
import { getReactRoot } from './others/rootHelpers';

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <LWShareAppComp />
    </StrictMode>,
);
