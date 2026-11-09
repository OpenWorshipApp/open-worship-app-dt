#!/usr/bin/env node
// What a `run-elder-asks.mjs` run found: verdicts by category and reason,
// and -- with `--fails` -- each failure with what the model sent and said.
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/elder-asks-report.mjs <results.jsonl> [--fails] [--category=3]
//
// A later line for the same id (a re-ask) replaces the earlier one.

import { readFileSync } from 'node:fs';

const [, , resultsPath, ...rest] = process.argv;
if (!resultsPath) {
    console.error('Give the results .jsonl a run wrote.');
    process.exit(2);
}
const categoryArg = rest.find((arg) => arg.startsWith('--category='));
const categorySet =
    categoryArg === undefined
        ? null
        : new Set(categoryArg.slice('--category='.length).split(',').map(Number));
const rowMap = new Map();
const ungradedSet = new Set();
for (const line of readFileSync(resultsPath, 'utf8').split(/\r?\n/)) {
    if (line.trim() === '') {
        continue;
    }
    try {
        const row = JSON.parse(line);
        // Not graded: the run's fault (the tab had lost the note, the
        // window was paused), asked again later.
        if (row.verdict === 'not-note-ask' || row.verdict === 'paused') {
            if (!rowMap.has(row.id)) {
                ungradedSet.add(row.id);
            }
            continue;
        }
        ungradedSet.delete(row.id);
        if (categorySet === null || categorySet.has(row.category)) {
            rowMap.set(row.id, row);
        }
    } catch (_error) {
        // a line cut short
    }
}
const rows = [...rowMap.values()];
const isPass = (row) => row.verdict === 'pass' || row.verdict === 'pass-multi';
const byCategory = new Map();
for (const row of rows) {
    const entry = byCategory.get(row.category) ?? { all: 0, pass: 0, multi: 0 };
    entry.all++;
    entry.pass += isPass(row) ? 1 : 0;
    entry.multi += row.verdict === 'pass-multi' ? 1 : 0;
    byCategory.set(row.category, entry);
}
const passCount = rows.filter(isPass).length;
const multiCount = rows.filter((row) => row.verdict === 'pass-multi').length;
const seconds = rows.map((row) => row.seconds).sort((one, other) => one - other);
console.log(
    `${rows.length} asked: ${passCount} supported (${((100 * passCount) / Math.max(1, rows.length)).toFixed(1)}%), ` +
        `${multiCount} of them in more than one call; median ${seconds[Math.floor(seconds.length / 2)] ?? '?'} s` +
        (ungradedSet.size > 0
            ? `; ${ungradedSet.size} not graded (ask again): ${[...ungradedSet].join(' ')}`
            : ''),
);
for (const [category, entry] of [...byCategory].sort((one, other) => one[0] - other[0])) {
    console.log(
        `  category ${String(category).padStart(2)}: ${entry.pass}/${entry.all}` +
            (entry.multi > 0 ? ` (${entry.multi} multi)` : ''),
    );
}
const reasonMap = new Map();
for (const row of rows.filter((one) => !isPass(one))) {
    const key = String(row.reason).split(' ')[0];
    reasonMap.set(key, [...(reasonMap.get(key) ?? []), row.id]);
}
for (const [reason, ids] of [...reasonMap].sort((one, other) => other[1].length - one[1].length)) {
    console.log(`  ${reason}: ${ids.length} -- ${ids.join(' ')}`);
}
if (rest.includes('--fails')) {
    for (const row of rows.filter((one) => !isPass(one))) {
        console.log(`\n#${row.id} [${row.expect?.do}] ${row.reason} (${row.seconds} s): ${row.text}`);
        if (row.after) {
            console.log(`   after: ${row.after}`);
        }
        for (const call of row.calls.filter((one) => one.args?.action !== 'read')) {
            console.log(
                `   ${call.isError ? 'REFUSED ' : ''}${call.name} ${JSON.stringify(call.args).replace(/"file":"[^"]*",?/, '').slice(0, 400)}`,
            );
            if (call.isError) {
                console.log(`     -> ${String(call.text).slice(0, 200)}`);
            }
        }
        console.log(`   answer: ${String(row.answer).replace(/\s+/g, ' ').slice(0, 400)}`);
    }
}
