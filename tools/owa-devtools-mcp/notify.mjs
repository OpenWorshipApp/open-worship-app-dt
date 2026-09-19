// "Something else is driving your app right now."
//
// The chatbot and any outside agent reach the window through the same MCP
// server, and a click they make is indistinguishable from one the user made --
// the pointer does not move, nothing is pressed, the screen just changes. On a
// machine running a service that is the wrong kind of surprise, so every tool
// call that TOUCHES the interface puts a small banner in the window saying so.
//
// Only acting tools announce themselves. Reading the page (a snapshot, a
// screenshot, `owa_app_state`) changes nothing the user can see, and a banner
// per read would both cry wolf and photograph itself during a QA run.
//
// Like `guide.mjs` this is a string evaluated in the page: dependency free,
// never importing an app module (that re-runs `document.onkeydown` and kills
// every shortcut), and confined to its own shadow root so no app style can
// reach it and it can touch no app state.

import { evaluateInApp } from './cdp.mjs';

// What each tool does, said the way a volunteer would say it. A tool that is
// not in here reads the app rather than acting on it, and stays quiet.
const ACTING_TOOLS = {
    click: 'clicked something',
    drag: 'dragged something',
    fill: 'filled in a box',
    fill_form: 'filled in a form',
    hover: 'pointed at something',
    press_key: 'pressed a key',
    type_text: 'typed something',
    upload_file: 'chose a file',
    handle_dialog: 'answered a message box',
    navigate_page: 'opened another page',
    new_page: 'opened a window',
    close_page: 'closed a window',
    resize_page: 'resized the window',
    emulate: 'changed how the page is shown',
    evaluate_script: 'ran something in the page',
    owa_hide_screens: 'took content off a screen',
    owa_guide_start: 'started a walkthrough',
    owa_guide_step: 'moved the walkthrough on',
    owa_find_ui: 'pointed out a control',
    owa_click: 'clicked something',
    owa_type: 'typed something',
    owa_goto_page: 'switched the window to another page',
    // Draws an outline over the window and swallows the next click. Nothing in
    // the app changes, but the window stops behaving normally until the user
    // picks, and that is exactly what the banner is for.
    owa_pick_element: 'asked you to point at a control',
    owa_highlight_selector: 'pointed out a control',
    // The one tool that reaches off this machine. It changes nothing in the
    // window, so by the rule above it would stay quiet -- and it is here
    // anyway, because "what left this computer" is the one thing an operator
    // is owed a look at even more than "what was pressed". A URL is a channel
    // out, so the banner NAMES the site: a read of a site nobody recognises,
    // in the middle of a question about clearing a screen, is the shape a
    // prompt injection makes, and a banner reading "read a website" would
    // have hidden exactly the part worth seeing.
    owa_read_website: 'read a website',
    // Writing the user's own documents. The banner says the ACTION and the
    // NAME, because "changed a song" is the one notice where which song is
    // the whole question -- and a read (`list` / `info`) says nothing at all,
    // the same rule every other reading tool follows.
    owa_lyric_file: 'changed a song',
    owa_slide_file: 'changed a slide document',
    // The verse goes on the congregation's screen, so the banner NAMES it:
    // "put a verse on the screen" says nothing the operator can check
    // against the wall. A `check` reads the passage and touches no screen,
    // and stays quiet like every other read.
    owa_present_bible: 'put a Bible passage on the screen',
    // A countdown or a message goes on the congregation's screen too, so the
    // banner names WHICH extra and, for a countdown, how long: "started a
    // 5 minute countdown on the screen" is something the operator can check
    // against the wall. A `check` reads and stays quiet.
    owa_foreground: 'put a countdown or a message on the screen',
    // The user's saved passages and notes, and putting a change back. Each
    // names what it touched below: "removed a note from Default" is a
    // sentence the operator can check, "changed a note" is not.
    owa_bible_item: 'changed the saved Bible passages',
    owa_bible_note: 'changed a Bible note',
    owa_undo: 'put back an earlier change',
};

// What a write to one of the user's documents reads as, by action, or no
// entry for a read (`list`, `info`, `slides`). A delete says where it went.
const AGENT_FILE_PHRASE_MAP = {
    create: (what, named) => `made the ${what} ${named}`,
    update: (what, named) => `changed the ${what} ${named}`,
    rename: (what, named) => `renamed the ${what} ${named}`,
    delete: (what, named) => `moved the ${what} ${named} to the trash`,
    'add-slide': (_what, named) => `added a slide to ${named}`,
    'update-slide': (_what, named, slide) => `changed ${slide} of ${named}`,
    'delete-slide': (_what, named, slide) => `removed ${slide} from ${named}`,
    'move-slide': (_what, named, slide) => `moved ${slide} of ${named}`,
    'duplicate-slide': (_what, named, slide) => `copied ${slide} of ${named}`,
};

