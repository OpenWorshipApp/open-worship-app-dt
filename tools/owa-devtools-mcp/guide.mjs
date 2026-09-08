// The interactive guide: a walkthrough drawn INSIDE the app window.
//
// Answering "how do I present a verse?" with a paragraph asks a volunteer to
// hold five steps in their head while looking for five buttons. This instead
// puts a numbered card in the corner of the real window, rings the control the
// current step is about, and waits: the user presses **Next**, or simply does
// the thing -- clicking the ringed control advances the guide by itself.
//
// In `demo` mode the card does the step FOR them: **Do it** clicks the ringed
// control (or types into it), shows what happened, and moves on -- one press
// per step, so nobody is dragged through the app faster than they can watch,
// and **Skip** is always there for a step they would rather do themselves.
//
// Everything here is a string evaluated in the page. It must stay dependency
// free and must NEVER import an app module (that re-runs module top-level code
// and takes the app's keyboard shortcuts down with it). It touches nothing but
// its own elements: no app state, no React tree, no styles outside its own
// shadow root, so a guide can be started, ignored and forgotten with no trace
// left on the service running underneath it.

import {
    BOT_FOCUS_LIST,
    detectBotFocus,
    getBotFocus,
} from './botFocus.mjs';
import { DOM_MATCH_RUNTIME } from './domMatch.mjs';
import { toEnglishOnly } from './help.mjs';

const MAX_STEPS = 20;

// The system prompt tells the model never to show a volunteer an id like
// "W-06", not even in passing -- and a card in front of one still read
// "Open the Background panel (W-08 step 1)". A rule the model can ignore is
// not a rule, so the card strips them out of whatever it is handed: the
// model's own steps, and a recipe's (W-08 step 2 cites W-15 itself).
// The whole aside goes, not just the id -- deleting "W-08" out of
// "(W-08 step 1)" leaves "( step 1)", which is worse than what it replaced,
// and an aside built around an id carries nothing else the user needed.
// The optional letter is `W-01b`, a real recipe id, and without it the id
// left its letter behind ("see b"). This is the one-line sibling of
// `scrubRecipeIds` in help.mjs, which keeps a page's line structure where this
// keeps a step's.
const ID_PATTERN = /\b[A-Z]{1,3}-\d{1,3}[a-z]?\b/g;
const ID_ASIDE_PATTERN =
    /\s*[([][^)\]]*\b[A-Z]{1,3}-\d{1,3}[a-z]?\b[^)\]]*[)\]]/g;


