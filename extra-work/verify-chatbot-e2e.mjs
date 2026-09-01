// Live end-to-end test of the chatbot against the running dev app: drives the
// real chatbot window (focus switch, provider switch, model picker, ask form)
// over CDP, asks a question per cell of the presenter|reader x claude|chatgpt
// matrix, and for one cell per provider presses "Show me step by step" and
// confirms the guide card lands on a real control in the right window.
//
//   node extra-work/verify-chatbot-e2e.mjs
//
// Spends real API calls on the user's own keys -- that is the point of the
// run. Restores the main window to reader.html and stops any guide at the
// end. Exits 1 on any failed check.

const MCP_URL = 'http://127.0.0.1:39223/mcp';
const ANSWER_TIMEOUT_MS = 120000;

let failures = 0;
function check(label, ok, detail = '') {
    console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
    );
    if (!ok) {
        failures += 1;
    }
}
function note(text) {
    console.log(`  ..  ${text}`);
}

// ---- CDP plumbing (mirrors tools/owa-devtools-mcp/cdp.mjs, self-contained) --

async function getCdpPort() {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) {
            continue;
        }
        const info = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        try {
            const res = await fetch(`${info.url}/json/version`, {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                return info.port;
            }
        } catch {
            // A stale file for a dead instance.
        }
    }
    throw new Error('No live app instance found');
}

async function listPages(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(5000),
    });
    const targets = await res.json();
    return targets.filter((target) => {
        return target.type === 'page' && !target.url.startsWith('devtools://');
    });
}

function evaluateInTarget(target, expression, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const timeoutId = setTimeout(() => {
            socket.close();
            reject(new Error(`Timed out evaluating in ${target.url}`));
        }, timeout);
        const finish = (error, value) => {
            clearTimeout(timeoutId);
            try {
                socket.close();
            } catch {
                // Already closing.
            }
            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        };
        socket.addEventListener('error', () => {
            finish(new Error(`Could not attach to ${target.url}`));
        });
        socket.addEventListener('open', () => {
            socket.send(
                JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression,
                        returnByValue: true,
                        awaitPromise: true,
                        allowUnsafeEvalBlockedByCSP: true,
                    },
                }),
            );
        });
        socket.addEventListener('message', (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (message.id !== 1) {
                return;
            }
            if (message.error) {
                finish(new Error(message.error.message));
                return;
            }
            const { result, exceptionDetails } = message.result ?? {};
            if (exceptionDetails) {
                finish(
                    new Error(
                        exceptionDetails.exception?.description ??
                            exceptionDetails.text,
                    ),
                );
                return;
            }
            finish(null, result?.value);
        });
    });
}

async function findPage(port, match, timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const pages = await listPages(port);
        const found = pages.find((page) => page.url.includes(match));
        if (found !== undefined) {
            return found;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return null;
}

// ---- MCP plumbing (for owa_guide_status on the app windows) ----------------

let mcpSessionId = null;
let mcpRequestId = 0;
async function mcpPost(body) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
    };
    if (mcpSessionId !== null) {
        headers['mcp-session-id'] = mcpSessionId;
    }
    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
        mcpSessionId = newSessionId;
    }
    if (!response.ok || response.status === 202) {
        return null;
    }
    const data = await response.json();
    return data?.result ?? null;
}
async function mcpCallTool(name, args = {}) {
    if (mcpSessionId === null) {
        await mcpPost({
            jsonrpc: '2.0',
            id: ++mcpRequestId,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'owa-verify-e2e', version: '0.1.0' },
            },
        });
        await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
    }
    const result = await mcpPost({
        jsonrpc: '2.0',
        id: ++mcpRequestId,
        method: 'tools/call',
        params: { name, arguments: args },
    });
    const text = (result?.content ?? [])
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n');
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// ---- Chatbot window driving ------------------------------------------------

