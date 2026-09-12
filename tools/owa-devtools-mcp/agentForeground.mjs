// `owa_foreground`: start or stop a foreground extra on the projector -- a
// countdown, a stopwatch, a clock, a scrolling message (marquee) along the top
// or bottom, or a quick line of text -- through the app's own screen managers,
// and answer with what each screen holds afterwards.
//
// Why a tool of its own rather than presses. "Start a 5 minute countdown on
// the screen" is a pre-service ask in nearly every church, and measured
// 2026-09-11 on Claude Sonnet 5 it was the assistant's worst answer of the
// day: the first reply took 8 rounds and $0.08 to write four steps (opening
// the Foreground tab itself on the way), and the "Yes, start it now" under it
// ran to the ten-round cap, started nothing, and ended on the half-sentence
// *"Now Foreground is active. Let me look for the countdown controls."* The
// Foreground tab is a toggle -- the model's press CLOSED the panel it had just
// opened, `owa_click` reported `didChange: false` because a tab carries its
// state in a class -- and the widget's boxes (`m Minutes`, `Start Countdown`)
// are a form written for a person. The verse had the same shape a day earlier
// and got `owa_present_bible`; this is the foreground's door.
//
// The whole of the work is on the app side (`src/helper/agentForegroundHelpers.ts`),
// reached the way `owa_present_bible` is: a dependency-free page expression
// fires a DOM event, the app relays it to a lazily imported worker, and the
// answer comes back on a second event. Nothing here imports an app module.

export const AGENT_FOREGROUND_WIDGETS = [
    'countdown',
    'stopwatch',
    'clock',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    // `stop` only: every extra at once, the way F10 (Clear Foreground) does.
    'all',
];
export const AGENT_FOREGROUND_ACTIONS = ['start', 'stop', 'check'];

// What each widget is called in a sentence to a person.
const WIDGET_NOUN_MAP = {
    countdown: 'countdown',
    stopwatch: 'stopwatch',
    clock: 'clock',
    'marquee-top': 'scrolling message along the top',
    'marquee-bottom': 'scrolling message along the bottom',
    'quick-text': 'line of text',
    all: 'foreground extras',
};

export function toForegroundWidgetNoun(widget) {
    return WIDGET_NOUN_MAP[widget] ?? 'foreground extra';
}

/**
 * One promise, one answer, one timeout -- modelled on
 * `genPresentBibleExpression`: a random reply token so two calls in flight
 * cannot take each other's answer, and a timeout so a window that stopped
 * listening fails rather than hangs.
 */
export function genForegroundExpression(request) {
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
                document.removeEventListener('owa-agent-foreground-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-foreground-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. A foreground extra is ' +
                    'started from the Presenter page -- leave the page ' +
                    'argument unset, or set it to presenter.html.'
                ));
            }, 15000);
            document.addEventListener('owa-agent-foreground-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-foreground', { detail: request }),
            );
        });
    })()`;
}

/**
 * The worker's answer as the model receives it. A refusal is an `isError`
 * result carrying the worker's own sentence, written for the model to act on
 * -- what was wrong and what to do instead -- the same shape `owa_present_bible`
 * answers with, for the same reason: a block that reads as an instruction
 * becomes correct behaviour, one that reads as a failure becomes an apology.
 */
export function formatForegroundResult(result) {
    if (result === null || typeof result !== 'object') {
        return { isError: true, text: 'The app did not answer.' };
    }
    if (result.isError === true) {
        return {
            isError: true,
            text: String(result.reason ?? 'That could not be done.'),
        };
    }
    return { isError: false, text: JSON.stringify(result, null, 2) };
}

function describeScreens(result) {
    const screens = Array.isArray(result.screens) ? result.screens : [];
    const onIds = screens
        .filter((screen) => screen.isShowing === true)
        .map((screen) => screen.screenId);
    const offIds = screens
        .filter((screen) => screen.isShowing !== true && screen.isLocked !== true)
        .map((screen) => screen.screenId);
    const parts = [];
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
    return parts;
}

/**
 * One or two sentences for the callers that answer without a model -- the
 * `/countdown` and `/marquee` commands and the offline bot. What CHANGED, in
 * words the user can check against the wall, never what was pressed.
 *
 * Plain ESM with no `node:fs`, so the renderer bundles it beside the server,
 * exactly as `agentBible.mjs` is.
 */
export function describeForeground(result) {
    if (result === null || typeof result !== 'object') {
        return 'The app did not answer.';
    }
    if (result.isError === true) {
        return String(result.reason ?? 'That could not be done.');
    }
    const detail = typeof result.detail === 'string' ? result.detail : '';
    if (result.did === 'checked') {
        return detail || 'No foreground extra is on any screen.';
    }
    if (result.did === 'stopped') {
        const parts = [detail || 'It is off the screen now.'];
        if (typeof result.note === 'string' && result.note !== '') {
            parts.push(result.note);
        }
        return parts.join(' ');
    }
    // The detail is written to follow "started" in a banner ("a 5 minute
    // countdown, ending at ..."), so it opens the sentence in lower case.
    const first = detail
        ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)} is on the screen now.`
        : 'It is on the screen now.';
    return [first, ...describeScreens(result)].join(' ');
}
