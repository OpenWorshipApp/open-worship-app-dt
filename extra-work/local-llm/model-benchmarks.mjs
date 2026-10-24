// model-benchmarks.mjs
// `model-benchmarks.json` beside this script is where every measurement of a
// model answering for the app's chatbot is kept: which model, in which
// program, on which machine, what it was asked, how long it took and what
// came back. It is kept so that somebody choosing a model -- for their own
// computer, or for a server shared with the whole church -- can be told what
// is known to work, instead of each run's numbers staying in the note of the
// day it was taken.
//
// This script checks the file's shape (the test runs the same check) and
// prints it as a table, best fit first:
//
//   node extra-work/local-llm/model-benchmarks.mjs            every model
//   node extra-work/local-llm/model-benchmarks.mjs --vram 8   what is known to
//                                                             run in 8 GB
//   node extra-work/local-llm/model-benchmarks.mjs --json     the same, as JSON
//
// A new measurement is a new object in a model's `runs` (or a new model):
// write what was measured and where it is recorded, and nothing that was not.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BENCHMARKS_FILE = path.join(HERE, 'model-benchmarks.json');

// How well a model does the chatbot's job, as the measurements show it:
//   good     answers app questions through the tool loop, correctly
//   usable   answers, with a stated limit (slow, one kind of question only)
//   limited  only the no-tool road (`/btw`, a drafted song) is worth using
//   poor     tried and not worth offering
//   unrated  measured, but nobody has said how well it does the job
export const FIT_LIST = ['good', 'usable', 'limited', 'poor', 'unrated'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_FIELDS = [
    'contextLength',
    'seconds',
    'secondsToFirstToken',
    'rounds',
    'totalTokens',
    'promptTokens',
    'generatedTokens',
    'tokensPerSecond',
    'promptTokensPerSecond',
];

function checkIsText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function checkIsNumberOrNull(value) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    );
}

/** Everything wrong with the store's shape; empty when it can be relied on. */
export function findBenchmarkProblems(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return ['the file is not a JSON object'];
    }
    const problems = [];
    if (data.version !== 1) {
        problems.push('"version" must be 1');
    }
    if (!DATE_PATTERN.test(data.updated ?? '')) {
        problems.push('"updated" must be a date, YYYY-MM-DD');
    }
    const machines = Array.isArray(data.machines) ? data.machines : [];
    const machineIds = new Set();
    machines.forEach((machine, index) => {
        const where = `machines[${index}]`;
        if (!checkIsText(machine?.id) || machineIds.has(machine.id)) {
            problems.push(`${where}.id is missing or used twice`);
        } else {
            machineIds.add(machine.id);
        }
        if (!checkIsText(machine?.what)) {
            problems.push(`${where}.what is missing`);
        }
        for (const field of ['vramGb', 'ramGb']) {
            if (!checkIsNumberOrNull(machine?.[field])) {
                problems.push(`${where}.${field} must be a number or null`);
            }
        }
    });
    // What the measurements taught of every model: said, and sourced.
    (Array.isArray(data.rules) ? data.rules : []).forEach((rule, index) => {
        for (const field of ['rule', 'source']) {
            if (!checkIsText(rule?.[field])) {
                problems.push(`rules[${index}].${field} is missing`);
            }
        }
    });
    if (!Array.isArray(data.models)) {
        problems.push('"models" must be a list');
        return problems;
    }
    const modelIds = new Set();
    data.models.forEach((model, modelIndex) => {
        const where = `models[${modelIndex}]`;
        if (!checkIsText(model?.model) || modelIds.has(model.model)) {
            problems.push(`${where}.model is missing or used twice`);
        } else {
            modelIds.add(model.model);
        }
        if (!FIT_LIST.includes(model?.fit)) {
            problems.push(`${where}.fit must be one of ${FIT_LIST.join(', ')}`);
        }
        // A judgement with nothing said for it is not one to pass on.
        if (model?.fit !== 'unrated' && !checkIsText(model?.fitNote)) {
            problems.push(
                `${where}.fitNote must say why it is "${model?.fit}"`,
            );
        }
        const runs = Array.isArray(model?.runs) ? model.runs : [];
        if (runs.length === 0) {
            problems.push(`${where}.runs must hold at least one measurement`);
        }
        runs.forEach((run, runIndex) => {
            const runWhere = `${where}.runs[${runIndex}]`;
            if (!DATE_PATTERN.test(run?.date ?? '')) {
                problems.push(`${runWhere}.date must be YYYY-MM-DD`);
            }
            for (const field of ['program', 'task', 'outcome', 'source']) {
                if (!checkIsText(run?.[field])) {
                    problems.push(`${runWhere}.${field} is missing`);
                }
            }
            if (
                run?.machine !== null &&
                run?.machine !== undefined &&
                !machineIds.has(run.machine)
            ) {
                problems.push(
                    `${runWhere}.machine "${run.machine}" is not in "machines"`,
                );
            }
            for (const field of NUMBER_FIELDS) {
                if (!checkIsNumberOrNull(run?.[field])) {
                    problems.push(
                        `${runWhere}.${field} must be a number or null`,
                    );
                }
            }
        });
    });
    return problems;
}

