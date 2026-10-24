import { useAppEffect } from '../helper/appHooks';
import { checkIsMainWindow } from '../server/mainWindowHelpers';
import { initLangAppMenu, registerLangAppMenuClicked } from './langHelpers';

/**
 * The language packs' **Tools** items (Khmer Tools → Editor, Open Lyric,
 * BibleNote): builds them into the native menu and answers their clicks.
 *
 * Mounted by every page the MAIN window shows — the Presenter, the Bible Reader
 * and the Slide Editor. The main process routes these clicks to the window
 * that built the items, and the native menu outlives a page, so a page of the
 * main window that does not listen leaves the items in the menu doing nothing:
 * that was the Reader, where Khmer Tools → Editor opened no browser. A page
 * that does not build them leaves them missing whenever the app starts there.
 *
 * Only in the main window: the items are keyed, so a Reader or Slide Editor
 * opened as a popup would take the key over and route every click to itself,
 * then drop them once it closed.
 */
export default function LangAppMenuComp() {
    useAppEffect(() => {
        if (!checkIsMainWindow()) {
            return;
        }
        const unregister = registerLangAppMenuClicked();
        initLangAppMenu();
        return unregister;
    }, []);
    return null;
}
