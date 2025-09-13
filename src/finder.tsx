import { StrictMode } from 'react';

import FinderAppComp from './_find/FinderAppComp';
import appProvider from './server/appProvider';
import { getReactRoot } from './initHelpers';

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
