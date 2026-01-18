import { StrictMode } from 'react';

import appProvider from './server/appProvider';
import { getReactRoot } from './others/initHelpers';
import { init } from './boot';

init(async () => {
    const FinderAppComp = (await import('./find/FinderAppComp')).default;
    const root = getReactRoot();
    root.render(
        <StrictMode>
            <FinderAppComp
                onClose={() => {
                    appProvider.messageUtils.sendData(
                        'finder:app:close-finder',
                    );
                }}
            />
        </StrictMode>,
    );
});
