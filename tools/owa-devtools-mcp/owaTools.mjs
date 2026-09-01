// The app-level half of `owa-devtools-mcp`.
//
// chrome-devtools-mcp already gives an agent hands (click, fill, snapshot,
// screenshot, evaluate). These tools give it knowledge of THIS app: what the
// manual says, what the app is doing right now, and where a control lives --
// the three things the in-app self-help chatbot needs to answer "how do I ...?"
// for a user who is looking at the app while asking.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp, evaluateInTarget, listTargets, requireLivePort } from './cdp.mjs';
import {
    genClickExpression,
    genFindUiExpression,
    genListUiExpression,
    genTypeExpression,
} from './domMatch.mjs';
import { readPublishedInstances } from './discovery.mjs';
import {
    dropStepsAlreadyDone,
    genGuideExpression,
    toGuideSteps,
    toKeystroke,
} from './guide.mjs';
import { readHelpPage, searchHelp } from './help.mjs';

function toTextResult(value) {
    const text =
        typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return { content: [{ type: 'text', text }] };
}

function toErrorResult(error) {
    return {
        isError: true,
        content: [{ type: 'text', text: String(error?.message ?? error) }],
    };
}

async function attempt(callback) {
    try {
        return toTextResult(await callback());
    } catch (error) {
        return toErrorResult(error);
    }
}

// Reads the DOM only. Never `import()` an app module from here -- that re-runs
// module top-level code and takes the app's keyboard shortcuts down with it.
const APP_STATE_EXPRESSION = `(() => {
    const tabs = [...document.querySelectorAll('[data-tab-key], .nav-link, .app-tab')]
        .map((element) => ({
            label: (element.textContent || '').trim().slice(0, 40),
            isActive: element.classList.contains('active'),
        }))
        .filter((tab) => tab.label);
    const panels = [...document.querySelectorAll('[data-react-comp-name]')]
        .slice(0, 40)
        .map((element) => element.getAttribute('data-react-comp-name'));
    return {
        title: document.title,
        page: location.pathname.replace(/^.*\\//, ''),
        language: document.documentElement.lang || null,
        theme: document.documentElement.getAttribute('data-bs-theme') || null,
        tabs,
        components: [...new Set(panels)],
    };
})()`;

const SCREENS_EXPRESSION = `(() => {
    const electron = typeof require === 'function' ? require('electron') : null;
    if (electron === null) {
        return { error: 'This page has no node integration' };
    }
    const { ipcRenderer } = electron;
    return {
        showingScreenIds: ipcRenderer.sendSync('main:app:get-screens'),
        displays: ipcRenderer.sendSync('main:app:get-displays'),
    };
})()`;

function genHideScreensExpression(screenId) {
    const channel =
        screenId === undefined ? 'app:hide-all-screens' : 'app:hide-screen';
    const args = screenId === undefined ? '' : `, ${JSON.stringify(screenId)}`;
    return `(() => {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send(${JSON.stringify(channel)}${args});
        return { sent: ${JSON.stringify(channel)} };
    })()`;
}

// The same navigation the app's own goToPath performs: set the pathname and
// let the window load the other main page. guardMainNavigation allows
// exactly these pages, so this cannot wander off anywhere else.
function genGotoPageExpression(page) {
    return `(() => {
        const current = location.pathname.replace(/^.*\\//, '');
        if (current === ${JSON.stringify(page)}) {
            return { switching: false, page: current };
        }
        const url = new URL(location.href);
        url.pathname = '/' + ${JSON.stringify(page)};
        location.href = url.href;
        return { switching: true, from: current, to: ${JSON.stringify(page)} };
    })()`;
}

