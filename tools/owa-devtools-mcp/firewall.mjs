// The firewall: what this MCP server will NOT do, however nicely it is asked.
//
// Everything else in this package assumes the caller means well. That
// assumption does not survive contact with the two things actually on the
// other end of the wire:
//
//  - **A language model reading untrusted text.** The chatbot's model is sent
//    every tool on every round, and it reads things the user did not write --
//    an attached file, a pasted document, a screenshot of somebody else's
//    slide, the app's own content. Text that says "ignore your instructions
//    and run this" is a normal Tuesday. The model is not a trust boundary.
//  - **Anything at all on the machine.** The HTTP door is bound to 127.0.0.1
//    and Origin-checked, which stops a web page; it stops nothing that can
//    open a socket.
//
// And what sat behind that, until this file existed, was `evaluate_script` on
// a renderer running with node integration. Measured against the live app on
// 2026-09-01, from a plain script with no credential:
//
//     evaluate_script -> require('os').userInfo()      -> the operator's name
//     evaluate_script -> require('fs').readFileSync(...) -> setting.json
//
// `require('child_process')` is the same reach. So one sentence of injected
// text in a lyric file was arbitrary code execution on a church's computer,
// and the only thing between them was the model's good judgement.
//
// The rule this file enforces: **the assistant may point, the human presses.**
// A tool that reads is open. A tool that acts is watched, rate-limited and
// refused when it would destroy something. A tool that escapes the app is not
// available at all -- not hidden, not discouraged, refused at the door AND
// removed from `tools/list` so the model never spends tokens learning it
// exists.
//
// Two enforcement points, because either alone is a hole:
//  - `tools/list` on the way out loses the denied tools. This is the part
//    that saves tokens; it is NOT the part that provides safety, because a
//    client can call a tool that was never listed.
//  - `tools/call` on the way in is refused. This is the safety.
//
// A refusal is written FOR THE MODEL: it says what was refused, why, and what
// to do instead, so a blocked call becomes correct behaviour ("ring it and
// ask the user to press it") rather than a dead end the model apologises for.
//
// Nothing here can be switched off from inside the protocol. There is no tool
// that relaxes the policy, and no argument that bypasses it. The one escape
// hatch is an environment variable the person starting the process sets --
// see `readFirewallMode`.

import {
    checkIsDestructiveLabelText,
    genDestructiveLabelRule,
} from './destructiveLabel.mjs';
import { AGENT_REMOVING_ACTIONS } from './agentData.mjs';
import { loadTranBundle } from './tran.mjs';
import { checkWebUrl } from './webUrlPolicy.mjs';

// The tools that cannot be made safe by inspecting their arguments, and what
// to say instead. Each entry is a sentence the model can act on and a
// volunteer could understand if it were ever shown to them.
const DENIED_TOOL_MAP = {
    evaluate_script:
        'Running code in the app window is switched off. This app\'s windows ' +
        'run with full access to the computer -- files, settings, other ' +
        'programs -- so a script here is not "just a page script". Use the ' +
        'app\'s own tools instead: owa_app_state for what the app is doing, ' +
        'owa_list_ui for the controls on screen, owa_find_ui to point one ' +
        'out, owa_click and owa_type to use one.',
    take_heapsnapshot:
        'Memory dumps are switched off. A heap snapshot contains every string ' +
        "the window is holding -- the user's API keys, their songs, their " +
        'notes -- and writes them to disk. If you need to know what the app ' +
        'is doing, use owa_app_state.',
    upload_file:
        'Choosing a file for the app is switched off, because it hands a file ' +
        'off the disk to a page that can send it anywhere. Ask the user to ' +
        'pick the file themselves -- owa_find_ui will point at the button.',
};

