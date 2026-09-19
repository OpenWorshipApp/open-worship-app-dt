// `owa_bible_item`, `owa_bible_note` and `owa_undo`: the page expression that
// reaches the app's data workers, and the vocabulary their schemas, the
// firewall and the banner share.
//
// The work is on the app side -- `src/helper/agentBibleListHelpers.ts`,
// `agentNoteHelpers.ts` and `agentBackupHelpers.ts` -- reached the way every
// other data tool reaches it (`agentFile.mjs`): a dependency-free expression
// fires a DOM event, `domHelpers.ts` relays it to a lazily imported worker, and
// the answer comes back on a second event. One event for the three, keyed by
// `domain`, because they are one shape of errand; the worker map in the relay
// is the whole routing.
//
// Plain ESM with no imports: `firewall.mjs` reads the action lists below, and
// nothing about a list of words needs a file system.

export const AGENT_BIBLE_ITEM_ACTIONS = [
    'list',
    'add',
    'update',
    'delete',
    'create-list',
    'rename-list',
    'delete-list',
];

export const AGENT_NOTE_ACTIONS = [
    'list',
    'read',
    'add',
    'update',
    'delete',
    'create-file',
    'rename-file',
    'delete-file',
];

export const AGENT_UNDO_ACTIONS = ['list', 'undo'];

/**
 * Every action that can take something of the user's away -- a file to the
 * trash, a slide, a saved passage, a note -- plus `undo`, which puts a created
 * file in the trash as readily as it brings a deleted one back. The firewall
 * rations these on a budget of their own: each one is recoverable, but a loop
 * emptying somebody's Documents folder into the trash is still a Sunday
 * morning lost, and no honest question removes more than a handful of things.
 */
export const AGENT_REMOVING_ACTIONS = [
    'delete',
    'delete-list',
    'delete-file',
    'delete-slide',
    'undo',
];

/**
 * The sentence every data tool ends on. A volunteer must never discover that
 * something of theirs is gone -- and must always be told how to get it back,
 * which only the model can do, and will not unless it is told to.
 */
export const AGENT_UNDO_TEXT =
    'Nothing is lost: a delete goes to the trash and every change keeps a ' +
    'backup owa_undo puts back. Change only what was asked, then say what ' +
    'changed and that it can be undone.';

/**
 * Ask one of the data workers. Modelled on `genAgentFileExpression`: a random
 * reply token so two calls in flight cannot take each other's answer, and a
 * timeout so a window that stopped listening fails rather than hangs. A write
 * takes its backup first, so the wait is generous.
 */
export function genAgentDataExpression(domain, request) {
    const payload = JSON.stringify(
        Object.assign({}, request ?? {}, { domain: String(domain) }),
    );
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
                document.removeEventListener('owa-agent-data-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-data-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. Saved passages, notes and ' +
                    'undo are handled by the presenter or the reader -- leave ' +
                    'the page argument unset, or set it to presenter.html.'
                ));
            }, 30000);
            document.addEventListener('owa-agent-data-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-data', { detail: request }),
            );
        });
    })()`;
}

/**
 * The worker's answer as the model receives it: a refusal is an `isError`
 * result carrying the worker's own sentence, written for the model to act on.
 */
export function formatAgentDataResult(result) {
    if (result === null || typeof result !== 'object') {
        return { isError: true, text: 'The app did not answer.' };
    }
    if (result.isError === true) {
        return {
            isError: true,
            text: String(result.reason ?? 'That could not be done.'),
        };
    }
    // Compact: see `toTextResult` in owaTools.mjs.
    return { isError: false, text: JSON.stringify(result) };
}
