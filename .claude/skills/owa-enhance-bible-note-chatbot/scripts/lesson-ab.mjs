// A blind pair set from a `run-lesson-asks.mjs --review=N` run (BN-74): each
// row's DRAFT (`blocksBefore`) and its REVIEWED lesson (`blocks`), shuffled
// under neutral ids, the key written apart -- the readers are told what was
// asked and never the review rounds or the fixes pressed in them.
//
//   node lesson-ab.mjs <results.jsonl> <out prefix> [seed]
//
// writes `<prefix>-set.jsonl` (rows `lesson-rubric.mjs --text=<dir>` turns
// into one `<id>.md` a lesson) and `<prefix>-key.json` ({id: {ask, version}}).
// Unblind only after both readers have written their verdicts.
import { readFileSync, writeFileSync } from 'node:fs';

const [input, prefix, seedArg = '11'] = process.argv.slice(2);
if (input === undefined || prefix === undefined) {
    console.error('node lesson-ab.mjs <results.jsonl> <out prefix> [seed]');
    process.exit(1);
}
const rows = readFileSync(input, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const entries = [];
for (const row of rows) {
    if (!Array.isArray(row.blocksBefore) || !Array.isArray(row.blocks)) {
        console.error(`${row.id}: no draft and reviewed pair, left out`);
        continue;
    }
    // The review's presses ride on `pressed`: what was ASKED is the rest.
    const reviewPressed = (row.reviews ?? [])
        .flatMap((review) => [review.pressed, ...(review.alsoPressed ?? [])])
        .filter((pressed) => typeof pressed === 'string');
    const asked = {
        ...row,
        pressed: (row.pressed ?? []).filter(
            (words) => !reviewPressed.includes(words),
        ),
    };
    entries.push({
        ask: row.id,
        version: 'draft',
        row: { ...asked, blocks: row.blocksBefore },
    });
    entries.push({ ask: row.id, version: 'reviewed', row: asked });
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