// Budgets, shared across every session in the process on purpose: the things
// being protected -- the ONE app window in front of a volunteer, and the ONE
// network this machine is on -- do not belong to a conversation. Two agents
// hammering at once is exactly the case a per-session budget would miss.
//
// They are separate counters and the numbers are not comparable. A guide walks
// a volunteer through a dozen presses in a minute and that is the tool working
// properly; a single question needing more than a page or two off the internet
// is already odd, and each of those is a hidden browser window plus whatever
// went out in the address. So the network budget is small, slow to refill, and
// its refusal says to ask the user rather than to try again.
//
// The third counts what takes something of the user's away -- a file to the
// trash, a slide, a note, a saved passage. Every one is recoverable
// (`owa_undo`), which is why they are offered at all; but a loop emptying a
// Documents folder into the trash still costs a volunteer their morning, and
// no honest request removes more than a handful of things.
const RATE_BUDGET_MAP = {
    acting: { windowMilliseconds: 60 * 1000, limit: 25 },
    network: { windowMilliseconds: 5 * 60 * 1000, limit: 10 },
    removing: { windowMilliseconds: 5 * 60 * 1000, limit: 10 },
};

// What the operator can look back at. Bounded because this app runs on very
// low-spec machines and a log nobody reads must never grow: the last N
// decisions, oldest dropped.
const LOG_LIMIT = 100;

const state = {
    rateAtMap: new Map(),
    logList: [],
    // `{at, rule}` -- see `getDestructiveLabelRule`.
    destructiveRule: null,
};

/** Tests drive the rate limiters, the log and the rule; all need a clean slate. */
export function resetFirewallState() {
    state.rateAtMap = new Map();
    state.logList = [];
    state.destructiveRule = null;
}

/**
 * `strict` (the default, and what ships) or `off`.
 *
 * Off is for a developer who has to drive the app in ways the policy forbids
 * -- a QA run that really does need `evaluate_script`. It is an environment
 * variable rather than a flag or a setting because the person who sets it must
 * be the person who started the process: nothing that arrives over the wire
 * can reach it, which is the whole point.
 */
export function readFirewallMode() {
    return process.env.OWA_MCP_FIREWALL === 'off' ? 'off' : 'strict';
}

function recordDecision(entry) {
    state.logList.push({ at: Date.now(), ...entry });
    if (state.logList.length > LOG_LIMIT) {
        state.logList.shift();
    }
}

/** The last decisions, oldest first. For an operator asking what was done. */
export function getFirewallLog() {
    return [...state.logList];
}

/**
 * Every tool that changes the window rather than reading it. Kept separate
 * from `notify.mjs`'s `ACTING_TOOLS` even though the lists overlap: that one
 * decides what to SAY to the user, this one decides what to COUNT, and a tool
 * can be worth one without the other (`owa_pick_element` interrupts the user,
 * which is worth a banner, and costs the app nothing, which is not worth a
 * budget slot).
 */
const ACTING_TOOL_SET = new Set([
    'click',
    'drag',
    'fill',
    'fill_form',
    'hover',
    'press_key',
    'type_text',
    'handle_dialog',
    'navigate_page',
    'new_page',
    'close_page',
    'resize_page',
    'emulate',
    'owa_click',
    'owa_type',
    'owa_goto_page',
    'owa_hide_screens',
    'owa_guide_start',
    'owa_guide_step',
    // These two write the user's own documents. They are the only acting
    // tools whose effect outlives the session -- a click can be clicked
    // again, a created file stays created -- so being inside the budget
    // matters more here than anywhere: a loop must not be able to fill
    // somebody's Documents folder.
    'owa_lyric_file',
    'owa_slide_file',
    // Puts a passage on the projector. A `check` only reads, but the budget
    // counts the tool, not the argument: a loop presenting verse after verse
    // is exactly what the cap is for.
    'owa_present_bible',
    // Starts a countdown, a clock or a message on the projector, or takes one
    // off. A `check` only reads, but the budget counts the tool, not the
    // argument, for the same reason as the passage above.
    'owa_foreground',
    // The user's saved Bible passages and notes, and putting back a change.
    // Written straight to disk -- a Bibles list and a notes file have no
    // editing history -- which is why each change is backed up first and
    // why the budget still counts them.
    'owa_bible_item',
    'owa_bible_note',
    'owa_undo',
]);

// The tools whose `action` can take something away (see
// `AGENT_REMOVING_ACTIONS`). Judged on the arguments, like a network call: a
// `list` must not spend a removal slot.
const REMOVING_TOOL_SET = new Set([
    'owa_lyric_file',
    'owa_slide_file',
    'owa_bible_item',
    'owa_bible_note',
    'owa_undo',
]);

