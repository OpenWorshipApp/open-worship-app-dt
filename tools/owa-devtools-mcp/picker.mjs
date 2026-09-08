// "This one." -- an element picker drawn inside the app window.
//
// Every other way of naming a control goes through WORDS: the words on it, the
// panel it is in, where on screen it sits. That is right for a model reading a
// manual and wrong for a person looking at their own screen, who can point at
// the thing instantly and cannot describe it at all. So the window offers to
// let them point, and what comes back is what `describe` already knows PLUS a
// selector that finds that exact element again.
//
// Two rules shape the whole file:
//
// - **The app must not react to the pick.** The click that chooses a control is
//   swallowed in the capture phase -- pointer-down, pointer-up and click alike,
//   because a Bootstrap dropdown opens on mousedown and would be open before a
//   click handler ever ran. Someone pointing at "Clear Bible" to ask what it
//   does must not clear the bible.
// - **It is a string evaluated in the page**, like `domMatch` and `guide`:
//   dependency free, never importing an app module (that re-runs
//   `document.onkeydown` and kills every shortcut), and leaving nothing behind.

import { DOM_MATCH_RUNTIME } from './domMatch.mjs';

// Long enough to find something on a crowded window, short enough that a
// forgotten picker does not sit over the app through a service. The tool stops
// polling at its own deadline; this is the page's own safety net for the case
// where nobody is polling at all any more.
const PICKER_TIMEOUT_MS = 60000;

