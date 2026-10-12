// The second read: what a first reader changed, and what it set aside, handed
// to a reader that was told nothing about why.
//
//   node .../second-read.mjs inputs --out=<dir> [--size=60] <edits.json> [...]
//   node .../second-read.mjs check <dir>/V1.json
//   node .../second-read.mjs templates <edits.json> [...]
//
// A big read is done by several readers that only PROPOSE
// (`apply-manual-edits.mjs`), and each proposal is checked by its own evidence
// quote: the line it cites is in the code. That proves the quote, not the
// claim. So once the edits are applied, `inputs` turns the same files into
// work for readers that see NO reason and NO evidence:
//
//   V<n>.input.json   corrections  { n, doc, entry, was, now }
//   L<n>.input.json   statements   { n, doc, entry, step, claim, firstReader }
//                     -- the ones a first reader left for the running app
//
// and each second reader answers in `<same name>.json` (the shapes are in
// `references/second-read.md`). `check` refuses an answer that skips an item,
// proves something with a line the file does not hold, or offers a fix whose
// `old` is not in the document exactly once. Template-only edits (a control's
// name made `[en:tran:…]`) are left out of `inputs`: `tran.test.mjs` holds
// that each key is a real one, and `templates` holds the other half -- that
// the edit changed NOTHING but the wrapper. It prints every template edit
// whose words moved too (`Slide Padding` becoming `Slide Padding (%)`), and
// those few are read by hand.
//
// Read-only on the repo. Exit code: 0 when nothing is wrong, 1 otherwise.