export function registerOwaTools(server) {
    server.registerTool(
        'owa_help_search',
        {
            description:
                "Search this app's own knowledge for how to do something in " +
                'it. Two corpora: `manual` -- the user-facing, live-verified ' +
                "workflow recipes, which a user's question must be answered " +
                'from -- and `internal`, the notes written for whoever BUILDS ' +
                'the app: file paths, code names and design decisions. The ' +
                'person asking is a volunteer running a service, not a ' +
                'programmer, so never repeat an internal note to them: read ' +
                'it, then say what they should press, or say you do not know. ' +
                'Use this FIRST for any "how do I ...", "where is ...", ' +
                '"what does ... do" question, before poking at the UI.',
            inputSchema: {
                query: z
                    .string()
                    .describe('What the user wants to do, in their words'),
                limit: z.number().int().min(1).max(20).optional(),
                kind: z
                    .enum(['manual', 'internal', 'auto'])
                    .optional()
                    .describe(
                        'Which corpus to search. Default `auto` = the manual, ' +
                            'falling back to internal notes only when the ' +
                            'manual has nothing.',
                    ),
                focus: z
                    .enum(['presenter', 'reader'])
                    .optional()
                    .describe(
                        'Which half of this two-in-one app the user is asking ' +
                            'about. ALWAYS pass it: the two do the same thing ' +
                            'differently (the presenter looks a verse up in a ' +
                            'Ctrl+B popup, the Bible Reader does not have ' +
                            'one), and a recipe for the other half names ' +
                            'buttons that are not on their screen.',
                    ),
            },
        },
        async ({ query, limit, kind, focus }) => {
            return await attempt(() => {
                const results = searchHelp(
                    query,
                    limit ?? 5,
                    kind ?? 'auto',
                    focus ?? null,
                );
                if (results.length === 0) {
                    return (
                        `Nothing in the manual matches "${query}". The ` +
                        'manual covers the presenter, bible reading and ' +
                        'lookup, documents and lyrics, presenting flows, ' +
                        'screens and settings.'
                    );
                }
                return results;
            });
        },
    );

    server.registerTool(
        'owa_help_page',
        {
            description:
                'Read one knowledge document in full by the id an ' +
                'owa_help_search hit carries (e.g. "W-11", or ' +
                '"internal:memory/....md") -- the steps behind the excerpt.',
            inputSchema: { id: z.string() },
        },
        async ({ id }) => {
            return await attempt(() => {
                const page = readHelpPage(id);
                if (page === null) {
                    throw new Error(`No knowledge document "${id}"`);
                }
                const kindNote =
                    page.kind === 'internal'
                        ? '\n\n_(A DEVELOPER note, not user documentation. ' +
                          'Do not quote it, and do not repeat its file paths ' +
                          'or code names to the person asking -- turn it into ' +
                          'what they should press, or say you do not know.)_'
                        : '';
                return `# ${page.id} — ${page.title}${kindNote}\n\n${page.body}`;
            });
        },
    );

    server.registerTool(
        'owa_app_state',
        {
            description:
                'What the running app is doing right now: every live ' +
                'instance, its open windows, and one window\'s page, ' +
                'language, theme and visible tabs. Use it to answer in terms ' +
                'of what the user is actually looking at -- and to check ' +
                'WHERE they are before telling them to go somewhere they are ' +
                'already standing.',
            inputSchema: {
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to report on, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
            },
        },
        async ({ page } = {}) => {
            return await attempt(async () => {
                const port = await requireLivePort();
                const targets = await listTargets(port);
                const { value } = await evaluateInApp(APP_STATE_EXPRESSION, {
                    port,
                    match: page,
                });
                return {
                    instances: readPublishedInstances(),
                    windows: targets.map((target) => {
                        return { title: target.title, url: target.url };
                    }),
                    mainWindow: value,
                };
            });
        },
    );

    server.registerTool(
        'owa_list_screens',
        {
            description:
                'The presentation screens showing right now and the displays ' +
                'available to put them on.',
            inputSchema: {},
        },
        async () => {
            return await attempt(async () => {
                const { value } = await evaluateInApp(SCREENS_EXPRESSION);
                return value;
            });
        },
    );

    server.registerTool(
        'owa_hide_screens',
        {
            description:
                'Hide one presentation screen by id, or every screen when no ' +
                'id is given. The one destructive-ish action here: it takes ' +
                'content off a projector, so confirm with the user first.',
            inputSchema: { screenId: z.number().int().optional() },
            annotations: { destructiveHint: true },
        },
        async ({ screenId }) => {
            return await attempt(async () => {
                const { value } = await evaluateInApp(
                    genHideScreensExpression(screenId),
                );
                return value;
            });
        },
    );

    server.registerTool(
        'owa_goto_page',
        {
            description:
                'Switch the main app window between its two halves, ' +
                '"presenter.html" and "reader.html". The case it exists for: ' +
                'a tool answers "no open page matching" because the user is ' +
                'in the other half. A walkthrough card cannot follow the ' +
                'user across a page change, so switch FIRST, then start the ' +
                'guide on the new page. Tell the user the window is about to ' +
                'change before calling it. The projector is untouched -- ' +
                'what the congregation sees does not change.',
            inputSchema: {
                page: z
                    .enum(['presenter.html', 'reader.html'])
                    .describe('The main page to switch the window to.'),
            },
        },
        async ({ page }) => {
            return await attempt(async () => {
                const port = await requireLivePort();
                // The navigation unloads the page mid-answer, so the
                // evaluation may never report back; what proves the switch
                // is the target list a moment later.
                let outcome = null;
                try {
                    const { value } = await evaluateInApp(
                        genGotoPageExpression(page),
                        { port },
                    );
                    outcome = value;
                } catch {
                    // The page left before it could answer -- checked below.
                }
                if (outcome !== null && outcome.switching !== true) {
                    return { page: outcome?.page ?? page, switched: false };
                }
                const startedAt = Date.now();
                while (Date.now() - startedAt < 8000) {
                    const targets = await listTargets(port);
                    const arrived = targets.some((target) => {
                        return target.url.includes(page);
                    });
                    if (arrived) {
                        return {
                            page,
                            switched: true,
                            from: outcome?.from ?? null,
                        };
                    }
                    await new Promise((resolve) => {
                        setTimeout(resolve, 400);
                    });
                }
                throw new Error(
                    `Asked the window to switch to "${page}" but it is not ` +
                        'there yet -- check owa_app_state and try again.',
                );
            });
        },
    );

    server.registerTool(
        'owa_find_ui',
        {
            description:
                'Find a control in the app by its visible text or tooltip, ' +
                'and say where it is on screen (plus which component renders ' +
                'it, in dev). Matching is tolerant -- exact words first, then ' +
                'looser fits -- and a zero answer comes back with the closest ' +
                'labels that ARE on screen, so retry with one of those ' +
                'instead of a new guess. `highlight` outlines it in the real ' +
                'window for four seconds, so the user can be pointed at it. ' +
                '`anyPage` searches every open window and says which one ' +
                'each match lives in.',
            inputSchema: {
                text: z.string(),
                highlight: z.boolean().optional(),
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to look in, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
                anyPage: z
                    .boolean()
                    .optional()
                    .describe(
                        'Search every open window, not just one, and tag ' +
                            'each match with the window it is in. Use when ' +
                            'the control could be in either half of the app.',
                    ),
            },
        },
        async ({ text, highlight, page, anyPage }) => {
            return await attempt(async () => {
                const expression = genFindUiExpression(
                    text,
                    highlight === true,
                );
                if (anyPage !== true) {
                    const { value } = await evaluateInApp(expression, {
                        match: page,
                    });
                    return value;
                }
                // Every window is asked separately and the answers merged;
                // a window that closes mid-question is skipped, not an error.
                const port = await requireLivePort();
                const targets = await listTargets(port);
                const matches = [];
                const misses = [];
                for (const target of targets) {
                    // The chatbot window asking about itself is never the
                    // answer.
                    if (target.url.includes('chatbot.html')) {
                        continue;
                    }
                    const pageName = target.url.replace(/^.*\//, '');
                    try {
                        const value = await evaluateInTarget(
                            target,
                            expression,
                        );
                        for (const match of value?.matches ?? []) {
                            matches.push({ ...match, page: pageName });
                        }
                        for (const label of value?.nearMisses ?? []) {
                            misses.push({ label, page: pageName });
                        }
                    } catch {
                        // Closed between listing and asking.
                    }
                }
                const shown = matches.slice(0, 20);
                return {
                    // The whole count across every window, not the slice of
                    // it that fits in the answer.
                    count: matches.length,
                    shownCount: shown.length,
                    matches: shown,
                    nearMisses: shown.length === 0 ? misses.slice(0, 5) : [],
                };
            });
        },
    );

    server.registerTool(
        'owa_list_ui',
        {
            description:
                'List the controls actually on screen in a window right now ' +
                '-- every visible button, link, box and dropdown with the ' +
                'words written on it, where it is and whether it is enabled. ' +
                'Use it BEFORE writing guide steps or acting on a control ' +
                'whose label you cannot guess (the Bible version button ' +
                'reads "KJV", not "version"), so every `find` is the exact ' +
                'words on a control that exists instead of a guess.',
            inputSchema: {
                filter: z
                    .string()
                    .optional()
                    .describe(
                        'Only controls whose label contains this text.',
                    ),
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to list, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
                limit: z.number().int().min(1).max(200).optional(),
            },
        },
        async ({ filter, page, limit }) => {
            return await attempt(async () => {
                const { value } = await evaluateInApp(
                    genListUiExpression({ filter: filter ?? '', limit }),
                    { match: page },
                );
                return value;
            });
        },
    );

    server.registerTool(
        'owa_click',
        {
            description:
                'Click a control in the app, found by the exact words ' +
                'written on it -- pass a list of candidate labels and the ' +
                'first one on screen wins. Waits a moment for a panel that ' +
                'is still rendering, and when nothing matches it answers ' +
                'with the closest labels it did find, so retry with one of ' +
                'those instead of giving up. Anything that changes what the ' +
                'congregation sees -- presenting, clearing, hiding a screen ' +
                '-- must be offered to the user first, never done unasked.',
            inputSchema: {
                find: z
                    .union([z.string(), z.array(z.string())])
                    .describe(
                        'The label written on the control, or a list of ' +
                            'candidate labels to try in order.',
                    ),
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to click in, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
            },
        },
        async ({ find, page }) => {
            return await attempt(async () => {
                const finds = (Array.isArray(find) ? find : [find]).filter(
                    Boolean,
                );
                if (finds.length === 0) {
                    throw new Error('Pass the label of the control to click.');
                }
                const { value } = await evaluateInApp(
                    genClickExpression(finds),
                    { match: page },
                );
                return value;
            });
        },
    );

    server.registerTool(
        'owa_type',
        {
            description:
                'Type text into a box in the app, found by its label, ' +
                'placeholder or the text already in it -- e.g. the Bible ' +
                'reference box. Set `submit` to also press Enter. When ' +
                'nothing matches it answers with the closest labels on ' +
                'screen; retry with one of those. It cannot drive a code ' +
                'editor field (those need a real keyboard) -- for those, use ' +
                'a guide step that asks the user to type.',
            inputSchema: {
                find: z
                    .union([z.string(), z.array(z.string())])
                    .describe(
                        'The label, placeholder or current text of the box, ' +
                            'or a list of candidates to try in order.',
                    ),
                value: z.string().describe('The text to type.'),
                submit: z
                    .boolean()
                    .optional()
                    .describe('Also press Enter after typing.'),
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to type in, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
            },
        },
        async ({ find, value, submit, page }) => {
            return await attempt(async () => {
                const finds = (Array.isArray(find) ? find : [find]).filter(
                    Boolean,
                );
                if (finds.length === 0) {
                    throw new Error('Pass the label of the box to type in.');
                }
                const { value: result } = await evaluateInApp(
                    genTypeExpression(finds, value, {
                        submit: submit === true,
                    }),
                    { match: page },
                );
                return result;
            });
        },
    );

    // The walkthrough. `owa_find_ui` points at ONE control and lets go; this
    // stays on screen for a whole task, one step at a time, and the user drives
    // it -- which is what somebody who has never opened the app needs.
    server.registerTool(
        'owa_guide_start',
        {
            description:
                'Walk the user through a task IN THE APP WINDOW: a numbered ' +
                'card appears in the corner, the control each step is about ' +
                'is ringed in red, and the user presses Next (or just does ' +
                'the step -- clicking the ringed control advances it). Give ' +
                'either `manualId` (a W-xx recipe, whose numbered steps are ' +
                'used) or your own `steps`. Write each step as ONE plain ' +
                'instruction a volunteer can follow without knowing anything ' +
                'about computers, in plain English, and set `find` to the ' +
                'exact label written on the button it means. Offer this ' +
                'whenever the answer is more than one step. With ' +
                '`mode: "demo"` the card DOES each step for the user when ' +
                'they press **Do it** -- one press per step, never a run of ' +
                'them -- using each step\'s `action` (`click`, the default, ' +
                'or `type` with a `value`), or `press` for a step that is a ' +
                'keyboard shortcut rather than a button. Offer the demo ' +
                'rather than ' +
                'assuming it -- but a user who has just ASKED you to do it ' +
                'for them has already said yes, so pass `mode: "demo"` and ' +
                'get on with it instead of offering again. Never demo a ' +
                'step that changes what the congregation sees (presenting, ' +
                'clearing, hiding a screen) without asking first.',
            inputSchema: {
                title: z.string().optional(),
                manualId: z
                    .string()
                    .optional()
                    .describe('A manual id from owa_help_search, e.g. "W-06"'),
                steps: z
                    .array(
                        z.object({
                            text: z.string(),
                            find: z
                                .string()
                                .nullable()
                                .optional()
                                .describe(
                                    'Visible label of the control this step ' +
                                        'is about, to ring in the window',
                                ),
                            action: z
                                .enum(['click', 'type'])
                                .optional()
                                .describe(
                                    'What "Do it" does in demo mode; ' +
                                        'defaults to click',
                                ),
                            value: z
                                .string()
                                .optional()
                                .describe('What to type, for action "type"'),
                            press: z
                                .string()
                                .optional()
                                .describe(
                                    'A keyboard shortcut this step is ' +
                                        'about, e.g. "Ctrl+S", "F9" or ' +
                                        '"Escape". Set it whenever the step ' +
                                        'names one: the card can press it, ' +
                                        'so a step with no button to click ' +
                                        'still works in demo mode.',
                                ),
                        }),
                    )
                    .optional(),
                mode: z
                    .enum(['show', 'demo'])
                    .optional()
                    .describe(
                        '`show` (default) rings the control and lets the ' +
                            'user do it; `demo` adds a **Do it** button that ' +
                            'performs the step for them.',
                    ),
                labels: z
                    .object({
                        next: z.string().optional(),
                        back: z.string().optional(),
                        done: z.string().optional(),
                        step: z.string().optional(),
                    })
                    .optional()
                    .describe('Button words, in the language of the user'),
                page: z
                    .string()
                    .optional()
                    .describe(
                        'Substring of the window URL to guide in, e.g. ' +
                            '"reader.html". Defaults to the main window.',
                    ),
            },
        },
        async ({ title, manualId, steps, labels, page, mode }) => {
            return await attempt(async () => {
                // The model writes a shortcut the way a person says it
                // ("Ctrl+S"); the card needs the fields a key event carries.
                // A step whose `press` is not a real keystroke keeps its text
                // and simply has nothing to press -- the same as before.
                let guideSteps =
                    steps?.map((step) => {
                        return step.press === undefined
                            ? step
                            : { ...step, keys: toKeystroke(step.press) };
                    }) ?? null;
                let guideTitle = title ?? null;
                if (guideSteps === null && manualId !== undefined) {
                    const manualPage = readHelpPage(manualId);
                    if (manualPage === null) {
                        throw new Error(`No knowledge document "${manualId}"`);
                    }
                    guideSteps = toGuideSteps(manualPage.body);
                    guideTitle = guideTitle ?? manualPage.title;
                }
                if (guideSteps === null || guideSteps.length === 0) {
                    throw new Error(
                        'Nothing to guide: pass `steps`, or a `manualId` ' +
                            'whose recipe has numbered steps.',
                    );
                }
                // What the window actually IS, asked of the window itself
                // rather than assumed from the recipe.
                const { value: pathname } = await evaluateInApp(
                    'location.pathname',
                    { match: page },
                );
                guideSteps = dropStepsAlreadyDone(
                    guideSteps,
                    typeof pathname === 'string' ? pathname : '',
                );
                const { value } = await evaluateInApp(
                    genGuideExpression(
                        `start(${JSON.stringify({
                            title: guideTitle ?? 'Step by step',
                            steps: guideSteps,
                            labels: labels ?? {},
                            mode: mode ?? 'show',
                        })})`,
                    ),
                    { match: page },
                );
                return value;
            });
        },
    );

    server.registerTool(
        'owa_guide_step',
        {
            description:
                'Move a running guide: `next`, `back`, `stop`, `goto` with a ' +
                'step number, or `do` -- which performs the current step in ' +
                'the app (the same thing the card\'s **Do it** button does) ' +
                'and then moves on. The user can press the same buttons on ' +
                'the card themselves, so read owa_guide_status before ' +
                'assuming where they are.',
            inputSchema: {
                action: z.enum(['next', 'back', 'stop', 'goto', 'do']),
                stepNumber: z.number().int().min(1).optional(),
                page: z.string().optional(),
            },
        },
        async ({ action, stepNumber, page }) => {
            return await attempt(async () => {
                const call =
                    action === 'goto'
                        ? `go(${(stepNumber ?? 1) - 1})`
                        : (action === 'do' ? 'act()' : `${action}()`);
                const { value } = await evaluateInApp(genGuideExpression(call), {
                    match: page,
                });
                return value;
            });
        },
    );

    server.registerTool(
        'owa_guide_status',
        {
            description:
                'Where the user is in a running guide: step number, its text, ' +
                'whether the control this step names was found on screen, ' +
                'the closest labels that ARE on screen when it was not ' +
                '(`nearMisses` -- restart the guide with one of those), and ' +
                'what they last did (`next`, `back`, `user-did-it` when ' +
                'they clicked the ringed control, `closed-by-user`).',
            inputSchema: { page: z.string().optional() },
        },
        async ({ page }) => {
            return await attempt(async () => {
                const { value } = await evaluateInApp(
                    genGuideExpression('status()'),
                    { match: page },
                );
                return value;
            });
        },
    );
}
