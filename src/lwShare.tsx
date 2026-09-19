import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import LWShareAppComp from './lwShare/LWShareAppComp';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import { getReactRoot } from './others/rootHelpers';

await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <LWShareAppComp />
        <AppWindowToolsComp />
    </StrictMode>,
);
