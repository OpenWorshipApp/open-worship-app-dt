// Giving up on an answer that is already on its way.
//
// One question can take a minute: the tool loop is up to ten rounds
// (`MAX_TOOL_ROUNDS`), every round is a whole model call, and a slow line or a
// model that keeps looking things up turns "Looking it up…" into something the
// user simply has to sit through. That is the wrong thing to hand a volunteer
// three minutes before a service -- they asked the wrong question, or they
// meant the other tab, or the band just started and they need the window shut.
// So the window can be told to stop, and stopping has to mean it:
//
// - the model call in flight is ABORTED, not merely ignored -- a request left
//   running is still being paid for, and on this machine it is also still
//   holding a socket and a response buffer;
// - the tool loop does not start another round;
// - nothing lands in the transcript afterwards, because an answer arriving
//   after the user gave up reads as the window answering a question nobody is
//   still asking.
//
// What it deliberately does NOT mean: undoing what the assistant already did.
// A tool that clicked something clicked it, and pretending otherwise would be
// a worse lie than the wait. Stopping is about the WAITING.
//
// An `AbortSignal` carries all of it -- `fetch` takes one, and so do both SDKs
// as a request option -- so the signal is the whole mechanism and this module
// is only the three things everyone needs to agree on: the error, how to
// recognise one, and where to check.

/**
 * The user pressed Stop. Its own class because it must never be described to
 * them as a failure: `describeLlmError` would turn an aborted request into
 * "it could not be reached — the internet may be down", which is a lie about
 * their building's wifi told at the worst possible moment.
 */
export class AskCancelledError extends Error {
    constructor(message = 'Stopped') {
        super(message);
        this.name = 'AskCancelledError';
    }
}

/**
 * Is this raised thing a cancellation rather than something that went wrong?
 *
 * The signal is the authority when there is one: once it is aborted, whatever
 * comes back out of the call is the abort, whichever layer noticed first. Each
 * layer names it differently -- `fetch` rejects with a `DOMException` called
 * `AbortError`, both SDKs with their own `APIUserAbortError` -- and this
 * window would otherwise print all three at the user as service problems.
 */
export function checkIsCancelError(
    error: any,
    signal?: AbortSignal | null,
): boolean {
    if (signal?.aborted === true) {
        return true;
    }
    const name = error?.name;
    return (
        error instanceof AskCancelledError ||
        name === 'AbortError' ||
        name === 'APIUserAbortError'
    );
}

/**
 * The check to make before spending anything -- another model round, another
 * tool call. Between two awaits is exactly where a press of Stop lands, and a
 * loop that only notices at its own next network error notices far too late.
 */
export function throwIfCancelled(signal?: AbortSignal | null) {
    if (signal?.aborted === true) {
        throw new AskCancelledError();
    }
}