// Installed once per page; re-sent on every call because a reload wipes it.
// Kept in a shadow root so the app's stylesheets cannot reach in and the
// guide cannot leak out.
const GUIDE_RUNTIME = `
(() => {
    if (window.__owaGuide !== undefined) {
        return window.__owaGuide;
    }
    const state = {
        steps: [],
        title: '',
        index: 0,
        isRunning: false,
        isDemo: false,
        canDemo: true,
        wasDemoAsked: false,
        lastAction: null,
        lastResult: null,
        // Where the last action landed. A step that points at a region
        // ('an empty part of the list') has no label to find, and the
        // region the user means is the one the guide was just working
        // in -- a panel opens exactly where the bar that opened it was.
        lastPoint: null,
        // What the last press BROUGHT UP, when the step was not
        // finished by it. The card promises the next press will choose
        // it, so that is what the next press must aim at -- re-reading
        // the step's candidates from the top instead lands on whatever
        // still answers to the FIRST of them, which by then is usually
        // some other control that shares the word.
        pendingFind: null,
        // A step the card could not do. The chat window this walkthrough was
        // asked from is one relay away, it can look at the real window, and
        // it wrote these steps in the first place -- so a stuck step goes and
        // asks it instead of handing the user back a shrug. Null except while
        // one is being asked about, and carrying the token the answer has to
        // match so a guide restarted in the meantime is not written on by an
        // answer to a question its predecessor asked.
        help: null,
        labels: {
            next: 'Next', back: 'Back', done: 'Done', step: 'Step',
            act: 'Do it', skip: 'Skip',
        },
    };
    const host = document.createElement('div');
    host.id = 'owa-guide-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;' +
        'pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = \`
        <style>
            .ring {
                position: fixed; border: 3px solid #ff3b30; border-radius: 6px;
                box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.25);
                pointer-events: none; transition: all 0.15s ease-out;
                display: none;
            }
            /* A still ring says "this is the one". A beating ring says
               "and nothing happens until you press it" -- which is the
               question a volunteer stuck on a step is actually asking. So
               it beats only while the guide is waiting on THEM, and holds
               still while the card is about to do the step itself.
               The COLOUR travels with the beat, red through amber and back.
               Size alone is a weak signal on a window that is mostly boxes
               with borders: a ring that only grows reads as another one of
               them at a glance, while a ring that changes hue is the only
               thing on screen doing it. The still state gets the same
               journey with no geometry, so "I am about to press this" still
               reads as alive rather than as a leftover outline. */
            .ring[data-waiting="yes"] {
                animation: owa-ring-beat 1.4s ease-in-out infinite;
            }
            .ring[data-waiting="no"] {
                animation: owa-ring-glow 2.2s ease-in-out infinite;
            }
            @keyframes owa-ring-beat {
                0%, 100% {
                    box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.3);
                    border-color: #ff3b30;
                }
                50% {
                    box-shadow: 0 0 0 12px rgba(255, 214, 10, 0.05);
                    border-color: #ffd60a;
                }
            }
            @keyframes owa-ring-glow {
                0%, 100% {
                    box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.3);
                    border-color: #ff3b30;
                }
                50% {
                    box-shadow: 0 0 0 4px rgba(255, 214, 10, 0.3);
                    border-color: #ffd60a;
                }
            }
            /* Reduced motion takes the movement, not the meaning: the ring
               keeps its solid red and simply stops travelling. */
            @media (prefers-reduced-motion: reduce) {
                .ring[data-waiting="yes"], .ring[data-waiting="no"] {
                    animation: none;
                }
            }
            /* Frosted, not solid. The card sits ON the app it is talking
               about, and the ring it is pointing with is often right beside
               it -- an opaque slab hides the very thing the step names, and
               the person following it has already been asked once to drag the
               card out of the way. The blur is what keeps it readable over a
               busy slide; the region is one small card, so it stays cheap.
               Where the engine cannot blur, the tint goes back to solid
               rather than leaving text floating on the app. */
            .card {
                position: fixed; right: 16px; bottom: 16px; width: 320px;
                max-width: calc(100vw - 32px);
                background: rgba(14, 19, 26, 0.62); color: #f2f5f8;
                backdrop-filter: blur(18px) saturate(140%);
                -webkit-backdrop-filter: blur(18px) saturate(140%);
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                font: 14px/1.45 system-ui, -apple-system, sans-serif;
                pointer-events: auto; display: none; overflow: hidden;
            }
            @supports not (backdrop-filter: blur(1px)) {
                .card { background: #10151c; }
            }
            .head {
                display: flex; align-items: center; justify-content: space-between;
                gap: 8px; padding: 8px 12px;
                background: rgba(255, 255, 255, 0.06);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                cursor: move; user-select: none; touch-action: none;
            }
            .title { font-weight: 600; font-size: 13px; }
            .count { font-size: 12px; opacity: 0.7; white-space: nowrap; }
            .body { padding: 12px; }
            .text { margin: 0 0 4px; }
            .hint { margin: 6px 0 0; font-size: 12px; opacity: 0.65; }
            /* Except when it carries an answer the assistant went and got:
               that is not a footnote about the step, it IS what to do now,
               and 65% of 12px is how you make someone miss it. */
            .hint[data-help="answered"] {
                opacity: 1; font-size: 13px;
                border-left: 2px solid #ffd60a; padding-left: 8px;
            }
            .foot { display: flex; gap: 8px; padding: 0 12px 12px; }
            button {
                flex: 1; padding: 7px 10px; border-radius: 6px; cursor: pointer;
                font: inherit; font-size: 13px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                background: rgba(255, 255, 255, 0.08); color: #f2f5f8;
            }
            button:hover { background: rgba(255, 255, 255, 0.16); }
            /* The one press that does something stays solid: it is the anchor
               the eye lands on, and glass on glass would bury it. */
            button.primary { background: #0d6efd; border-color: #0d6efd; }
            button.primary:hover { background: #2a80ff; }
            button:disabled { opacity: 0.4; cursor: default; }
            .close {
                flex: 0 0 auto; width: 28px; padding: 2px 0; background: none;
                border: none; opacity: 0.7; font-size: 16px;
            }
        </style>
        <div class="ring"></div>
        <div class="card">
            <div class="head">
                <span class="title"></span>
                <span style="display:flex;align-items:center;gap:6px">
                    <span class="count"></span>
                    <button class="close" title="Stop">&times;</button>
                </span>
            </div>
            <div class="body">
                <p class="text"></p>
                <p class="hint"></p>
            </div>
            <div class="foot">
                <button class="back"></button>
                <button class="skip"></button>
                <button class="next primary"></button>
            </div>
        </div>
    \`;
    // A card from a runtime that is no longer reachable. Only one thing makes
    // one: deleting window.__owaGuide to pick up an edited guide.mjs, which is
    // the documented way to do exactly that. The orphan keeps its own click
    // handlers, and it comes FIRST in the document -- so a getElementById in a
    // verification script drives the dead card and reads the live one as
    // broken. Cost a whole debugging session; it is two lines.
    for (const stale of document.querySelectorAll('#owa-guide-host')) {
        stale.remove();
    }
    document.documentElement.appendChild(host);
    const ring = root.querySelector('.ring');
    const card = root.querySelector('.card');
    const parts = {
        title: root.querySelector('.title'),
        count: root.querySelector('.count'),
        text: root.querySelector('.text'),
        hint: root.querySelector('.hint'),
        back: root.querySelector('.back'),
        skip: root.querySelector('.skip'),
        next: root.querySelector('.next'),
        close: root.querySelector('.close'),
    };

    // The card is a floating widget, not furniture bolted to the corner: the
    // control a step is about is often underneath it, and the person following
    // the guide is the only one who knows what is in the way. So the head row
    // is a drag handle, and the card stays where it was left for the rest of
    // the walkthrough. Always kept fully inside the window -- a card dragged
    // off the edge could not be dragged back.
    const head = root.querySelector('.head');
    const placement = { left: null, top: null, wasMoved: false };
    const clampCard = () => {
        if (placement.left === null) {
            return;
        }
        const maxLeft = Math.max(0, innerWidth - card.offsetWidth);
        const maxTop = Math.max(0, innerHeight - card.offsetHeight);
        placement.left = Math.min(Math.max(placement.left, 0), maxLeft);
        placement.top = Math.min(Math.max(placement.top, 0), maxTop);
        card.style.left = placement.left + 'px';
        card.style.top = placement.top + 'px';
        card.style.right = 'auto';
        card.style.bottom = 'auto';
    };
    // The card sits in a corner and the ring lands wherever the control is,
    // so sooner or later the card is parked on top of the one thing it is
    // pointing at -- and the person following the step is looking at a step
    // that says "the ringed control", with no ring in sight. Frosted glass
    // was not enough: a control read through an 18px blur is not a control
    // you can find. So the card moves itself out of the way.
    // Corners only, and the current one first: a card that slides a few
    // pixels every time the ring twitches is worse than one that is briefly
    // in the way. It never moves once the user has dragged it -- they know
    // what is underneath it and the guide does not.
    const CARD_GAP = 16;
    const avoidRing = () => {
        if (placement.wasMoved || ring.style.display === 'none') {
            return;
        }
        const target = ring.getBoundingClientRect();
        if (target.width === 0 && target.height === 0) {
            return;
        }
        const width = card.offsetWidth;
        const height = card.offsetHeight;
        if (width === 0 || height === 0) {
            return;
        }
        const maxLeft = Math.max(0, innerWidth - width - CARD_GAP);
        const maxTop = Math.max(0, innerHeight - height - CARD_GAP);
        // Bottom right first: where the card lives unless something is in
        // the way, so a ring nowhere near it never moves it at all.
        const corners = [
            { left: maxLeft, top: maxTop },
            { left: CARD_GAP, top: maxTop },
            { left: maxLeft, top: CARD_GAP },
            { left: CARD_GAP, top: CARD_GAP },
        ];
        let bestCorner = null;
        for (const corner of corners) {
            // The ring is drawn 3px outside its control and beats outward;
            // clearing it by a margin is what keeps the two visibly apart.
            const overlapX = Math.max(
                0,
                Math.min(corner.left + width, target.x + target.width + 12) -
                    Math.max(corner.left, target.x - 12),
            );
            const overlapY = Math.max(
                0,
                Math.min(corner.top + height, target.y + target.height + 12) -
                    Math.max(corner.top, target.y - 12),
            );
            const overlap = overlapX * overlapY;
            if (overlap === 0) {
                bestCorner = corner;
                break;
            }
            // Every corner covered (a ring bigger than the gaps between
            // them): the least bad one still shows the most of it.
            if (bestCorner === null || overlap < bestCorner.overlap) {
                bestCorner = Object.assign({ overlap }, corner);
            }
        }
        if (
            placement.left === bestCorner.left &&
            placement.top === bestCorner.top
        ) {
            return;
        }
        placement.left = bestCorner.left;
        placement.top = bestCorner.top;
        clampCard();
    };

    let grab = null;
    const endGrab = () => {
        grab = null;
    };
    head.addEventListener('pointerdown', (event) => {
        // The stop button lives in this row: a press on it is not a drag.
        if (event.button !== 0 || event.target.closest('button') !== null) {
            return;
        }
        const rect = card.getBoundingClientRect();
        grab = { x: event.clientX - rect.x, y: event.clientY - rect.y };
        placement.left = rect.x;
        placement.top = rect.y;
        // From here the card is where the USER put it. The avoidance below
        // stands down for the rest of the walkthrough: it exists to save
        // them a drag, not to undo one.
        placement.wasMoved = true;
        // Keeps the pointer with the handle when the hand outruns the card;
        // the window listeners below are what actually move it, so a browser
        // that refuses the capture still drags.
        try {
            head.setPointerCapture(event.pointerId);
        } catch {
            // Nothing to do: the drag works without it.
        }
        // Or the drag selects the step's text instead of moving the card.
        event.preventDefault();
    });
    // On the window, not the handle: a fast drag leaves the handle behind, and
    // the press can end anywhere. They cost nothing while nothing is grabbed.
    addEventListener('pointermove', (event) => {
        if (grab === null) {
            return;
        }
        placement.left = event.clientX - grab.x;
        placement.top = event.clientY - grab.y;
        clampCard();
    });
    addEventListener('pointerup', endGrab);
    addEventListener('pointercancel', endGrab);
    // A window made smaller must not leave the card outside it.
    addEventListener('resize', clampCard);

    let watchedElement = null;
    // Which step the view was last scrolled for, so a re-draw never scrolls.
    let scrollIntoViewFor = null;
    const handleWatchedClick = () => { api.next('user-did-it'); };
    // The keystroke half of the same idea: a step that says "press Ctrl+Q"
    // has no control to ring and so nothing to watch for a click, but the
    // user pressing it themselves is exactly as much of an answer. Only
    // armed while such a step is showing, and torn down with everything else.
    let watchedKeys = null;
    // Raised only around the guide's own dispatch below. The step it just
    // performed must not ALSO count as the user doing it and skip the next
    // one -- and this says so explicitly rather than leaning on isTrusted,
    // which would also ignore a press driven through the MCP tools, where
    // advancing is the right answer.
    let isSelfPressing = false;
    const handleWatchedKey = (event) => {
        const keys = watchedKeys;
        if (keys === null || isSelfPressing) {
            return;
        }
        if (
            event.key === keys.key &&
            event.ctrlKey === !!keys.ctrlKey &&
            event.altKey === !!keys.altKey &&
            event.shiftKey === !!keys.shiftKey &&
            event.metaKey === !!keys.metaKey
        ) {
            api.next('user-did-it');
        }
    };
    // Long enough to outlast the 700ms reposition that re-arms it,
    // short enough that a guide which stops mid-step hands the
    // window back before the user notices it was held.
    const HOVER_HOLD_MS = 2500;

    const unwatch = () => {
        if (watchedElement !== null) {
            watchedElement.removeEventListener('click', handleWatchedClick, true);
            watchedElement = null;
        }
        if (watchedKeys !== null) {
            removeEventListener('keydown', handleWatchedKey, true);
            watchedKeys = null;
        }
    };

    // The one thing this card cannot do for itself: the help window it was
    // asked from is a separate OS window sitting ON TOP of this one, so the
    // control a step rings can be behind it and the user is told to press
    // something they cannot see. Only the main process can move that window,
    // and only this runtime knows when a walkthrough starts and ends -- so
    // say so out loud and let the app relay it. A DOM event, not an import:
    // importing an app module from an injected expression re-runs its
    // top-level code and kills every keyboard shortcut in the window.
    let wasRunning = false;
    const signal = () => {
        if (state.isRunning === wasRunning) {
            return;
        }
        wasRunning = state.isRunning;
        try {
            document.dispatchEvent(new CustomEvent('owa-guide-running', {
                detail: { isRunning: state.isRunning },
            }));
        } catch (_error) {
            // A window with nothing listening is the normal case for an
            // outside agent; the walkthrough itself does not depend on it.
        }
    };

    // A step the card could not perform used to end here, with an apology:
    // "I could not do that one for you - do it yourself, then press Skip."
    // Honest, and the end of the road. 68 of the manual's 251 steps name no
    // control the card can press, and a quarter of a walkthrough that shrugs
    // is a walkthrough a volunteer stops trusting.
    //
    // But the assistant that started this guide is still there, it can look
    // at the real window through its tools, and it can rewrite the guide from
    // this step. So the card ASKS it. Same relay as the running signal above,
    // for the same reason: this runtime is an injected expression that may
    // not import an app module, so a DOM event is all it is allowed to reach
    // the app with.
    //
    // Once per step per run. A second press of a step the assistant has
    // already been consulted about gets the plain apology -- asking again
    // would spend another round of the user's own API credit on the question
    // that just came back unanswerable.
    const HELP_WAIT_MS = 30000;
    const HELP_TEXT_MAX = 400;
    let helpToken = 0;
    let helpTimer = null;
    let askedHelpAt = [];
    const askForHelp = (result) => {
        const step = state.steps[state.index];
        if (step === undefined || askedHelpAt.indexOf(state.index) !== -1) {
            return false;
        }
        askedHelpAt.push(state.index);
        helpToken += 1;
        const token = helpToken;
        state.help = { token: token, status: 'asking', text: null };
        // Nothing may be listening at all -- an outside agent driving the app,
        // AI switched off, the chat window closed -- and a card that sits on
        // "asking the assistant" for the rest of the service is worse than the
        // apology it replaced. So the wait is bounded and falls back to it.
        clearTimeout(helpTimer);
        helpTimer = setTimeout(() => {
            if (state.help !== null && state.help.token === token &&
                state.help.status === 'asking') {
                state.help = { token: token, status: 'unavailable', text: null };
                render();
            }
        }, HELP_WAIT_MS);
        try {
            document.dispatchEvent(new CustomEvent('owa-guide-help', {
                detail: {
                    token: token,
                    title: state.title,
                    stepNumber: state.index + 1,
                    stepCount: state.steps.length,
                    stepText: step.text,
                    reason: result.reason ?? '',
                    // What the card looked for and what it found instead:
                    // the assistant is being asked to fix an aim, and these
                    // two are the aim and the miss.
                    looked: (step.finds ?? [step.find]).filter(Boolean),
                    nearMisses: (result.nearMisses ?? []).slice(0, 8),
                },
            }));
        } catch (_error) {
            state.help = { token: token, status: 'unavailable', text: null };
            return false;
        }
        return true;
    };

    // The answer, relayed back into this window the same way. Ignored unless
    // it answers the question the card is still waiting on: the assistant may
    // have restarted the guide outright while thinking about it, and the new
    // card must not be written on by the old card's rescue.
    document.addEventListener('owa-guide-help-answer', (event) => {
        const detail = (event && event.detail) || {};
        if (state.help === null || detail.token !== state.help.token) {
            return;
        }
        clearTimeout(helpTimer);
        // Through the SAME sieve as a step (stripInternalIds): this lands on
        // the card, and the rule that a volunteer is never shown an id like
        // "W-06" does not stop applying because the sentence arrived by a
        // different road. The patterns are interpolated rather than copied so
        // there is one place they are written down.
        const text = String(detail.text ?? '')
            .replace(new RegExp(${JSON.stringify(ID_ASIDE_PATTERN.source)}, 'g'), '')
            .replace(new RegExp(${JSON.stringify(ID_PATTERN.source)}, 'g'), '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([.,;:)])/g, '$1')
            .trim();
        state.help = {
            token: state.help.token,
            status: text.length > 0 ? 'answered' : 'unavailable',
            text: text.slice(0, HELP_TEXT_MAX),
        };
        render();
    });

    // A step whose instruction IS a keystroke. Dispatched at the document
    // because that is where the app listens -- one document.onkeydown feeds
    // every shortcut it has registered -- and carrying the code as well as
    // the key because the app forces the key back through an en-US layout
    // before matching it. keyup follows keydown so a listener that pairs
    // them is not left holding a key down forever.
    const pressKeys = (keys) => {
        const init = {
            key: keys.key,
            code: keys.code,
            ctrlKey: !!keys.ctrlKey,
            altKey: !!keys.altKey,
            shiftKey: !!keys.shiftKey,
            metaKey: !!keys.metaKey,
            bubbles: true,
            cancelable: true,
            composed: true,
        };
        isSelfPressing = true;
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', init));
            document.dispatchEvent(new KeyboardEvent('keyup', init));
        } finally {
            isSelfPressing = false;
        }
        return { done: true, did: 'pressed', keys: keys.label };
    };

    // The shared matcher (domMatch.mjs): one way of answering "which
    // element IS 'Bible Lookup'?" for the guide, owa_find_ui, owa_click
    // and owa_type alike, so a label one tool can see they all can.
    const dm = ${DOM_MATCH_RUNTIME};

    // Every candidate the step offered, in order, until one is actually on
    // screen: a step reads "Press Ctrl+B (or click Bible Lookup in the
    // header)", and only the second half of that is a thing to point at.
    const findMatch = (step) => {
        if (state.pendingFind !== null) {
            const pending = dm.findBest([state.pendingFind]);
            if (pending !== null) {
                return pending;
            }
        }
        const wanted = (step.finds ?? [step.find]).filter(Boolean);
        if (wanted.length === 0) {
            return null;
        }
        return dm.findBest(wanted, { preferPressSafe: true });
    };
    const findElement = (step) => {
        const match = findMatch(step);
        return match === null ? null : match.element;
    };

    // The words the card says for this step's control: the label the ring
    // actually landed on when there is one -- a step offers several and the
    // first is not always the one on screen (W-08's "pick a tab" led with
    // "Ok", a button on a dialog that was not open) -- and otherwise the
    // first candidate that reads like a label rather than a bolded sentence.
    const nameOf = (step, match) => {
        if (match !== null && match !== undefined && match.needle) {
            return toSpoken(match.needle);
        }
        const wanted = (step.finds ?? [step.find]).filter(Boolean);
        const short = wanted.find((one) => {
            return String(one).length <= 40;
        });
        return toSpoken(short ?? wanted[0] ?? null);
    };

    // What stands between the user and this control. A control can be on
    // screen by every measure the matcher has -- laid out, painted, enabled --
    // and still be behind the Bible Lookup popup, which the app draws over the
    // whole window. Reported from a real service (2026-09-08, screenshot): the
    // card rang the Images tab THROUGH the popup, the ring landed on a line of
    // Genesis, and Do it clicked a tab nobody could see and moved on. The
    // topmost element at the control's own centre says it: the control, or a
    // child, or an ancestor of it, is reachable; anything else is in the way.
    // The guide's own host takes no pointer events and is never listed.
    const coverOf = (element) => {
        // jsdom has no hit-testing; there, nothing is ever in the way.
        if (typeof document.elementsFromPoint !== 'function') {
            return null;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return null;
        }
        const x = Math.min(innerWidth - 1, Math.max(0, rect.x + rect.width / 2));
        const y = Math.min(innerHeight - 1, Math.max(0, rect.y + rect.height / 2));
        const hits = document.elementsFromPoint(x, y);
        for (const hit of hits) {
            if (hit === host) {
                continue;
            }
            if (hit === element || element.contains(hit) || hit.contains(element)) {
                return null;
            }
            return hit;
        }
        return null;
    };

    // The layer a cover belongs to, in words a volunteer can act on. The app
    // has two: its popups (the Bible Lookup, drawn in the modal container with
    // a red close button of its own), and the questions it asks -- confirm,
    // alert, input -- which block everything until they are answered and
    // which this card must never answer for anyone: "click Delete, then Yes"
    // would confirm its own dialog. Anything else in front (a menu, a toast)
    // is named as such and left alone; a click still reaches the control.
    // The target is the control the cover is in front of. A layer the target
    // is INSIDE is not in its way: the Foreground widgets are floating
    // panels, and a header bar over one of their labels read as a cover --
    // so the card closed the very panel holding the control (2026-09-08).
    const layerOf = (cover, target = null) => {
        const root = cover.closest(
            '#modal-container, #app-context-menu-container, .floating-widget',
        );
        if (root !== null && target !== null && root.contains(target)) {
            return null;
        }
        const modal = cover.closest('#modal-container');
        if (modal !== null) {
            if (modal.classList.contains('modal-container--blocking') ||
                modal.querySelector(
                    '#app-confirm-popup, #app-alert-popup, #app-input-popup',
                ) !== null) {
                return { kind: 'question', short: 'the question',
                    name: 'a question the app is asking', closer: null };
            }
            const icon = modal.querySelector('button.btn-danger i.bi-x-lg');
            return { kind: 'popup', short: 'the popup',
                name: 'the popup that is open',
                closer: icon === null ? null : icon.closest('button') };
        }
        // A right-click menu sits on a backdrop that closes it when clicked
        // anywhere outside the menu -- so the backdrop is its closer, and
        // there is nothing sensible to ring: the way out is the whole
        // window.
        const menu = cover.closest('#app-context-menu-container');
        if (menu !== null) {
            return { kind: 'menu', short: 'the menu',
                name: 'the menu that is open', closer: menu };
        }
        // A floating panel (the names lookup, a colour picker) carries its
        // own close button in its toolbar.
        const widget = cover.closest('.floating-widget');
        if (widget !== null) {
            const icon = widget.querySelector(
                '.floating-widget__button i.bi-x-lg',
            );
            return { kind: 'popup', short: 'the floating panel',
                name: 'the floating panel that is open',
                closer: icon === null ? null : icon.closest('button') };
        }
        return { kind: 'other', short: 'something',
            name: 'something else on the window', closer: null };
    };

    // A needle can say where to look as well as what to look for
    // ("Background > Videos"). The card is read by a volunteer, so it says
    // the thing, and the panel it is in comes from the element the ring
    // actually landed on -- which is the truth, where the needle is only the
    // request.
    const toSpoken = (needle) => {
        const parts = String(needle ?? '').split('>');
        return parts[parts.length - 1].trim();
    };

    const renderStep = () => {
        const step = state.steps[state.index];
        if (!state.isRunning || step === undefined) {
            card.style.display = 'none';
            ring.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        delete parts.hint.dataset.help;
        parts.title.textContent = state.title;
        parts.count.textContent = state.labels.step + ' ' + (state.index + 1) +
            '/' + state.steps.length;
        parts.text.textContent = step.text;
        parts.back.textContent = state.labels.back;
        parts.back.disabled = state.index === 0;
        parts.skip.hidden = !state.isDemo;
        parts.skip.textContent = state.labels.skip;
        const isLast = state.index === state.steps.length - 1;
        // A look-step has nothing to do for anyone: its button says Next
        // even in demo mode, so nobody presses Do it on a thing to notice.
        parts.next.textContent = state.isDemo && !isLast && step.kind !== 'look'
            ? state.labels.act
            : (isLast ? state.labels.done : state.labels.next);
        unwatch();
        const match = findMatch(step);
        const target = match === null ? null : match.element;
        const named = nameOf(step, match);
        if (target === null) {
            ring.style.display = 'none';
            // Not an error: plenty of steps are "type the book name" or "wait
            // for it to load", with nothing on screen to point at. But a step
            // that names a keystroke has something to offer even so -- and in
            // demo mode that is a button that works, not an apology.
            if (step.kind === 'look') {
                parts.hint.textContent = 'Nothing to press for this one — ' +
                    'it is something to notice in the window behind me. ' +
                    'Press ' + (isLast ? state.labels.done : state.labels.next) +
                    ' when you have.';
                return;
            }
            if (step.keys != null) {
                watchedKeys = step.keys;
                addEventListener('keydown', handleWatchedKey, true);
                parts.hint.textContent = state.isDemo
                    ? 'Press ' + state.labels.act + ' and I will press ' +
                        step.keys.label + ' for you.'
                    : 'Press ' + step.keys.label + ' — I will notice when ' +
                        'you do.';
                return;
            }
            if (state.isDemo && step.action === 'rightClick') {
                parts.hint.textContent = 'Press ' + state.labels.act +
                    ' and I will right-click the list for you, then press it ' +
                    'again to choose' + (named ? ' "' + named + '"' : '') + '.';
                return;
            }
            parts.hint.textContent = named
                ? 'Look for "' + named + '" in the window behind me.'
                : 'Do this step in the window behind me.';
            return;
        }
        // Some of what this window can do is only painted while
        // the mouse is over the part of the window it lives in --
        // the row of icons above a bible view is six of them. A
        // ring around one of those points at nothing, so the card
        // holds it visible instead. The hold is short and re-armed
        // by every reposition, so it lapses on its own the moment
        // the guide moves on or stops.
        // A loose fit is pointed at in words, never ringed: a ring says
        // "this one", and the tiers under an exact name say "one like it".
        if (match !== null && match.isPressSafe !== true) {
            ring.style.display = 'none';
            const seen = (dm.labelPartsOf(target)[0] ?? '').slice(0, 40);
            parts.hint.textContent = 'Look for "' + named + '" in the window ' +
                'behind me. The closest thing I can see is "' + seen +
                '", which may not be it.';
            return;
        }
        const isHeldVisible = dm.revealHidden(target, HOVER_HOLD_MS);
        const rect = target.getBoundingClientRect();
        if (dm.visibilityOf(target) === 'gone') {
            ring.style.display = 'none';
            parts.hint.textContent = '"' + named + '" is not on screen right ' +
                'now — open the panel or tab it belongs to first.';
            return;
        }
        // Behind a popup: ring the way OUT of the popup, not the control
        // under it. A ring drawn through the popup lands on whatever the
        // popup paints there, and the user is told to press a line of
        // scripture. In demo mode the next press closes the popup; in show
        // mode the user does, and the card notices the button go and
        // draws the step again.
        const cover = coverOf(target);
        const layer = cover === null ? null : layerOf(cover, target);
        if (layer !== null && layer.kind === 'question') {
            ring.style.display = 'none';
            parts.hint.textContent = '"' + named + '" is behind ' +
                layer.name + ' — answer that first, and I will carry on.';
            return;
        }
        if (layer !== null && layer.kind === 'menu') {
            ring.style.display = 'none';
            parts.hint.textContent = '"' + named + '" is behind ' +
                layer.name + '. ' + (state.isDemo
                    ? 'Press ' + state.labels.act + ' and I will close ' +
                        'the menu first, then press it again for this step.'
                    : 'Press Escape (or click anywhere outside the menu) ' +
                        'and I will carry on.');
            watchedElement = layer.closer;
            return;
        }
        if (layer !== null && layer.kind === 'popup' && layer.closer !== null) {
            const closerRect = layer.closer.getBoundingClientRect();
            ring.style.display = 'block';
            ring.dataset.waiting = 'yes';
            ring.style.left = (closerRect.x - 3) + 'px';
            ring.style.top = (closerRect.y - 3) + 'px';
            ring.style.width = closerRect.width + 'px';
            ring.style.height = closerRect.height + 'px';
            avoidRing(closerRect);
            parts.hint.textContent = '"' + named + '" is behind ' +
                layer.name + '. ' + (state.isDemo
                    ? 'Press ' + state.labels.act + ' and I will close ' +
                        layer.short + ' first, then press it again for ' +
                        'this step.'
                    : 'Close it with the ringed ✕ and I will carry on.');
            // Held for repositioning only: closing the popup is not doing
            // the step, so this click must not advance the guide.
            watchedElement = layer.closer;
            return;
        }
        // Only when the step CHANGES, never on a re-draw: the ring is kept on
        // the control by a repeating render, and scrolling from there fights
        // the user for the scrollbar -- look away from the ringed control for
        // a moment and it drags the panel back under you.
        if (scrollIntoViewFor !== state.index) {
            scrollIntoViewFor = state.index;
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        const shown = target.getBoundingClientRect();
        ring.style.display = 'block';
        // Demo mode is about to press this for them; anything else is the
        // guide standing still until they do.
        ring.dataset.waiting =
            !state.isDemo || state.lastAction === 'demo-could-not'
                ? 'yes'
                : 'no';
        ring.style.left = (shown.x - 3) + 'px';
        ring.style.top = (shown.y - 3) + 'px';
        ring.style.width = shown.width + 'px';
        ring.style.height = shown.height + 'px';
        avoidRing(shown);
        // Which panel it is in beats any amount of "top left": a window this
        // busy has four panels in every corner, and the panel is the word the
        // user can actually look for.
        const inPanel = dm.describe(target).inPanel;
        parts.hint.textContent = (state.isDemo
            ? 'Press ' + state.labels.act + ' and I will ' +
                (step.action === 'type' ? 'type it' : 'click it') + ' for you. '
            : '') + (isHeldVisible
            ? 'This one only shows while the mouse is over it, so I ' +
                'am holding it up for you. '
            : '') + 'The ringed control is ' +
            (inPanel === null ? '' : 'in the ' + inPanel + ' panel, ') +
            'at the ' +
            (shown.y < innerHeight / 3 ? 'top' :
                (shown.y > innerHeight * 2 / 3 ? 'bottom' : 'middle')) + ' ' +
            (shown.x < innerWidth / 3 ? 'left' :
                (shown.x > innerWidth * 2 / 3 ? 'right' : 'center')) +
            ' of this window.' + (layer === null ? '' :
                ' Something is in front of it right now — close that first.');
        watchedElement = target;
        target.addEventListener('click', handleWatchedClick, true);
    };

    // Moving the ring back onto a control we ALREADY hold, which is all a
    // scroll or a re-layout underneath it needs: one getBoundingClientRect,
    // no document query. The full renderStep -- which queries every button,
    // link, input and [title] in the app and measures each one -- is worth
    // paying only when there is nothing valid to point at any more.
    const reposition = () => {
        if (!state.isRunning || watchedElement === null) {
            return;
        }
        if (!watchedElement.isConnected) {
            render();
            return;
        }
        const rect = watchedElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            render();
            return;
        }
        // The forced hover lapses by itself; this is what keeps it
        // up while the step is still being read. Re-arming an
        // existing hold is a timer reset, not a second reveal, and
        // a control that never needed one costs a single question.
        dm.revealHidden(watchedElement, HOVER_HOLD_MS);
        ring.style.left = (rect.x - 3) + 'px';
        ring.style.top = (rect.y - 3) + 'px';
        ring.style.width = rect.width + 'px';
        ring.style.height = rect.height + 'px';
        // The control can move under the card without the step changing --
        // a panel opening, a list scrolling -- so this is checked on every
        // reposition, not only when a new step is drawn.
        avoidRing(rect);
    };

    // Only while a guide is actually on screen. The old timer was installed
    // for the life of the page by any owa_guide_* call -- a bare status()
    // included -- and never cleared, so a window that had once been asked
    // anything kept waking up every 700ms for the rest of the service.
    let trackId = null;
    const untrack = () => {
        if (trackId !== null) {
            clearInterval(trackId);
            trackId = null;
        }
    };
    const track = () => {
        if (trackId !== null) {
            return;
        }
        trackId = setInterval(() => {
            if (!state.isRunning) {
                untrack();
                return;
            }
            // Nothing held: the step's control has not rendered yet (or has
            // gone), which is the one case worth a full search.
            if (watchedElement === null) {
                render();
                return;
            }
            reposition();
        }, 700);
    };

    // Whatever a draw ends up writing, the card must still be inside the
    // window afterwards. Once avoidRing (or a drag) has pinned a top the card
    // no longer hangs off the bottom edge by itself, so a hint that GROWS --
    // which is exactly what an assistant's rescue does -- pushes its own
    // buttons out of sight. Wrapped rather than added to each branch below,
    // because every one of them ends in a return.
    const render = () => {
        renderHint();
        clampCard();
    };

    // Said after the step is drawn, not before: the branch that finds nothing
    // to ring writes the hint too, and used to wipe this.
    const renderHint = () => {
        renderStep();
        if (state.isRunning) {
            track();
        } else {
            untrack();
        }

        if (state.lastAction === 'started' && state.wasDemoAsked &&
            !state.canDemo) {
            parts.hint.textContent = 'I cannot press these steps for you — ' +
                'they are things to do in the page itself, not buttons. I ' +
                'will walk you through them instead.';
            return;
        }
        if (state.lastAction === 'demo-did-it' && state.lastResult !== null &&
            state.lastResult.more !== undefined) {
            parts.hint.textContent = 'Done - and it brought up "' +
                state.lastResult.more + '". Press ' + state.labels.act +
                ' again to finish this step.';
            return;
        }
        if (state.lastAction === 'demo-did-it' && state.lastResult !== null &&
            state.lastResult.did === 'closed') {
            // The popup closes on the app's own event loop: the control may
            // still be covered on this draw and free on the next one, which
            // the tracker makes for itself. The words do not depend on it.
            parts.hint.textContent = 'I closed ' + state.lastResult.closed +
                ', which was in the way. Press ' + state.labels.act +
                ' again and I will do this step.';
            return;
        }
        if (state.lastAction === 'demo-could-not' && state.lastResult !== null) {
            // Being asked, or answered: the assistant is looking at the real
            // window and knows more about this step than the card does, so
            // whatever it says outranks the card's own apology.
            if (state.help !== null && state.help.status === 'asking') {
                parts.hint.textContent = 'That did not work — I am asking ' +
                    'the assistant to look at your window…';
                return;
            }
            if (state.help !== null && state.help.status === 'answered') {
                parts.hint.textContent = state.help.text;
                parts.hint.dataset.help = 'answered';
                return;
            }
            parts.hint.textContent = 'I could not do that one for you (' +
                state.lastResult.reason + ') - do it yourself, then press ' +
                state.labels.skip + '.';
        }
    };

    // Driven from the card's own button, or from the owa_guide_step tool with
    // action "do". It clicks or types into the element the step names and
    // nothing else -- no scripted sequence runs behind the user's back. Async
    // because a step can land before its panel has finished rendering: ask
    // again for a moment before declaring nothing on screen, and say which
    // labels WERE seen so the caller can retry with real words.
    // Which of the step's own labels are NOT on screen right now. If one
    // appears BECAUSE of the press -- the menu item behind the menu the step
    // told you to open -- the step is not finished, and the card says so
    // instead of moving on. It is never clicked for them: "click Delete,
    // then Yes" would otherwise confirm its own dialog.
    const missingOf = (step) => {
        return (step.finds ?? [step.find]).filter(Boolean).filter((one) => {
            return dm.findBest([one]) === null;
        });
    };

    const rememberPoint = (element) => {
        const rect = element.getBoundingClientRect();
        state.lastPoint = {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
        };
    };

    const perform = async () => {
        const step = state.steps[state.index];
        if (step === undefined) {
            return { done: false, reason: 'no step' };
        }
        if (step.kind === 'look') {
            // Driven through the tool: there is nothing to do and nothing
            // went wrong, so the card moves on as it would on Next.
            return { done: true, did: 'looked' };
        }
        const missingBefore = missingOf(step);
        // Done AND still not finished: report what the press revealed rather
        // than letting the card march on to the next step with a menu open.
        const withMore = async (result) => {
            // Aimed at once: whatever happens next, the step is no longer
            // waiting on the thing the PREVIOUS press brought up.
            state.pendingFind = null;
            if (!result.done || missingBefore.length === 0) {
                return result;
            }
            const appeared = await dm.waitForBest(missingBefore, 900);
            if (appeared === null || appeared.element === null) {
                return result;
            }
            state.pendingFind = appeared.needle;
            // The step's OWN words, not the element's joined names: a menu
            // item carrying both text and a title reads back as "Download
            // From URL Download From URL", and the card is quoting this to
            // the user.
            return Object.assign(result, {
                more: String(appeared.needle).slice(0, 40),
            });
        };
        let match = findMatch(step);
        let target = match === null ? null : match.element;
        // A step reading "right-click the list and choose X" is two actions.
        // While X is not on screen the press opens the menu; once it is, the
        // very same press chooses it. One press, one action, either way --
        // and the region is only reached for when there is no control.
        if (target === null && step.action === 'rightClick') {
            const region = dm.findListRegion(state.lastPoint);
            if (region !== null) {
                unwatch();
                rememberPoint(region);
                const at = dm.openContextMenu(region);
                return await withMore({ done: true, did: 'right-clicked', at });
            }
        }
        if (target === null) {
            const wanted = (step.finds ?? [step.find]).filter(Boolean);
            // Nothing was named to wait FOR, so there is nothing to wait for:
            // a pure keystroke step would otherwise stall a second and a half
            // before doing the one thing it could always have done.
            const waited =
                wanted.length === 0
                    ? { element: null, nearMisses: [] }
                    : await dm.waitForBest(wanted, 1500, {
                          preferPressSafe: true,
                      });
            if (waited.element === null) {
                // The control is not there -- but the step may still have
                // said how to do it without one.
                if (step.keys != null) {
                    unwatch();
                    return pressKeys(step.keys);
                }
                return {
                    done: false,
                    reason: 'nothing on screen to act on',
                    nearMisses: waited.nearMisses,
                };
            }
            match = waited;
            target = waited.element;
        }
        // Close enough to point at is not close enough to PRESS. The
        // matcher's looser tiers exist so a ring can land near a misspelt
        // step; taken as the thing itself they pressed the projector's
        // Clear All for a step about the drawing panel's Clear, and opened
        // the help window for a step that bolded ASSISTANT. A loose match
        // is handed to the rescue with the label it found, which is what
        // the assistant needs to write a better step.
        if (match !== null && match.isPressSafe !== true) {
            const seen = (dm.labelPartsOf(target)[0] ?? '').slice(0, 40);
            return {
                done: false,
                reason: 'the closest control on screen is "' + seen +
                    '", which is not "' + nameOf(step, match) + '"',
                nearMisses: dm.nearMisses(
                    (step.finds ?? [step.find]).filter(Boolean),
                ),
            };
        }
        // In the way: a popup is closed by this press and the step by the
        // next, one press one action, the same shape as the right-click
        // menu above. A question the app is asking is never answered here
        // -- that is the user's turn, and the rescue has nothing to add.
        const cover = coverOf(target);
        const layer = cover === null ? null : layerOf(cover, target);
        if (layer !== null && layer.kind === 'question') {
            return {
                done: false,
                reason: '"' + nameOf(step, null) +
                    '" is behind ' + layer.name + ' — answer that first',
                isUserTurn: true,
            };
        }
        if (layer !== null && (layer.kind === 'popup' || layer.kind === 'menu')) {
            if (layer.closer === null) {
                return {
                    done: false,
                    reason: 'it is behind ' + layer.name +
                        ', which has to be closed first',
                    isUserTurn: true,
                };
            }
            unwatch();
            layer.closer.click();
            return { done: true, did: 'closed', closed: layer.short };
        }
        try {
            if (step.action === 'type' && typeof step.value === 'string') {
                target.focus();
                // Off the element's own prototype, not the global classes:
                // an evaluated string can run in a realm whose
                // HTMLInputElement is not the one this element was made
                // from. (The step names a text box, so the tag check has
                // already happened at match time -- a button's value
                // accessor is not a text box.)
                const setter = Object.getOwnPropertyDescriptor(
                    Object.getPrototypeOf(target),
                    'value',
                )?.set;
                if (setter === undefined ||
                    !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                    return { done: false, reason: 'not a text box' };
                }
                setter.call(target, step.value);
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                rememberPoint(target);
                return await withMore({
                    done: true, did: 'typed', value: step.value,
                });
            }
            unwatch();
            rememberPoint(target);
            target.click();
            return await withMore({ done: true, did: 'clicked',
                label: (target.textContent ||
                    target.getAttribute('title') || '').trim().slice(0, 40) });
        } catch (error) {
            return { done: false, reason: String(error && error.message) };
        }
    };

    const api = {
        start(payload) {
            state.steps = (payload.steps ?? []).slice(0, ${MAX_STEPS});
            state.title = payload.title ?? 'Step by step';
            state.labels = Object.assign(state.labels, payload.labels ?? {});
            // A recipe whose steps name no control at all can be walked
            // through but never performed: EVERY press of "Do it" would
            // apologise, which is what a dead button looks like from the
            // outside. Say it once, up front, and be the walkthrough instead.
            // (W-11 is the case that surfaced this -- its four steps bold
            // only keystrokes and stressed words, none of them a control.)
            state.canDemo = state.steps.some((step) => {
                return (
                    (step.finds ?? [step.find]).filter(Boolean).length > 0 ||
                    step.keys != null ||
                    step.action === 'rightClick'
                );
            });
            state.wasDemoAsked = payload.mode === 'demo';
            state.isDemo = state.wasDemoAsked && state.canDemo;
            state.index = 0;
            state.pendingFind = null;
            // A restart is usually the assistant's OWN answer to a stuck step
            // -- the fix landing, not a leftover to carry over. Dropping the
            // token here is also what stops a late answer writing on the card
            // that replaced the one it was asked from.
            state.help = null;
            askedHelpAt = [];
            clearTimeout(helpTimer);
            state.isRunning = state.steps.length > 0;
            state.lastAction = 'started';
            state.lastResult = null;
            render();
            signal();
            return api.status();
        },
        go(index) {
            state.index = Math.max(0, Math.min(state.steps.length - 1, index));
            state.pendingFind = null;
            render();
            return api.status();
        },
        next(reason) {
            if (state.index >= state.steps.length - 1) {
                return api.stop(reason ?? 'finished');
            }
            state.index += 1;
            state.pendingFind = null;
            state.lastAction = reason ?? 'next';
            render();
            return api.status();
        },
        back() {
            state.index = Math.max(0, state.index - 1);
            state.pendingFind = null;
            state.lastAction = 'back';
            render();
            return api.status();
        },
        stop(reason) {
            state.isRunning = false;
            state.lastAction = reason ?? 'stopped';
            unwatch();
            // Not left to lapse: a guide that is stopped should
            // leave nothing of itself on the window.
            dm.releaseHidden();
            render();
            signal();
            return api.status();
        },
        async act() {
            const result = await perform();
            state.lastResult = result;
            state.lastAction = result.done ? 'demo-did-it' : 'demo-could-not';
            // Before the card says it cannot: the assistant wrote these steps
            // and can see the window they are about. Fired here rather than
            // in perform() so a tool-driven 'do' consults exactly as a press
            // of the card's own button does -- the user is stuck either way.
            if (!result.done && result.isUserTurn !== true) {
                askForHelp(result);
            }
            // A moment to see what happened before the card moves on. A
            // popup closed out of the way is not the step done: the card
            // stays, and says so.
            if (result.done && result.more === undefined &&
                result.did !== 'closed') {
                setTimeout(() => {
                    if (state.isRunning) {
                        api.next('after-demo');
                    }
                }, 700);
            } else {
                render();
            }
            return api.status();
        },
        status() {
            const step = state.steps[state.index];
            // A guide whose steps name controls that are not there looks
            // exactly like a working one from the outside, so the caller is
            // told which label this step used, whether it landed -- and when
            // it did not, the labels that came closest, so the retry is
            // written in words the screen actually has.
            const match =
                state.isRunning && step !== undefined
                    ? findMatch(step)
                    : null;
            // A loose fit -- the label merely contains or begins with the
            // step's words -- is reported as NOT found, with the label it
            // did find beside it: to a caller, "found" means "this is the
            // one", and the demo will refuse to press it.
            const isLoose = match !== null && match.isPressSafe !== true;
            const found = match === null || isLoose ? null : match.element;
            const named = step === undefined ? null : nameOf(step, match);
            const foundCover = found === null ? null : coverOf(found);
            return {
                isRunning: state.isRunning,
                isDemo: state.isDemo,
                canDemo: state.canDemo,
                find: named,
                isTargetFound: found !== null,
                nearest: isLoose
                    ? (dm.labelPartsOf(match.element)[0] ?? '').slice(0, 60)
                    : null,
                // Found is not reachable: a control behind the Bible Lookup
                // popup is on screen by every other measure. Named so a
                // caller knows the next "do" closes the popup, not the step.
                behind: foundCover === null
                    ? null
                    : (layerOf(foundCover, found)?.name ?? null),
                // "look": a step that is something to notice, with nothing
                // to press -- its button reads Next and a "do" just moves on.
                kind: step === undefined ? null : (step.kind ?? 'act'),
                // A step can be perfectly actionable with nothing to ring, so
                // say what it would press. Without this, a keystroke step
                // reads exactly like a broken one -- no target, no label --
                // and the model "fixes" a guide that was working.
                press: step === undefined || step.keys == null
                    ? null
                    : step.keys.label,
                canActOnStep:
                    found !== null ||
                    (step !== undefined &&
                        (step.keys != null || step.action === 'rightClick')),
                nearMisses:
                    state.isRunning && step !== undefined && found === null
                        ? dm.nearMisses(
                              (step.finds ?? [step.find]).filter(Boolean),
                          )
                        : [],
                lastResult: state.lastResult,
                // What the card is doing about a step it could not perform.
                // The assistant reads its own rescue back here, and a robot
                // test can see the difference between a card that asked for
                // help and one that shrugged.
                help: state.help === null ? null : {
                    status: state.help.status,
                    text: state.help.text,
                },
                title: state.title,
                stepNumber: state.isRunning ? state.index + 1 : null,
                stepCount: state.steps.length,
                stepText: state.isRunning && step !== undefined
                    ? step.text
                    : null,
                lastAction: state.lastAction,
            };
        },
    };
    parts.next.addEventListener('click', () => {
        const isLast = state.index === state.steps.length - 1;
        const step = state.steps[state.index];
        if (state.isDemo && !isLast && step !== undefined && step.kind !== 'look') {
            api.act();
            return;
        }
        api.next();
    });
    parts.skip.addEventListener('click', () => { api.next('skipped'); });
    parts.back.addEventListener('click', () => { api.back(); });
    parts.close.addEventListener('click', () => { api.stop('closed-by-user'); });
    addEventListener('resize', render);
    // Capture, because the thing that scrolls is a panel inside the app, not
    // the window; passive, because this only reads. Event driven rather than
    // polled: the ring follows the control exactly, and costs nothing at all
    // while nothing moves.
    addEventListener('scroll', reposition, { capture: true, passive: true });
    window.__owaGuide = api;
    return api;
})()`;

