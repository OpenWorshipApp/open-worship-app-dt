// Taking Node away from the window that talks to a language model.
//
// Every window in this app runs with `nodeIntegration: true` and
// `contextIsolation: false` (see the TODO on `genWebPreferences`), which means
// page code can call `require('fs')` and `require('child_process')`. For the
// presenter that is how the app is built and the page code is all ours. The
// chatbot window is not like the others:
//
//  - it renders text written by a remote service,
//  - which itself read a file, an image or a document the user was handed by
//    somebody else,
//  - and it holds the user's API keys while it does it.
//
// So it is the one window where "a string of text ends up being executed"
// stops being a hypothetical, and the blast radius of that in a renderer with
// node integration is the whole computer. This takes the escape hatches away
// from it AFTER the preload has finished with them: `fullProvider` is imported
// (and has done all its requiring) before this runs, and its utilities hold
// their own module-scoped `require`, which is a different binding from the
// global one this deletes.
//
// This is a second line, not the first. The first is that the chatbot window
// renders answers as TEXT -- there is no `dangerouslySetInnerHTML` anywhere in
// `src/chatbot/` and there must never be one. The point of this file is that
// the day somebody adds one by accident, it is not also a remote shell.
//
// What it deliberately does NOT do: narrow `appProvider`. The chatbot window
// genuinely writes files (a saved report, a saved picture), so it keeps the
// bridge the rest of the app uses. Narrowing that bridge to the handful of
// calls this window makes is real work and is tracked as MC-04.

// One entry per window that should not have Node. Three are on it: the
// chatbot, the one renderer whose CONTENT comes from outside the machine; the
// AI Chat window, which hosts somebody else's site in a `<webview>` guest --
// the guest is sandboxed on its own (`electron/aiChatGuestHelpers.ts`), and the
// page around it draws a tab strip and needs nothing of Node either; and the
// Markdown Preview, which renders a file from anywhere on the machine -- a
// Resources folder somebody copied in, a download -- and reads it through the
// provider bridge. Adding a page here is a one-line change, and each one needs
// checking against what that page's code actually does -- a window that writes
// files through `require` rather than the provider bridge would break.
const LOCKED_DOWN_PATH_NAMES = [
    '/chatbot.html',
    '/aichat.html',
    '/markdownPreview.html',
];

export function checkShouldLockdownRenderer(pathName: string) {
    return LOCKED_DOWN_PATH_NAMES.some((one) => {
        return pathName.startsWith(one);
    });
}

/**
 * Removes a global for good, and REPORTS whether it managed to. A lockdown
 * that quietly did nothing is worse than none, because everything downstream
 * gets written believing it held -- so the removal is read back rather than
 * assumed, and a name that will not go is left out of the returned list.
 *
 * Two attempts, because two shapes of property exist here. `delete` clears
 * anything configurable, which is what Electron's node integration assigns.
 * A non-configurable one survives it silently; if it is still WRITABLE it can
 * be emptied by assignment instead, which is just as good -- the page looks
 * the name up and gets `undefined` either way.
 *
 * There is deliberately no third attempt with a throwing getter. Redefining a
 * property as an accessor requires it to be configurable, and a configurable
 * property was already deleted by the first attempt -- so that branch could
 * never run, and a test written against it fails, which is how this was
 * caught. Non-configurable AND non-writable is simply not revocable, and the
 * honest answer is to say so.
 */
function revokeGlobal(scope: any, name: string) {
    if (scope[name] === undefined) {
        return false;
    }
    try {
        delete scope[name];
    } catch {
        // Non-configurable in strict mode; the assignment below is the
        // remaining option.
    }
    if (scope[name] === undefined) {
        return true;
    }
    try {
        scope[name] = undefined;
    } catch {
        // Non-writable as well. Nothing more can be done to it.
    }
    return scope[name] === undefined;
}

// `require` is the obvious one; the rest are the ways back to it.
// `module.require` and `process.mainModule.require` are both live handles to
// the same loader, so deleting `require` alone would have been theatre.
const REVOKED_GLOBAL_NAMES = [
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
];

/**
 * `process` is replaced rather than removed. The Anthropic, OpenAI and Kimi
 * SDKs all run in this window and all probe `process.env` for a key when they
 * start; taking the object away makes them throw where they would otherwise
 * read `undefined` and carry on with the key they were handed. So they get an
 * object shaped like the one they expect, with nothing in it -- which also
 * closes `process.env` as a way to read whatever secrets are in the
 * environment this app was launched from, and `process.binding` / `dlopen` /
 * `mainModule` as ways back to Node.
 */
function genDecoyProcess(realProcess: any) {
    return Object.freeze({
        env: Object.freeze({}),
        argv: Object.freeze([]),
        platform: String(realProcess?.platform ?? ''),
        versions: Object.freeze({}),
        // Present because a bundler shim or an SDK may call it; a window with
        // no Node has nothing to say about the event loop.
        nextTick: (callback: () => void) => {
            queueMicrotask(callback);
        },
    });
}

/**
 * Call this from the preload, after everything the window legitimately needs
 * has been imported and before any page script runs. Returns what it took
 * away, so a caller can log it and a test can assert it.
 */
export function lockdownRenderer(scope: any = globalThis) {
    const revokedNameList: string[] = [];
    for (const name of REVOKED_GLOBAL_NAMES) {
        if (revokeGlobal(scope, name)) {
            revokedNameList.push(name);
        }
    }
    if (scope.process !== undefined) {
        const decoy = genDecoyProcess(scope.process);
        try {
            // Assignment first: `process` is a plain writable global, and
            // redefining a property that is already there throws on some
            // shapes. Only if the assignment does not take does this fall
            // through to the heavier hammer.
            scope.process = decoy;
            if (scope.process !== decoy) {
                Object.defineProperty(scope, 'process', {
                    configurable: false,
                    enumerable: false,
                    writable: false,
                    value: decoy,
                });
            }
            revokedNameList.push('process');
        } catch {
            // Left as it was; the caller logs what was actually revoked.
        }
    }
    return revokedNameList;
}
