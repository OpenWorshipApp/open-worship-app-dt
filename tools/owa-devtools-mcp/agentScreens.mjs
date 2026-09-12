// `owa_list_screens`: what is on the projector -- not only WHETHER a screen
// is showing but WHAT it holds, and the names of the controls that change it.
//
// The tool used to answer `isAnyShowing`, the showing ids and the display
// list, all read over IPC, and a model handed "showing: true" for a screen
// with a verse on it inferred the rest. Measured 2026-09-09 on the standing
// corpus with the projector showing a Khmer verse: *the words no come out
// big screen* took nine rounds and 36 seconds to conclude, confidently, that
// "nothing has actually been sent to it yet" -- and *is anything showing on
// the projector* answered "yes, the screen is on" with not a word about what
// was on it. Pressing "yes, turn it on" under the panic answer took eight
// rounds because the model had to go looking for the control's name
// (`owa_find_ui "show screen"` finds nothing -- `EC-115`) and pressed a
// near miss first.
//
// So the answer now carries three more things, read from two places:
//
//  - `screens[]`, one per screen the presenter knows about, showing or not:
//    the background, the slide (document, slide name, first words), the
//    Bible passage, the foreground widgets, the lock. This comes from the
//    app's own screen managers through the same DOM-event relay
//    `owa_lyric_file` uses (`src/helper/agentScreenHelpers.ts`), because a
//    page expression cannot reach a module's closure and this package may not
//    import an app module.
//  - `controls`, the labels ON the buttons as the app is displaying them --
//    the show/hide toggle, the five Clear buttons and whether each has
//    anything to clear -- read off the DOM of each screen's card, so an
//    `owa_click` can be aimed with the exact words in the user's language
//    and no search round in between.
//  - `previewCard`, where the Mini Screen panel sits in the window, because
//    the model placed it "at the top of the Presenter" three answers out of
//    three (`EC-116`); it is wherever the user dragged it, and the DOM knows.
//
// A window that does not answer the relay (a page other than the presenter,
// an older build) still gets the IPC basics, with `screens` absent and a
// `note` saying why, so the state answers never go dark.

/**
 * The expression is one promise: the IPC basics are read synchronously, the
 * relay answer is awaited with a timeout, and the DOM is read last so the
 * labels are from the same moment as the content.
 */