function findBest(runs, field) {
    const values = runs
        .map((run) => {
            return run[field];
        })
        .filter((value) => {
            return typeof value === 'number';
        });
    return values.length > 0 ? Math.max(...values) : null;
}

/**
 * One row per model, best fit first: what to say about it, the fastest it was
 * MEASURED reading a prompt and writing an answer, and the smallest video
 * memory it is known to have run in (0 is no graphics card at all). Nothing
 * is worked out from a whole answer's seconds: those hold the reading of the
 * prompt too. `vramGb` keeps the models measured on a machine with no more
 * than that.
 */
export function genBenchmarkSummary(data, { vramGb = null } = {}) {
    const machineMap = new Map(
        (data.machines ?? []).map((machine) => {
            return [machine.id, machine];
        }),
    );
    const rows = [];
    for (const model of data.models) {
        const vramList = model.runs
            .map((run) => {
                return machineMap.get(run.machine)?.vramGb ?? null;
            })
            .filter((value) => {
                return value !== null;
            });
        const ranInVramGb = vramList.length > 0 ? Math.min(...vramList) : null;
        if (vramGb !== null && (ranInVramGb === null || ranInVramGb > vramGb)) {
            continue;
        }
        rows.push({
            model: model.model,
            fit: model.fit,
            fitNote: model.fitNote ?? '',
            runs: model.runs.length,
            bestPromptTokensPerSecond: findBest(
                model.runs,
                'promptTokensPerSecond',
            ),
            bestTokensPerSecond: findBest(model.runs, 'tokensPerSecond'),
            ranInVramGb,
        });
    }
    return rows.sort((one, other) => {
        return (
            FIT_LIST.indexOf(one.fit) - FIT_LIST.indexOf(other.fit) ||
            one.model.localeCompare(other.model)
        );
    });
}

export function readBenchmarks(file = BENCHMARKS_FILE) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
    const args = process.argv.slice(2);
    const vramAt = args.indexOf('--vram');
    const vramGb = vramAt === -1 ? null : Number(args[vramAt + 1]);
    if (vramGb !== null && !(vramGb > 0)) {
        console.error(
            'Usage: node model-benchmarks.mjs [--vram <GB>] [--json]',
        );
        process.exit(1);
    }
    const data = readBenchmarks();
    const problems = findBenchmarkProblems(data);
    if (problems.length > 0) {
        console.error('model-benchmarks.json cannot be relied on:');
        for (const problem of problems) {
            console.error(`  - ${problem}`);
        }
        process.exit(1);
    }
    const rows = genBenchmarkSummary(data, { vramGb });
    if (args.includes('--json')) {
        console.log(JSON.stringify(rows, null, 2));
        return;
    }
    console.log(
        `${data.models.length} models, updated ${data.updated}` +
            (vramGb === null
                ? ''
                : `; shown: measured in ${vramGb} GB or less`),
    );
    for (const row of rows) {
        const reads =
            row.bestPromptTokensPerSecond === null
                ? ''
                : `, reads a prompt at ${row.bestPromptTokensPerSecond} tokens/s`;
        const speed =
            row.bestTokensPerSecond === null
                ? ''
                : `, writes at ${row.bestTokensPerSecond} tokens/s`;
        const vram =
            row.ranInVramGb === null
                ? ''
                : row.ranInVramGb === 0
                  ? ', ran with no graphics card'
                  : `, ran in ${row.ranInVramGb} GB`;
        console.log(
            `\n${row.fit.toUpperCase().padEnd(8)} ${row.model}  (${row.runs} run${row.runs === 1 ? '' : 's'}${reads}${speed}${vram})`,
        );
        if (row.fitNote.length > 0) {
            console.log(`         ${row.fitNote}`);
        }
    }
}

function checkIsRunDirectly() {
    try {
        return (
            process.argv[1] !== undefined &&
            fs.realpathSync.native(process.argv[1]) ===
                fs.realpathSync.native(fileURLToPath(import.meta.url))
        );
    } catch {
        return false;
    }
}

if (checkIsRunDirectly()) {
    main();
}