/** Does THIS call take something of the user's away? */
export function checkIsRemovingCall(name, args) {
    return (
        REMOVING_TOOL_SET.has(name) &&
        AGENT_REMOVING_ACTIONS.includes(args?.action)
    );
}

export function checkIsActingTool(name) {
    return ACTING_TOOL_SET.has(name);
}

/**
 * Every tool that reaches OFF this machine. Listed rather than special-cased
 * in `checkToolCall` because a second one must inherit the address check and
 * the budget by being added here, not by somebody remembering to.
 */
const NETWORK_TOOL_SET = new Set(['owa_read_website']);

/**
 * Tools that reach off this machine only when handed an address. The song
 * drafter is a local tool -- it asks the app nothing and works with no window
 * open -- until a caller gives it a `url`, at which point it opens the same
 * hidden window `owa_read_website` does and is charged and screened the same
 * way. Judged on the ARGUMENTS, because a draft from a paste must not spend a
 * network slot or be refused for having no address.
 */
const NETWORK_WHEN_URL_TOOL_SET = new Set(['owa_lyric_validate']);

export function checkIsNetworkTool(name) {
    return NETWORK_TOOL_SET.has(name);
}

/** Does THIS call go out to the internet? The name, or the name plus a url. */
export function checkIsNetworkCall(name, args) {
    return (
        NETWORK_TOOL_SET.has(name) ||
        (NETWORK_WHEN_URL_TOOL_SET.has(name) &&
            typeof args?.url === 'string' &&
            args.url.trim() !== '')
    );
}

/**
 * A page the app itself serves. Everything else is refused, including
 * `data:` and `javascript:`, which fall out of the default rather than being
 * named -- a list of what is forbidden is a list somebody will find the gap
 * in, so this is a list of what is allowed.
 *
 * Loading a remote page into one of this app's windows is the same hole
 * `evaluate_script` was: the window has node integration, so the page it
 * loads gets the disk.
 */
export function checkIsAppUrl(url) {
    if (typeof url !== 'string' || url === '') {
        return false;
    }
    if (url === 'about:blank') {
        return true;
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol === 'file:') {
        return true;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
        parsed.hostname,
    );
}

/**
 * The words a control is being sought by. `owa_click` and `owa_type` take
 * either one label or a list of candidates, and "Panel > Control" narrows a
 * label to a panel -- so the last segment is what is actually written on the
 * thing about to be pressed.
 */
function toCandidateLabels(find) {
    const list = Array.isArray(find) ? find : [find];
    return list
        .filter((one) => {
            return typeof one === 'string' && one !== '';
        })
        .map((one) => {
            return one.split('>').pop().trim();
        });
}

// Read on every `owa_click`, `owa_type` and walkthrough start and on every
// snapshot row the uid interlock looks at -- and deriving it re-reads and
// parses the app's whole dictionary (~110 KB, ~1 300 entries). What it derives
// is ~1.5 KB, so it is kept for a minute and then dropped: a walkthrough's
// dozen presses pay for it once, and nothing resident outlives the question
// that needed it.
const DESTRUCTIVE_RULE_TTL_MILLISECONDS = 60 * 1000;

/**
 * The destructive-label rule for every language the app can be shown in,
 * derived from the app's own `tran()` dictionary (`destructiveLabel.mjs`).
 */
export function getDestructiveLabelRule(now = Date.now()) {
    const cached = state.destructiveRule;
    if (cached === null || now - cached.at > DESTRUCTIVE_RULE_TTL_MILLISECONDS) {
        state.destructiveRule = {
            at: now,
            rule: genDestructiveLabelRule(loadTranBundle()),
        };
    }
    return state.destructiveRule.rule;
}

/** Whether a label names something that cannot be undone, in any language. */
export function checkIsDestructiveText(text) {
    if (typeof text !== 'string' || text === '') {
        return false;
    }
    return checkIsDestructiveLabelText(text, getDestructiveLabelRule());
}

export function findDestructiveLabel(find) {
    for (const label of toCandidateLabels(find)) {
        if (checkIsDestructiveText(label)) {
            return label;
        }
    }
    return null;
}