export function genListScreensExpression() {
    return `(() => {
    const electron = typeof require === 'function' ? require('electron') : null;
    if (electron === null) {
        return { error: 'This page has no node integration' };
    }
    const { ipcRenderer } = electron;
    const showingScreenIds = ipcRenderer.sendSync('main:app:get-screens');
    const all = ipcRenderer.sendSync('main:app:get-displays');
    const primaryId = all && all.primaryDisplay ? all.primaryDisplay.id : null;
    const displays = ((all && all.displays) || []).map((display) => {
        return {
            id: display.id,
            // The words the display button in the screen footer shows, so an
            // answer can name the one the user is looking at.
            label: display.label || undefined,
            width: display.size ? display.size.width : undefined,
            height: display.size ? display.size.height : undefined,
            isPrimary: display.id === primaryId ? true : undefined,
        };
    });
    const basics = {
        isAnyShowing: showingScreenIds.length > 0,
        showingScreenIds,
        displays,
    };

    const clean = (text) => {
        return String(text || '').replace(/\\s+/g, ' ').trim();
    };
    // Where a box sits, in the words a person would use, off the thirds of
    // the window -- the same phrasing owa_find_ui answers with.
    const whereOf = (rect) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        const col = cx < w / 3 ? 'left' : cx > (2 * w) / 3 ? 'right' : 'middle';
        const row = cy < h / 3 ? 'top' : cy > (2 * h) / 3 ? 'bottom' : 'middle';
        if (row === 'middle' && col === 'middle') {
            return 'in the middle of the window';
        }
        if (row === 'middle') {
            return 'at the middle ' + col + ' of the window';
        }
        if (col === 'middle') {
            return 'at the ' + row + ' of the window';
        }
        return 'at the ' + row + ' ' + col + ' of the window';
    };
    const readControls = () => {
        const cards = [...document.querySelectorAll('.mini-screen.card[data-screen-key]')];
        const perScreen = {};
        for (const card of cards) {
            const screenId = Number.parseInt(card.getAttribute('data-screen-key'), 10);
            if (Number.isNaN(screenId)) {
                continue;
            }
            const toggle = card.querySelector('.show-hide[role="button"]');
            const clears = [...card.querySelectorAll('.control-buttons button')]
                .map((button) => {
                    const label = clean(button.getAttribute('title') || button.getAttribute('aria-label'));
                    if (label.length === 0) {
                        return null;
                    }
                    // Painted as an outline when its layer holds nothing --
                    // the app's own "nothing to clear here".
                    const hasSomething = !/btn-outline-/.test(button.className);
                    return { label, hasSomething };
                })
                .filter(Boolean);
            perScreen[screenId] = {
                showHide: toggle === null ? null : clean(toggle.getAttribute('aria-label') || toggle.getAttribute('title')),
                clear: clears,
            };
        }
        return perScreen;
    };
    const readPreviewCard = () => {
        const panel = document.querySelector('[data-widget-name="Mini Screen"]');
        if (panel === null) {
            return null;
        }
        const rect = panel.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return { panel: 'Mini Screen', where: 'collapsed -- its bar is folded away', isCollapsed: true };
        }
        return { panel: 'Mini Screen', where: whereOf(rect), isCollapsed: false };
    };

    return new Promise((resolve) => {
        const request = { token: Math.random().toString(36).slice(2) };
        let isDone = false;
        const finish = (result) => {
            if (isDone) {
                return;
            }
            isDone = true;
            clearTimeout(timer);
            document.removeEventListener('owa-agent-screens-answer', onAnswer);
            const answer = Object.assign({}, basics);
            if (result && result.isError !== true && Array.isArray(result.screens)) {
                if (result.isAuthoritative === false) {
                    answer.note = 'What each screen holds is known only while ' +
                        'the Presenter page is open, and it is not: this ' +
                        'says whether a screen is on and nothing more. ' +
                        'owa_goto_page can switch the main window to it.';
                } else {
                    const controls = readControls();
                    answer.screens = result.screens.map((screen) => {
                        const own = controls[screen.screenId] || null;
                        const display = displays.find((one) => { return one.id === screen.displayId; }) || null;
                        const merged = Object.assign({}, screen, {
                            display: display === null ? undefined : {
                                id: display.id,
                                label: display.label,
                                isPrimary: display.isPrimary,
                            },
                            controls: own,
                        });
                        // Said once, as display, with its name.
                        delete merged.displayId;
                        return merged;
                    });
                    answer.previewCard = readPreviewCard();
                }
            } else {
                answer.note = 'What each screen holds could not be read from this ' +
                    'window' + (result && result.reason ? ': ' + result.reason : '') + '.';
            }
            resolve(answer);
        };
        const onAnswer = (event) => {
            const detail = (event && event.detail) || {};
            if (detail.token !== request.token) {
                return;
            }
            finish(detail.result);
        };
        const timer = setTimeout(() => { finish(null); }, 4000);
        document.addEventListener('owa-agent-screens-answer', onAnswer);
        document.dispatchEvent(new CustomEvent('owa-agent-screens', { detail: request }));
    });
})()`;
}

/**
 * One sentence per screen, for the callers that answer without a model: the
 * offline bot and the `/screen` command. "Screen 0 is showing" said nothing a
 * volunteer could check against the wall; "showing verse 2 of Amazing Grace
 * over a blue background" is something they can look up and see.
 *
 * Plain ESM with no `node:fs` so the renderer can bundle it beside the server,
 * exactly as `questionMatch.mjs` and `botFocus.mjs` are.
 */
// How much of the slide's words a SENTENCE quotes. The tool answer carries
// more, for a model deciding which verse it is; a sentence read by a person
// needs only enough to recognise the line.
const QUOTED_TEXT_LIMIT = 70;

export function describeScreenContent(screen) {
    if (screen === null || typeof screen !== 'object') {
        return '';
    }
    const parts = [];
    if (screen.slide) {
        const { document, kind, name, text } = screen.slide;
        let said = `${kind === 'song' ? 'the song' : `the ${kind}`} "${document}"`;
        if (name) {
            said += ` (${name})`;
        }
        if (text) {
            const quoted = text.length > QUOTED_TEXT_LIMIT
                ? `${text.slice(0, QUOTED_TEXT_LIMIT).trimEnd()}…`
                : text;
            said += ` -- "${quoted}"`;
        }
        parts.push(said);
    }
    if (screen.bible) {
        const { reference, version, versions } = screen.bible;
        const said = versions && versions.length > 1
            ? `${reference} in ${versions.join(', ')}`
            : `${reference} (${version})`;
        parts.push(said);
    }
    if (screen.background) {
        const { kind, name } = screen.background;
        const article = /^[aeiou]/i.test(kind) ? 'an' : 'a';
        parts.push(`${article} ${kind} background${name ? ` (${name})` : ''}`);
    }
    if (Array.isArray(screen.foreground) && screen.foreground.length > 0) {
        parts.push(`foreground: ${screen.foreground.join(', ')}`);
    }
    if (parts.length === 0) {
        return 'nothing on any layer';
    }
    return parts.join('; ');
}
