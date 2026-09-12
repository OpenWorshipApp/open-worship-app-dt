// Live verification of the new owa_* tools against the running dev app.
// Talks MCP over the app's streamable-HTTP host exactly the way the chatbot
// does (src/chatbot/mcpClient.ts): one session, tools/list, tools/call.
//
//   node extra-work/verify-chatbot-tools.mjs
//
// Exits 1 on any failed check. Read-only checks plus one harmless click
// (the Bible version button) and one type into the reader reference box.

const MCP_URL = 'http://127.0.0.1:39223/mcp';

let sessionId = null;
let requestId = 0;
let failures = 0;

async function post(body) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
    };
    if (sessionId !== null) {
        headers['mcp-session-id'] = sessionId;
    }
    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
        sessionId = newSessionId;
    }
    if (!response.ok) {
        if (response.status === 404) {
            sessionId = null;
        }
        throw new Error(`MCP host answered ${response.status}`);
    }
    if (response.status === 202) {
        return null;
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error.message ?? 'MCP call failed');
    }
    return data?.result ?? null;
}

async function ensureSession() {
    if (sessionId !== null) {
        return;
    }
    await post({
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'owa-verify', version: '0.1.0' },
        },
    });
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
}

async function callTool(name, args = {}) {
    await ensureSession();
    const result = await post({
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'tools/call',
        params: { name, arguments: args },
    });
    const text = (result?.content ?? [])
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n');
    if (result?.isError) {
        throw new Error(text || 'tool call failed');
    }
    return text;
}

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) {
        failures += 1;
    }
}

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

const NEW_TOOLS = [
    'owa_list_ui',
    'owa_click',
    'owa_type',
    'owa_find_ui',
    'owa_guide_start',
    'owa_guide_step',
    'owa_guide_status',
];

// 1. The new tools are registered.
await ensureSession();
const { tools } = await post({
    jsonrpc: '2.0',
    id: ++requestId,
    method: 'tools/list',
});
const names = (tools ?? []).map((tool) => tool.name);
for (const name of NEW_TOOLS) {
    check(`tools/list has ${name}`, names.includes(name));
}
console.log(`(total tools exposed: ${names.length})`);

// 2. owa_list_ui on the reader window shows real controls.
const listed = parseJson(
    await callTool('owa_list_ui', { page: 'reader.html', limit: 120 }),
);
check('owa_list_ui returns controls', (listed?.count ?? 0) > 5, `count=${listed?.count}`);
const labels = (listed?.controls ?? []).map((row) => row.label);
console.log('  sample labels:', labels.slice(0, 12).join(' | '));

// 3. The screenshot scenario: "reference box" misses, but near misses name
//    the real label.
const missed = parseJson(
    await callTool('owa_find_ui', { text: 'reference box', page: 'reader.html' }),
);
const nearMissLabels = (missed?.nearMisses ?? []).join(' | ');
check(
    'owa_find_ui "reference box" names the real box as a near miss',
    missed !== null &&
        (missed.count > 0 ||
            (missed.nearMisses ?? []).some((label) => {
                return /reference/i.test(label);
            })),
    `count=${missed?.count} nearMisses=${nearMissLabels}`,
);

// 4. Cross-window search tags the page each match lives in.
const any = parseJson(
    await callTool('owa_find_ui', { text: 'settings', anyPage: true }),
);
check(
    'owa_find_ui anyPage tags matches with their window',
    (any?.matches ?? []).every((match) => typeof match.page === 'string'),
    `count=${any?.count}`,
);

// 5. Type a reference into the reader's reference box (the failing case in
//    the screenshot) -- by its accessible name. A button that shares the
//    words (a history row) must never be picked for typing.
const typed = parseJson(
    await callTool('owa_type', {
        find: ['Bible Reference'],
        value: 'John 3:16',
        page: 'reader.html',
    }),
);
check(
    'owa_type into the reference box',
    typed?.typed === 'John 3:16',
    JSON.stringify(typed).slice(0, 200),
);

// 6. Click by label: the Bible version button (reads "KJV").
const clicked = parseJson(
    await callTool('owa_click', { find: ['KJV'], page: 'reader.html' }),
);
check(
    'owa_click the version button',
    clicked?.clicked !== null && clicked?.clicked !== undefined,
    JSON.stringify(clicked).slice(0, 200),
);
// Close whatever the click opened, so the window is left as found.
await callTool('owa_guide_step', { action: 'stop', page: 'reader.html' }).catch(
    () => {},
);

// 7. A guide whose step names an on-screen control starts with the target
//    found, and nearMisses ride along when it does not.
const guide = parseJson(
    await callTool('owa_guide_start', {
        title: 'Verification guide',
        page: 'reader.html',
        steps: [
            { text: 'Click the Bible version button.', find: 'KJV' },
            { text: 'Click in the reference box.', find: 'Bible Reference' },
        ],
    }),
);
check('guide starts', guide?.isRunning === true, `step 1 found=${guide?.isTargetFound}`);
await callTool('owa_guide_step', { action: 'next', page: 'reader.html' });
const status = parseJson(
    await callTool('owa_guide_status', { page: 'reader.html' }),
);
check(
    'guide step 2 rings the reference box (the screenshot failure)',
    status?.isTargetFound === true,
    `isTargetFound=${status?.isTargetFound} find=${JSON.stringify(status?.find)}`,
);
await callTool('owa_guide_step', { action: 'stop', page: 'reader.html' });

// 8. The page-mismatch case (the second screenshot): a guide for the page
//    that is not open must say so AND name the pages that are.
let pageError = null;
try {
    await callTool('owa_guide_start', {
        title: 'Wrong window',
        page: 'presenter.html',
        steps: [{ text: 'Click Bible Lookup.', find: 'Bible Lookup' }],
    });
} catch (error) {
    pageError = error.message;
}
check(
    'guide for a page that is not open names the pages that are',
    pageError !== null &&
        pageError.includes('no open page matching "presenter.html"') &&
        pageError.includes('reader.html'),
    pageError?.slice(0, 160),
);

// 9. owa_goto_page walks the main window across and back.
const gone = parseJson(await callTool('owa_goto_page', { page: 'presenter.html' }));
check(
    'owa_goto_page switches the window to the presenter',
    gone?.switched === true || gone?.page === 'presenter.html',
    JSON.stringify(gone),
);
const back = parseJson(await callTool('owa_goto_page', { page: 'reader.html' }));
check(
    'owa_goto_page switches back to the reader',
    back?.switched === true || back?.page === 'reader.html',
    JSON.stringify(back),
);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
