// `owa_app_state`'s `selectedDocument`: what the user is in the MIDDLE of on
// the Presenter page -- the document they picked, its slides in the order the
// previewer shows them, which one is on a screen, which one the arrow keys
// would go to next, and the exact words each card answers to.
//
// The tool used to answer the window's page, language, theme and tabs, and
// `owa_list_screens` what the projector held; nothing said what the user had
// SELECTED. Measured 2026-09-09 on Claude Sonnet 5 with "Amazing Grace"
// highlighted and the projector still holding a Khmer hymn: *which song is
// selected right now?* was answered with the hymn (the only document any tool
// had named), and *show the next slide* ran to the ten-round cap, dumped 200
// controls into the context looking for a slide card (~35 000 tokens: the
// cards had no accessible name and were never listed), pressed a slide's
// index badge because it happened to bubble to the card, changed the
// congregation's screen -- and then answered "I could not find an answer for
// that", the last round having spent its whole output budget thinking.
//
// So the answer carries `selectedDocument`, read from the app's own document
// and screen managers through the same DOM-event relay `owa_list_screens`
// uses (`src/helper/agentPresenterHelpers.ts`), because a page expression
// cannot reach a module's closure and this package may not import an app
// module. Every slide carries `find` -- the card's accessible name, one
// function on the app side builds both -- so `owa_click` presses the next
// slide by exact words with no search round and no dump, and
// `owa_list_screens` then says what went up.

/**
 * One promise: fires the relay, awaits its answer with a timeout. Returns the
 * relay's result as-is (`isAuthoritative`, `selectedDocument`) or an object
 * with `isError` and a `reason`, so the tool can say WHY it has nothing rather
 * than answering a stale "nothing selected".
 */
export function genPresenterStateExpression() {
    return `(() => {
    return new Promise((resolve) => {
        const request = { token: Math.random().toString(36).slice(2) };
        let isDone = false;
        const finish = (result) => {
            if (isDone) {
                return;
            }
            isDone = true;
            clearTimeout(timer);
            document.removeEventListener('owa-agent-presenter-answer', onAnswer);
            resolve(result === null
                ? { isError: true, reason: 'the window did not answer in time' }
                : result);
        };
        const onAnswer = (event) => {
            const detail = (event && event.detail) || {};
            if (detail.token !== request.token) {
                return;
            }
            finish(detail.result);
        };
        const timer = setTimeout(() => { finish(null); }, 6000);
        document.addEventListener('owa-agent-presenter-answer', onAnswer);
        document.dispatchEvent(new CustomEvent('owa-agent-presenter', { detail: request }));
    });
})()`;
}

const NOTE_NOT_PRESENTER =
    'What is selected is known only while the Presenter page is open, and ' +
    'it is not. owa_goto_page can switch the main window to it.';

/**
 * Folds the relay's answer into an `owa_app_state` result: `selectedDocument`
 * when the presenter answered, a `note` saying why not otherwise -- never a
 * silent absence, which a model reads as "nothing is selected".
 */
export function foldPresenterState(answer, relayResult) {
    const folded = Object.assign({}, answer);
    if (
        relayResult === null ||
        typeof relayResult !== 'object' ||
        relayResult.isError === true
    ) {
        folded.note =
            'What is selected could not be read from this window' +
            (relayResult && relayResult.reason
                ? `: ${relayResult.reason}`
                : '') +
            '.';
        return folded;
    }
    if (relayResult.isAuthoritative === false) {
        folded.note = NOTE_NOT_PRESENTER;
        return folded;
    }
    folded.selectedDocument = relayResult.selectedDocument ?? null;
    // The run sheet rides beside it (EC-132): a service driven from a run
    // sheet may have nothing selected in the Documents list at all, and
    // "what's next" is a question about the sheet, not the selection. Null
    // when the window could not read it -- never absent, which reads as
    // "there is no such thing".
    folded.runSheet = relayResult.runSheet ?? null;
    return folded;
}

// How much of a slide's words a SENTENCE quotes -- a line, for a person.
const QUOTED_WORDS_LIMIT = 50;

