// Measures how well the in-app tips (Help → Tips of the Day / All tips, and
// the walkthrough each one starts) teach ONE window of the Open Worship App --
// against an inventory of that window's controls, which is the denominator
// every "99%" this skill states is a percentage of.
//
//   node .claude/skills/owa-enhance-tips/scripts/tip-coverage.mjs reader.html
//   node .../tip-coverage.mjs reader 99%              exit 1 below 99% covered
//   node .../tip-coverage.mjs reader --harvest        + read the live window
//   node .../tip-coverage.mjs reader --leads          every untriaged label
//   node .../tip-coverage.mjs reader --uncovered      every item not covered
//   node .../tip-coverage.mjs reader --quality        every quality finding
//   node .../tip-coverage.mjs reader --steps=reader-copy-title
//                                                     a guide payload to verify
//   node .../tip-coverage.mjs reader --init           write the inventory skeleton
//   node .../tip-coverage.mjs --all                   one line per window
//   --json        machine-readable          --port=<n>  a CDP port (--harvest)
//   --inventory=<file>   measure against another inventory (a draft, a test)
//
// An inventory ITEM is one thing a volunteer can do on that window: a control,
// a menu row, a shortcut. Per item, each tip of the window is read for three
// things:
//
//   acted     a step's `find` names the control (or its `press` is the key),
//             so **Do it** reaches it;
//   taught    a tip's words name it (title, detail or a step), as a whole
//             phrase -- `strict` items take no credit from words alone;
//   findable  a tip that acts on or teaches it carries the control's words
//             (or the item's `search` words) in its title, detail or category,
//             which is exactly what the All tips search box reads.
//
// COVERED (the headline) = acted or taught or credited, AND findable. A tip
// nobody can find by the words on the button is a tip nobody gets.
//
// Leads are labels the window can draw that the inventory has not decided on:
// `tran()` labels in a control position (a title, an aria-label, a menu row, a
// button's text) in the inventory's source folders and in every file a live
// harvest saw rendered, plus the labels `--harvest` read off the live window.
// A coverage figure is PROVISIONAL while any lead is untriaged -- an inventory
// that leaves controls out can reach 99% of nothing.
//
// Read-only apart from two files: `--harvest` merges what it read into the
// gitignored `test-results/owa-enhance-tips/<page>-harvest.json` (which holds
// the operator's own passage names and file names: it is never quoted into a
// note), and `--init` writes a missing inventory skeleton. `--harvest` reads
// the DOM over raw CDP exactly as `owa_list_ui` does; it presses nothing.

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-tips -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const INVENTORY_DIR = path.join(HERE, '..', 'references', 'inventory');
const MCP_DIR = path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp');
const HARVEST_DIR = path.join(REPO_ROOT, 'test-results', 'owa-enhance-tips');

function importMcp(fileName) {
    return import(pathToFileURL(path.join(MCP_DIR, fileName)).href);
}

const { BOT_FOCUS_LIST, detectBotFocus } = await importMcp('botFocus.mjs');
const { READER_DEMO_LIST, getReaderDemo } = await importMcp('readerDemos.mjs');
const { PRESENTER_DEMO_LIST, getPresenterDemo } =
    await importMcp('presenterDemos.mjs');
const { PAGE_DEMO_LIST, getPageDemo } = await importMcp('pageDemos.mjs');
const { DESTRUCTIVE_LABEL_PATTERNS, toComparableLabel } =
    await importMcp('destructiveLabel.mjs');

const argList = process.argv.slice(2);
const flagMap = new Map();
const positionalList = [];
for (const arg of argList) {
    if (arg.startsWith('--')) {
        const [name, ...rest] = arg.slice(2).split('=');
        flagMap.set(name, rest.length > 0 ? rest.join('=') : true);
    } else {
        positionalList.push(arg);
    }
}
const isJson = flagMap.has('json');
const targetText =
    flagMap.get('target') ??
    positionalList.find((one) => /^\d+(?:\.\d+)?%?$/.test(one));
const target = targetText === undefined ? null : Number.parseFloat(targetText);

// Card space, measured against the walkthrough card and the All tips list.
const TITLE_MAX_CHARS = 60;
const DETAIL_MAX_CHARS = 200;
const STEP_MAX_CHARS = 260;
const STEPS_MAX = 6;

// A `tran()` call in a position that names a control. `message`, `description`
// and dialog bodies are sentences, not controls, and are left out on purpose.
const LITERAL_SOURCE =
    String.raw`(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`[^`$]*`)';
const CONTROL_CALL_PATTERN = new RegExp(
    String.raw`(?:\b(aria-label|menuElement|title|label|placeholder|tooltip|contextMenuTitle|undoLabel|redoLabel)\s*[:=]\s*\{?\s*|(>)\s*\{\s*)` +
        String.raw`tran\(\s*(` +
        LITERAL_SOURCE +
        String.raw`)\s*[,)]`,
    'g',
);

// ---- small helpers ---------------------------------------------------------

function toPosix(filePath) {
    return filePath.split(path.sep).join('/');
}

function toToday() {
    return new Date().toISOString().slice(0, 10);
}

function toPercent(count, total) {
    return total === 0 ? null : Math.round((count / total) * 1000) / 10;
}

