// A minimal CDP client for the app-level tools.
//
// The browser tools come from chrome-devtools-mcp (puppeteer); this is the
// small side door the OWA tools use to ask the running app a question. It is
// deliberately tiny and dependency-free -- Node 22 / Electron 43 both have a
// global `WebSocket` -- and every call opens and closes its own socket, so
// nothing here holds a connection (or memory) between questions.
//
// Evaluated expressions must never `import()` an app module: a dynamic import
// re-runs module top-level code, and the app installs `document.onkeydown`
// there, which kills every keyboard shortcut in the window. Read the DOM, or
// talk to the main process over `require('electron').ipcRenderer` (renderers
// run with node integration).

import { resolveCdpPort } from './discovery.mjs';

export const PAGE_KINDS = {
    presenter: 'presenter.html',
    reader: 'reader.html',
    editor: 'app-document-editor.html',
    screen: 'screen.html',
    setting: 'setting.html',
};

// Which window a question is about, best first. An open DevTools window is a
// `page` target too, and it was being picked as "the app" -- so app pages are
// ranked explicitly and everything else is dropped.
const APP_PAGE_RANK = [
    PAGE_KINDS.presenter,
    PAGE_KINDS.reader,
    'appDocumentEditor.html',
    'lyricEditor.html',
    'bibleNote.html',
    'webEditor.html',
    PAGE_KINDS.setting,
    'about.html',
    // The chatbot window asking about itself is never the answer.
    'chatbot.html',
    PAGE_KINDS.screen,
];

function getPageRank(url) {
    const index = APP_PAGE_RANK.findIndex((pageName) => {
        return url.includes(pageName);
    });
    return index === -1 ? APP_PAGE_RANK.length : index;
}

export async function listTargets(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
        throw new Error(`CDP /json/list answered ${res.status}`);
    }
    const targets = await res.json();
    return targets.filter((target) => {
        return (
            target.type === 'page' &&
            typeof target.url === 'string' &&
            !target.url.startsWith('devtools://')
        );
    });
}

export async function getVersion(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() : null;
}

/**
 * The page an app-level question is about: the main window, not a popup and
 * not the chatbot's own window -- that is what "the app" means to someone
 * asking for help while looking at it.
 */
export function pickTarget(targets, match) {
    if (match) {
        return (
            targets.find((target) => {
                return target.url.includes(match);
            }) ?? null
        );
    }
    return (
        [...targets].sort((one, other) => {
            return getPageRank(one.url) - getPageRank(other.url);
        })[0] ?? null
    );
}

export async function requireLivePort(port) {
    const livePort = await resolveCdpPort({ port });
    if (livePort === null) {
        throw new Error(
            'No running Open Worship App was found. Start the app (or ' +
                '`npm run dev`) and try again.',
        );
    }
    return livePort;
}

function sendCommand(socket, id, method, params) {
    socket.send(JSON.stringify({ id, method, params }));
}

/**
 * Runs `expression` in a page and returns its value. Promises are awaited, so
 * a tool can hand over an `async` expression and read the settled value.
 */
export function evaluateInTarget(target, expression, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const timeoutId = setTimeout(() => {
            socket.close();
            reject(new Error(`Timed out evaluating in ${target.url}`));
        }, timeout);
        const finish = (error, value) => {
            clearTimeout(timeoutId);
            try {
                socket.close();
            } catch {
                // Already closing.
            }
            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        };
        socket.addEventListener('error', () => {
            finish(new Error(`Could not attach to ${target.url}`));
        });
        socket.addEventListener('open', () => {
            sendCommand(socket, 1, 'Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true,
                allowUnsafeEvalBlockedByCSP: true,
            });
        });
        socket.addEventListener('message', (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (message.id !== 1) {
                return;
            }
            if (message.error) {
                finish(new Error(message.error.message));
                return;
            }
            const { result, exceptionDetails } = message.result ?? {};
            if (exceptionDetails) {
                finish(
                    new Error(
                        exceptionDetails.exception?.description ??
                            exceptionDetails.text,
                    ),
                );
                return;
            }
            finish(null, result?.value);
        });
    });
}

/** `evaluateInTarget`, resolving the live app and the page for the caller. */
export async function evaluateInApp(expression, { port, match } = {}) {
    const livePort = await requireLivePort(port);
    const targets = await listTargets(livePort);
    const target = pickTarget(targets, match);
    if (target === null) {
        // Name the pages that ARE open: "no presenter.html" with the main
        // window on reader.html is the caller's cue to switch pages first,
        // and it cannot say so without being told where the window is.
        const openPages = targets
            .map((one) => {
                return one.url.replace(/^.*\//, '');
            })
            .join(', ');
        throw new Error(
            match
                ? `The app has no open page matching "${match}". The open ` +
                      `pages are: ${openPages}.`
                : 'The app has no open page',
        );
    }
    return {
        port: livePort,
        target,
        value: await evaluateInTarget(target, expression),
    };
}
