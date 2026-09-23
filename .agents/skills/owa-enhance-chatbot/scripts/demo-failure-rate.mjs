// Presses **Do it** through every step of every manual recipe, against the
// running app, and reports how often the card could not do the step.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/demo-failure-rate.mjs
//   node .../demo-failure-rate.mjs --recipes=W-08,W-06 --json
//   node .../demo-failure-rate.mjs --page=presenter    (only recipes filed there)
//
// "Do it for me" is the walkthrough's whole promise, and it is kept one step
// at a time by a card that has to find a control by its words, see whether
// anything is in front of it, and press it. Any of those can fail on any step
// of 43 recipes, and a run that presses the three steps it remembers is how a
// skill tells itself the button works. This walks all of them, in the window
// each recipe is filed under, and grades every press by what the card itself
// reported: done, done-but-more (a menu opened), closed (a popup was in the
// way), could-not (with the reason and the nearest labels on screen), or
// skipped (a destructive label this harness will not press for anyone).
//
// It presses real controls in a real window: tabs open, panels expand,
// popups come and go, the Settings window opens. Never run it while a screen
// is live. The chatbot window is left alone: with it CLOSED the stuck-step
// rescue answers "unavailable" at once and the numbers are the card's own;
// with it OPEN each could-not step spends one model round on the rescue.
//
// Spends no API credit by itself.

import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DISCOVERY_DIR = path.join(os.tmpdir(), 'open-worship-app-cdp');
const argv = process.argv.slice(2);
const isJson = argv.includes('--json');
const argOf = (name, fallback) => {
    const found = argv.find((one) => one.startsWith('--' + name + '='));
    return found === undefined ? fallback : found.split('=')[1];
};
const onlyRecipes = argOf('recipes', '')
    .split(',')
    .map((one) => one.trim().toUpperCase())
    .filter(Boolean);
const onlyPage = argOf('page', '');
// W-02 is the recipe about switching the main window's page: its first Do it
// navigates the window, which unloads the card with everything else. A
// walkthrough cannot survive its own step there, by design of the app.
const skipRecipes = argOf('skip', 'W-02')
    .split(',')
    .map((one) => one.trim().toUpperCase())
    .filter(Boolean);

// A label the harness will not press for anyone, whatever the recipe says:
// the card has no interlock of its own yet (backlog), so the harness is it.
const DESTRUCTIVE_PATTERN =
    /\b(delete|trash|discard|erase|remove|uninstall|overwrite|clear all|reset all|factory|sign out|log out)\b/i;

// Windows the ONE main window navigates between, reachable with owa_goto_page;
// every other window has to be open already.
const MAIN_PAGES = new Set(['presenter', 'reader', 'appDocumentEditor']);

function readInstance() {
    const instances = readdirSync(DISCOVERY_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            try {
                return JSON.parse(
                    readFileSync(path.join(DISCOVERY_DIR, name), 'utf8'),
                );
            } catch {
                return null;
            }
        })
        .filter((one) => one !== null && one.mcpUrl && one.mcpToken)
        .sort((one, other) => {
            return String(other.startedAt).localeCompare(String(one.startedAt));
        });
    if (instances.length === 0) {
        throw new Error(
            'No app is publishing an endpoint. Start it with ' +
                'env -u ELECTRON_RUN_AS_NODE npm run dev.',
        );
    }
    return instances[0];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const instance = readInstance();
const MCP_URL = process.env.OWA_MCP_URL ?? instance.mcpUrl;
const MCP_TOKEN = process.env.OWA_MCP_TOKEN ?? instance.mcpToken;
if (!MCP_TOKEN) {
    throw new Error('The selected MCP endpoint has no published token.');
}
let sessionId = null;
let requestId = 0;