// A snapshot of the chatbot window's state, taken in one evaluation.
const CHATBOT_STATE_EXPRESSION = `(() => {
    const readSeg = (label) => {
        const group = document.querySelector(
            '.chat-head-row [aria-label="' + label + '"]',
        );
        if (group === null) {
            return null;
        }
        const buttons = [...group.querySelectorAll('button')].map((button) => ({
            label: button.textContent.trim(),
            isOn: button.classList.contains('is-on'),
            isDisabled: button.disabled,
        }));
        return buttons;
    };
    const modelPicker = document.querySelector('select.chat-engine');
    const messages = [...document.querySelectorAll('.chat-cues > *')].map(
        (item) => ({
            isAsked: item.textContent.includes('Ask again'),
            text: item.textContent.replace(/\\s+/g, ' ').trim().slice(0, 300),
            actions: [...item.querySelectorAll('button')]
                .map((button) => button.textContent.trim())
                .filter((label) => {
                    return label.length > 0 &&
                        !['Ask again', 'Copy'].includes(label);
                }),
        }),
    );
    return {
        url: location.href,
        focus: readSeg('Which part of the app'),
        providers: readSeg('Which model answers'),
        model: modelPicker === null ? null : modelPicker.value,
        modelOptions: modelPicker === null
            ? []
            : [...modelPicker.options].map((option) => ({
                value: option.value,
                label: option.textContent.trim(),
            })),
        isBusy: document.querySelector('.chat-status') !== null,
        alert: document.querySelector('.chat-alert')?.textContent ?? null,
        engineOff: document.querySelector('.chat-engine-off') !== null,
        messages,
        tabCount: document.querySelectorAll('.chat-tab').length,
    };
})()`;

// Click a seg button by its label; answer the resulting state.
function genClickSegExpression(groupLabel, buttonLabel) {
    return `(() => {
        const group = document.querySelector('.chat-head-row [aria-label="' +
            ${JSON.stringify(groupLabel)} + '"]');
        if (group === null) {
            return { ok: false, reason: 'no group' };
        }
        const button = [...group.querySelectorAll('button')].find((one) => {
            return one.textContent.trim() === ${JSON.stringify(buttonLabel)};
        });
        if (button === undefined) {
            return { ok: false, reason: 'no button' };
        }
        if (button.disabled) {
            return { ok: false, reason: 'disabled' };
        }
        button.click();
        return { ok: true };
    })()`;
}

// Ask a question through the real form: the React-controlled input takes the
// native setter plus an input event, then the form is submitted by its own
// requestSubmit so the Ask button's disabled state is honoured.
function genAskExpression(question) {
    return `(() => {
        const input = document.querySelector('input.chat-input');
        const form = document.querySelector('form.chat-ask');
        if (input === null || form === null) {
            return { ok: false, reason: 'no form' };
        }
        if (input.disabled) {
            return { ok: false, reason: 'busy' };
        }
        const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(input), 'value',
        )?.set;
        setter.call(input, ${JSON.stringify(question)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        form.requestSubmit();
        return { ok: true };
    })()`;
}

// Open a fresh chat tab so each cell starts clean.
const NEW_TAB_EXPRESSION = `(() => {
    const button = [...document.querySelectorAll('button')].find((one) => {
        return one.textContent.trim() === '+' ||
            (one.getAttribute('aria-label') ?? '').match(/new/i) !== null;
    });
    if (button === undefined) {
        return { ok: false, reason: 'no new-tab button' };
    }
    button.click();
    return { ok: true };
})()`;

async function getChatbotState(chatbotPage) {
    return await evaluateInTarget(chatbotPage, CHATBOT_STATE_EXPRESSION);
}

