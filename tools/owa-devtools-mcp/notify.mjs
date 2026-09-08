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
};

// What a write to one of the user's documents is called, or null for a read.
const AGENT_FILE_VERBS = {
    create: 'made',
    update: 'changed',
    rename: 'renamed',
};

// Two tools say more than their entry. `owa_find_ui` only draws when asked to,
// so without a highlight it is a read; `owa_read_website` names where it went.
export function describeToolCall(name, args) {
    if (name === 'owa_find_ui' && args?.highlight !== true) {
        return null;
    }
    if (name === 'owa_lyric_file' || name === 'owa_slide_file') {
        const verb = AGENT_FILE_VERBS[args?.action];
        if (verb === undefined) {
            // `list` and `info` only read, and a banner per read would both
            // cry wolf and photograph itself during a QA run.
            return null;
        }
        const what = name === 'owa_lyric_file' ? 'song' : 'slide document';
        const named = typeof args?.name === 'string' && args.name !== '';
        return named ? `${verb} the ${what} "${args.name}"` : `${verb} a ${what}`;
    }
    if (name === 'owa_read_website') {
        const site = toSiteName(args?.url);
        // The generic entry above, when the address is unreadable: a tool
        // that announces itself only for well-formed input announces itself
        // exactly when it matters least.
        return site === null
            ? ACTING_TOOLS[name]
            : `read a page on ${site}`;
    }
    return ACTING_TOOLS[name] ?? null;
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
