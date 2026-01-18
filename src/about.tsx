import { StrictMode } from 'react';

import { init } from './boot';
import { getReactRoot } from './others/initHelpers';

init(async () => {
    const AboutComp = (await import('./others/AboutComp')).default;
    const root = getReactRoot();
    root.render(
        <StrictMode>
            <AboutComp />
        </StrictMode>,
    );
});
