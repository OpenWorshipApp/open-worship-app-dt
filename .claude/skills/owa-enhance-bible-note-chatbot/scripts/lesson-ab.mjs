// A blind pair set, shuffled under neutral ids with the key written apart:
//
//   node lesson-ab.mjs <results.jsonl> <out prefix> [seed]
//     each row's DRAFT (`blocksBefore`) against its REVIEWED lesson
//     (`blocks`), from one `run-lesson-asks.mjs --review=N` run (BN-74) --
//     the readers are told what was asked and never the review rounds or
//     the fixes pressed in them;
//
//   node lesson-ab.mjs --before=<a.jsonl> --after=<b.jsonl> <out prefix> [seed]
//     the same ask's lesson from two runs (a shape changed between them,
//     BN-81), paired by id.
//
// writes `<prefix>-set.jsonl` (rows `lesson-rubric.mjs --text=<dir>` turns
// into one `<id>.md` a lesson) and `<prefix>-key.json` ({id: {ask, version}}).
// Unblind only after both readers have written their verdicts.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => {
    const found = args.find((arg) => arg.startsWith(`--${name}=`));
    return found === undefined ? null : found.slice(name.length + 3);
};
const [first, second, third] = args.filter((arg) => !arg.startsWith('--'));
const beforeFile = flag('before');
const afterFile = flag('after');
const isTwoRuns = beforeFile !== null && afterFile !== null;
const input = isTwoRuns ? null : first;
const prefix = isTwoRuns ? first : second;
const seedArg = (isTwoRuns ? second : third) ?? '11';
if (prefix === undefined || (!isTwoRuns && input === undefined)) {
    console.error(
        'node lesson-ab.mjs <results.jsonl> <out prefix> [seed]\n' +
            'node lesson-ab.mjs --before=<a.jsonl> --after=<b.jsonl> <out prefix> [seed]',
    );
    process.exit(1);
}
const readRows = (file) => {
    return readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
};
// What was ASKED: the review's presses ride on `pressed` and are left out.
const toAsked = (row) => {
    const reviewPressed = (row.reviews ?? [])
        .flatMap((review) => [review.pressed, ...(review.alsoPressed ?? [])])
        .filter((pressed) => typeof pressed === 'string');
    return {
        ...row,
        pressed: (row.pressed ?? []).filter(
            (words) => !reviewPressed.includes(words),
        ),
    };
};
const entries = [];
if (isTwoRuns) {
    const afterMap = new Map(readRows(afterFile).map((row) => [row.id, row]));
    for (const before of readRows(beforeFile)) {
        const after = afterMap.get(before.id);
        if (after === undefined || !Array.isArray(after.blocks)) {
            console.error(`${before.id}: not in the after run, left out`);
            continue;
        }
        entries.push({ ask: before.id, version: 'before', row: toAsked(before) });
        entries.push({ ask: after.id, version: 'after', row: toAsked(after) });
    }
} else {
    for (const row of readRows(input)) {
        if (!Array.isArray(row.blocksBefore) || !Array.isArray(row.blocks)) {
            console.error(`${row.id}: no draft and reviewed pair, left out`);
            continue;
        }
        const asked = toAsked(row);
        entries.push({
            ask: row.id,
            version: 'draft',
            row: { ...asked, blocks: row.blocksBefore },
        });
        entries.push({ ask: row.id, version: 'reviewed', row: asked });
    }
}
// A seeded shuffle, so a set can be made again for a third reader.
let seed = Number(seedArg);
const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
};
for (let index = entries.length - 1; index > 0; index--) {
    const other = Math.floor(rand() * (index + 1));
    [entries[index], entries[other]] = [entries[other], entries[index]];
}
const key = {};
const lines = [];
entries.forEach((entry, index) => {
    const id = `Y-${String(index + 1).padStart(2, '0')}`;
    key[id] = { ask: entry.ask, version: entry.version };
    const {
        reviews,
        blocksBefore,
        firstAnswer,
        answer,
        calls,
        replies,
        actions,
        card,
        ...kept
    } = entry.row;
    lines.push(JSON.stringify({ ...kept, id }));
});
writeFileSync(`${prefix}-set.jsonl`, `${lines.join('\n')}\n`);
writeFileSync(`${prefix}-key.json`, JSON.stringify(key, null, 1));
console.log(
    `${lines.length} lessons -> ${prefix}-set.jsonl, key ${prefix}-key.json`,
);