// The saved passages and notes, the same way.
const AGENT_DATA_PHRASE_MAP = {
    owa_bible_item: {
        add: (args, list) =>
            typeof args?.reference === 'string' && args.reference.trim() !== ''
                ? `saved ${args.reference.trim()} to the Bibles list ${list}`
                : `saved a passage to the Bibles list ${list}`,
        update: (_args, list) => `changed a saved passage in ${list}`,
        delete: (_args, list) => `removed a saved passage from ${list}`,
        'create-list': (_args, list) => `made the Bibles list ${list}`,
        'rename-list': (_args, list) => `renamed the Bibles list ${list}`,
        'delete-list': (_args, list) =>
            `moved the Bibles list ${list} to the trash`,
    },
    owa_bible_note: {
        add: (_args, file) => `added a note to ${file}`,
        update: (_args, file) => `changed a note in ${file}`,
        delete: (_args, file) => `removed a note from ${file}`,
        'create-file': (_args, file) => `made the notes file ${file}`,
        'rename-file': (_args, file) => `renamed the notes file ${file}`,
        'delete-file': (_args, file) =>
            `moved the notes file ${file} to the trash`,
    },
};

function toQuotedName(name, fallback) {
    return typeof name === 'string' && name.trim() !== ''
        ? `"${name.trim()}"`
        : fallback;
}

// What each foreground extra is called in a banner.
const FOREGROUND_BANNER_NOUN_MAP = {
    countdown: 'the countdown',
    stopwatch: 'the stopwatch',
    clock: 'the clock',
    'marquee-top': 'the scrolling message',
    'marquee-bottom': 'the scrolling message',
    'quick-text': 'the line of text',
    all: 'every foreground extra',
};

// The banner for `owa_foreground` says WHICH extra and, for a countdown, how
// long -- "started a 5 minute countdown on the screen" is a sentence the
// operator can check against the wall, where "put an extra on the screen"
// is not. A `check` reads and is quiet, like every other read.
function describeForegroundCall(args) {
    if (args?.action === 'check') {
        return null;
    }
    const widget = typeof args?.widget === 'string' ? args.widget : '';
    const noun = FOREGROUND_BANNER_NOUN_MAP[widget];
    if (args?.action === 'stop') {
        return noun === undefined
            ? 'took a foreground extra off the screen'
            : `took ${noun} off the screen`;
    }
    switch (widget) {
        case 'countdown':
            if (typeof args?.minutes === 'number') {
                return `started a ${args.minutes} minute countdown on the screen`;
            }
            return typeof args?.at === 'string' && args.at.trim() !== ''
                ? `started a countdown to ${args.at.trim()} on the screen`
                : 'started a countdown on the screen';
        case 'stopwatch':
            return 'started a stopwatch on the screen';
        case 'clock':
            return 'put a clock on the screen';
        case 'marquee-top':
        case 'marquee-bottom':
            return 'put a scrolling message on the screen';
        case 'quick-text':
            return 'put a line of text on the screen';
        default:
            return ACTING_TOOLS.owa_foreground;
    }
}

// Two tools say more than their entry. `owa_find_ui` only draws when asked to,
// so without a highlight it is a read; `owa_read_website` names where it went.
export function describeToolCall(name, args) {
    if (name === 'owa_find_ui' && args?.highlight !== true) {
        return null;
    }
    if (name === 'owa_lyric_file' || name === 'owa_slide_file') {
        const phrase = AGENT_FILE_PHRASE_MAP[args?.action];
        if (phrase === undefined) {
            // `list`, `info` and `slides` only read, and a banner per read
            // would both cry wolf and photograph itself during a QA run.
            return null;
        }
        const what = name === 'owa_lyric_file' ? 'song' : 'slide document';
        const slide = Number.isInteger(args?.slide)
            ? `slide ${args.slide}`
            : 'a slide';
        return phrase(what, toQuotedName(args?.name, `a ${what}`), slide)
            .replace(`the ${what} a ${what}`, `a ${what}`);
    }
    if (Object.hasOwn(AGENT_DATA_PHRASE_MAP, name)) {
        const phraseMap = AGENT_DATA_PHRASE_MAP[name];
        if (!Object.hasOwn(phraseMap, String(args?.action))) {
            return null;
        }
        const where = toQuotedName(
            name === 'owa_bible_item' ? args?.list : args?.file,
            '"Default"',
        );
        return phraseMap[args.action](args, where);
    }
    if (name === 'owa_undo') {
        return args?.action === 'undo' ? ACTING_TOOLS.owa_undo : null;
    }
    if (name === 'owa_present_bible') {
        if (args?.action === 'check') {
            return null;
        }
        const reference =
            typeof args?.reference === 'string' ? args.reference.trim() : '';
        return reference === ''
            ? ACTING_TOOLS.owa_present_bible
            : `put ${reference} on the screen`;
    }
    if (name === 'owa_foreground') {
        return describeForegroundCall(args);
    }
    if (name === 'owa_read_website' || checkIsDraftFromPage(name, args)) {
        const site = toSiteName(args?.url);
        // The generic entry above, when the address is unreadable: a tool
        // that announces itself only for well-formed input announces itself
        // exactly when it matters least.
        return site === null
            ? ACTING_TOOLS.owa_read_website
            : `read a page on ${site}`;
    }
    return ACTING_TOOLS[name] ?? null;
}

