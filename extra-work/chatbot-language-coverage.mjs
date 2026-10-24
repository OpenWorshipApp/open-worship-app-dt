// How much of the help window (🤖) and the AI Chat window (✨) a person reads
// in the app's language, measured on the RUNNING dev app.
//
//   node extra-work/chatbot-language-coverage.mjs [--json] [--keep-tab]
//
// The app must be shown in the language to measure (Settings → Language),
// with the help window open; the AI Chat window is measured when it is open
// too. The run opens a tab of its own in the help window and drives it
// through states that need no assistant -- the empty window, the folded
// head, a tab's menu, the suggestion list, the full question list, Report's
// first press, the `/` commands, the guide's own answers, the verse finder's
// and the Bible import's first steps -- then closes that tab again
// (`--keep-tab` leaves it). Nothing is sent to any assistant, nothing is
// pressed in the app window, no projector is touched.
//
// Every visible string -- text, and a control's title, aria-label and
// placeholder, and a picker's options -- is put in one of three piles:
// IN THE LANGUAGE (a letter of its script), NEUTRAL (no words to translate:
// numbers, keys, a link, a command, a product's or a model's name, a
// Bible's own key and title) and NOT TRANSLATED (an English word left).
// Coverage is the first pile over the first and the last, by distinct
// string. What a person typed and what an assistant wrote are not the
// window's words and are left out; a model is never asked here, so every
// answer measured is one the window wrote itself.
//
// For a language written in Latin letters (French), "in the language" is a
// string with none of the English words the window is written in, read
// against the app's own dictionary (every English key's words), so the
// measure is the same rule for every language.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const isJson = process.argv.includes('--json');
const isKeepingTab = process.argv.includes('--keep-tab');
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

// ---- CDP plumbing (as extra-work/verify-chatbot-e2e.mjs) -------------------