async function waitForIdle(chatbotPage, timeoutMs = ANSWER_TIMEOUT_MS) {
    const startedAt = Date.now();
    // Let the busy state appear before waiting for it to go.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    while (Date.now() - startedAt < timeoutMs) {
        const state = await getChatbotState(chatbotPage);
        if (!state.isBusy) {
            return state;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return null;
}

async function clickActionButton(chatbotPage, label) {
    return await evaluateInTarget(
        chatbotPage,
        `(() => {
            const buttons = [...document.querySelectorAll('.chat-cues button')];
            const button = buttons.find((one) => {
                return one.textContent.trim().toLowerCase() ===
                    ${JSON.stringify(label.toLowerCase())};
            });
            if (button === undefined) {
                return { ok: false };
            }
            button.click();
            return { ok: true };
        })()`,
    );
}

async function setModel(chatbotPage, modelId) {
    return await evaluateInTarget(
        chatbotPage,
        `(() => {
            const picker = document.querySelector('select.chat-engine');
            if (picker === null) {
                return { ok: false, reason: 'no picker' };
            }
            const option = [...picker.options].find((one) => {
                return one.value === ${JSON.stringify(modelId)};
            });
            if (option === undefined) {
                return { ok: false, reason: 'no option' };
            }
            const setter = Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(picker), 'value',
            )?.set;
            setter.call(picker, option.value);
            picker.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true };
        })()`,
    );
}

// ---- The matrix ------------------------------------------------------------

const port = await getCdpPort();
note(`app CDP on port ${port}`);

let chatbotPage = await findPage(port, 'chatbot.html');
if (chatbotPage === null) {
    // The window may not be open after a restart -- open it the way the
    // user does, with the robot button in the header.
    const mainPage = await findPage(port, 'reader.html');
    if (mainPage !== null) {
        await evaluateInTarget(
            mainPage,
            `(() => {
                const button = document.querySelector(
                    '[aria-label="App Assistant"]',
                );
                if (button !== null) {
                    button.click();
                    return { ok: true };
                }
                return { ok: false };
            })()`,
        );
        chatbotPage = await findPage(port, 'chatbot.html');
    }
}
if (chatbotPage === null) {
    console.log('FATAL: the chatbot window is not open in the running app');
    process.exit(1);
}

const initial = await getChatbotState(chatbotPage);
const available = (initial.providers ?? [])
    .filter((item) => !item.isDisabled)
    .map((item) => item.label);
note(`providers: ${(initial.providers ?? [])
    .map((item) => `${item.label}${item.isDisabled ? ' (no key)' : ''}`)
    .join(', ')}`);
note(`models on current provider: ${(initial.modelOptions ?? [])
    .map((item) => item.label)
    .join(', ')}`);

if (initial.engineOff || available.length === 0) {
    console.log(
        'FATAL: no LLM provider has an API key in this profile — add one ' +
            'in Settings → Others and re-run.',
    );
    process.exit(1);
}

// focus -> { question, guidePage, verifyFirstFind }
const FOCUS_CASES = {
    reader: {
        button: 'Bible Reader',
        question: 'How do I look up a verse?',
        guidePage: 'reader.html',
    },
    presenter: {
        button: 'Presenter',
        question: 'How do I present a verse on the screen?',
        guidePage: 'presenter.html',
    },
};

let guideCheckedFor = new Set();

async function waitForAskReady(chatbotPage, timeoutMs = 8000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const ready = await evaluateInTarget(
            chatbotPage,
            `(() => {
                const input = document.querySelector('input.chat-input');
                return { ready: input !== null && !input.disabled };
            })()`,
        );
        if (ready.ready) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
}

async function runCell({ focusKey, providerLabel, modelId, withGuide }) {
    const tag = `${focusKey} / ${providerLabel}${modelId ? ` / ${modelId}` : ''}`;
    // Fresh tab per cell, so a previous answer never reads as this one. The
    // new tab's input takes a beat to come back enabled -- asking while the
    // busy flag is still up drops the question without a word.
    await evaluateInTarget(chatbotPage, NEW_TAB_EXPRESSION);
    const isReady = await waitForAskReady(chatbotPage);
    if (!isReady) {
        check(`${tag}: ask`, false, 'input never became ready');
        return;
    }
    const focusClick = await evaluateInTarget(
        chatbotPage,
        genClickSegExpression(
            'Which part of the app',
            FOCUS_CASES[focusKey].button,
        ),
    );
    if (!focusClick.ok) {
        check(`${tag}: set focus`, false, focusClick.reason);
        return;
    }
    const providerClick = await evaluateInTarget(
        chatbotPage,
        genClickSegExpression('Which model answers', providerLabel),
    );
    if (!providerClick.ok) {
        check(`${tag}: set provider`, false, providerClick.reason);
        return;
    }
    if (modelId !== null) {
        const modelSet = await setModel(chatbotPage, modelId);
        if (!modelSet.ok) {
            check(`${tag}: set model`, false, modelSet.reason);
            return;
        }
    }
    const head = await getChatbotState(chatbotPage);
    const chosenModel = head.model;
    note(`${tag}: asking (model=${chosenModel})`);
    const asked = await evaluateInTarget(
        chatbotPage,
        genAskExpression(FOCUS_CASES[focusKey].question),
    );
    if (!asked.ok) {
        check(`${tag}: ask`, false, asked.reason);
        return;
    }
    const done = await waitForIdle(chatbotPage);
    if (done === null) {
        check(`${tag}: answer arrives`, false, 'still busy after 120s');
        return;
    }
    const last = done.messages[done.messages.length - 1];
    const answered =
        last !== undefined && !last.isAsked && last.text.length > 30;
    check(`${tag}: answer arrives`, answered, last?.text.slice(0, 120));
    check(
        `${tag}: no error banner`,
        done.alert === null,
        done.alert ?? undefined,
    );
    const stepByStep = (last?.actions ?? []).find((label) => {
        return /step by step/i.test(label);
    });
    note(
        `${tag}: action buttons: ${(last?.actions ?? []).join(', ') || '(none)'}`,
    );

    if (withGuide && stepByStep !== undefined) {
        await clickActionButton(chatbotPage, stepByStep);
        // The recipe card goes up at once; the model REBUILD behind it (for
        // the steps the recipe could not point at) takes a minute. Wait out
        // the busy spinner before judging where the guide ended up.
        const guided = await waitForIdle(chatbotPage, ANSWER_TIMEOUT_MS);
        note(
            `${tag}: guide rebuild ${guided === null ? 'timed out' : 'settled'}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const status = await mcpCallTool('owa_guide_status', {
            page: FOCUS_CASES[focusKey].guidePage,
        });
        check(
            `${tag}: guide card running in ${FOCUS_CASES[focusKey].guidePage}`,
            status?.isRunning === true,
            JSON.stringify({
                isRunning: status?.isRunning,
                find: status?.find,
                isTargetFound: status?.isTargetFound,
                nearMisses: status?.nearMisses,
            }),
        );
        // A recipe's early steps can be prose with nothing to ring (the card
        // itself says "do this step in the window"). What matters is that the
        // first step that NAMES a control lands on one.
        let ringed = null;
        for (let step = 0; step < (status?.stepCount ?? 0); step++) {
            const current = await mcpCallTool('owa_guide_status', {
                page: FOCUS_CASES[focusKey].guidePage,
            });
            if (current?.isRunning !== true) {
                break;
            }
            if (typeof current?.find === 'string' && current.find.length > 0) {
                ringed = current;
                break;
            }
            await mcpCallTool('owa_guide_step', {
                action: 'next',
                page: FOCUS_CASES[focusKey].guidePage,
            });
        }
        if (ringed === null) {
            note(`${tag}: no step names a control to ring (prose-only recipe)`);
        } else {
            check(
                `${tag}: a step's ring lands on a real control`,
                ringed.isTargetFound === true,
                `find=${JSON.stringify(ringed.find)} ` +
                    `nearMisses=${JSON.stringify(ringed.nearMisses)}`,
            );
        }
        await mcpCallTool('owa_guide_step', {
            action: 'stop',
            page: FOCUS_CASES[focusKey].guidePage,
        });
        guideCheckedFor.add(`${focusKey}/${providerLabel}`);
    }
}