/**
 * The song drafter, handed a page address. It is a local tool -- checking or
 * drafting a paste opens nothing and says nothing -- but given a `url` it
 * opens the same hidden window `owa_read_website` does, and what left this
 * computer is announced the same way whichever tool sent it.
 */
function checkIsDraftFromPage(name, args) {
    return (
        name === 'owa_lyric_validate' &&
        typeof args?.url === 'string' &&
        args.url.trim() !== ''
    );
}

// Just the site, never the whole address: the path is where an exfiltration
// attempt puts its payload, and a banner is a thing glanced at, not read.
function toSiteName(url) {
    try {
        return new URL(String(url)).hostname;
    } catch {
        return null;
    }
}

const NOTICE_RUNTIME = `
(() => {
    if (window.__owaAgentNotice !== undefined) {
        return window.__owaAgentNotice;
    }
    const host = document.createElement('div');
    host.id = 'owa-agent-notice-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483645;' +
        'pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = \`
        <style>
            .pill {
                position: fixed; top: 10px; left: 50%; translate: -50% 0;
                display: flex; align-items: center; gap: 8px;
                padding: 6px 14px 6px 10px; border-radius: 999px;
                background: rgba(16, 21, 28, 0.94); color: #f2f5f8;
                border: 1px solid rgba(255, 187, 51, 0.55);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                font: 13px/1.3 system-ui, -apple-system, sans-serif;
                white-space: nowrap; pointer-events: none;
                opacity: 0; transition: opacity 0.2s ease-out;
            }
            .pill[data-shown="yes"] { opacity: 1; }
            .dot {
                width: 8px; height: 8px; border-radius: 50%;
                background: #ffbb33; flex: 0 0 auto;
                animation: beat 1s ease-in-out infinite;
            }
            @keyframes beat {
                0%, 100% { opacity: 1; } 50% { opacity: 0.25; }
            }
            .what { opacity: 0.75; }
        </style>
        <div class="pill">
            <span class="dot"></span>
            <span><b>Assistant</b> <span class="what"></span></span>
        </div>
    \`;
    document.documentElement.appendChild(host);
    const pill = root.querySelector('.pill');
    const what = root.querySelector('.what');
    let hideTimeout = null;
    const api = {
        show(text) {
            what.textContent = String(text ?? 'is using the app');
            pill.dataset.shown = 'yes';
            clearTimeout(hideTimeout);
            // Long enough to read, short enough that it is gone before the
            // next thing the user does.
            hideTimeout = setTimeout(() => {
                pill.dataset.shown = 'no';
            }, 2600);
            return true;
        },
    };
    window.__owaAgentNotice = api;
    return api;
})()`;

function genNoticeExpression(text) {
    return (
        `(() => { const api = ${NOTICE_RUNTIME};` +
        ` return api.show(${JSON.stringify(text)}); })()`
    );
}

// Same phrase in the same window, twice in a row, while the first is still on
// screen: one banner. Keyed by the window as well as the phrase -- two agents
// (the chatbot and an outside client) acting on two different windows at once
// are two things happening, and the user is owed a banner in each.
let lastKey = null;
let lastAt = 0;

/**
 * Fire and forget on purpose: a tool call must not wait for its own banner,
 * and an app that has closed since must not turn one into a failed tool.
 */
export function notifyToolCall(name, args) {
    if (process.env.OWA_MCP_NOTICE === '0') {
        return;
    }
    const said = describeToolCall(name, args);
    if (said === null) {
        return;
    }
    const match = typeof args?.page === 'string' ? args.page : undefined;
    const now = Date.now();
    const key = `${match ?? ''}|${said}`;
    if (key === lastKey && now - lastAt < 1200) {
        return;
    }
    lastKey = key;
    lastAt = now;
    evaluateInApp(genNoticeExpression(said), { match }).catch(() => {});
}

/**
 * Every `tools/call` on its way in, without touching the MCP server's own
 * dispatch: the transport hands each message to `onmessage`, so that is the
 * one seam both the stdio and the HTTP host already share.
 *
 * Call this AFTER `server.connect`, and only wrap what is there. The SDK
 * CHAINS the handler it finds -- it keeps the old `onmessage` and calls it
 * from the new one -- so an accessor that answers "me" when it reads, and
 * stores what it writes, hands the SDK a closure that calls straight back into
 * this one: every message then recursed until the stack ran out and the whole
 * MCP host answered 500 to `initialize`.
 */
export function watchToolCalls(transport) {
    if (transport === null || typeof transport !== 'object') {
        return transport;
    }
    if (transport.__owaNoticeWrapped === true) {
        return transport;
    }
    const inner = transport.onmessage;
    transport.__owaNoticeWrapped = true;
    transport.onmessage = (message, extra) => {
        try {
            if (message?.method === 'tools/call') {
                notifyToolCall(message.params?.name, message.params?.arguments);
            }
        } catch (_error) {
            // A banner is never a reason for a tool call not to happen.
        }
        return inner?.call(transport, message, extra);
    };
    return transport;
}
