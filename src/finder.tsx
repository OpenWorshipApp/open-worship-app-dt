import { StrictMode } from 'react';

import appProvider from './server/appProvider';
import { init } from './boot';
import FinderAppComp from './find/FinderAppComp';
import { getReactRoot } from './others/rootHelpers';

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