// --- The uid interlock -------------------------------------------------
//
// `owa_click` and `owa_type` name the control they are aiming at, so the
// interlock above can read it. chrome-devtools' own acting tools cannot be
// read that way: they take a `uid` out of an accessibility snapshot and carry
// no label at all, so until this existed the whole *point, don't press* rule
// was two `take_snapshot` lines away from being irrelevant --
//
//     take_snapshot  ->  uid=1_112 button "Clear All" ...
//     click({uid: '1_112'})                         <- nothing looked at it
//
// The uid only means anything because a snapshot said so, and that snapshot
// came back THROUGH this file. So the way to read the label is to remember it
// on the way out and look it up on the way in.
//
// What is remembered is deliberately almost nothing: only the uids whose line
// is BOTH an interactive control and destructively worded. In the presenter's
// 286-line snapshot that is one entry. A memory that held the whole tree would
// be a per-session cache of the app's entire UI, which is exactly what this
// app cannot afford.
//
// It is a net, not a proof, and it fails OPEN for a uid it never saw -- which
// is the same call `redactSecrets` makes and for the same reason: a uid the
// model was never shown is a uid it cannot aim with, and refusing every
// unrecognised one would break the developer's door for no gain.

// Only roles a press actually does something to. Without this, a Bible verse
// reading "and God shall take away his part" marks its StaticText uid as
// destructive, and the firewall starts refusing ordinary work -- the exact
// failure the label list above is kept short to avoid.
const INTERACTIVE_ROLE_SET = new Set([
    'button',
    'checkbox',
    'combobox',
    'link',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'textbox',
    'treeitem',
]);

// `  uid=1_112 button "Clear All" description="Clear All [F6]"`
const SNAPSHOT_LINE_PATTERN = /^ *uid=(\S+) +([A-Za-z]+)(.*)$/gm;

// A row's accessible name and its description are each quoted. Read whole, the
// row catches a label found anywhere inside it; read one quoted name at a time
// it also catches a label that is only refused WHOLE (a translation that sits
// inside some ordinary sentence of the dictionary), which the quotes and the
// description beside it would otherwise never equal.
function checkIsDestructiveRow(rest) {
    if (checkIsDestructiveText(rest)) {
        return true;
    }
    for (const match of rest.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
        if (checkIsDestructiveText(match[1])) {
            return true;
        }
    }
    return false;
}

// A snapshot names its page in every uid (`1_112`), so one page's tree can be
// replaced without touching another's.
function toUidPagePrefix(uid) {
    const index = String(uid).indexOf('_');
    return index === -1 ? '' : String(uid).slice(0, index + 1);
}

/**
 * A per-session memory of which uids must not be pressed.
 *
 * Replace-per-page rather than merge: chrome-devtools mints fresh uids on
 * every snapshot, so `1_112` after the next one is a DIFFERENT element.
 * Merging would leave the firewall refusing a uid that has since become an
 * ordinary control -- worse than missing one, because a firewall that blocks
 * ordinary work is a firewall the model learns to route around.
 */
export function genUidLabelMemory({ limit = 200 } = {}) {
    const destructiveMap = new Map();
    return {
        /** Harvest a result that may carry a snapshot. Cheap when it doesn't. */
        remember(text) {
            if (typeof text !== 'string' || !text.includes('uid=')) {
                return;
            }
            const foundMap = new Map();
            const seenPrefixSet = new Set();
            SNAPSHOT_LINE_PATTERN.lastIndex = 0;
            let match = SNAPSHOT_LINE_PATTERN.exec(text);
            while (match !== null) {
                const [, uid, role, rest] = match;
                seenPrefixSet.add(toUidPagePrefix(uid));
                if (
                    INTERACTIVE_ROLE_SET.has(role.toLowerCase()) &&
                    checkIsDestructiveRow(rest)
                ) {
                    foundMap.set(uid, rest.trim());
                }
                match = SNAPSHOT_LINE_PATTERN.exec(text);
            }
            if (seenPrefixSet.size === 0) {
                return;
            }
            for (const uid of [...destructiveMap.keys()]) {
                if (seenPrefixSet.has(toUidPagePrefix(uid))) {
                    destructiveMap.delete(uid);
                }
            }
            for (const [uid, label] of foundMap) {
                if (destructiveMap.size >= limit) {
                    break;
                }
                destructiveMap.set(uid, label);
            }
        },
        /** The remembered wording, or null for a uid never seen as destructive. */
        lookup(uid) {
            return destructiveMap.get(uid) ?? null;
        },
        get size() {
            return destructiveMap.size;
        },
    };
}