export function genGuideExpression(call) {
    return `(() => { const api = ${GUIDE_RUNTIME}; return api.${call}; })()`;
}

// A bold phrase that is a keystroke, not a control: nothing on screen is
// labelled "Ctrl+B", so ringing it can only fail.
const SHORTCUT_PATTERN =
    /^(ctrl|alt|shift|cmd|meta|win|esc|escape|tab|enter|f\d{1,2})\b|\+/i;

// ...but a keystroke is still a thing that can be DONE, and that is the whole
// difference between a card that acts and a card that apologises. A third of
// the manual's steps name no control to ring, and the largest rescuable slice
// of those name a shortcut instead ("Close the dialog with the red X button or
// **Ctrl+Q**", "Press **F9** to take the verse off screen"). Ringing them is
// still impossible; pressing them is not.
//
// The app hears keys through a single `document.onkeydown` that feeds every
// registered shortcut, so a synthetic keydown at the document drives the real
// thing -- verified live against Ctrl+B (opens the Bible Lookup popup) and
// Ctrl+Q (closes it).
const NAMED_KEY_MAP = {
    esc: 'Escape',
    escape: 'Escape',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    space: ' ',
    spacebar: ' ',
    del: 'Delete',
    delete: 'Delete',
    backspace: 'Backspace',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
};

