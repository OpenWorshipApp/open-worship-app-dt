import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import ScreenMirrorGuestComp from './screen-mirror/ScreenMirrorGuestComp';

// No `AppLayoutComp`: the guest page is a connection console with one way
// out, back to the Presenter, and none of the app header's panels.
await init();
run(
    <>
        <ScreenMirrorGuestComp />
        <AppWindowToolsComp />
    </>,
);