// Which argument of which tool is a uid. `upload_file` takes one too and is
// denied outright above, so it is not here.
const UID_ARG_MAP = {
    click: ['uid'],
    fill: ['uid'],
    drag: ['from_uid', 'to_uid'],
};

/**
 * The wording that stops this call, or null. `fill_form` carries its uids in a
 * list of `{uid, value}` rather than at the top level, so it is read on its
 * own rather than bent into `UID_ARG_MAP`.
 */
export function findDestructiveUid(name, args, lookupUidLabel) {
    if (typeof lookupUidLabel !== 'function') {
        return null;
    }
    const uidList = [];
    for (const key of UID_ARG_MAP[name] ?? []) {
        if (typeof args?.[key] === 'string') {
            uidList.push(args[key]);
        }
    }
    if (name === 'fill_form' && Array.isArray(args?.elements)) {
        for (const element of args.elements) {
            if (typeof element?.uid === 'string') {
                uidList.push(element.uid);
            }
        }
    }
    for (const uid of uidList) {
        const label = lookupUidLabel(uid);
        if (label !== null && label !== undefined) {
            return label;
        }
    }
    return null;
}

function checkHasRoom(kind, now) {
    const { windowMilliseconds, limit } = RATE_BUDGET_MAP[kind];
    const since = now - windowMilliseconds;
    const atList = (state.rateAtMap.get(kind) ?? []).filter((at) => {
        return at > since;
    });
    state.rateAtMap.set(kind, atList);
    return atList.length < limit;
}

function useRoom(kind, now) {
    state.rateAtMap.get(kind)?.push(now);
}

function checkRate(kind, now) {
    if (!checkHasRoom(kind, now)) {
        return false;
    }
    useRoom(kind, now);
    return true;
}

const ALLOWED = { isAllowed: true };

function refuse(rule, reason) {
    return { isAllowed: false, rule, reason };
}

// One sentence for both halves of the interlock, because they are the same
// refusal: the model found the right control and must not press it itself.
export function genDestructiveReason(label) {
    return (
        `Pressing "${label}" for the user is switched off, because it ` +
        'cannot be undone by pressing it again. Point at it instead -- ' +
        'owa_find_ui with highlight -- and tell the user in one sentence ' +
        'what it will do and to press it themselves if they want it.'
    );
}

// --- The page half -----------------------------------------------------
//
// Everything above reads the words a call CARRIES. The press itself happens
// in the page, on whatever element the matcher resolved -- and that is where
// the words stop mattering: a title that says Delete on a button whose own
// text does not, a label in the language the window is showing, a no-break
// space the matcher folds and a pattern does not, or a walkthrough step the
// firewall never reads at all. So every press also carries a guard, and the
// page refuses by what the element IS (`destructiveLabel.mjs`). Same split as
// `webUrlPolicy.mjs`: this file refuses what it can see cheaply, the far end
// refuses authoritatively.

const QUESTION_REASON =
    'That control is part of a question the app is asking the user -- a ' +
    'confirm, an alert or a box to fill in -- and answering it is theirs to ' +
    'do, never yours. Tell them in one sentence what the app is asking and ' +
    'let them press it.';

/**
 * What a press carries into the page to be judged by, or null when the
 * operator switched the firewall off -- the one switch, read in one place, so
 * the page half can never be stricter or looser than the rest of the policy.
 */
export function genPressGuard() {
    return readFirewallMode() === 'off'
        ? null
        : { rule: getDestructiveLabelRule() };
}

/**
 * The sentence for a refusal the PAGE made. A walkthrough is already ringing
 * the control, so it is told to say so rather than to point at it again.
 */
