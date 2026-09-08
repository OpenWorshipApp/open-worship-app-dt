import { provider } from './fullProvider';
import { initProvider } from './providerHelpers';
import {
    checkShouldLockdownRenderer,
    lockdownRenderer,
} from './rendererLockdown';

// Order is the whole point. `fullProvider` above has already done every
// `require` this window will ever need, and holds them in its own module
// scope; taking the GLOBAL `require` away now leaves the bridge working and
// leaves the page with no way back to Node. Page scripts run after the
// preload, so `src/chatbot/*` never sees one.
if (checkShouldLockdownRenderer(globalThis.location?.pathname ?? '')) {
    lockdownRenderer();
}

initProvider(provider);
