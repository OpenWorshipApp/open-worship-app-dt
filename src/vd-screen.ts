// A screen of a virtual display, drawn by the browser watching it: the app's
// own screen page, given a stand-in for the desktop provider before any of it
// loads (`appProvider` reads `globalThis.provider` once, at import).
import {
    connectWebScreen,
    ensureRandomUUID,
} from './virtual-display/webScreenProvider';

ensureRandomUUID();
const { provider } = await connectWebScreen();
(globalThis as any).provider = provider;
await import('./screen');