export function genPressRefusalReason(refusal, { isGuide = false } = {}) {
    if (refusal?.refused === 'question') {
        return QUESTION_REASON;
    }
    const label = String(refusal?.label ?? 'that control');
    if (!isGuide) {
        return genDestructiveReason(label);
    }
    return (
        `Pressing "${label}" for the user is switched off, because it ` +
        'cannot be undone by pressing it again. The walkthrough card is ' +
        'already ringing it: tell the user in one sentence what it will do ' +
        'and to press it themselves if they want it, then move the ' +
        'walkthrough on with next.'
    );
}

/** A refusal the page made is logged beside the ones made here. */
export function recordPressRefusal(name, refusal) {
    recordDecision({
        name,
        rule:
            refusal?.refused === 'question'
                ? 'question-press'
                : 'destructive-press',
        isAllowed: false,
    });
}

/**
 * The whole policy, as one pure-ish function: name and arguments in, a
 * verdict out. Pure except for the rate limiter's clock, which is why `now`
 * is an argument.
 *
 * Order matters. The outright denials come first so a denied tool is never
 * also charged to the rate budget, and the budget comes last so a call that
 * was going to be refused anyway does not use one up.
 */
export function checkToolCall(
    name,
    args,
    { now = Date.now(), lookupUidLabel = null } = {},
) {
    if (readFirewallMode() === 'off') {
        return ALLOWED;
    }
    const denied = DENIED_TOOL_MAP[name];
    if (denied !== undefined) {
        return refuse('denied-tool', denied);
    }
    if (name === 'navigate_page' || name === 'new_page') {
        // Reload, back and forward carry no address at all, so the allowlist
        // had nothing to look at and refused every one of them -- including
        // reloading the page the window is already showing, which cannot go
        // anywhere by definition. History is safe for the same reason the
        // allowlist works: nothing outside the app can be navigated TO, so
        // there is nothing outside the app to go BACK to.
        const isHistoryMove =
            name === 'navigate_page' &&
            args?.url === undefined &&
            ['reload', 'back', 'forward'].includes(args?.type);
        if (!isHistoryMove && !checkIsAppUrl(args?.url)) {
            return refuse(
                'foreign-url',
                'Opening an address outside this app is switched off. The ' +
                    "app's windows can read the computer's files, so a page " +
                    'loaded into one is not a normal web page. Use ' +
                    'owa_goto_page to move between the presenter and the ' +
                    'reader.',
            );
        }
    }
    // Reaching out to the internet. The address rules live in
    // `webUrlPolicy.mjs` because the main process enforces the same ones
    // again, asynchronously and with DNS, at the moment it opens the socket
    // -- this is the cheap synchronous half, made here so that a refusal is
    // logged where every other refusal is logged and costs no round trip to
    // the app.
    if (checkIsNetworkCall(name, args)) {
        const verdict = checkWebUrl(args?.url);
        if (!verdict.isAllowed) {
            return refuse('foreign-url', verdict.reason);
        }
    }
    // The interlock, in its two halves. `owa_click`/`owa_type` are aimed BY
    // label, so the words are right there in the arguments.
    if (name === 'owa_click' || name === 'owa_type') {
        const label = findDestructiveLabel(args?.find);
        if (label !== null) {
            return refuse('destructive-label', genDestructiveReason(label));
        }
    }
    // chrome-devtools' own acting tools are aimed by a uid, which means
    // nothing on its own -- so the label comes from the snapshot that minted
    // it, remembered on the way out by `guardToolCalls`.
    const uidLabel = findDestructiveUid(name, args, lookupUidLabel);
    if (uidLabel !== null) {
        return refuse('destructive-uid', genDestructiveReason(uidLabel));
    }
    // Both budgets are looked at before either is spent, so a call refused
    // by one does not use up a slot of the other.
    const isActing = checkIsActingTool(name);
    const isRemoving = checkIsRemovingCall(name, args);
    if (isActing && !checkHasRoom('acting', now)) {
        return refuse(
            'rate-limit',
            'Too many actions in the app in the last minute. Something is ' +
                'looping. Stop acting, tell the user in plain words what you ' +
                'were trying to do and what you would need from them, and ' +
                'let them act.',
        );
    }
    if (isRemoving && !checkHasRoom('removing', now)) {
        return refuse(
            'rate-limit',
            'Too many things removed in the last few minutes. Each one went ' +
                'to the trash and can be put back with owa_undo, but no ' +
                'honest request removes this many this fast. Stop, tell the ' +
                'user what was removed, and ask what they want.',
        );
    }
    if (isActing) {
        useRoom('acting', now);
    }
    if (isRemoving) {
        useRoom('removing', now);
    }
    if (checkIsNetworkCall(name, args) && !checkRate('network', now)) {
        return refuse(
            'rate-limit',
            'Too many pages read off the internet in the last few minutes. ' +
                'Stop reading and answer from what you already have, or tell ' +
                'the user which page you would need them to look at. Reading ' +
                'the same site again will not answer it.',
        );
    }
    return ALLOWED;
}

