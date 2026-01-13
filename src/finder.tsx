import { StrictMode } from 'react';

import FinderAppComp from './find/FinderAppComp';
import appProvider from './server/appProvider';
import { getReactRoot } from './others/initHelpers';

const root = getReactRoot();
root.render(
    <StrictMode>
        <FinderAppComp
            onClose={() => {
                appProvider.messageUtils.sendData('finder:app:close-finder');
            }}
        />
    </StrictMode>,
);
