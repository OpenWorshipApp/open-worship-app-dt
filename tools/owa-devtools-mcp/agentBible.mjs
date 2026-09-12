// `owa_present_bible`: put a Bible passage on the projector by its reference,
// or read what a reference is, through the app's own parser and the same
// present path as the Bible Lookup's "Show bible item".
//
// Why a tool of its own rather than presses. "Put John 3:16 on the screen"
// is the commonest ask in a service and the one the assistant could only
// DESCRIBE: the Bible Lookup is a step-by-step picker written for a person
// (first letters of the book, click the book, the chapter, the verse,
// double-click the preview), with labels along the way -- the book's own
// name, bare numbers -- that no card and no `owa_click` can be aimed at from
// a sentence. Measured 2026-09-09 and 2026-09-10 on Claude Sonnet 5: the
// answer was the manual's steps and the **Do it for me** under it pressed
// **Bible Lookup**, then stopped on a step with nothing to press and the
// user's verse nowhere in it. The song equivalent already worked through
// `selectedDocument`; this is the verse's door.
//
// The whole of the work is on the app side (`src/helper/agentBibleHelpers.ts`),
// reached the way `owa_list_screens` is: a dependency-free page expression
// fires a DOM event, the app relays it to a lazily imported worker, and the
// answer comes back on a second event. Nothing here imports an app module.

export const AGENT_BIBLE_ACTIONS = ['present', 'check'];

/**
 * One promise, one answer, one timeout -- modelled on
 * `genAgentFileExpression`: a random reply token so two calls in flight
 * cannot take each other's answer, and a timeout so a window that stopped
 * listening fails rather than hangs. Presenting reads the version's data off
 * disk, so the wait is generous.
 */
export function genPresentBibleExpression(request) {
    const payload = JSON.stringify(request ?? {});
    return `(() => {
        const request = Object.assign(${payload}, {
            token: Math.random().toString(36).slice(2),
        });
        return new Promise((resolve, reject) => {
            const onAnswer = (event) => {
                const detail = (event && event.detail) || {};
                if (detail.token !== request.token) {
                    return;
                }
                clearTimeout(timer);
                document.removeEventListener('owa-agent-bible-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-bible-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. A passage is presented ' +
                    'from the Presenter page -- leave the page argument ' +
                    'unset, or set it to presenter.html.'
                ));
            }, 20000);
            document.addEventListener('owa-agent-bible-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-bible', { detail: request }),
            );
        });
    })()`;
}

/**
 * The worker's answer as the model receives it. A refusal is an `isError`
 * result carrying the worker's own sentence, written for the model to act
 * on -- what was wrong and what to do instead -- the same shape the firewall
 * and the file tools answer with, for the same reason: a block that reads as
 * an instruction becomes correct behaviour, one that reads as a failure
 * becomes an apology.
 */
export function formatPresentBibleResult(result) {
    if (result === null || typeof result !== 'object') {
        return { isError: true, text: 'The app did not answer.' };
    }
    if (result.isError === true) {
        const versions = Array.isArray(result.versions)
            ? ` Installed versions: ${result.versions.join(', ')}.`
            : '';
        return {
            isError: true,
            text: `${String(result.reason ?? 'That could not be done.')}${versions}`,
        };
    }
    return { isError: false, text: JSON.stringify(result, null, 2) };
}

function quote(text) {
    return typeof text === 'string' && text.length > 0 ? ` -- "${text}"` : '';
}

/**
 * One or two sentences for the callers that answer without a model -- the
 * `/verse` command and the offline bot. What CHANGED, in words the user can
 * check against the wall, never what was pressed.
 *
 * Plain ESM with no `node:fs`, so the renderer bundles it beside the server,
 * exactly as `agentScreens.mjs` is.
 */
export function describePresentedBible(result) {
    if (result === null || typeof result !== 'object') {
        return 'The app did not answer.';
    }
    if (result.isError === true) {
        return String(result.reason ?? 'That could not be done.');
    }
    const where = `${result.reference} (${result.version})`;
    if (result.isPresented !== true) {
        return `${where} reads${quote(result.text)}. It is not on a screen.`;
    }
    const screens = Array.isArray(result.screens) ? result.screens : [];
    const onIds = screens
        .filter((screen) => screen.isShowing === true)
        .map((screen) => screen.screenId);
    const offIds = screens
        .filter((screen) => screen.isShowing !== true && screen.isLocked !== true)
        .map((screen) => screen.screenId);
    const parts = [`${where} is on the screen now${quote(result.text)}.`];
    if (onIds.length > 0) {
        parts.push(
            `Screen ${onIds.join(' and ')} ${onIds.length === 1 ? 'is' : 'are'} ` +
                'showing it to the projector.',
        );
    }
    if (offIds.length > 0) {
        parts.push(
            `Screen ${offIds.join(' and ')} ${offIds.length === 1 ? 'is' : 'are'} ` +
                'off, so the projector is not showing it yet.',
        );
    }
    return parts.join(' ');
}