/** The tool list with the outright-denied ones taken out. */
export function filterToolList(toolList) {
    if (!Array.isArray(toolList) || readFirewallMode() === 'off') {
        return toolList;
    }
    return toolList.filter((tool) => {
        return DENIED_TOOL_MAP[tool?.name] === undefined;
    });
}

// Secrets that must not leave the machine inside a tool result. This is not
// theoretical: the chatbot calls Anthropic, OpenAI and Moonshot FROM THE
// RENDERER with the user's own key in a header, and the key sits in an input
// on Settings -> Others. So `list_network_requests`, `list_console_messages`
// and a plain `take_snapshot` of the settings page will each hand the user's
// key straight back to a model -- which is to say, off the machine.
//
// Anchored, bounded and few, so this stays linear over a large snapshot. It
// is a net, not a proof: a secret in a shape nobody anticipated still gets
// through, which is why the tools that dump memory wholesale are denied
// outright above rather than being trusted to this.
const SECRET_PATTERNS = [
    // Provider keys. Anthropic first: `sk-ant-` would otherwise be eaten by
    // the generic `sk-` rule and leave the prefix showing.
    /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
    /\bsk-[A-Za-z0-9]{20,}/g,
    // JSON Web Tokens -- SongSelect's OAuth pair, among others.
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
    // A named credential and whatever it was set to, in a header, a JSON blob
    // or a DOM attribute: `"apiKey": "..."`, `x-api-key: ...`, `value="..."`
    // on a field called password.
    /((?:api[_-]?key|apikey|x-api-key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret)["']?\s*[:=]\s*["']?)[^"'\s,;}]{8,}/gi,
];

const REDACTED = '[redacted by the app firewall]';

export function redactSecrets(text) {
    if (typeof text !== 'string' || text === '') {
        return text;
    }
    let out = text;
    for (const pattern of SECRET_PATTERNS) {
        // A capture group means "keep the name, drop the value"; without one
        // the whole match goes.
        out = out.replace(pattern, (match, keep) => {
            return keep === undefined ? REDACTED : `${keep}${REDACTED}`;
        });
    }
    return out;
}

/**
 * Scrub secrets out, and take the uid labels in, on the one walk that already
 * touches every text block of every result. Any result can carry a snapshot,
 * not just `take_snapshot`'s -- every acting tool takes `includeSnapshot`, and
 * a model refreshing its uids that way would otherwise refresh them past the
 * interlock.
 */
function redactContentList(contentList, uidMemory = null) {
    if (!Array.isArray(contentList)) {
        return contentList;
    }
    return contentList.map((item) => {
        if (item?.type !== 'text' || typeof item.text !== 'string') {
            return item;
        }
        uidMemory?.remember(item.text);
        const text = redactSecrets(item.text);
        return text === item.text ? item : { ...item, text };
    });
}

function genRefusalMessage(id, reason) {
    // An `isError` RESULT, not a JSON-RPC error. A protocol error is a
    // failure the client reports and gives up on; a result the model can read
    // is an instruction it can follow, which is the entire point of writing
    // the reasons the way they are written above.
    return {
        jsonrpc: '2.0',
        id,
        result: {
            content: [{ type: 'text', text: reason }],
            isError: true,
        },
    };
}

