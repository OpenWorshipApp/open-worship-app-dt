import { StrictMode } from 'react';

import appProvider from './server/appProvider';
import { getReactRoot } from './others/initHelpers';
import { init } from './boot';
import FinderAppComp from './find/FinderAppComp';

await init();
const root = getReactRoot();
function handleClosing() {
    appProvider.messageUtils.sendData('finder:app:close-finder');
}
root.render(
    <StrictMode>
        <FinderAppComp onClose={handleClosing} />
    </StrictMode>,
);