// Reader half, both providers, default models; guide verification on each.
for (const providerLabel of available) {
    await runCell({
        focusKey: 'reader',
        providerLabel,
        modelId: null,
        withGuide: true,
    });
}

// The page-mismatch case: focus says Presenter while the main window is the
// Bible Reader. The guide cannot start on a page that is not open, so the
// answer must be "go to the Presenter first" with a retry button -- and the
// retry must start the guide once the window has switched.
{
    const tag = 'switch-guidance';
    await evaluateInTarget(chatbotPage, NEW_TAB_EXPRESSION);
    await waitForAskReady(chatbotPage);
    await evaluateInTarget(
        chatbotPage,
        genClickSegExpression('Which part of the app', 'Presenter'),
    );
    await evaluateInTarget(
        chatbotPage,
        genClickSegExpression('Which model answers', available[0]),
    );
    note(`${tag}: asking with focus=Presenter while the window is the reader`);
    await evaluateInTarget(
        chatbotPage,
        genAskExpression('How do I present a verse on the screen?'),
    );
    const answeredState = await waitForIdle(chatbotPage);
    const answer =
        answeredState?.messages[answeredState.messages.length - 1];
    const stepByStep = (answer?.actions ?? []).find((label) => {
        return /step by step/i.test(label);
    });
    check(`${tag}: answer offers step by step`, stepByStep !== undefined);
    if (stepByStep !== undefined) {
        await clickActionButton(chatbotPage, stepByStep);
        const guided = await waitForIdle(chatbotPage);
        const reply = guided?.messages[guided.messages.length - 1];
        check(
            `${tag}: told to switch to the Presenter first, not an error`,
            /go to the presenter first/i.test(reply?.text ?? ''),
            reply?.text.slice(0, 120),
        );
        const retry = (reply?.actions ?? []).find((label) => {
            return /start it/i.test(label);
        });
        check(`${tag}: retry button offered`, retry !== undefined);
        // Switch with the new tool, then the retry must start the guide.
        await mcpCallTool('owa_goto_page', { page: 'presenter.html' });
        if (retry !== undefined) {
            await clickActionButton(chatbotPage, retry);
            await waitForIdle(chatbotPage);
            await new Promise((resolve) => setTimeout(resolve, 2500));
            const status = await mcpCallTool('owa_guide_status', {
                page: 'presenter.html',
            });
            check(
                `${tag}: guide runs once the window has switched`,
                status?.isRunning === true,
                JSON.stringify({
                    isRunning: status?.isRunning,
                    isTargetFound: status?.isTargetFound,
                }),
            );
            await mcpCallTool('owa_guide_step', {
                action: 'stop',
                page: 'presenter.html',
            });
        }
    }
}

