// Which page target is the ONE main window (2026-11-10, robot run
// 20261110-1109, F-1).
//
// `pickTarget` with no `match` ranks the targets by page KIND, so the main
// window on the Reader and a Bible Reader window of its own
// (`reader.html?uuid=reader`) tie, and a Reader window outranks a main window
// on the Slide Editor. `owa_goto_page` aimed that way and navigated the POPUP
// to `presenter.html?uuid=reader` -- a Presenter whose every pane spun for
// good -- while the main window stayed where it was. The help window's **Go
// to the Presenter** reaches it whenever a Reader window is open.
//
// The rule is the app's own (`checkIsMainWindowUrl` in
// `src/chatbot/windowAimHelpers.ts`): every popup's address carries a `uuid`
// (`openPopupWindow`), the main window's never does. Its pages are the ones it
// navigates between plus the Screen Mirror guest page, which only the main
// window loads (`allowedMainHtmlFiles` in `electron/ElectronMainController.ts`).
// Local Web Share and the screens are loaded with no `uuid` as well, and are
// never the main window. Pure, no node built-in: plain data in, plain data out.

import { BOT_MAIN_WINDOW_PAGES } from './botFocus.mjs';

export const SCREEN_MIRROR_PAGE = 'screen-mirror.html';

const MAIN_WINDOW_PAGE_SET = new Set([
  ...BOT_MAIN_WINDOW_PAGES,
  SCREEN_MIRROR_PAGE,
]);

function toUrlObject(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

/** The page the main window shows at `url`, or `null` when it is not it. */
export function toMainWindowPage(url) {
  const urlObject = toUrlObject(String(url));
  if (urlObject === null || urlObject.searchParams.has('uuid')) {
    return null;
  }
  const pageName = urlObject.pathname.split('/').pop() ?? '';
  return MAIN_WINDOW_PAGE_SET.has(pageName) ? pageName : null;
}

/** The main window among the CDP page targets, or `null` when none is it. */
export function findMainWindowTarget(targets) {
  return (
    (targets ?? []).find((target) => {
      return toMainWindowPage(target.url) !== null;
    }) ?? null
  );
}