const MODIFIER_MAP = {
    ctrl: 'ctrlKey',
    control: 'ctrlKey',
    alt: 'altKey',
    option: 'altKey',
    shift: 'shiftKey',
    cmd: 'metaKey',
    command: 'metaKey',
    meta: 'metaKey',
    win: 'metaKey',
};

// The `code` a physical en-US keyboard would report. The app deliberately
// forces every key back to that layout THROUGH the code before matching it
// (`toEnUsKey`), so a `key` sent with no `code` matches nothing on a German
// or Khmer layout -- the exact users this app is for.
function toKeyCode(key) {
    if (/^[a-z]$/i.test(key)) {
        return 'Key' + key.toUpperCase();
    }
    if (/^[0-9]$/.test(key)) {
        return 'Digit' + key;
    }
    if (key === ' ') {
        return 'Space';
    }
    // 'F9', 'Escape', 'Tab', 'ArrowUp' are already their own codes.
    return key;
}

/**
 * Turns a written shortcut ("Ctrl+Q", "F9", "Escape") into the fields the
 * app's key handler actually reads. Returns null for anything that is not a
 * keystroke, which is most bold text -- a label ("Bible Lookup"), a stressed
 * word, or a lone modifier ("hold **Ctrl** while clicking", which names no key
 * to press and would otherwise send a meaningless bare Control).
 *
 * A single character only counts WITH a modifier: "**A**" in the manual is
 * emphasis far more often than it is a key, and pressing a stray letter into
 * whatever has focus is a worse failure than declining to.
 *
 * What is written is what is sent, on every platform. The app registers some
 * shortcuts as Ctrl-everywhere (`allControlKey`) and others as Ctrl-on-Windows
 * / Cmd-on-Mac, so there is no rule that rewrites "Ctrl" for a Mac correctly
 * for both -- and the card is showing the user those same words to read.
 */
