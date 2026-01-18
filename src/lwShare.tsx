import { StrictMode } from 'react';

import { getReactRoot } from './others/initHelpers';
import { init } from './boot';

init(async () => {
    const LWShareAppComp = (await import('./lwShare/LWShareAppComp')).default;
    const root = getReactRoot();
    root.render(
        <StrictMode>
            <LWShareAppComp />
        </StrictMode>,
    );
});
