// The `--app-*` design tokens the controller paints with are declared under
// `.app[data-bs-theme='…']` in these two sheets, and `others/main.tsx` is what
// normally loads them. Three of the windows below never go through it, so they
// are imported here instead: a window that pulls in these tools pulls in what
// they are drawn with.
import './theme-override-dark.scss';
import './theme-override-light.scss';

import AppAssistantComp from './AppAssistantComp';
import PresentingControlComp from '../presenting-control/PresentingControlComp';
import { useThemeSource } from './themeHelpers';

/**
 * What every window of the app gets, declared once.
 *
 * Both of these are window-level tools that draw nothing until they are asked
 * for -- the annotation overlay and the way into the assistant -- and both used
 * to be present on some pages and missing from others for no reason other than
 * which entry file happened to import them. One component so that "what a
 * window carries" is a single line to read and a single line to change.
 *
 * Mount it on every entry EXCEPT `about`, `chatbot`, `finder` and `screen`:
 * the first three are one-purpose popups, and the screen is the projector --
 * an overlay or a help window on the output is the one place they must never
 * appear.
 */
export default function AppWindowToolsComp() {
    const { theme } = useThemeSource();
    // `display: contents` so the wrapper is layout-neutral -- custom properties
    // still inherit through it, and the overlay it hosts is `position: fixed`
    // anyway. On the six pages that already render inside `RenderApp`'s own
    // `.app` this is a harmless second declaration of the same tokens; on
    // `lwShare`, `lyricEditor` and `experiment` it is the only one there is.
    return (
        <div
            className="app"
            data-bs-theme={theme}
            style={{ display: 'contents' }}
        >
            <PresentingControlComp />
            <AppAssistantComp />
        </div>
    );
}