export function toKeystroke(phrase) {
    if (typeof phrase !== 'string') {
        return null;
    }
    const parts = phrase
        .split('+')
        .map((part) => {
            return part.trim();
        })
        .filter((part) => {
            return part.length > 0;
        });
    if (parts.length === 0) {
        return null;
    }
    const keystroke = {
        key: null,
        code: null,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        label: null,
    };
    for (const modifier of parts.slice(0, -1)) {
        const flag = MODIFIER_MAP[modifier.toLowerCase()];
        // An unknown word before a "+" means this was never a shortcut.
        if (flag === undefined) {
            return null;
        }
        keystroke[flag] = true;
    }
    const wanted = parts[parts.length - 1];
    const named = NAMED_KEY_MAP[wanted.toLowerCase()];
    if (/^f([1-9]|1\d|2[0-4])$/i.test(wanted)) {
        keystroke.key = wanted.toUpperCase();
    } else if (named !== undefined) {
        keystroke.key = named;
    } else if (wanted.length === 1 && parts.length > 1) {
        // Shift+B really does arrive as an uppercase `key`, and the app
        // compares the letter's case to decide what was typed.
        keystroke.key = keystroke.shiftKey
            ? wanted.toUpperCase()
            : wanted.toLowerCase();
    } else {
        return null;
    }
    keystroke.code = toKeyCode(keystroke.key);
    // What the card says out loud, kept as the user's own words rather than
    // rebuilt from the flags, so "Ctrl+Q" is not read back as "Control+q".
    keystroke.label = parts.join('+');
    return keystroke;
}