async function getCdpPort() {
    const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
    const infoList = fs
        .readdirSync(dir)
        .filter((name) => {
            return name.endsWith('.json');
        })
        .map((name) => {
            try {
                return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
            } catch {
                return null;
            }
        })
        .filter((info) => {
            return info !== null && info.isDev === true;
        })
        .sort((one, other) => {
            return String(other.startedAt).localeCompare(String(one.startedAt));
        });
    for (const info of infoList) {
        try {
            const response = await fetch(`${info.url}/json/version`, {
                signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
                return info.port;
            }
        } catch {
            // A file left by an instance that is gone.
        }
    }
    throw new Error('No live DEV app instance found.');
}

async function listPages(port) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(5000),
    });
    return (await response.json()).filter((target) => {
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
            const message = JSON.parse(event.data);
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

// ---- What is on screen -------------------------------------------------------

// Run in the page: every visible string, where it is. A person's own words
// (`.cue-you .cue-said`, a tab's name, the box) and code spans are left out.
const COLLECT_EXPRESSION = `(() => {
    const found = [];
    const seen = new Set();
    const EXCLUDED = '.cue-you .cue-said, code, kbd, pre, textarea, input, ' +
        '.chat-tab-name, .chat-tab-input, .cue-lyric-text, webview, ' +
        // Decoration no screen reader reads: a site's logo letters.
        '[aria-hidden="true"]';
    const isShown = (element) => {
        return element.checkVisibility({ visibilityProperty: true });
    };
    const whereOf = (element) => {
        const named = element.closest('[class]');
        return named === null ? element.tagName.toLowerCase()
            : named.tagName.toLowerCase() + '.' +
                String(named.className).split(' ')[0];
    };
    const push = (text, element, kind) => {
        const clean = String(text ?? '').replace(/\\s+/g, ' ').trim();
        if (clean.length === 0) {
            return;
        }
        const key = kind + '|' + clean;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        found.push({ text: clean, where: whereOf(element), kind });
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement;
        if (element === null || element.closest(EXCLUDED) !== null ||
            element.closest('select, style, script') !== null ||
            !isShown(element)) {
            continue;
        }
        push(node.textContent, element, 'text');
    }
    for (const element of document.querySelectorAll(
        '[title], [aria-label], [placeholder]',
    )) {
        if (element.closest('.cue-you .cue-said, .chat-tab-name') !== null ||
            !isShown(element)) {
            continue;
        }
        for (const name of ['title', 'aria-label', 'placeholder']) {
            if (element.hasAttribute(name)) {
                push(element.getAttribute(name), element, name);
            }
        }
    }
    for (const option of document.querySelectorAll('select option')) {
        if (isShown(option.closest('select'))) {
            push(option.textContent, option.closest('select'), 'option');
        }
    }
    return { lang: document.documentElement.lang, found };
})()`;

// ---- Driving the help window -------------------------------------------------

const clickExpression = (selector, index = 0) => {
    return `(() => {
        const list = [...document.querySelectorAll(${JSON.stringify(selector)})];
        const element = list[${index < 0 ? 'list.length - 1' : index}];
        if (element === undefined) {
            return false;
        }
        element.click();
        return true;
    })()`;
};

const typeExpression = (text, isSubmitting) => {
    return `(() => {
        const input = document.querySelector('textarea.chat-input');
        const form = input?.closest('form');
        if (input === null || form === null) {
            return false;
        }
        const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(input), 'value',
        ).set;
        setter.call(input, ${JSON.stringify(text)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        if (${isSubmitting}) {
            form.requestSubmit();
        }
        return true;
    })()`;
};

const IS_BUSY_EXPRESSION = `document.querySelector('.chat-progress') !== null`;

async function waitIdle(page) {
    await sleep(600);
    for (let index = 0; index < 60; index += 1) {
        if (!(await evaluateInTarget(page, IS_BUSY_EXPRESSION))) {
            return;
        }
        await sleep(500);
    }
}

// ---- The piles -----------------------------------------------------------------

const { extractDictionary } = await import(
    pathToFileURL(path.join(repoDir, 'tools/owa-devtools-mcp/tran.mjs')).href
);

function readScriptPattern(langCode) {
    const filePath = path.join(repoDir, 'src/lang/data', langCode, 'assistant.json');
    return new RegExp(JSON.parse(fs.readFileSync(filePath, 'utf8')).scriptPattern, 'u');
}

// Names no language translates: the products, the companies, the models.
const NAME_WORDS = new Set(
    (
        'chatgpt claude gemini deepseek kimi grok mistral le chat perplexity ' +
        'qwen copilot lm studio ollama bedrock kilo code open worship openai ' +
        'anthropic google github nvidia nemotron super vl lightning gemma ' +
        'haiku sonnet opus gpt mini nano llama mac super-computer local free ' +
        'beta owa ai api key ctrl shift alt enter esc tab cmd kjv nkjv bfbs ' +
        'url pdf png txt json markdown f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12 ' +
        'voxtral realtime bonsai muse glimmer prism ml qat embedding nomic ' +
        'meta windows macos linux youtube songselect beblia screen mirror'
    ).split(' '),
);

function toWords(text) {
    return (
        text
            // A link, a path, a command, a model's id, a key chord.
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/\S+\.(?:com|ai|app|org|io|net)\b\S*/g, ' ')
            .replace(/(?:^|\s)\/[a-z][\w-]*/g, ' ')
            .replace(/\b[\w.-]+\/[\w.:-]+\b/g, ' ')
            .replace(/\b[\w-]+:[\w.-]+\b/g, ' ')
            .match(/\p{Script=Latin}[\p{Script=Latin}'’]*/gu) ?? []
    );
}

function classify(text, scriptPattern, englishWordSet) {
    if (!scriptPattern.test('a') && scriptPattern.test(text)) {
        return 'translated';
    }
    // A Bible named by its key and title ("KJV — King James Version") is the
    // Bible's own name, as installed.
    if (/^[A-Z0-9]{2,10}(?: — .+)?(?: \(.+\))?$/.test(text)) {
        return 'neutral';
    }
    const words = toWords(text).filter((word) => {
        const lower = word.toLowerCase();
        return (
            lower.length > 1 &&
            !NAME_WORDS.has(lower) &&
            // All capitals of 2-6 letters: an abbreviation or a key.
            !/^[A-Z]{2,6}$/.test(word)
        );
    });
    if (scriptPattern.test('a')) {
        // A language written in Latin letters: English is a word of the
        // window's own English that this language does not also use.
        const english = words.filter((word) => {
            return englishWordSet.has(word.toLowerCase());
        });
        return english.length === 0 ? 'translated' : 'english';
    }
    return words.length === 0 ? 'neutral' : 'english';
}

// ---- The run -------------------------------------------------------------------

const port = await getCdpPort();
const pages = await listPages(port);
const chatbotPage = pages.find((page) => {
    return page.url.includes('/chatbot.html');
});
if (chatbotPage === undefined) {
    console.error('Open the help window (🤖) first.');
    process.exit(2);
}
const aiChatPage = pages.find((page) => {
    return page.url.includes('/aichat.html');
});

const results = [];
async function collect(page, state) {
    const { lang, found } = await evaluateInTarget(page, COLLECT_EXPRESSION);
    for (const item of found) {
        results.push({ ...item, state, lang });
    }
    return lang;
}

async function runChatbotStates() {
    const page = chatbotPage;
    const tabCount = await evaluateInTarget(
        page,
        `document.querySelectorAll('.chat-tabs [role="tab"]').length`,
    );
    await evaluateInTarget(page, clickExpression('.chat-tab-add:not(.chat-tab-window)'));
    await sleep(800);
    const ownTabCount = await evaluateInTarget(
        page,
        `document.querySelectorAll('.chat-tabs [role="tab"]').length`,
    );
    if (ownTabCount !== tabCount + 1) {
        // No tab of its own (the strip is full): the run would be writing
        // into one of the user's, so it stops.
        throw new Error('Could not open a tab of its own in the help window.');
    }
    await collect(page, 'empty window');
    // The head folded to one line, and open again.
    if (await evaluateInTarget(page, clickExpression('.chat-head-fold'))) {
        await sleep(400);
        await collect(page, 'head folded');
        await evaluateInTarget(page, clickExpression('.chat-head-fold'));
        await sleep(400);
    }
    // A tab's own menu.
    if (await evaluateInTarget(page, clickExpression('.chat-tab-menu', -1))) {
        await sleep(400);
        await collect(page, 'tab menu');
        await evaluateInTarget(
            page,
            `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
        );
        await evaluateInTarget(page, `document.body.click()`);
        await sleep(300);
    }
    // Everything it can answer.
    if (await evaluateInTarget(page, clickExpression('.chat-more'))) {
        await sleep(800);
        await collect(page, 'all questions');
    }
    // The suggestion list, by a word and by a slash.
    for (const typed of ['how', '/']) {
        await evaluateInTarget(page, typeExpression(typed, false));
        await sleep(700);
        await collect(page, `suggestions for "${typed}"`);
    }
    await evaluateInTarget(page, typeExpression('', false));
    // Report's first press only ASKS; a keystroke takes the question away.
    if (await evaluateInTarget(page, clickExpression('button.chat-report'))) {
        await sleep(500);
        await collect(page, 'report asks');
        await evaluateInTarget(page, clickExpression('.chat-report-no'));
        await sleep(300);
    }
    // What the window answers by itself: commands, the guide, two flows.
    for (const asked of [
        '/commands',
        '/tips',
        '/credit',
        '/limit',
        '/here',
        '/screen',
        '/btw',
        '/help text size',
        '/help clear long text',
        '/help import a bible',
        'Help me find a Bible verse',
        'Import bible',
    ]) {
        await evaluateInTarget(page, typeExpression(asked, true));
        await waitIdle(page);
        await collect(page, asked);
        // The verse finder's second step: its first Bible pressed.
        if (asked === 'Help me find a Bible verse') {
            const isPressed = await evaluateInTarget(
                page,
                `(() => {
                    const rows = [...document.querySelectorAll('.cue-actions')];
                    const button = rows[rows.length - 1]?.querySelector('button');
                    if (button === undefined || button === null) {
                        return false;
                    }
                    button.click();
                    return true;
                })()`,
            );
            if (isPressed) {
                await waitIdle(page);
                await collect(page, 'verse finder, a Bible picked');
            }
        }
    }
    if (!isKeepingTab) {
        // The run's own tab, closed: it is the last one, and nothing of the
        // user's is touched.
        await evaluateInTarget(page, clickExpression('.chat-tab-close', -1));
        await sleep(300);
        const leftCount = await evaluateInTarget(
            page,
            `document.querySelectorAll('.chat-tabs [role="tab"]').length`,
        );
        if (leftCount !== tabCount) {
            console.error(`Note: ${tabCount} tabs before, ${leftCount} after.`);
        }
    }
}

await runChatbotStates();
if (aiChatPage !== undefined) {
    // The tab in front as it is -- the site itself is a guest and is not
    // read -- and, over a site, the bar's Recently closed panel.
    await collect(aiChatPage, 'AI Chat window');
    const RECENTLY_CLOSED = '.aichat-head .aichat-tool';
    if (await evaluateInTarget(aiChatPage, clickExpression(RECENTLY_CLOSED, 3))) {
        await sleep(400);
        await collect(aiChatPage, 'AI Chat recently closed');
        await evaluateInTarget(aiChatPage, clickExpression(RECENTLY_CLOSED, 3));
    }
    // A tab of the run's own: the chooser card, and its sign-out question
    // asked and answered "keep me signed in" (the first press only ASKS).
    // Closed again after; a tab on no site is not kept as recently closed.
    const TAB_COUNT = `document.querySelectorAll('.chat-tabs [role="tab"]').length`;
    const tabCountBefore = await evaluateInTarget(aiChatPage, TAB_COUNT);
    await evaluateInTarget(
        aiChatPage,
        clickExpression('.chat-tab-add:not(.chat-tab-window)'),
    );
    await sleep(600);
    // Only a tab this run added is ever closed: never one of the user's.
    if ((await evaluateInTarget(aiChatPage, TAB_COUNT)) === tabCountBefore + 1) {
        await collect(aiChatPage, 'AI Chat chooser');
        if (
            await evaluateInTarget(
                aiChatPage,
                clickExpression('.aichat-chooser .aichat-link-button', -1),
            )
        ) {
            await sleep(400);
            await collect(aiChatPage, 'AI Chat sign-out asks');
            await evaluateInTarget(aiChatPage, clickExpression('.chat-clear-no'));
        }
        if (!isKeepingTab) {
            await evaluateInTarget(aiChatPage, clickExpression('.chat-tab-close', -1));
        }
    }
}

const lang = results[0]?.lang?.split('-')[0] ?? 'en';
if (lang === 'en') {
    console.error('The app is shown in English: nothing to measure.');
    process.exit(2);
}
const scriptPattern = readScriptPattern(lang);
const englishWordSet = new Set();
if (scriptPattern.test('a')) {
    const english = extractDictionary(
        fs.readFileSync(path.join(repoDir, 'src/lang/data/km/index.ts'), 'utf8'),
    );
    const theirs = extractDictionary(
        fs.readFileSync(path.join(repoDir, 'src/lang/data', lang, 'index.ts'), 'utf8'),
    );
    const theirWordSet = new Set(
        Object.values(theirs).flatMap((value) => {
            return String(value).toLowerCase().match(/\p{L}+/gu) ?? [];
        }),
    );
    for (const key of Object.keys(english)) {
        for (const word of key.toLowerCase().match(/\p{L}+/gu) ?? []) {
            if (word.length > 2 && !theirWordSet.has(word)) {
                englishWordSet.add(word);
            }
        }
    }
}

const byText = new Map();
for (const item of results) {
    if (!byText.has(item.text)) {
        byText.set(item.text, {
            ...item,
            pile: classify(item.text, scriptPattern, englishWordSet),
        });
    }
}
const all = [...byText.values()];
const count = (pile) => {
    return all.filter((item) => {
        return item.pile === pile;
    }).length;
};
const translated = count('translated');
const english = count('english');
const neutral = count('neutral');
const coverage = translated + english === 0 ? 1 : translated / (translated + english);
const left = all.filter((item) => {
    return item.pile === 'english';
});

if (isJson) {
    const states = [...new Set(results.map((item) => item.state))];
    console.log(
        JSON.stringify(
            { lang, translated, english, neutral, coverage, states, left },
            null,
            1,
        ),
    );
} else {
    console.log(
        `${lang}: ${(coverage * 100).toFixed(1)}% -- ${translated} strings in ` +
            `the language, ${english} not, ${neutral} neutral ` +
            `(${all.length} distinct, ${new Set(results.map((item) => item.state)).size} states)`,
    );
    for (const item of left) {
        console.log(`  [${item.state}] ${item.kind} ${item.where}: ${item.text.slice(0, 140)}`);
    }
}
