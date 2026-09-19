// `owa_lyric_file` and `owa_slide_file`: the page expression that reaches the
// app's document worker, and the schema both tools share.
//
// The work itself is `handleAgentFileRequest` in `src/helper/agentFileHelpers.ts`
// -- this package must never import an app module, because the SAME files are
// spawned standalone over stdio for an outside agent, where there is no app to
// import. So the request goes the way the guide card's rescue does: a
// dependency-free expression fires a DOM event, `domHelpers.ts` relays it to
// the worker, and the answer comes back on a second event.
//
// Two tools rather than one, by the operator's own call: a model choosing
// between them should not have to read about the file type it is not touching.
// The cost is that both schemas ride every round of every question, so
// everything shareable is shared -- the expression, the actions, and the
// wording below.

export const AGENT_FILE_ACTIONS = [
    'list',
    'info',
    'create',
    'update',
    'rename',
    'delete',
];

/**
 * One slide at a time, for slide documents only: a song's slides are made
 * from its words, so a song has none of its own to change.
 */
export const AGENT_SLIDE_ACTIONS = [
    'slides',
    'add-slide',
    'update-slide',
    'delete-slide',
    'move-slide',
    'duplicate-slide',
];

/**
 * What each action does, said once. It reads as part of both tools'
 * descriptions, so a change here changes both and they cannot drift.
 */
export const AGENT_FILE_ACTION_TEXT =
    '`list` names what is there, `info` reads one, `create` makes a new one, ' +
    '`update` changes one, `rename` renames one, `delete` moves one to the ' +
    'trash.';

/**
 * The sentence both tools end on, and the most important one in either.
 *
 * A volunteer must never discover that their song changed, or went, because
 * an assistant decided it should. `update` writes the editing history rather
 * than the file, `delete` is a move to the trash, and every change keeps a
 * backup `owa_undo` puts back (`src/helper/agentBackupHelpers.ts`) -- but only
 * the model can tell them that, and it will not unless it is told to.
 */
export const AGENT_FILE_SAFETY_TEXT =
    'Nothing is lost: `delete` goes to the trash, `create` refuses a taken ' +
    'name, `update` -- like every edit -- stays UNSAVED (a * beside the ' +
    'name, Ctrl+Z undoes it) for the user to Save, and every change keeps a ' +
    'backup owa_undo puts back -- say so afterwards. Ask before changing ' +
    'what they did not ask about.';

/**
 * Ask the app to act on one of the user's documents.
 *
 * Modelled on `genReadWebPageExpression`, and on `genCaptureExpression` before
 * it: a random reply token so two calls in flight cannot take each other's
 * answer, and a timeout so a window that stopped listening fails rather than
 * hangs.
 */
export function genAgentFileExpression(request) {
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
                document.removeEventListener('owa-agent-file-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-file-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. Documents are handled by ' +
                    'the presenter or the reader -- leave the page argument ' +
                    'unset, or set it to presenter.html.'
                ));
            }, 20000);
            document.addEventListener('owa-agent-file-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-file', { detail: request }),
            );
        });
    })()`;
}

/**
 * The worker's answer as the model receives it.
 *
 * A refusal comes back as an `isError` result carrying the worker's own
 * sentence, which is written for the model to act on -- the same shape the
 * firewall answers with, for the same reason: a block that reads as an
 * instruction becomes correct behaviour, one that reads as a failure becomes
 * an apology.
 */
export function formatAgentFileResult(result) {
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