// ...nor is the verb in front of it, nor a word the manual merely stressed.
// A real label is Capitalised on screen ("Bible Reader", "Clear Bible"); bold
// prose is not ("**not**", "**version**") -- and "not" would have found the
// Notes button and drawn a red ring around the wrong thing entirely.
const ACTION_PATTERN =
    /^(double-?click|right-?click|click|press|type|drag|drop|hover|scroll|open|choose|select)\b/i;

// A recipe names a whole row of tabs in one bold -- "**Colors / Images /
// Videos / Cameras / Web**" -- and introduces each with the colon it is
// written with, "**Colors:**". Neither string is the text on any control, so
// the step about picking a tab had nothing to point at and rang whatever else
// on screen happened to contain one of its other bolds. The full phrase stays
// FIRST, because a control really named "A / B" must still win it; its parts
// follow, and the punctuation the sentence needed is not part of a label.
// A recipe that opens a menu says so in the first words of the step:
// "**Right-click an empty part of the list** ... and choose **Download From
// URL**". What it tells you to right-click is prose, never a label, so the
// step found nothing and demo mode could only apologise -- while the item it
// names is one right-click away. The sentence carries the ACTION; where to
// aim it is worked out from where the guide is looking.
// It has to be the sentence's FIRST words, not a mention anywhere in it:
// W-08 step 2 reads "Pick a tab ... (or right-click the empty list)",
// and its action is a plain click on a tab already on screen.
const RIGHT_CLICK_PATTERN = /^\s*(?:\*\*)?right[- ]?click\b/i;

