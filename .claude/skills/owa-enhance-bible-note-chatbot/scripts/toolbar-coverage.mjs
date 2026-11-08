#!/usr/bin/env node
// How much of the Bible Note editor's toolbar the chatbot can do, measured --
// never guessed (owa-enhance-bible-note-chatbot, rule 1).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/toolbar-coverage.mjs
//   node …/toolbar-coverage.mjs --no-run     # inventory and leads only
//   node …/toolbar-coverage.mjs --json
//
// 1. The inventory (`references/toolbar-inventory.json`): one item per control,
//    each either `change` (what owa_note_edit does for it) or `excluded` (why
//    not, a decision the run report lists).
// 2. LEADS: the toolbar's own labels read out of the INSTALLED `bible-note`
//    package (its built toolbar: aria-labels and menu texts) that no
//    inventory item names. A package upgrade that adds a control shows here
//    before anybody asks why the chatbot cannot do it. The figure is
//    PROVISIONAL while a lead is untriaged.
// 3. The parity tests: `vitest run` over
//    `src/helper/agentNoteToolbarParity.test.ts` and
//    `src/helper/agentNoteEditHelpers.test.ts`, read as JSON. An item is
//    COVERED when a passing test is named `toolbar: <id>`.
//
// Writes nothing in the repository; the vitest JSON goes to the OS temp
// folder and is removed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = resolve(SKILL_DIR, '..', '..', '..');
const INVENTORY_PATH = join(SKILL_DIR, 'references', 'toolbar-inventory.json');
const TEST_FILE_LIST = [
    'src/helper/agentNoteToolbarParity.test.ts',
    'src/helper/agentNoteEditHelpers.test.ts',
];
// Labels of the toolbar that are not controls of a NOTE: the menus
// themselves and the Emoji & HTML Character dialog's own words.
// Each is listed with why, so a new label is never hidden by accident.
const NOT_A_NOTE_CONTROL_MAP = {
    'Formatting options for text style':
        'the block type menu itself (its items are inventory items)',
    'Formatting options for additional text styles': 'the ••• menu itself',
    'Insert specialized editor node': 'the + Insert menu itself',
    'Formatting options for font size': 'the size menu itself',
    'Formatting options for text alignment': 'the alignment menu itself',
    'Search emoji and HTML characters':
        'the search box of the Emoji & HTML Character dialog',
    'No matches': "that dialog's empty line",
    HTML: 'a tab of that dialog',
};

const args = new Set(process.argv.slice(2));
const isJson = args.has('--json');
const isRunning = !args.has('--no-run');

function readInventory() {
    return JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
}

/** The toolbar's labels, read off the package's built toolbar. */
function readPackageLabels() {
    let entryPath;
    try {
        const require = createRequire(join(REPO_DIR, 'package.json'));
        entryPath = require.resolve('bible-note');
    } catch (_error) {
        return { labels: [], note: 'the bible-note package is not installed' };
    }
    let distDir = dirname(entryPath);
    while (
        !existsSync(join(distDir, 'bible-note.mjs')) &&
        distDir !== dirname(distDir)
    ) {
        distDir = dirname(distDir);
    }
    const source = readFileSync(join(distDir, 'bible-note.mjs'), 'utf8');
    // The toolbar is the region between the block type menu and the
    // invisible-characters switch.
    const start = source.indexOf('Formatting options for text style');
    const end = source.indexOf('Show invisible characters', start);
    if (start < 0 || end < 0) {
        return { labels: [], note: 'the toolbar was not found in the package' };
    }
    const toolbar = source.slice(Math.max(0, start - 20000), end + 4000);
    const labels = new Set();
    for (const match of toolbar.matchAll(/"aria-label": "([^"]+)"/g)) {
        labels.add(match[1]);
    }
    for (const match of toolbar.matchAll(
        /"aria-label": `([^`$]+?)(?:\.|\s*Shortcut)/g,
    )) {
        labels.add(match[1].trim());
    }
    for (const match of toolbar.matchAll(/children: "([A-Z][^"]{1,40})"/g)) {
        labels.add(match[1]);
    }
    for (const match of toolbar.matchAll(/buttonAriaLabel: "([^"]+)"/g)) {
        labels.add(match[1]);
    }
    for (const match of toolbar.matchAll(/name: "([A-Z][a-z]+ Align)"/g)) {
        labels.add(match[1]);
    }
    for (const match of toolbar.matchAll(
        /contentName: "([^"]+)"|buttonLabel: "([^"]+)"/g,
    )) {
        labels.add(match[1] ?? match[2]);
    }
    return { labels: [...labels].sort() };
}

