// Scores a verse-finding run: a row passes when one of the **Open … in Bible
// Lookup** buttons under its answer names a reference the row expects. The
// standing set is `../references/verse-find-asks.json` (2026-10-16, the goal
// _chatbot be smart enough to help user find verses he/she forgot_): exact
// words, misremembered words, modern paraphrases and descriptions in the KJV;
// Khmer typed with no spaces, Khmer descriptions and English words under the
// Khmer Bible; and questions typed in an ordinary chat.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/corpus-run.mjs \
//        --server=Auto --asks=.claude/skills/owa-enhance-chatbot/references/verse-find-asks.json \
//        --out=test-results/chatbot-quality/verse-find.jsonl
//   node .claude/skills/owa-enhance-chatbot/scripts/score-verse-find.mjs \
//        .claude/skills/owa-enhance-chatbot/references/verse-find-asks.json \
//        test-results/chatbot-quality/verse-find.jsonl
//
// The rows name Bibles by their short names on the dev profile it was made on
// (KJV, ពគប); a row whose Bible is not installed fails for that reason, and
// its answer says so. First run: 20 of 20 (2026-10-16).
import fs from 'node:fs';

const [asksPath, outPath] = process.argv.slice(2);
const asks = JSON.parse(fs.readFileSync(asksPath, 'utf8'));
const records = new Map();
for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
    if (line.trim() === '') {
        continue;
    }
    try {
        const record = JSON.parse(line);
        if (typeof record.key === 'string') {
            records.set(record.key, record);
        }
    } catch {
        // A line the driver was still writing.
    }
}
let passed = 0;
let asked = 0;
for (const ask of asks) {
    const record = records.get(`asks/${ask.focus}/${ask.id}`);
    if (record === undefined) {
        console.log(`--   ${ask.id}  (not asked yet)`);
        continue;
    }
    asked += 1;
    const opened = (record.actions ?? [])
        .map((one) => {
            return typeof one === 'string' ? one : String(one?.label ?? '');
        })
        .filter((label) => {
            return /^Open .+ in Bible Lookup$/i.test(label);
        })
        .map((label) => {
            return label.replace(/^Open (.+) in Bible Lookup$/i, '$1');
        });
    const isPass = ask.expect.some((ref) => {
        return opened.some((one) => {
            return one.toLowerCase() === ref.toLowerCase();
        });
    });
    if (isPass) {
        passed += 1;
    }
    console.log(
        `${isPass ? 'PASS' : 'FAIL'} ${ask.id}  ${record.model ?? '?'}  ` +
            `${record.seconds ?? '?'}s  ${record.cost ?? ''}  ` +
            `opened=[${opened.join('; ')}]` +
            (isPass ? '' : `  expected=${ask.expect.join('|')}`),
    );
}
console.log(`\n${passed}/${asked} found (of ${asks.length} asks)`);