async function post(body) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${MCP_TOKEN}`,
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
    if (!response.ok || response.status === 202) {
        return null;
    }
    const text = await response.text();
    const line =
        text.startsWith('event:') || text.includes('\ndata:')
            ? text
                  .split('\n')
                  .find((one) => one.startsWith('data:'))
                  ?.slice(5)
            : text;
    try {
        return JSON.parse(line ?? '{}').result ?? null;
    } catch {
        return null;
    }
}

// The firewall allows 25 acting calls a minute across every session -- a
// walkthrough pressed step after step IS the loop that budget exists to
// stop -- so this paces itself under it rather than measuring the limit.
const ACTING = new Set(['owa_guide_start', 'owa_guide_step', 'owa_goto_page']);
const ACTING_LIMIT = 20;
const actedAt = [];
async function pace(name) {
    if (!ACTING.has(name)) {
        return;
    }
    for (;;) {
        const now = Date.now();
        while (actedAt.length > 0 && now - actedAt[0] > 61000) {
            actedAt.shift();
        }
        if (actedAt.length < ACTING_LIMIT) {
            actedAt.push(now);
            return;
        }
        await sleep(actedAt[0] + 61000 - now + 50);
    }
}

async function call(name, args = {}) {
    await pace(name);
    requestId += 1;
    const result = await post({
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: { name, arguments: args },
    });
    const text = (result?.content ?? [])
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n');
    if (result?.isError) {
        return { error: text };
    }
    try {
        return JSON.parse(text);
    } catch {
        return { text };
    }
}

// Raw CDP, for the two things the tools do not offer: what is in the way
// (a popup) and closing it between recipes so one recipe's leftovers do not
// become the next one's failures.
async function evaluateIn(pageMatch, expression) {
    const targets = await (await fetch(`${instance.url}/json/list`)).json();
    const target = targets.find((one) => {
        return one.type === 'page' && one.url.includes(pageMatch);
    });
    if (target === undefined) {
        return null;
    }
    return await new Promise((resolve) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const timeoutId = setTimeout(() => {
            socket.close();
            resolve(null);
        }, 8000);
        socket.addEventListener('open', () => {
            socket.send(
                JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression,
                        returnByValue: true,
                        awaitPromise: true,
                    },
                }),
            );
        });
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id !== 1) {
                return;
            }
            clearTimeout(timeoutId);
            socket.close();
            resolve(message.result?.result?.value ?? null);
        });
        socket.addEventListener('error', () => {
            clearTimeout(timeoutId);
            resolve(null);
        });
    });
}

// Which window each recipe is filed under, off the question corpus -- the
// same file the chatbot's own "Do it for me" reads when it picks a page.
function readRecipePages() {
    const dir = path.resolve('tools/owa-devtools-mcp/questions');
    const pages = {};
    for (const name of readdirSync(dir)) {
        if (!name.endsWith('.json') || name === 'schema.json') {
            continue;
        }
        const data = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
        const focuses = Array.isArray(data.focus)
            ? data.focus
            : [data.focus ?? null];
        for (const section of data.sections ?? []) {
            for (const question of section.questions ?? []) {
                const recipe = question.resources?.recipe;
                if (!recipe) {
                    continue;
                }
                pages[recipe] ??= new Set();
                for (const focus of focuses) {
                    pages[recipe].add(focus);
                }
            }
        }
    }
    return pages;
}

function pickPage(focuses) {
    const list = [...focuses];
    for (const preferred of ['presenter', 'reader', 'appDocumentEditor']) {
        if (list.includes(preferred)) {
            return preferred;
        }
    }
    return list.find((one) => one !== null) ?? 'presenter';
}

async function closeLeftovers(pageKey) {
    // A popup left open by the previous recipe (the Bible Lookup, a confirm
    // the harness would never answer) is closed the way the app closes it.
    await evaluateIn(
        pageKey + '.html',
        `(() => {
        const done = [];
        const closer = document.querySelector(
            '#modal-container button.btn-danger i.bi-x-lg',
        );
        if (closer) { closer.closest('button').click(); done.push('popup'); }
        const menu = document.querySelector('#app-context-menu-container');
        if (menu) { menu.click(); done.push('menu'); }
        for (const icon of document.querySelectorAll(
            '.floating-widget .floating-widget__button i.bi-x-lg',
        )) { icon.closest('button').click(); done.push('widget'); }
        return done.join(',');
    })()`,
    );
}

async function runRecipe(manualId, pageKey) {
    const record = { manualId, page: pageKey, steps: [], outcome: 'ran' };
    if (MAIN_PAGES.has(pageKey)) {
        let went = await call('owa_goto_page', { page: pageKey + '.html' });
        if (went?.error) {
            // A window mid-navigation from the previous recipe answers late.
            await sleep(2500);
            went = await call('owa_goto_page', { page: pageKey + '.html' });
        }
        if (went?.error) {
            record.outcome = 'page-unreachable';
            record.detail = went.error.slice(0, 160);
            return record;
        }
        await sleep(1200);
    }
    await closeLeftovers(pageKey);
    const started = await call('owa_guide_start', {
        manualId,
        mode: 'demo',
        page: pageKey + '.html',
    });
    if (started?.error) {
        record.outcome = /no open page/i.test(started.error)
            ? 'window-not-open'
            : 'start-failed';
        record.detail = started.error.slice(0, 160);
        return record;
    }
    record.title = started.title;
    record.stepCount = started.stepCount;
    if (!started.canDemo) {
        record.outcome = 'cannot-demo';
        await call('owa_guide_step', { action: 'stop' });
        return record;
    }
    let presses = 0;
    let stalls = 0;
    let lastStep = null;
    while (presses < started.stepCount * 3 + 3) {
        const before = await call('owa_guide_status');
        if (!before?.isRunning) {
            break;
        }
        const stepNumber = before.stepNumber;
        if (stepNumber === lastStep) {
            stalls += 1;
            if (stalls > 2) {
                record.steps.push({
                    step: stepNumber,
                    grade: 'stuck',
                    find: before.find,
                });
                await call('owa_guide_step', { action: 'next' });
                stalls = 0;
                continue;
            }
        } else {
            stalls = 0;
        }
        lastStep = stepNumber;
        const label = String(before.find ?? '');
        if (
            DESTRUCTIVE_PATTERN.test(label) ||
            DESTRUCTIVE_PATTERN.test(String(before.press ?? '')) ||
            // The step's own first words, not a mention anywhere in it:
            // "Press F7 (Clear Background) to remove it" removes nothing.
            /^\s*(?:right-?click|click|press|choose|select)\s+(?:the\s+|a\s+)?(?:delete|trash|remove|discard|clear all)\b/i.test(
                String(before.stepText ?? ''),
            )
        ) {
            record.steps.push({
                step: stepNumber,
                grade: 'skipped-destructive',
                find: before.find,
                text: String(before.stepText ?? '').slice(0, 80),
            });
            await call('owa_guide_step', { action: 'next' });
            continue;
        }
        presses += 1;
        const after = await call('owa_guide_step', { action: 'do' });
        if (after?.error) {
            record.steps.push({
                step: stepNumber,
                grade: 'tool-error',
                find: before.find,
                reason: String(after.error).slice(0, 120),
            });
            await call('owa_guide_step', { action: 'next' });
            continue;
        }
        const result = after?.lastResult ?? null;
        const entry = {
            step: stepNumber,
            find: before.find,
            press: before.press,
            found: before.isTargetFound,
            behind: before.behind ?? null,
            text: String(before.stepText ?? '').slice(0, 80),
        };
        if (result === null) {
            entry.grade = 'no-result';
        } else if (!result.done) {
            entry.grade = 'could-not';
            entry.reason = result.reason;
            entry.nearMisses = (result.nearMisses ?? []).slice(0, 4);
            // The rescue: wait for whatever answers it, bounded.
            const startedAt = Date.now();
            let status = after;
            while (Date.now() - startedAt < 35000) {
                const help = status?.help;
                if (!help || help.status !== 'asking') {
                    break;
                }
                await sleep(1500);
                status = await call('owa_guide_status');
            }
            entry.help = status?.help?.status ?? 'none';
            if (status?.help?.text) {
                entry.helpText = String(status.help.text).slice(0, 160);
            }
            await call('owa_guide_step', { action: 'next' });
        } else if (result.did === 'closed') {
            entry.grade = 'closed';
        } else if (result.more !== undefined) {
            entry.grade = 'done-more';
            entry.more = result.more;
        } else {
            entry.grade = 'done';
            entry.did = result.did;
            entry.label = result.label ?? result.value ?? null;
            // The card moves on by itself after ~700ms.
            await sleep(1100);
        }
        record.steps.push(entry);
    }
    await call('owa_guide_step', { action: 'stop' });
    await closeLeftovers(pageKey);
    return record;
}

requestId += 1;
await post({
    jsonrpc: '2.0',
    id: requestId,
    method: 'initialize',
    params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'owa-demo-failure-rate', version: '1.0.0' },
    },
});
await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

const recipePages = readRecipePages();
const ids = Object.keys(recipePages).sort((one, other) => {
    return one.localeCompare(other, undefined, { numeric: true });
});
const records = [];
for (const manualId of ids) {
    if (onlyRecipes.length > 0 && !onlyRecipes.includes(manualId)) {
        continue;
    }
    if (skipRecipes.includes(manualId)) {
        continue;
    }
    const pageKey = pickPage(recipePages[manualId]);
    if (onlyPage && pageKey !== onlyPage) {
        continue;
    }
    const record = await runRecipe(manualId, pageKey);
    records.push(record);
    if (!isJson) {
        const counts = {};
        for (const step of record.steps) {
            counts[step.grade] = (counts[step.grade] ?? 0) + 1;
        }
        console.log(
            manualId.padEnd(6) +
                pageKey.padEnd(18) +
                record.outcome.padEnd(16) +
                Object.entries(counts)
                    .map(([key, value]) => key + ':' + value)
                    .join(' ') +
                (record.detail ? '  ' + record.detail : ''),
        );
        for (const step of record.steps) {
            if (step.grade !== 'done') {
                console.log(
                    '   ' +
                        String(step.step).padStart(2) +
                        ' ' +
                        step.grade.padEnd(20) +
                        (step.find ?? '').slice(0, 30).padEnd(31) +
                        (step.reason ?? step.more ?? step.behind ?? '').slice(
                            0,
                            70,
                        ) +
                        (step.nearMisses?.length
                            ? '  near: ' +
                              step.nearMisses.join(' | ').slice(0, 60)
                            : '') +
                        (step.help && step.help !== 'none'
                            ? '  help:' + step.help
                            : ''),
                );
            }
        }
    }
}

const summary = {
    recipes: records.length,
    byOutcome: {},
    byGrade: {},
    byReason: {},
};
for (const record of records) {
    summary.byOutcome[record.outcome] =
        (summary.byOutcome[record.outcome] ?? 0) + 1;
    for (const step of record.steps) {
        summary.byGrade[step.grade] = (summary.byGrade[step.grade] ?? 0) + 1;
        if (step.reason) {
            const key = step.reason.replace(/"[^"]*"/g, '"…"').slice(0, 60);
            summary.byReason[key] = (summary.byReason[key] ?? 0) + 1;
        }
    }
}
const pressed = Object.entries(summary.byGrade)
    .filter(([key]) => key !== 'skipped-destructive')
    .reduce((sum, [, value]) => sum + value, 0);
summary.pressed = pressed;
summary.couldNot = summary.byGrade['could-not'] ?? 0;
summary.failureRate =
    pressed === 0 ? null : Number((summary.couldNot / pressed).toFixed(3));
if (isJson) {
    console.log(JSON.stringify({ summary, records }, null, 2));
} else {
    console.log('');
    console.log(JSON.stringify(summary));
}
