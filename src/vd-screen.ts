// A screen of a virtual display, drawn by the browser watching it: the app's
// own screen page, given a stand-in for the desktop provider before any of it
// loads (`appProvider` reads `globalThis.provider` once, at import).
//
// The same page also draws a Screen Show: another screen's content inside an
// iframe of a screen window or of the presenter, given its stand-in by the
// window holding it (`screenShowFrameProvider`).
import {
    connectWebScreen,
    ensureRandomUUID,
} from './virtual-display/webScreenProvider';

ensureRandomUUID();
const params = new URLSearchParams(globalThis.location.search);
if (params.has('screenShow')) {
    const { connectScreenShowFrame } =
        await import('./_screen/screenShowFrameProvider');
    (globalThis as any).provider = connectScreenShowFrame();
    await import('./screen');
} else {
    const { provider } = await connectWebScreen();
    (globalThis as any).provider = provider;
    await import('./screen');
    // Only now: it reaches the screen managers, which read the provider.
    const { reportScreenEmptiness } =
        await import('./virtual-display/webScreenEmptyReporter');
    reportScreenEmptiness(Number(params.get('screenId')));
}