// Presenter half: the main window must BE the presenter for its controls to
// be on screen. From the reader it is the "Go Back to Presenter" button in
// the header -- the one button with that aria-label.
const readerPage = await findPage(port, 'reader.html');
if (readerPage !== null) {
    const clicked = await evaluateInTarget(
        readerPage,
        `(() => {
            const button = document.querySelector(
                '[aria-label="Go Back to Presenter"]',
            );
            if (button !== null) {
                button.click();
                return { ok: true };
            }
            return { ok: false };
        })()`,
    );
    note(`presenter switch click: ${JSON.stringify(clicked)}`);
}
const presenterPage = await findPage(port, 'presenter.html');
check(
    'main window switched to presenter.html',
    presenterPage !== null,
);

if (presenterPage !== null) {
    for (const providerLabel of available) {
        await runCell({
            focusKey: 'presenter',
            providerLabel,
            modelId: null,
            withGuide: true,
        });
    }
}

// Different models: one more cell per provider on the reader with the LAST
// built-in model (the first is the default already covered above).
for (const providerLabel of available) {
    await evaluateInTarget(
        chatbotPage,
        genClickSegExpression('Which model answers', providerLabel),
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    const state = await getChatbotState(chatbotPage);
    const realModels = (state.modelOptions ?? []).filter((option) => {
        return option.value !== '::more::';
    });
    const other = realModels[realModels.length - 1];
    if (other !== undefined && other.value !== state.model) {
        await runCell({
            focusKey: 'reader',
            providerLabel,
            modelId: other.value,
            withGuide: false,
        });
    } else {
        note(`${providerLabel}: only one model listed, skipping model cell`);
    }
}

// Restore: main window back to the Bible Reader, the page it was on.
if (presenterPage !== null) {
    const backPage = await findPage(port, 'presenter.html');
    if (backPage !== null) {
        await evaluateInTarget(
            backPage,
            `(() => {
                // The presenter header's own tabs list the Bible Reader.
                const tab = [...document.querySelectorAll('button')]
                    .find((one) => {
                        return /bible reader/i.test(one.textContent) &&
                            one.classList.contains('nav-link');
                    });
                if (tab !== undefined) {
                    tab.click();
                    return { ok: true };
                }
                return { ok: false };
            })()`,
        );
    }
    const restored = await findPage(port, 'reader.html');
    check('main window restored to reader.html', restored !== null);
}

console.log(
    failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