export const PICKER_RUNTIME = `
(() => {
    if (window.__owaPicker !== undefined) {
        return window.__owaPicker;
    }
    const dm = ${DOM_MATCH_RUNTIME};
    const state = { phase: 'idle', result: null, startedAt: 0 };
    let host = null;
    let outline = null;
    let hint = null;
    let hovered = null;
    let timer = null;

    const install = () => {
        // Same reason as the guide's: an orphan host from a runtime that was
        // replaced keeps its own listeners and comes first in the document.
        for (const stale of document.querySelectorAll('#owa-picker-host')) {
            stale.remove();
        }
        host = document.createElement('div');
        host.id = 'owa-picker-host';
        // pointer-events:none on the HOST, not just its children: this thing
        // covers the whole window, and 'elementFromPoint' has to see straight
        // through it to the control underneath or the picker would only ever
        // pick itself.
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;' +
            'pointer-events:none';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<style>' +
            '.outline{position:fixed;border:2px solid #00b8d4;border-radius:4px;' +
            'box-shadow:0 0 0 3px rgba(0,184,212,.28);pointer-events:none;' +
            'display:none;transition:all .08s ease-out}' +
            '.hint{position:fixed;left:50%;top:14px;transform:translateX(-50%);' +
            'background:rgba(17,17,17,.92);color:#fff;padding:7px 14px;' +
            'border-radius:999px;font:13px system-ui,sans-serif;' +
            'pointer-events:none;white-space:nowrap;' +
            'box-shadow:0 4px 16px rgba(0,0,0,.4)}' +
            '.name{color:#7fe7f5}' +
            '</style>' +
            '<div class="outline"></div>' +
            '<div class="hint">Click the control you mean' +
            ' <span class="name"></span> &middot; Esc to cancel</div>';
        document.documentElement.appendChild(host);
        outline = root.querySelector('.outline');
        hint = root.querySelector('.name');
    };

    const paint = (element) => {
        hovered = element ?? null;
        if (outline === null) {
            return;
        }
        if (hovered === null) {
            outline.style.display = 'none';
            return;
        }
        const rect = hovered.getBoundingClientRect();
        outline.style.display = 'block';
        outline.style.left = rect.left + 'px';
        outline.style.top = rect.top + 'px';
        outline.style.width = rect.width + 'px';
        outline.style.height = rect.height + 'px';
        if (hint !== null) {
            const label = dm.labelOf(hovered).slice(0, 40);
            hint.textContent = label.length > 0 ? '(' + label + ')' : '';
        }
    };

    // What is under the pointer, raised to something worth picking.
    //
    // 'elementFromPoint' answers with the deepest node, which on a real button
    // is the <i> holding its icon -- an element with no words on it, no role,
    // and a selector nobody can use. So the innermost thing the matcher itself
    // would call a control wins, and only failing that the raw element.
    const targetAt = (x, y) => {
        const found = document.elementFromPoint(x, y);
        if (found === null) {
            return null;
        }
        let current = found;
        for (let step = 0; step < 6; step++) {
            if (current === null || current === document.body) {
                break;
            }
            if (dm.checkIsControl(current) || dm.checkIsRegion(current)) {
                return current;
            }
            current = current.parentElement;
        }
        return found;
    };

    const handleMove = (event) => {
        paint(targetAt(event.clientX, event.clientY));
    };
    // Every press swallowed, in the capture phase, before the app sees it. A
    // dropdown opens on mousedown; a click handler alone would be too late.
    const handlePress = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.type !== 'click') {
            return;
        }
        const target = targetAt(event.clientX, event.clientY) ?? hovered;
        if (target === null) {
            finish('cancelled', null);
            return;
        }
        finish('picked', Object.assign(dm.describe(target), {
            selector: dm.selectorOf(target),
            path: dm.containerPathOf(target),
            // The ways it is named, kept APART. describe's own label JOINS
            // them, which is right for matching and wrong for a chip a person
            // reads: a button whose text and aria-label are the same word
            // comes back as "Setting Setting", and one with a tooltip comes
            // back as its name followed by a whole sentence.
            // (No backticks in this string -- it is a template literal, and
            // one would end it here. The file header says so; this line is
            // what happens when that is forgotten.)
            labelParts: dm.labelPartsOf(target),
        }));
    };
    const handleKey = (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        finish('cancelled', null);
    };

    const listen = (isAdding) => {
        const method = isAdding ? 'addEventListener' : 'removeEventListener';
        document[method]('mousemove', handleMove, true);
        document[method]('mousedown', handlePress, true);
        document[method]('mouseup', handlePress, true);
        document[method]('click', handlePress, true);
        document[method]('keydown', handleKey, true);
    };

    const teardown = () => {
        listen(false);
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (host !== null) {
            host.remove();
            host = null;
        }
        outline = null;
        hint = null;
        hovered = null;
    };

    function finish(phase, result) {
        state.phase = phase;
        state.result = result;
        teardown();
    }

    const start = () => {
        // A second start replaces the first rather than stacking listeners:
        // the window can only be asked to point at one thing at a time.
        teardown();
        state.phase = 'picking';
        state.result = null;
        state.startedAt = Date.now();
        install();
        listen(true);
        timer = setTimeout(() => {
            if (state.phase === 'picking') {
                finish('cancelled', null);
            }
        }, ${PICKER_TIMEOUT_MS});
        return { phase: state.phase };
    };

    const read = () => {
        return { phase: state.phase, result: state.result };
    };

    const stop = () => {
        if (state.phase === 'picking') {
            finish('cancelled', null);
        }
        return { phase: state.phase };
    };

    window.__owaPicker = { start, read, stop };
    return window.__owaPicker;
})()`;

/** Put the picker up and start listening. */
export function genPickerStartExpression() {
    return `(() => {
        const picker = ${PICKER_RUNTIME};
        // The card and the picker are both drawn over the app, and a ring the
        // user cannot click through while pointing at something else is a trap.
        document.dispatchEvent(new CustomEvent('owa-guide-running', {
            detail: { isRunning: true },
        }));
        return picker.start();
    })()`;
}

/** Has the user pointed at something yet? */
export function genPickerReadExpression() {
    return `(() => {
        return window.__owaPicker === undefined
            ? { phase: 'idle', result: null }
            : window.__owaPicker.read();
    })()`;
}

/** Take it down -- on a pick, a cancel, or the caller giving up. */
export function genPickerStopExpression() {
    return `(() => {
        document.dispatchEvent(new CustomEvent('owa-guide-running', {
            detail: { isRunning: false },
        }));
        return window.__owaPicker === undefined
            ? { phase: 'idle' }
            : window.__owaPicker.stop();
    })()`;
}