// A bold, plus the word the recipe qualifies it with: "the **Background**
// (ផ្ទៃខាងក្រោយ) panel". Only the CONTAINER nouns are captured -- they are
// the ones that change which control is meant, where "tab" or "button" only
// repeat what the label already says. The Khmer twin the manual writes
// between the two is stepped over, not matched: this window is English.
// That aside must not itself contain a bold: "press **Ctrl+B** (or click
// **Bible Lookup**)" is one step naming two things, and a parenthesis
// allowed to swallow asterisks eats the second one whole.
// The length cap is generous on purpose. It was 40, and W-08's "**Colors /
// Images / Videos / Cameras / Webs**" is 41: the bold was not read, the
// scanner paired its closing asterisks with the NEXT bold's opening ones,
// "Colors" was eaten with them, and the step about picking a tab rang "Ok"
// first -- a button on a dialog that was not open (measured 2026-09-08: 88
// bolds in the manual are over 40 characters). And a one-character bold --
// "**✕**", "**ⓘ**" -- has to be READ even though it names no control: left
// unread, its asterisks pair with the next bold's and the words between
// become the label. `checkIsControlLabel` is what turns the ✕ away, one
// step later and on purpose.
const BOLD_PATTERN =
    /\*\*([^*\n]{1,120})\*\*(?:\s*\([^)*]{0,60}\))?(?:\s*(panel|pane|section|area|sidebar))?/g;

function toFindCandidates(phrase) {
    const candidates = [phrase, ...phrase.split(/\s+\/\s+/)];
    return candidates
        .map((one) => {
            return one.replace(/[:.,;]+$/, '').trim();
        })
        .filter((one, at, all) => {
            return one.length > 0 && all.indexOf(one) === at;
        });
}

function checkIsControlLabel(candidate) {
    return (
        candidate.length > 1 &&
        /[A-Z]/.test(candidate) &&
        !SHORTCUT_PATTERN.test(candidate) &&
        !ACTION_PATTERN.test(candidate)
    );
}

// A candidate that could be the words ON a control, as against a bolded
// sentence that happens to start with a capital: short, a few words, no
// clause punctuation, not opening with an article or a pronoun. "Nothing
// changes" passes -- there is no telling it from a button -- and that is
// fine: it fails later as a control that is not on screen, which is honest.
// "the Bible you are reading" and "Colours are the special one" do not.
const LABEL_LIKE_MAX_WORDS = 5;
function checkIsLabelLike(candidate) {
    const text = String(candidate ?? '').replace(/^[^>]*>\s*/, '').trim();
    return (
        text.length > 0 &&
        text.length <= 40 &&
        text.split(/\s+/).length <= LABEL_LIKE_MAX_WORDS &&
        !/[—;:,.!?]/.test(text) &&
        !/^(?:the|a|an|your|you|it|its|this|that|these|those)\b/i.test(text)
    );
}

// A step that opens by describing what the user will SEE -- "The live
// background's tab shows a * prefix", "When it finishes, the file appears in
// the folder" -- rather than telling them to do something. Measured
// 2026-09-08 over every recipe step Do it was pressed on: 51 of the 124
// presses the card refused named nothing to press at all, and 40 of those
// were this shape; each refusal cost an apology or a model round for a step
// whose whole content was "notice this". Only a step with no control
// worth ringing and no key to press: a step that says "click" anywhere in
// it, or bolds a label, is an action even when it opens with "The".
const OBSERVE_PATTERN =
    /^(?:the|a|an|each|every|these|this|that|those|it|its|your|you|nothing|only|recent|when|if|once|both|some|all|there|opening|closing|picking|results|rows|links|panels|anything|everything|whatever)\b/i;
function checkIsLookStep(text, finds, keys, action) {
    if (keys != null || action === 'rightClick') {
        return false;
    }
    if (finds.some(checkIsLabelLike)) {
        return false;
    }
    return OBSERVE_PATTERN.test(text) && !/\b(?:click|press|type|drag)\b/i.test(text);
}

// A recipe starts from wherever the app happens to be, so its first steps are
// often "go to this window" -- and the user asking from inside that window is
// already there. Telling them to click a tab they are looking through is how a
// walkthrough loses someone on step 1, so the guide asks the window what page
// it is and drops those steps before showing anything.
// A model told to say "look at the app window" when the card appears will,
// sooner or later, write that down as step 1 -- and a walkthrough whose
// first instruction is to look at the thing you are already looking at has
// spent the one step the user was most willing to follow. The card says it.
export function stripInternalIds(text) {
    return String(text ?? '')
        .replace(ID_ASIDE_PATTERN, '')
        .replace(ID_PATTERN, '')
        // Whatever the cut left behind: a doubled space, a space in front of
        // the full stop, or the comma that used to introduce the id.
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .replace(/[,;:]\s*$/, '')
        .trim();
}

const PREAMBLE_PATTERN = /^(look|watch|see)\b[^.]{0,40}\bapp window\b/i;

