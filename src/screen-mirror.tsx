import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import ScreenMirrorGuestComp from './screen-mirror/ScreenMirrorGuestComp';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import HandleAlertComp from './popup-widget/HandleAlertComp';
import ToastComp from './toast/ToastComp';

// No `AppLayoutComp`: the guest page is a connection console with one way
// out, back to the Presenter, and none of the app header's panels. It does
// carry the header's own button group (2026-11-14), so it mounts the hosts
// those buttons and the Help menu open into: the toasts that carry Help ->
// Tips of the Day (the page has a lesson of its own), the Help button's menu,
// and the AI caution in front of the assistant and AI Chat -- without the
// alert host that caution fails OPEN (`askAiCaution`).
await init();
run(
    <>
        <ScreenMirrorGuestComp />
        <ToastComp />
        <AppContextMenuComp />
        <HandleAlertComp />
        <AppWindowToolsComp />
    </>,
);