function formatPercent(value) {
    return value === null ? '—' : `${value}%`;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `[Shift+Escape]` is the shortcut a title carries, not part of its name.
function normalizeLabel(text) {
    return String(text ?? '')
        .replace(/\s*\[[^\]]*\]\s*$/u, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function toTranKey(key) {
    return String(key).trim().toLowerCase();
}

/** `Bible Notes > More Options` → the control and the panels around it. */
function parseLabel(text) {
    const partList = normalizeLabel(text)
        .split(' > ')
        .map((part) => part.trim())
        .filter(Boolean);
    return {
        full: partList.join(' > '),
        control: partList.at(-1) ?? '',
        scopeList: partList.slice(0, -1),
    };
}

// Case-sensitive on purpose: a control is written as it reads ("Copy Title"),
// a sentence that merely uses the words ("copy the title") is not a lesson.
function checkHasPhrase(text, phrase) {
    if (phrase.length === 0) {
        return false;
    }
    return new RegExp(
        String.raw`(?<![\p{L}\p{N}])${escapeRegExp(phrase)}(?![\p{L}\p{N}])`,
        'u',
    ).test(text);
}

// What the All tips box does: the query lower-cased, `includes` on the title,
// the detail and the category (`DailyTipComp`'s `filteredTips`).
function checkIsSearchHit(tip, word) {
    const needle = word.trim().toLocaleLowerCase();
    if (needle.length === 0) {
        return false;
    }
    return [tip.title, tip.detail, tip.category ?? ''].some((text) => {
        return text.toLocaleLowerCase().includes(needle);
    });
}

function checkIsDestructive(text) {
    const comparable = toComparableLabel(text);
    return DESTRUCTIVE_LABEL_PATTERNS.some((pattern) => {
        return pattern.test(comparable);
    });
}

function checkIsActionableStep(step) {
    return (
        step.findList.length > 0 ||
        step.press !== null ||
        step.action === 'rightClick'
    );
}

// ---- the window and its tips ----------------------------------------------

function resolvePage(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return null;
    }
    const bare = text.replace(/^.*[\\/]/, '');
    const byKey = BOT_FOCUS_LIST.find((one) => {
        return one.key.toLowerCase() === bare.toLowerCase();
    });
    if (byKey !== undefined) {
        return byKey;
    }
    const key = detectBotFocus(bare.endsWith('.html') ? bare : `${bare}.html`);
    return BOT_FOCUS_LIST.find((one) => one.key === key) ?? null;
}

/**
 * The catalog the window's All tips list is built from, one shape for all
 * three sources. `keyMode` is how a `translateFind` key is looked up: the
 * Reader translates a scoped label part by part, the Presenter and the small
 * windows translate the whole string (`getReaderDemo` / `getPresenterDemo` /
 * `getPageDemo`).
 */
function loadCatalog(pageKey) {
    if (pageKey === 'reader') {
        return {
            keyMode: 'parts',
            tipList: READER_DEMO_LIST.map((demo) => toTip(demo, false)),
        };
    }
    if (pageKey === 'presenter') {
        return {
            keyMode: 'whole',
            tipList: PRESENTER_DEMO_LIST.map((demo) => toTip(demo, false)),
        };
    }
    return {
        keyMode: 'whole',
        tipList: PAGE_DEMO_LIST.filter((demo) => demo.page === pageKey).map(
            (demo) => {
                return toTip(
                    {
                        ...demo,
                        title: demo.label,
                        steps: [
                            {
                                text: demo.detail,
                                ...(demo.find === undefined
                                    ? {}
                                    : {
                                          find: demo.find,
                                          action: 'click',
                                          translateFind: true,
                                      }),
                            },
                        ],
                    },
                    true,
                );
            },
        ),
    };
}

function toTip(demo, isPageDemo) {
    return {
        id: demo.id,
        title: demo.title ?? demo.label,
        label: demo.label,
        detail: demo.detail ?? '',
        category: demo.category ?? null,
        isFeatured: !isPageDemo && demo.isFeatured !== false,
        stepList: (demo.steps ?? []).map((step) => {
            const findList = [
                ...new Set([
                    ...(typeof step.find === 'string' ? [step.find] : []),
                    ...(step.finds ?? []),
                ]),
            ];
            return {
                text: step.text ?? '',
                findList,
                action:
                    step.action ?? (findList.length > 0 ? 'click' : null),
                press: typeof step.press === 'string' ? step.press : null,
                value: typeof step.value === 'string' ? step.value : null,
                translateFind: step.translateFind ?? false,
                translateFinds: step.translateFinds === true,
                translateValue: step.translateValue === true,
            };
        }),
    };
}

function getGuidePayload(pageInfo, demoId) {
    const demo =
        getReaderDemo(demoId) ??
        getPresenterDemo(demoId) ??
        getPageDemo(demoId);
    if (demo === null) {
        return null;
    }
    // The English window's words first; a Khmer window is reached through the
    // app's own All tips list, which translates at the press.
    return {
        title: demo.title,
        mode: 'demo',
        page: pageInfo.window,
        steps: demo.steps.map((step) => {
            const find = step.finds?.[0] ?? step.find;
            return {
                text: step.text,
                ...(typeof find === 'string' ? { find } : {}),
                ...(step.action === undefined ? {} : { action: step.action }),
                ...(step.value === undefined ? {} : { value: step.value }),
                ...(step.press === undefined ? {} : { press: step.press }),
            };
        }),
    };
}

// ---- the dictionaries ------------------------------------------------------

// Read as SOURCE, never imported, the way `src/lang/tranKeyCoverage.test.ts`
// reads it: the module pulls in font files and a `.gz.bundle`. Sanitized key
// → the translated string, or null when the file is no longer shaped so.
function readPack(langCode) {
    const filePath = path.join(
        REPO_ROOT,
        'src',
        'lang',
        'data',
        langCode,
        'index.ts',
    );
    try {
        const source = readFileSync(filePath, 'utf8');
        const start = source.indexOf('const dictionary = {');
        const end = source.indexOf('function sanitizeTranKey');
        if (start === -1 || end === -1) {
            return null;
        }
        const objectText = source
            .slice(start + 'const dictionary = '.length, end)
            .trim()
            .replace(/;$/, '');
        // Only ever an object literal of strings: the slice above.
        const dictionary = new Function(`return (${objectText});`)();
        return new Map(
            Object.entries(dictionary).map(([key, value]) => {
                return [toTranKey(key), value];
            }),
        );
    } catch {
        return null;
    }
}

// ---- the inventory ---------------------------------------------------------

function toInventoryPath(pageKey) {
    const otherPath = flagMap.get('inventory');
    return typeof otherPath === 'string'
        ? path.resolve(otherPath)
        : path.join(INVENTORY_DIR, `${pageKey}.json`);
}

function genInventorySkeleton(pageInfo) {
    return {
        page: pageInfo.key,
        window: pageInfo.window,
        updated: toToday(),
        scope: `${pageInfo.label}: what this inventory counts and what it leaves to other windows.`,
        sourceDirs: [],
        sourceFiles: [],
        ignore: [],
        items: [],
    };
}

function loadInventory(pageKey) {
    const filePath = toInventoryPath(pageKey);
    if (!existsSync(filePath)) {
        return null;
    }
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

/** Problems that make a figure meaningless: a credit to a tip that is gone. */
function validateInventory(inventory, tipIdSet) {
    const problemList = [];
    const idSet = new Set();
    for (const item of inventory.items ?? []) {
        const at = item.id ?? '(no id)';
        if (typeof item.id !== 'string' || item.id.length === 0) {
            problemList.push(`${at}: an item needs an id`);
        } else if (idSet.has(item.id)) {
            problemList.push(`${at}: duplicate id`);
        }
        idSet.add(item.id);
        if (typeof item.surface !== 'string' || item.surface.length === 0) {
            problemList.push(`${at}: an item needs a surface`);
        }
        if (
            (item.labels ?? []).length === 0 &&
            (item.press ?? []).length === 0
        ) {
            problemList.push(`${at}: an item needs labels or press keys`);
        }
        for (const tipId of item.tips ?? []) {
            if (!tipIdSet.has(tipId)) {
                problemList.push(`${at}: credits "${tipId}", which is no tip`);
            }
        }
        if ('exclude' in item && typeof item.exclude !== 'string') {
            problemList.push(`${at}: an exclusion needs its reason`);
        }
    }
    for (const entry of inventory.ignore ?? []) {
        const at = entry.label ?? entry.pattern ?? entry.file ?? '(empty)';
        if (typeof entry.reason !== 'string' || entry.reason.length === 0) {
            problemList.push(`ignore ${at}: needs a reason`);
        }
        if (typeof entry.pattern === 'string') {
            try {
                new RegExp(entry.pattern, 'u');
            } catch (error) {
                problemList.push(`ignore ${at}: ${error.message}`);
            }
        }
    }
    return problemList;
}

// ---- coverage --------------------------------------------------------------

function checkIsSameControl(itemLabel, findLabel) {
    if (
        toComparableLabel(itemLabel.control) !==
        toComparableLabel(findLabel.control)
    ) {
        return false;
    }
    // A scoped item is one particular "More Options"; an unscoped find could
    // press any of them, so only a find in the same panel acts on it.
    if (itemLabel.scopeList.length === 0) {
        return true;
    }
    return (
        toComparableLabel(itemLabel.scopeList.join(' > ')) ===
        toComparableLabel(findLabel.scopeList.join(' > '))
    );
}

function checkMentions(prose, itemLabel) {
    return (
        checkHasPhrase(prose, itemLabel.control) &&
        itemLabel.scopeList.every((scope) => checkHasPhrase(prose, scope))
    );
}

// A string as a window in that language shows it: `tran()`'s own lookup,
// English when the dictionary has no entry.
function translateIn(pack, text) {
    return pack?.get(toTranKey(text)) ?? text;
}

// The same search typed in a Khmer or French window: the button's words as
// that window shows them, against the tip's title, detail and category as
// that window shows them. A Khmer detail that leaves the button's Khmer name
// out is a tip no Khmer volunteer finds by the button.
function checkIsSearchHitIn(pack, tip, wordList) {
    const translatedTip = {
        title: translateIn(pack, tip.label),
        detail: translateIn(pack, tip.detail),
        category:
            tip.category === null ? '' : translateIn(pack, tip.category),
    };
    return wordList.some((word) => {
        return checkIsSearchHit(translatedTip, translateIn(pack, word));
    });
}

function measureItem(item, tipList, packMap) {
    const labelList = (item.labels ?? []).map(parseLabel);
    const pressSet = new Set(
        (item.press ?? []).map((key) => key.toLowerCase()),
    );
    const tipMap = new Map(tipList.map((tip) => [tip.id, tip]));
    const actedSet = new Set();
    const taughtSet = new Set();
    // A credit to a tip that is gone is reported by `validateInventory` and
    // counts for nothing here.
    const creditedSet = new Set(
        (item.tips ?? []).filter((tipId) => tipMap.has(tipId)),
    );
    for (const tip of tipList) {
        for (const step of tip.stepList) {
            if (step.press !== null && pressSet.has(step.press.toLowerCase())) {
                actedSet.add(tip.id);
            }
            if (!checkIsActionableStep(step)) {
                continue;
            }
            for (const find of step.findList) {
                const findLabel = parseLabel(find);
                if (
                    labelList.some((label) => {
                        return checkIsSameControl(label, findLabel);
                    })
                ) {
                    actedSet.add(tip.id);
                }
            }
        }
        if (item.strict !== true) {
            const prose = [
                tip.title,
                tip.detail,
                ...tip.stepList.map((step) => step.text),
            ].join('\n');
            if (labelList.some((label) => checkMentions(prose, label))) {
                taughtSet.add(tip.id);
            }
        }
    }
    const teachingIdList = [
        ...new Set([...actedSet, ...taughtSet, ...creditedSet]),
    ];
    const searchWordList = [
        ...labelList.map((label) => label.control),
        ...(item.search ?? []),
    ];
    const findableIdList = teachingIdList.filter((tipId) => {
        const tip = tipMap.get(tipId);
        return (
            tip !== undefined &&
            searchWordList.some((word) => checkIsSearchHit(tip, word))
        );
    });
    const findableInMap = {};
    for (const [langCode, pack] of Object.entries(packMap)) {
        findableInMap[langCode] =
            pack !== null &&
            teachingIdList.some((tipId) => {
                return checkIsSearchHitIn(
                    pack,
                    tipMap.get(tipId),
                    searchWordList,
                );
            });
    }
    const isExcluded = typeof item.exclude === 'string';
    // Something the firewall will never press, or that only the person may
    // do (a file choice, the projector, a native menu), cannot be acted on
    // and is left out of the acted denominator rather than counted as a miss.
    const isActable =
        !isExcluded &&
        typeof item.personOnly !== 'string' &&
        !labelList.some((label) => checkIsDestructive(label.control));
    let status = 'uncovered';
    if (isExcluded) {
        status = 'excluded';
    } else if (findableIdList.length > 0) {
        status = 'covered';
    } else if (teachingIdList.length > 0) {
        status = 'not-findable';
    }
    return {
        id: item.id,
        surface: item.surface,
        labels: item.labels ?? [],
        status,
        isActable,
        isActed: actedSet.size > 0,
        actedBy: [...actedSet],
        taughtBy: [...taughtSet],
        creditedBy: [...creditedSet],
        findableBy: findableIdList,
        findableIn: findableInMap,
        ...(isExcluded ? { exclude: item.exclude } : {}),
    };
}

// ---- leads -----------------------------------------------------------------

function listSourceFiles(relDir) {
    const fullDir = path.join(REPO_ROOT, relDir);
    if (!existsSync(fullDir)) {
        return [];
    }
    if (statSync(fullDir).isFile()) {
        return [toPosix(relDir)];
    }
    const fileList = [];
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
        const relPath = `${toPosix(relDir)}/${entry.name}`;
        if (entry.isDirectory()) {
            fileList.push(...listSourceFiles(relPath));
        } else if (
            /\.(?:tsx?|mjs)$/.test(entry.name) &&
            !/\.(?:test|spec)\.|\.d\.(?:m?ts)$/.test(entry.name)
        ) {
            fileList.push(relPath);
        }
    }
    return fileList;
}

function readLiteral(literalText) {
    try {
        // Only ever handed a single string literal the pattern matched.
        return new Function(`return (${literalText});`)();
    } catch {
        return null;
    }
}

/** label → where the window's source draws it in a control position. */
function sweepSource(fileList) {
    const labelMap = new Map();
    for (const relPath of fileList) {
        let text;
        try {
            text = readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
        } catch {
            continue;
        }
        for (const match of text.matchAll(CONTROL_CALL_PATTERN)) {
            const label = normalizeLabel(readLiteral(match[3]) ?? '');
            if (label.length === 0) {
                continue;
            }
            const line = text.slice(0, match.index).split('\n').length;
            const entry = labelMap.get(label) ?? { label, atList: [] };
            entry.atList.push({
                file: relPath,
                line,
                context: match[1] ?? 'text',
            });
            labelMap.set(label, entry);
        }
    }
    return labelMap;
}

function genAccountant(inventory) {
    const itemLabelList = (inventory.items ?? []).flatMap((item) => {
        return [...(item.labels ?? []), ...(item.aliases ?? [])].map(
            parseLabel,
        );
    });
    const comparableSet = new Set(
        itemLabelList.flatMap((label) => {
            return [
                toComparableLabel(label.full),
                toComparableLabel(label.control),
            ];
        }),
    );
    const ignoreList = (inventory.ignore ?? []).map((entry) => {
        return {
            ...entry,
            regExp:
                typeof entry.pattern === 'string'
                    ? new RegExp(entry.pattern, 'u')
                    : null,
        };
    });
    const checkIsIgnored = (label, fileList) => {
        const comparable = toComparableLabel(label);
        return ignoreList.some((entry) => {
            if (typeof entry.label === 'string') {
                return toComparableLabel(entry.label) === comparable;
            }
            if (entry.regExp !== null) {
                return entry.regExp.test(label);
            }
            if (typeof entry.file === 'string') {
                return (
                    fileList.length > 0 &&
                    fileList.every((file) => file.startsWith(entry.file))
                );
            }
            return false;
        });
    };
    return {
        // A source label is ONE `tran()` key: it is decided or it is not.
        checkIsSourceAccounted(label, fileList) {
            return (
                comparableSet.has(toComparableLabel(label)) ||
                checkIsIgnored(label, fileList)
            );
        },
        // A live label joins a control's text, title and aria-label, so it is
        // accounted for when it CARRIES a decided control's words.
        checkIsLiveAccounted(label) {
            if (
                comparableSet.has(toComparableLabel(label)) ||
                checkIsIgnored(label, [])
            ) {
                return true;
            }
            return itemLabelList.some((itemLabel) => {
                return (
                    itemLabel.control.length >= 3 &&
                    checkHasPhrase(label, itemLabel.control)
                );
            });
        },
    };
}

// ---- the live window -------------------------------------------------------

function toHarvestPath(pageKey) {
    return path.join(HARVEST_DIR, `${pageKey}-harvest.json`);
}

function loadHarvest(pageKey) {
    const filePath = toHarvestPath(pageKey);
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

async function readLiveWindow(pageInfo, port) {
    const { evaluateInApp } = await importMcp('cdp.mjs');
    const { DOM_MATCH_RUNTIME } = await importMcp('domMatch.mjs');
    // `owa_list_ui`'s own reading with the 200-row cap lifted, plus the dev
    // server's component stamps: which source files drew this window now.
    const expression = `(() => {
        const dm = ${DOM_MATCH_RUNTIME};
        const controls = dm.listControls('', 5000);
        const fileSet = new Set();
        const visit = (root) => {
            for (const element of root.querySelectorAll('[data-react-comp-fp]')) {
                fileSet.add(element.getAttribute('data-react-comp-fp'));
            }
            for (const element of root.querySelectorAll('*')) {
                if (element.shadowRoot) {
                    visit(element.shadowRoot);
                }
            }
        };
        visit(document);
        return { url: location.href, controls, files: [...fileSet] };
    })()`;
    const { value } = await evaluateInApp(expression, {
        port,
        match: pageInfo.window,
        timeout: 30000,
    });
    return value;
}

function mergeHarvest(pageKey, previous, live) {
    const harvest = previous ?? {
        page: pageKey,
        passCount: 0,
        fileList: [],
        labelMap: {},
    };
    const fileSet = new Set(harvest.fileList);
    const newFileList = (live.files ?? []).filter((file) => {
        return !fileSet.has(file);
    });
    const newLabelList = [];
    for (const row of live.controls ?? []) {
        const label = normalizeLabel(row.label);
        if (label.length === 0) {
            continue;
        }
        const entry = harvest.labelMap[label];
        if (entry === undefined) {
            newLabelList.push(label);
            harvest.labelMap[label] = {
                panelList: row.inPanel ? [row.inPanel] : [],
                showsOnHover: row.showsOnHover === true,
                revealBy: row.revealBy ?? null,
            };
        } else if (row.inPanel && !entry.panelList.includes(row.inPanel)) {
            entry.panelList.push(row.inPanel);
        }
    }
    harvest.fileList = [...fileSet, ...newFileList].sort();
    harvest.passCount += 1;
    harvest.updatedAt = new Date().toISOString();
    mkdirSync(HARVEST_DIR, { recursive: true });
    writeFileSync(
        toHarvestPath(pageKey),
        `${JSON.stringify(harvest, null, 2)}\n`,
    );
    return {
        harvest,
        pass: {
            controlCount: (live.controls ?? []).length,
            newLabelList,
            newFileList,
        },
    };
}

// ---- quality ---------------------------------------------------------------

function genQualityFindings(tipList, keyMode, inventory, packMap) {
    const findingList = [];
    const add = (level, code, tipId, text) => {
        findingList.push({ level, code, tipId, text });
    };
    const missingIn = (key) => {
        return Object.entries(packMap)
            .filter(([, pack]) => {
                return pack !== null && !pack.has(toTranKey(key));
            })
            .map(([langCode]) => langCode);
    };
    const toFindKeyList = (find) => {
        return keyMode === 'parts'
            ? parseLabel(find).full.split(' > ')
            : [normalizeLabel(find)];
    };
    const inventoryLabelSet = new Set(
        (inventory?.items ?? []).flatMap((item) => {
            return [...(item.labels ?? []), ...(item.aliases ?? [])].map(
                (label) => toComparableLabel(parseLabel(label).control),
            );
        }),
    );
    const titleMap = new Map();
    for (const tip of tipList) {
        for (const [field, text] of [
            ['title', tip.label],
            ['detail', tip.detail],
            ...(tip.category === null ? [] : [['category', tip.category]]),
        ]) {
            const langList = missingIn(text);
            if (langList.length > 0) {
                add(
                    'error',
                    'untranslated',
                    tip.id,
                    `${field} "${text}" has no ${langList.join('/')} string`,
                );
            }
        }
        const comparableTitle = toComparableLabel(tip.title);
        if (titleMap.has(comparableTitle)) {
            add(
                'error',
                'duplicate-title',
                tip.id,
                `same title as ${titleMap.get(comparableTitle)}: "${tip.title}"`,
            );
        }
        titleMap.set(comparableTitle, tip.id);
        if (tip.title.length > TITLE_MAX_CHARS) {
            add('warn', 'long-title', tip.id, `${tip.title.length} characters`);
        }
        if (tip.detail.length > DETAIL_MAX_CHARS) {
            add(
                'warn',
                'long-detail',
                tip.id,
                `${tip.detail.length} characters`,
            );
        }
        if (tip.stepList.length > STEPS_MAX) {
            add('warn', 'many-steps', tip.id, `${tip.stepList.length} steps`);
        }
        const actedControlList = [];
        tip.stepList.forEach((step, index) => {
            const at = `step ${index + 1}`;
            if (step.text.length > STEP_MAX_CHARS) {
                add(
                    'warn',
                    'long-step',
                    tip.id,
                    `${at}: ${step.text.length} characters`,
                );
            }
            if (!checkIsActionableStep(step)) {
                return;
            }
            for (const find of step.findList) {
                const control = parseLabel(find).control;
                actedControlList.push(control);
                if (checkIsDestructive(control)) {
                    add(
                        'error',
                        'destructive-find',
                        tip.id,
                        `${at}: "${find}" -- the firewall refuses to press it, so Do it can never run`,
                    );
                }
                if (
                    inventoryLabelSet.size > 0 &&
                    !inventoryLabelSet.has(toComparableLabel(control))
                ) {
                    add(
                        'info',
                        'unknown-control',
                        tip.id,
                        `${at}: "${find}" is no inventory item's label`,
                    );
                }
            }
            const keyList = [];
            if (step.translateFind === true && step.findList.length > 0) {
                keyList.push(...toFindKeyList(step.findList[0]));
            } else if (typeof step.translateFind === 'string') {
                keyList.push(...toFindKeyList(step.translateFind));
            }
            if (step.translateFinds) {
                for (const find of step.findList) {
                    keyList.push(...toFindKeyList(find));
                }
            }
            if (step.translateValue && step.value !== null) {
                keyList.push(step.value);
            }
            for (const key of new Set(keyList)) {
                const langList = missingIn(key);
                if (langList.length > 0) {
                    add(
                        'error',
                        'find-untranslated',
                        tip.id,
                        `${at}: "${key}" has no ${langList.join('/')} string: tran() throws on it in a dev window in that language, a packaged one falls back to English`,
                    );
                }
            }
        });
        if (actedControlList.length === 0) {
            add('info', 'self-guided', tip.id, 'no Do it step');
        } else if (
            !actedControlList.some((control) => checkIsSearchHit(tip, control))
        ) {
            add(
                'warn',
                'not-searchable',
                tip.id,
                `its title and detail name none of the controls it presses (${[...new Set(actedControlList)].join(', ')})`,
            );
        }
    }
    return findingList;
}

// ---- one window ------------------------------------------------------------

async function measurePage(pageInfo, { isHarvesting, port }) {
    const { keyMode, tipList } = loadCatalog(pageInfo.key);
    const inventory = loadInventory(pageInfo.key);
    const tipIdSet = new Set(tipList.map((tip) => tip.id));
    let harvest = loadHarvest(pageInfo.key);
    let pass = null;
    if (isHarvesting) {
        const live = await readLiveWindow(pageInfo, port);
        ({ harvest, pass } = mergeHarvest(pageInfo.key, harvest, live));
    }
    const packMap = { km: readPack('km'), fr: readPack('fr') };
    const qualityList = genQualityFindings(tipList, keyMode, inventory, packMap);
    // Every catalog is imported statically by `dailyTipHelpers.ts`, which
    // `DailyTipComp` → `ToastComp` puts in every window that shows toasts: a
    // tip is paid for in memory by windows that never show it.
    const translatedChars = tipList.reduce((total, tip) => {
        const textList = [tip.label, tip.detail, tip.category ?? ''];
        return (
            total +
            Object.values(packMap).reduce((sum, pack) => {
                return (
                    sum +
                    textList.reduce((one, text) => {
                        return one + (pack?.get(toTranKey(text))?.length ?? 0);
                    }, 0)
                );
            }, 0)
        );
    }, 0);
    const catalog = {
        tipCount: tipList.length,
        actionableCount: tipList.filter((tip) => {
            return tip.stepList.some(checkIsActionableStep);
        }).length,
        featuredCount: tipList.filter((tip) => tip.isFeatured).length,
        sourceChars: JSON.stringify(tipList).length,
        translatedChars,
    };
    if (inventory === null) {
        return {
            page: pageInfo,
            catalog,
            inventory: null,
            qualityList,
            pass,
            harvest,
        };
    }
    const problemList = validateInventory(inventory, tipIdSet);
    const itemList = (inventory.items ?? []).map((item) => {
        return measureItem(item, tipList, packMap);
    });
    const countedList = itemList.filter((item) => item.status !== 'excluded');
    const coveredList = countedList.filter((item) => {
        return item.status === 'covered';
    });
    const actableList = countedList.filter((item) => item.isActable);
    const actedList = actableList.filter((item) => item.isActed);
    const surfaceMap = new Map();
    for (const item of countedList) {
        const row = surfaceMap.get(item.surface) ?? {
            surface: item.surface,
            itemCount: 0,
            coveredCount: 0,
            actableCount: 0,
            actedCount: 0,
        };
        row.itemCount += 1;
        row.coveredCount += item.status === 'covered' ? 1 : 0;
        row.actableCount += item.isActable ? 1 : 0;
        row.actedCount += item.isActable && item.isActed ? 1 : 0;
        surfaceMap.set(item.surface, row);
    }
    const accountant = genAccountant(inventory);
    const sourceFileList = [
        ...new Set([
            ...(inventory.sourceDirs ?? []).flatMap(listSourceFiles),
            ...(inventory.sourceFiles ?? []).flatMap(listSourceFiles),
            ...(harvest?.fileList ?? []).filter((file) => {
                return existsSync(path.join(REPO_ROOT, file));
            }),
        ]),
    ].sort();
    const sourceLeadList = [...sweepSource(sourceFileList).values()].filter(
        (entry) => {
            return !accountant.checkIsSourceAccounted(
                entry.label,
                entry.atList.map((at) => at.file),
            );
        },
    );
    const liveLeadList = Object.entries(harvest?.labelMap ?? {})
        .filter(([label]) => !accountant.checkIsLiveAccounted(label))
        .map(([label, entry]) => ({ label, ...entry }));
    const usedTipIdSet = new Set(
        itemList.flatMap((item) => [
            ...item.actedBy,
            ...item.taughtBy,
            ...item.creditedBy,
        ]),
    );
    return {
        page: pageInfo,
        catalog,
        inventory: {
            updated: inventory.updated ?? null,
            itemCount: itemList.length,
            excludedCount: itemList.length - countedList.length,
            problemList,
        },
        coverage: {
            counted: countedList.length,
            covered: coveredList.length,
            percent: toPercent(coveredList.length, countedList.length),
            notFindable: countedList.filter((item) => {
                return item.status === 'not-findable';
            }).length,
            uncovered: countedList.filter((item) => {
                return item.status === 'uncovered';
            }).length,
            actable: actableList.length,
            acted: actedList.length,
            actedPercent: toPercent(actedList.length, actableList.length),
            findableIn: Object.fromEntries(
                Object.keys(packMap).map((langCode) => {
                    const count = countedList.filter((item) => {
                        return item.findableIn[langCode];
                    }).length;
                    return [
                        langCode,
                        {
                            count,
                            percent: toPercent(count, countedList.length),
                        },
                    ];
                }),
            ),
        },
        surfaceList: [...surfaceMap.values()],
        itemList,
        // A tip that covers no item is either teaching something the
        // inventory does not know, or nothing a volunteer needs.
        unusedTipIdList: tipList
            .map((tip) => tip.id)
            .filter((tipId) => !usedTipIdSet.has(tipId)),
        leads: {
            sourceFileCount: sourceFileList.length,
            sourceList: sourceLeadList,
            liveList: liveLeadList,
            harvestPassCount: harvest?.passCount ?? 0,
            harvestUpdatedAt: harvest?.updatedAt ?? null,
        },
        qualityList,
        pass,
    };
}

// ---- printing --------------------------------------------------------------

function printLine(text = '') {
    process.stdout.write(`${text}\n`);
}

function countBy(list, key) {
    const map = {};
    for (const one of list) {
        map[one[key]] = (map[one[key]] ?? 0) + 1;
    }
    return map;
}

function printPass(pass) {
    if (pass === null) {
        return;
    }
    printLine(
        `harvest pass: ${pass.controlCount} controls read, ` +
            `${pass.newLabelList.length} new labels, ` +
            `${pass.newFileList.length} new source files`,
    );
    for (const file of pass.newFileList.slice(0, 20)) {
        printLine(`  + ${file}`);
    }
}

function printQuality(qualityList, isAll) {
    const countMap = countBy(qualityList, 'level');
    printLine(
        `quality: ${countMap.error ?? 0} errors · ${countMap.warn ?? 0} warnings · ` +
            `${countMap.info ?? 0} notes ` +
            `(${Object.entries(countBy(qualityList, 'code'))
                .map(([code, count]) => `${code} ${count}`)
                .join(', ')})`,
    );
    const shownList = isAll
        ? qualityList
        : qualityList.filter((one) => one.level === 'error').slice(0, 8);
    for (const one of shownList) {
        printLine(`  ${one.level.padEnd(5)} ${one.code}  ${one.tipId}: ${one.text}`);
    }
}

function printReport(report) {
    const { page, catalog } = report;
    printLine(
        `Tip coverage — ${page.label} (${page.window})   ${toToday()}`,
    );
    printLine(
        `catalog: ${catalog.tipCount} tips · ${catalog.actionableCount} with a Do it step · ` +
            `${catalog.featuredCount} featured · ` +
            `${Math.round(catalog.sourceChars / 1024)} KB of lessons + ` +
            `${Math.round(catalog.translatedChars / 1024)} KB of km/fr strings`,
    );
    printPass(report.pass);
    if (report.inventory === null) {
        printLine();
        printLine(
            `No inventory yet: ${toPosix(path.relative(REPO_ROOT, toInventoryPath(page.key)))}`,
        );
        printLine(
            'Write its skeleton with --init, declare sourceDirs, then triage the leads.',
        );
        printLine();
        printQuality(report.qualityList, flagMap.has('quality'));
        return;
    }
    const { coverage, inventory, leads } = report;
    printLine(
        `inventory: ${inventory.itemCount} items (${inventory.excludedCount} excluded) · updated ${inventory.updated ?? '?'}`,
    );
    for (const problem of inventory.problemList) {
        printLine(`  ! ${problem}`);
    }
    printLine();
    const isProvisional =
        leads.sourceList.length + leads.liveList.length > 0 ||
        leads.harvestPassCount === 0;
    printLine(
        `COVERED   ${coverage.covered}/${coverage.counted} = ${formatPercent(coverage.percent)}` +
            (isProvisional ? '   (provisional: see leads)' : '') +
            (target === null
                ? ''
                : `   target ${target}% ${coverage.percent !== null && coverage.percent >= target ? 'MET' : 'not met'}`),
    );
    printLine(
        `  taught but not findable ${coverage.notFindable} · uncovered ${coverage.uncovered}`,
    );
    printLine(
        `  the same search in ${Object.entries(coverage.findableIn)
            .map(([langCode, one]) => {
                return `${langCode} ${one.count}/${coverage.counted} = ${formatPercent(one.percent)}`;
            })
            .join(' · ')}`,
    );
    printLine(
        `ACTED     ${coverage.acted}/${coverage.actable} actable = ${formatPercent(coverage.actedPercent)}`,
    );
    if (report.surfaceList.length > 0) {
        printLine();
        printLine('surface                                   items covered  acted');
        for (const row of report.surfaceList) {
            printLine(
                `${row.surface.slice(0, 40).padEnd(42)}${String(row.itemCount).padStart(5)}` +
                    `${String(row.coveredCount).padStart(8)}` +
                    `${`${row.actedCount}/${row.actableCount}`.padStart(7)}`,
            );
        }
    }
    const shownStatusList = flagMap.has('uncovered')
        ? ['uncovered', 'not-findable']
        : [];
    const missList = report.itemList.filter((item) => {
        return shownStatusList.includes(item.status);
    });
    if (missList.length > 0) {
        printLine();
        for (const item of missList) {
            printLine(
                `  ${item.status.padEnd(12)} ${item.id}  [${item.surface}] ${item.labels.join(' | ')}` +
                    (item.status === 'not-findable'
                        ? `  (taught by ${[...item.actedBy, ...item.taughtBy, ...item.creditedBy].join(', ')})`
                        : ''),
            );
        }
    }
    printLine();
    printLine(
        `leads: ${leads.sourceList.length} untriaged from source (${leads.sourceFileCount} files) · ` +
            `${leads.liveList.length} from ${leads.harvestPassCount} live harvest pass(es)` +
            (leads.harvestUpdatedAt === null
                ? ' -- none yet, run with --harvest'
                : `, last ${leads.harvestUpdatedAt.slice(0, 16)}`),
    );
    if (flagMap.has('leads')) {
        const byFileMap = new Map();
        for (const lead of leads.sourceList) {
            const file = lead.atList[0].file;
            byFileMap.set(file, [...(byFileMap.get(file) ?? []), lead]);
        }
        for (const [file, leadList] of byFileMap) {
            printLine(`  ${file}`);
            for (const lead of leadList) {
                const at = lead.atList[0];
                printLine(
                    `    ${lead.label}   (${at.context}, line ${at.line}` +
                        (lead.atList.length > 1
                            ? `, +${lead.atList.length - 1} more`
                            : '') +
                        ')',
                );
            }
        }
        if (leads.liveList.length > 0) {
            printLine('  live window:');
            for (const lead of leads.liveList) {
                printLine(
                    `    ${lead.label}` +
                        (lead.panelList.length > 0
                            ? `   [${lead.panelList.join(', ')}]`
                            : '') +
                        (lead.showsOnHover ? '   (hover)' : ''),
                );
            }
        }
    }
    if (report.unusedTipIdList.length > 0) {
        printLine(
            `tips that cover no item: ${report.unusedTipIdList.length}` +
                (flagMap.has('uncovered')
                    ? ` -- ${report.unusedTipIdList.join(', ')}`
                    : ' (--uncovered lists them)'),
        );
    }
    printLine();
    printQuality(report.qualityList, flagMap.has('quality'));
}

// ---- main ------------------------------------------------------------------

async function main() {
    const port = Number(flagMap.get('port')) || undefined;
    if (flagMap.has('all')) {
        const rowList = [];
        for (const pageInfo of BOT_FOCUS_LIST) {
            rowList.push(await measurePage(pageInfo, { isHarvesting: false }));
        }
        if (isJson) {
            printLine(JSON.stringify(rowList, null, 2));
            return 0;
        }
        printLine('window                    tips  do-it  items  covered  acted  leads  q-errors');
        for (const row of rowList) {
            const errorCount = row.qualityList.filter((one) => {
                return one.level === 'error';
            }).length;
            printLine(
                `${row.page.window.padEnd(24)}${String(row.catalog.tipCount).padStart(4)}` +
                    `${String(row.catalog.actionableCount).padStart(7)}` +
                    (row.inventory === null
                        ? '      —        —      —      —'
                        : `${String(row.inventory.itemCount).padStart(7)}` +
                          `${formatPercent(row.coverage.percent).padStart(9)}` +
                          `${formatPercent(row.coverage.actedPercent).padStart(7)}` +
                          `${String(row.leads.sourceList.length + row.leads.liveList.length).padStart(7)}`) +
                    `${String(errorCount).padStart(10)}`,
            );
        }
        return 0;
    }
    const pageInfo = resolvePage(
        positionalList.find((one) => !/^\d+(?:\.\d+)?%?$/.test(one)),
    );
    if (pageInfo === null) {
        printLine(
            `Name a window: ${BOT_FOCUS_LIST.map((one) => one.window).join(', ')} -- or --all.`,
        );
        return 1;
    }
    if (typeof flagMap.get('steps') === 'string') {
        const payload = getGuidePayload(pageInfo, flagMap.get('steps'));
        if (payload === null) {
            printLine(`No tip has the id "${flagMap.get('steps')}".`);
            return 1;
        }
        printLine(JSON.stringify(payload, null, 2));
        return 0;
    }
    if (flagMap.has('init')) {
        const filePath = toInventoryPath(pageInfo.key);
        if (existsSync(filePath)) {
            printLine(`Already there: ${toPosix(path.relative(REPO_ROOT, filePath))}`);
            return 1;
        }
        mkdirSync(INVENTORY_DIR, { recursive: true });
        writeFileSync(
            filePath,
            `${JSON.stringify(genInventorySkeleton(pageInfo), null, 2)}\n`,
        );
        printLine(`Wrote ${toPosix(path.relative(REPO_ROOT, filePath))}`);
        return 0;
    }
    const report = await measurePage(pageInfo, {
        isHarvesting: flagMap.has('harvest'),
        port,
    });
    if (isJson) {
        printLine(JSON.stringify(report, null, 2));
    } else {
        printReport(report);
    }
    if (report.inventory?.problemList.length > 0) {
        return 1;
    }
    if (target !== null) {
        const percent = report.coverage?.percent ?? null;
        return percent !== null && percent >= target ? 0 : 1;
    }
    return 0;
}

try {
    process.exitCode = await main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