function normalize(label) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Toolbar labels no inventory item and no known non-control names. */
function findLeads(inventory, labels) {
    const known = new Set(
        inventory.items.flatMap((item) => {
            return [item.label, ...(item.aliases ?? [])].map(normalize);
        }),
    );
    const ignored = new Set(Object.keys(NOT_A_NOTE_CONTROL_MAP).map(normalize));
    return labels.filter((label) => {
        const key = normalize(label);
        if (known.has(key) || ignored.has(key)) {
            return false;
        }
        // "Format text as bold" is the inventory's "Format text as bold".
        return ![...known].some((one) => {
            return one.includes(key) || key.includes(one);
        });
    });
}

function runParityTests() {
    const outputPath = join(
        tmpdir(),
        `note-toolbar-parity-${process.pid}.json`,
    );
    try {
        execFileSync(
            process.execPath,
            [
                join(REPO_DIR, 'node_modules', 'vitest', 'vitest.mjs'),
                'run',
                ...TEST_FILE_LIST,
                '--reporter=json',
                `--outputFile=${outputPath}`,
            ],
            { cwd: REPO_DIR, stdio: 'ignore' },
        );
    } catch (_error) {
        // A failing test still writes the report; it is read below.
    }
    if (!existsSync(outputPath)) {
        return null;
    }
    const report = JSON.parse(readFileSync(outputPath, 'utf8'));
    rmSync(outputPath, { force: true });
    const passed = new Set();
    const failed = new Set();
    for (const file of report.testResults ?? []) {
        for (const result of file.assertionResults ?? []) {
            const match = /^toolbar: (.+)$/.exec(result.title ?? '');
            if (match === null) {
                continue;
            }
            (result.status === 'passed' ? passed : failed).add(match[1]);
        }
    }
    return { passed, failed };
}

const inventory = readInventory();
const { labels, note } = readPackageLabels();
const leads = findLeads(inventory, labels);
const tests = isRunning ? runParityTests() : null;

const counted = inventory.items.filter((item) => {
    return item.excluded === undefined;
});
const excluded = inventory.items.filter((item) => {
    return item.excluded !== undefined;
});
const covered =
    tests === null
        ? []
        : counted.filter((item) => {
              return tests.passed.has(item.id);
          });
const missing =
    tests === null
        ? []
        : counted.filter((item) => {
              return !tests.passed.has(item.id);
          });
const percent =
    counted.length === 0
        ? 0
        : Math.round((covered.length / counted.length) * 1000) / 10;

if (isJson) {
    console.log(
        JSON.stringify(
            {
                inventory: inventory.items.length,
                counted: counted.length,
                excluded: excluded.map((item) => item.id),
                covered: covered.length,
                percent: tests === null ? null : percent,
                missing: missing.map((item) => item.id),
                failed: tests === null ? [] : [...tests.failed],
                leads,
                isProvisional: leads.length > 0,
                note: note ?? null,
            },
            null,
            2,
        ),
    );
    process.exit(0);
}

console.log('Bible Note toolbar through the chatbot (owa_note_edit)');
console.log(
    `  inventory   ${inventory.items.length} controls (updated ${inventory.updated})`,
);
console.log(
    `  excluded    ${excluded.length}: ${excluded.map((item) => item.id).join(', ') || 'none'}`,
);
if (tests === null) {
    console.log(
        isRunning
            ? '  tests       the parity tests wrote no report'
            : '  tests       not run (--no-run)',
    );
} else {
    console.log(
        `  covered     ${covered.length} of ${counted.length} = ${percent}%` +
            (leads.length > 0 ? '  (PROVISIONAL: untriaged leads below)' : ''),
    );
    for (const item of missing) {
        console.log(
            `  ✗ ${item.id} — ${item.label}${tests.failed.has(item.id) ? ' (test FAILS)' : ' (no test)'}`,
        );
    }
}
if (note) {
    console.log(`  leads       ${note}`);
} else if (leads.length === 0) {
    console.log(
        `  leads       none: every toolbar label of the installed package is triaged`,
    );
} else {
    console.log(
        `  leads       ${leads.length} toolbar label(s) no inventory item names:`,
    );
    for (const lead of leads) {
        console.log(`    ? ${lead}`);
    }
}
const reviewedDir = join(SKILL_DIR, 'references');
if (!readdirSync(reviewedDir).includes('scoreboard.md')) {
    console.log('  (no scoreboard.md yet: add this run as its first row)');
}