import {
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-agent-docs -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const MANUAL_PATH =
    '.claude/skills/owa-robot-test/references/user-workflows.md';

const [mode, ...argList] = process.argv.slice(2);
const readFlag = (name) => {
    return argList
        .find((arg) => arg.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
};
const fileList = argList.filter((arg) => !arg.startsWith('--'));

function writeChunks(outDir, prefix, list, size) {
    let count = 0;
    for (let at = 0; at < list.length; at += size) {
        count += 1;
        const group = `${prefix}${count}`;
        const items = list.slice(at, at + size).map((item, index) => {
            return { n: index + 1, ...item };
        });
        writeFileSync(
            path.join(outDir, `${group}.input.json`),
            JSON.stringify({ group, items }, null, 1),
        );
        console.log(`${group}: ${items.length}`);
    }
}

function genInputs() {
    const outDir = readFlag('out');
    const size = Number(readFlag('size')) || 60;
    if (outDir === undefined || fileList.length === 0) {
        console.error(
            'Usage: second-read.mjs inputs --out=<dir> [--size=60] <edits.json> [...]',
        );
        process.exit(1);
    }
    mkdirSync(outDir, { recursive: true });
    const corrections = [];
    const statements = [];
    for (const filePath of fileList) {
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        for (const entry of data.recipes ?? []) {
            const doc = entry.file ?? data.file ?? MANUAL_PATH;
            for (const edit of entry.edits ?? []) {
                if (edit.kind === 'template') {
                    continue;
                }
                corrections.push({
                    doc,
                    entry: entry.id,
                    was: edit.old,
                    now: edit.new,
                });
            }
            for (const one of entry.needsLive ?? []) {
                statements.push({
                    doc,
                    entry: entry.id,
                    step: one.step ?? '',
                    claim: one.claim,
                    firstReader: one.why,
                });
            }
        }
    }
    // One document's corrections stay together: a reader that has opened the
    // file once checks the rest of it cheaply.
    corrections.sort((one, other) => one.doc.localeCompare(other.doc));
    writeChunks(outDir, 'V', corrections, size);
    writeChunks(outDir, 'L', statements, Math.ceil(size / 2));
    console.log(
        `${corrections.length} correction(s), ${statements.length} statement(s) ` +
            `for the running app`,
    );
}

const squeeze = (value) => {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
};

function checkResult() {
    const resultPath = fileList[0];
    if (resultPath === undefined) {
        console.error('Usage: second-read.mjs check <dir>/<group>.json');
        process.exit(1);
    }
    let data;
    try {
        data = JSON.parse(readFileSync(resultPath, 'utf-8'));
    } catch (error) {
        console.log(`NOT VALID JSON: ${error.message}`);
        process.exit(1);
    }
    const input = JSON.parse(
        readFileSync(resultPath.replace(/\.json$/, '.input.json'), 'utf-8'),
    );
    const cache = new Map();
    const readSqueezed = (file) => {
        if (!cache.has(file)) {
            const full = path.join(REPO_ROOT, file);
            cache.set(
                file,
                existsSync(full) && statSync(full).isFile()
                    ? squeeze(readFileSync(full, 'utf-8'))
                    : null,
            );
        }
        return cache.get(file);
    };
    // A correction is confirmed, wrong or unsure; a statement set aside for
    // the running app is true, false or (still) live.
    const count = {
        confirmed: 0,
        wrong: 0,
        unsure: 0,
        true: 0,
        false: 0,
        live: 0,
    };
    const problemList = [];
    const byNumber = new Map(
        (data.results ?? []).map((one) => [one.n, one]),
    );
    for (const item of input.items) {
        const result = byNumber.get(item.n);
        if (result === undefined) {
            problemList.push(`n ${item.n}: no result`);
            continue;
        }
        const { verdict } = result;
        if (!(verdict in count)) {
            problemList.push(`n ${item.n}: unknown verdict "${verdict}"`);
            continue;
        }
        count[verdict] += 1;
        const evidenceList = result.evidence ?? [];
        const isOpen = verdict === 'unsure' || verdict === 'live';
        if (!isOpen && evidenceList.length === 0) {
            problemList.push(`n ${item.n}: ${verdict} with no evidence`);
        }
        if ((verdict === 'wrong' || verdict === 'false') && !result.fix) {
            problemList.push(`n ${item.n}: ${verdict} with no fix`);
        }
        if (verdict === 'false' && !result.old) {
            problemList.push(
                `n ${item.n}: false needs "old", the passage as it stands`,
            );
        }
        if (result.old) {
            const body = readFileSync(path.join(REPO_ROOT, item.doc), 'utf-8');
            const times = body.split(result.old).length - 1;
            if (times !== 1) {
                problemList.push(
                    `n ${item.n}: "old" occurs ${times} time(s) in ${item.doc}; ` +
                        'it must occur exactly once, copied exactly',
                );
            }
        }
        if (verdict === 'unsure' && !result.note) {
            problemList.push(`n ${item.n}: unsure with no note saying why`);
        }
        if (verdict === 'live' && !(result.watch && result.needs)) {
            problemList.push(
                `n ${item.n}: live needs "watch" (what to look at) and "needs"`,
            );
        }
        for (const proof of evidenceList) {
            if (proof.url) {
                continue;
            }
            const body = readSqueezed(proof.file ?? '');
            if (body === null) {
                problemList.push(`n ${item.n}: no such file: ${proof.file}`);
            } else if (!body.includes(squeeze(proof.quote))) {
                problemList.push(
                    `n ${item.n}: the quote is not in ${proof.file}: ` +
                        JSON.stringify(String(proof.quote).slice(0, 80)),
                );
            }
        }
    }
    const said = Object.entries(count)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => `${value} ${name}`)
        .join(', ');
    console.log(
        `${input.items.length} item(s): ${said || 'none answered'}; ` +
            `${problemList.length} problem(s)`,
    );
    for (const problem of problemList) {
        console.log(`  - ${problem}`);
    }
    process.exit(problemList.length > 0 ? 1 : 0);
}

function checkTemplates() {
    if (fileList.length === 0) {
        console.error('Usage: second-read.mjs templates <edits.json> [...]');
        process.exit(1);
    }
    const unwrap = (value) => {
        return String(value ?? '').replace(/\[en:tran:([^\]]+)\]/g, '$1');
    };
    let total = 0;
    const movedList = [];
    for (const filePath of fileList) {
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        for (const entry of data.recipes ?? []) {
            for (const edit of entry.edits ?? []) {
                if (edit.kind !== 'template') {
                    continue;
                }
                total += 1;
                if (squeeze(unwrap(edit.new)) !== squeeze(unwrap(edit.old))) {
                    movedList.push({ id: entry.id, ...edit });
                }
            }
        }
    }
    console.log(
        `${total} template edit(s); ${movedList.length} change more than ` +
            'the wrapper (read each)',
    );
    for (const one of movedList) {
        console.log(`  - ${one.id}`);
        console.log(`      was: ${squeeze(one.old).slice(0, 200)}`);
        console.log(`      now: ${squeeze(one.new).slice(0, 200)}`);
    }
}

if (mode === 'inputs') {
    genInputs();
} else if (mode === 'check') {
    checkResult();
} else if (mode === 'templates') {
    checkTemplates();
} else {
    console.error('Usage: second-read.mjs inputs|check|templates …');
    process.exit(1);
}