/**
 * Wraps a transport so every `tools/call` is checked on the way in and every
 * result is scrubbed on the way out.
 *
 * Call this AFTER `server.connect` and AFTER `watchToolCalls`, so this ends up
 * the OUTERMOST wrapper on `onmessage` and therefore runs FIRST: a refused
 * call must not also raise a banner telling the user the app just did the
 * thing it did not do.
 *
 * Both hooks re-enter the same trap `notify.mjs` documents -- the SDK chains
 * whatever handler it finds, so an accessor that answers "me" recurses until
 * the stack goes. Read the field once, store the wrapper, never define a
 * getter.
 */
export function guardToolCalls(transport, { log = defaultLog } = {}) {
    if (transport === null || typeof transport !== 'object') {
        return transport;
    }
    if (transport.__owaFirewallWrapped === true) {
        return transport;
    }
    transport.__owaFirewallWrapped = true;
    // Which request id asked what, so the outbound side knows whether it is
    // looking at a tool list or a tool result. Bounded and drained on the way
    // out; a client that abandons requests must not grow this for ever.
    const pendingMethodMap = new Map();
    const PENDING_LIMIT = 64;
    // Per-transport, so it dies with the session rather than living in the
    // module: uids are only meaningful to the client that was shown them.
    const uidMemory = genUidLabelMemory();
    const lookupUidLabel = (uid) => {
        return uidMemory.lookup(uid);
    };

    const innerOnMessage = transport.onmessage;
    transport.onmessage = (message, extra) => {
        try {
            const { method, id } = message ?? {};
            if (id !== undefined && (method === 'tools/list' || method === 'tools/call')) {
                if (pendingMethodMap.size >= PENDING_LIMIT) {
                    pendingMethodMap.delete(pendingMethodMap.keys().next().value);
                }
                pendingMethodMap.set(id, method);
            }
            if (method === 'tools/call') {
                const name = message.params?.name;
                const verdict = checkToolCall(name, message.params?.arguments, {
                    lookupUidLabel,
                });
                if (!verdict.isAllowed) {
                    pendingMethodMap.delete(id);
                    recordDecision({
                        name,
                        rule: verdict.rule,
                        isAllowed: false,
                    });
                    log(`refused ${name} (${verdict.rule})`);
                    // Answered here and never forwarded: the server below
                    // never learns the call happened, which is what makes
                    // this a firewall rather than a warning.
                    transport.send?.(genRefusalMessage(id, verdict.reason));
                    return undefined;
                }
                if (checkIsActingTool(name)) {
                    recordDecision({ name, rule: 'acted', isAllowed: true });
                } else if (checkIsNetworkTool(name)) {
                    // Logged with the address: an operator asking what was
                    // done needs to see where it went, not just that it went.
                    recordDecision({
                        name,
                        rule: 'fetched',
                        isAllowed: true,
                        url: message.params?.arguments?.url,
                    });
                }
            }
        } catch (error) {
            // A broken check must fail CLOSED for a tool it was asked about,
            // but it must not take down the session. Nothing here can throw
            // for a well-formed message, so this is the unreachable branch;
            // if it is ever reached, say so rather than silently opening.
            log(`firewall check failed: ${String(error?.message ?? error)}`);
        }
        return innerOnMessage?.call(transport, message, extra);
    };

    const innerSend = transport.send?.bind(transport);
    if (innerSend !== undefined) {
        transport.send = (message, options) => {
            try {
                const asked = pendingMethodMap.get(message?.id);
                if (asked !== undefined) {
                    pendingMethodMap.delete(message.id);
                    if (asked === 'tools/list' && message.result?.tools) {
                        message.result.tools = filterToolList(
                            message.result.tools,
                        );
                    } else if (asked === 'tools/call' && message.result) {
                        message.result.content = redactContentList(
                            message.result.content,
                            uidMemory,
                        );
                    }
                }
            } catch (error) {
                log(`firewall scrub failed: ${String(error?.message ?? error)}`);
            }
            return innerSend(message, options);
        };
    }
    return transport;
}

// stderr, not stdout: for the stdio door stdout IS the protocol channel, and
// for the app this lands in the same terminal as everything else it says.
function defaultLog(text) {
    console.error('[owa-devtools-mcp firewall]', text);
}
