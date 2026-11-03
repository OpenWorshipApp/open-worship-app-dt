// No tool here ever sees a DevTools window as a page. Two reasons, both
// measured 2026-11-02 against the Electron 32 build (Chromium 128):
//
//  - chrome-devtools-mcp connects with `handleDevToolsAsPage: true` and a
//    target filter that keeps `devtools://` pages, so an open DevTools window
//    was a page every page tool waited on -- and Chromium 128's DevTools front
//    end never answers an outside client. `Network.enable` timed out after
//    15 s, and `list_pages`, `take_snapshot`, `list_console_messages` and the
//    rest hung for as long as DevTools stayed open, on both doors. With the
//    window skipped, the same `pages()` answered in 48 ms.
//  - A DevTools console evaluates in a renderer that has Node: the reach
//    `evaluate_script` is refused for, and `owa_menu` refuses Toggle Developer
//    Tools for. A tool that can see the DevTools page can type into it.
//
// The `owa_*` tools never listed it (`listPageTargets` in cdp.mjs).
// Dependency-free, so both doors load it for nothing.

export function checkIsDevToolsUrl(url) {
  return typeof url === 'string' && url.startsWith('devtools://');
}

const SKIPS_DEVTOOLS = Symbol('owaSkipsDevToolsTargets');

/**
 * Wrap a puppeteer instance's `connect` so the target filter it is given also
 * drops DevTools pages. chrome-devtools-mcp builds its connect options inside
 * `ensureBrowserConnected` and offers no option for this, so the wrap is on
 * the shared puppeteer it imports. Safe to call again.
 */
export function skipDevToolsTargets(puppeteer) {
  if (puppeteer.connect[SKIPS_DEVTOOLS]) {
    return;
  }
  const connect = puppeteer.connect;
  const wrappedConnect = (options = {}) => {
    const { targetFilter } = options;
    return connect.call(puppeteer, {
      ...options,
      targetFilter: (target) => {
        if (checkIsDevToolsUrl(target.url())) {
          return false;
        }
        return targetFilter ? targetFilter(target) : true;
      },
    });
  };
  wrappedConnect[SKIPS_DEVTOOLS] = true;
  puppeteer.connect = wrappedConnect;
}