// What a step calls the window the card is running in. Read off the ONE
// declaration instead of a pair of hand-written regexes, which is why this
// used to work in exactly two windows: a walkthrough of the Settings window
// opened FOR the user still began "Click the gear (Settings) in the header --
// Settings opens in its own window", pointing at a control that is not in that
// window, at a thing already done.
//
// Two names each, and both are needed: the descriptor's `label` is what a
// recipe writes in a sentence ("go to the Bible Reader"), `openFind` is what
// is written ON the control ("Slide Editor" for the Document Editor). The
// label's last word plus "tab" catches the shorthand a recipe uses for a tab,
// which is the form the reader's own hand-written pattern carried. Matched by
// substring rather than by a built regex: these are whole control names, and a
// label is user-facing text that has no business being spliced into a pattern.
// The names a step can call a window by: the descriptor's `label` is what a
// recipe writes in a sentence ("go to the Bible Reader"), `openFind` is what
// is written ON the control ("Slide Editor" for the Document Editor), and the
// label's last word plus "tab" is the shorthand a recipe uses for a tab --
// which is the form the reader's own hand-written pattern carried. Matched by
// substring rather than by a built regex: these are whole control names, and
// user-facing text has no business being spliced into a pattern.
function toWindowNames(descriptor) {
    const words = descriptor.label.split(' ');
    return [
        descriptor.label,
        descriptor.openFind,
        `${words[words.length - 1]} tab`,
    ]
        .filter((one) => {
            return typeof one === 'string' && one.length > 0;
        })
        .map((one) => {
            return one.toLowerCase();
        });
}

function genHereNames(pathname) {
    const descriptor = getBotFocus(detectBotFocus(pathname) ?? '');
    return descriptor === null ? null : toWindowNames(descriptor);
}

// A recipe's first step is how you GET to the window the rest of it happens
// in -- the same sentence `dropStepsAlreadyDone` throws away once you are
// there. Read the other way round it says which window that is, and that is
// the one question `owa_guide_start` had no answer to: a card asked for
// without a page ran in whatever the main window happened to be showing, so
// the Settings recipe was walked in the Presenter. Its step 2 names nine bold
// words, none of them controls of that window, and the fourth of them --
// "English", from "Language: click English" -- is an exact word of the Bible
// version button "KJV English KJV". A card about Settings rang a Bible
// version, three rows of which matched equally well.
//
// Deliberately silent unless it is SURE. A step naming several windows is a
// recipe that genuinely works in several (the annotation overlay and this
// very assistant open from all eight), and a step that names none is the
// common case -- both keep whatever page the caller asked for. Measured over
// the 44 manual documents: 5 recipes name exactly one window and all 5 are
// right, 5 name more than one, 29 name none.
export function detectRecipeWindow(steps) {
    const first = steps?.[0]?.text ?? '';
    const goingPattern =
        /^(click|open|go to|switch to|choose|select|press)\b/i;
    if (!goingPattern.test(first)) {
        return null;
    }
    const lowered = first.toLowerCase();
    const named = BOT_FOCUS_LIST.filter((descriptor) => {
        return toWindowNames(descriptor).some((name) => {
            return lowered.includes(name);
        });
    });
    return named.length === 1 ? named[0].window : null;
}

export function dropStepsAlreadyDone(steps, pathname = '') {
    const kept = [...steps];
    while (kept.length > 1 && PREAMBLE_PATTERN.test(kept[0].text)) {
        kept.shift();
    }
    const hereNames = genHereNames(pathname);
    if (hereNames === null) {
        return kept;
    }
    const checkIsHere = (text) => {
        const lowered = String(text ?? '').toLowerCase();
        return hereNames.some((name) => {
            return lowered.includes(name);
        });
    };
    const goingPattern = /^(click|open|go to|switch to|choose|select)\b/i;
    while (
        kept.length > 1 &&
        goingPattern.test(kept[0].text) &&
        checkIsHere(kept[0].text)
    ) {
        kept.shift();
    }
    return kept;
}

/**
 * Turns a manual recipe into guide steps: its numbered list, cleaned of the
 * markdown a card cannot show and of the Khmer twin the manual writes beside
 * each English label (this window is English), with every bold phrase kept as
 * a candidate control to ring -- the recipes are written as "press **Ctrl+B**
 * (or click **Bible Lookup**)", and it is the second one the user can see.
 */
// A step starts at a numbered line; or, on a page that numbers nothing, at a
// top-level bullet that opens with a bold. Four recipes are written that
// way -- W-01 (the Presenter tour), W-09 (the foreground widgets), W-10 (the
// screen card and its clears) and W-17 (the Find bar) -- and every one of
// them answered "Nothing to guide" to the walkthrough buttons under its own
// answer, W-10 being the page the panic question lands on. A bold-led bullet
// IS a step of a tour: "**Lock** (header, the padlock): when locked…" names
// the control and says what it does, which is what a card shows.
function readStepLines(lines, startPattern, isParagraphPage = false) {
    const steps = [];
    let current = null;
    for (const line of lines) {
        const started = startPattern.exec(line);
        if (started !== null) {
            if (current !== null) {
                steps.push(current);
            }
            current = { raw: started[1] };
            continue;
        }
        // A note the recipe hangs under a step ("> Note: ...") is background
        // for whoever maintains the manual; on a card it buries the one
        // instruction the user is meant to carry out.
        if (current !== null && /^\s*>/.test(line)) {
            continue;
        }
        // A wrapped continuation line of the step above it -- and, on a
        // bullet page, the sub-bullets under it.
        if (current !== null && /^\s{2,}\S/.test(line)) {
            current.raw += ' ' + line.trim().replace(/^[-*]\s+/, '');
            continue;
        }
        if (current !== null && line.trim() === '') {
            steps.push(current);
            current = null;
            continue;
        }
        // A paragraph wraps at column 0; a numbered step never does.
        if (current !== null && isParagraphPage && line.trim() !== '') {
            current.raw += ' ' + line.trim();
        }
    }
    if (current !== null) {
        steps.push(current);
    }
    return steps;
}

const NUMBERED_STEP_PATTERN = /^\s*\d+\.\s+(.*)$/;
// A bullet, or a paragraph, that opens with a bold -- not the page's own
// front matter (**Goal:**, **Where:**), which is about the recipe, not a
// step of it.
const BOLD_LED_STEP_PATTERN =
    /^(?:[-*]\s+)?(\*\*(?!(?:Goal|Where|Verify|Note|Tip|Why|Screenshots?)\b)[^*\n]{1,120}\*\*.*)$/;

export function toGuideSteps(markdown, limit = MAX_STEPS) {
    const lines = markdown.split(/\r?\n/);
    let steps = readStepLines(lines, NUMBERED_STEP_PATTERN);
    if (steps.length === 0) {
        steps = readStepLines(lines, BOLD_LED_STEP_PATTERN, true);
    }
    return steps.slice(0, limit).map((step) => {
        const marked = [...step.raw.matchAll(BOLD_PATTERN)].map((match) => {
            return {
                text: toEnglishOnly(match[1].replace(/[*`]/g, '')).trim(),
                region: match[2] ?? null,
            };
        });
        const bolds = marked.map((one) => {
            return one.text;
        });
        const plain = bolds
            .flatMap(toFindCandidates)
            .filter(checkIsControlLabel);
        // A step that names a PANEL and a control inside it is naming ONE
        // thing, not two: "open the **Background** panel and choose the
        // **Videos** tab" means the Videos tab of that panel. Asked for on
        // its own, "Background" is also the word on a transition button down
        // beside the screen preview -- and that is what the ring landed on.
        // The ORDER is the adaptive part. The scoped candidate is tried
        // first and can only match once the panel is open; with the panel
        // collapsed it finds nothing and the panel itself is next, which is
        // the half of the step the user has not done yet.
        const scope = marked.find((one) => {
            return one.region !== null && checkIsControlLabel(one.text);
        });
        const finds = [
            ...(scope === undefined
                ? []
                : plain
                      .filter((one) => {
                          return one !== scope.text;
                      })
                      .map((one) => {
                          return scope.text + ' > ' + one;
                      })),
            ...(scope === undefined ? [] : [scope.text + ' ' + scope.region]),
            ...plain,
        ].filter((one, at, all) => {
            return all.indexOf(one) === at;
        });
        // The first shortcut the step names, kept ALONGSIDE the labels rather
        // than instead of them: a recipe writes "press Ctrl+B (or click Bible
        // Lookup)", and clicking the control the user can see is the better
        // demonstration -- so the element wins when there is one, and this is
        // what the step falls back on when the shortcut is all there is, or
        // when the named control turns out not to be on screen.
        const keys =
            bolds.map(toKeystroke).find((one) => {
                return one !== null;
            }) ?? null;
        const action = RIGHT_CLICK_PATTERN.test(step.raw) ? 'rightClick' : undefined;
        const text = toEnglishOnly(
            step.raw
                // The screenshot markers and links mean nothing on a card.
                .replace(/📸/g, '')
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/_([^_]+)_/g, '$1'),
        )
            .replace(/\s+/g, ' ')
            .trim();
        return {
            keys,
            action,
            text,
            finds,
            ...(checkIsLookStep(text, finds, keys, action) ? { kind: 'look' } : {}),
        };
    }).filter((step) => {
        return step.text.length > 0;
    });
}