function quoteWords(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return '';
    }
    const cut =
        text.length > QUOTED_WORDS_LIMIT
            ? `${text.slice(0, QUOTED_WORDS_LIMIT).trimEnd()}…`
            : text;
    return ` -- "${cut}"`;
}

function nameSlide(slide) {
    if (slide === null || typeof slide !== 'object') {
        return '';
    }
    const label = slide.name ? `slide ${slide.n} "${slide.name}"` : `slide ${slide.n}`;
    return `${label}${quoteWords(slide.text)}`;
}

/**
 * One or two sentences for the callers that answer without a model -- the
 * offline bot and the `/` commands. "Amazing Grace is selected" is not the
 * whole answer to somebody about to press a key: which slide is up and which
 * comes next is.
 *
 * Plain ESM with no `node:fs`, so the renderer bundles it beside the server,
 * exactly as `agentScreens.mjs` is.
 */
export function describeSelectedDocument(selectedDocument) {
    if (selectedDocument === null || typeof selectedDocument !== 'object') {
        return 'Nothing is selected in the Documents list.';
    }
    const { name, kind, slideCount, onScreen, next } = selectedDocument;
    const what = kind === 'song' ? 'The song' : `The ${kind}`;
    const count = `${slideCount} slide${slideCount === 1 ? '' : 's'}`;
    const parts = [`${what} "${name}" is selected (${count}).`];
    if (onScreen) {
        const screens = Array.isArray(onScreen.onScreens)
            ? onScreen.onScreens
            : [];
        const where =
            screens.length === 0
                ? ''
                : ` on screen ${screens.join(' and ')}`;
        parts.push(`Its ${nameSlide(onScreen)} is${where}.`);
    } else {
        parts.push('None of its slides is on a screen yet.');
    }
    if (next) {
        parts.push(`Next is ${nameSlide(next)}.`);
    }
    return parts.join(' ');
}

function nameRunLine(line) {
    if (line === null || typeof line !== 'object') {
        return '';
    }
    const kind = line.kind ? ` (${line.kind})` : '';
    const slide = line.slide
        ? `, ${line.slide.name ? `slide ${line.slide.n} "${line.slide.name}"` : `slide ${line.slide.n}`}`
        : '';
    return `line ${line.n} "${line.title}"${kind}${slide}`;
}

/**
 * The run sheet in one or two sentences, for the offline bot and the `/run`
 * command. Says what is open, where the run is and what the next press puts
 * up -- or, with no run player open, which sheets there are to open.
 */
export function describeRunSheet(runSheet) {
    if (runSheet === null || typeof runSheet !== 'object') {
        return 'The run sheet could not be read from this window.';
    }
    const openSheets = Array.isArray(runSheet.openSheets)
        ? runSheet.openSheets
        : [];
    if (openSheets.length === 0) {
        const names = Array.isArray(runSheet.availableSheets)
            ? runSheet.availableSheets
            : [];
        if (names.length === 0) {
            return (
                'No run sheet (presenting flow) is open, and the Presenting ' +
                'Flows panel lists none.'
            );
        }
        const listed = names.slice(0, 6).map((name) => `"${name}"`).join(', ');
        const more = names.length > 6 ? ` and ${names.length - 6} more` : '';
        return (
            'No run sheet is open in its run player, so there is no "next" ' +
            `yet. The Presenting Flows panel lists ${listed}${more}; the ` +
            'Preview Presenting Flow button on one opens its run player.'
        );
    }
    return openSheets
        .map((sheet) => {
            const count = `${sheet.lineCount} line${sheet.lineCount === 1 ? '' : 's'}`;
            const parts = [`The run sheet "${sheet.name}" is open (${count}).`];
            if (sheet.cursor) {
                const last =
                    sheet.cursor.slide && sheet.cursor.slide.isLast
                        ? ' -- its last slide'
                        : '';
                parts.push(`The run is on ${nameRunLine(sheet.cursor)}${last}.`);
            } else {
                parts.push('Nothing in it has been put up yet.');
            }
            if (sheet.next) {
                parts.push(`Next is ${nameRunLine(sheet.next)}.`);
            } else if (sheet.isAtEnd) {
                parts.push('That is the end of the sheet.');
            }
            return parts.join(' ');
        })
        .join(' ');
}
