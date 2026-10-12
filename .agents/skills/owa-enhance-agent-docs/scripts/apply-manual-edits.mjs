// Proposed edits to documents, checked before one of them is written -- the
// single writer after several readers.
//
//   node .../apply-manual-edits.mjs <edits.json>            check only
//   node .../apply-manual-edits.mjs <edits.json> --apply    check, then write
//   node .../apply-manual-edits.mjs <edits.json> --apply --only=template
//
// A big backlog -- fifty recipes, a hundred notes -- is read by several agents
// at once, and several agents writing one 5 800-line file lose each other's
// edits. So a reader only PROPOSES, as JSON, and this is what stands between
// a proposal and the file:
//
//   {
//     "file": "docs/test-paths/coverage-matrix.md",   // optional; default the manual
//     "recipes": [
//       { "id": "W-14",                    // a recipe, a matrix row, or a note
//         "file": ".claude/memory/x.md",   // optional: this entry's own document
//         "verdict": "ok" | "edited" | "needs-live" | "regression",
//         "edits": [
//           { "old": "exact text, occurring once in the document",
//             "new": "its replacement",
//             "kind": "wrong-claim" | "template",
//             "why": "one sentence",
//             "evidence": [{ "file": "src/…", "quote": "an exact fragment of it" }] }
//         ],
//         "needsLive": [{ "step": "3", "claim": "…", "why": "…" }],
//         "notes": "" }
//     ]
//   }
//
// It refuses the whole file unless every `old` is in its document exactly
// once, no two edits overlap, and every evidence quote really is in the file
// it names -- a reader that proves a fix with a line the code does not hold
// has not proven it. Line endings are each document's own before and after.
//
// Exit code: 0 when nothing is wrong, 1 otherwise (and nothing is written).

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-agent-docs -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const MANUAL_PATH =
    '.claude/skills/owa-robot-test/references/user-workflows.md';

const argList = process.argv.slice(2);
const jsonPath = argList.find((arg) => !arg.startsWith('--'));
const isApplying = argList.includes('--apply');
const onlyKind = argList
    .find((arg) => arg.startsWith('--only='))
    ?.slice('--only='.length);
if (jsonPath === undefined) {
    console.error('Usage: apply-manual-edits.mjs <edits.json> [--apply]');
    process.exit(1);
}

let data;
try {
    data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
} catch (error) {
    console.log(`Not valid JSON: ${error.message}`);
    process.exit(1);
}

const toLf = (value) => String(value ?? '').replace(/\r\n/g, '\n');
// A quote is matched with its runs of spaces squeezed: a reader copies a line
// out of a file, not its indentation.
const squeeze = (value) => value.replace(/\s+/g, ' ').trim();

const squeezedCache = new Map();
function readSqueezed(relPath) {
    if (!squeezedCache.has(relPath)) {
        const fullPath = path.join(REPO_ROOT, relPath);
        const isFile = existsSync(fullPath) && statSync(fullPath).isFile();
        squeezedCache.set(
            relPath,
            isFile ? squeeze(toLf(readFileSync(fullPath, 'utf-8'))) : null,
        );
    }
    return squeezedCache.get(relPath);
}

// Each document an entry edits: its text as read, and the spans taken in it.
const documentMap = new Map();
function readDocument(relPath) {
    if (!documentMap.has(relPath)) {
        const fullPath = path.join(REPO_ROOT, relPath);
        const rawText =
            existsSync(fullPath) && statSync(fullPath).isFile()
                ? readFileSync(fullPath, 'utf-8')
                : null;
        documentMap.set(relPath, {
            rawText,
            text: rawText === null ? null : toLf(rawText),
            spanList: [],
            acceptedList: [],
        });
    }
    return documentMap.get(relPath);
}

const problemList = [];
let editCount = 0;
for (const entry of data.recipes ?? []) {
    if (!entry.id || !entry.verdict) {
        problemList.push('an entry has no id or no verdict');
    }
    const targetPath = entry.file ?? data.file ?? MANUAL_PATH;
    const target = readDocument(targetPath);
    if (target.text === null) {
        problemList.push(`${entry.id}: no such document: ${targetPath}`);
        continue;
    }
    for (const [index, edit] of (entry.edits ?? []).entries()) {
        editCount++;
        const name = `${entry.id} edit ${index + 1}`;
        const oldText = toLf(edit.old);
        const newText = toLf(edit.new);
        const shown = JSON.stringify(oldText.slice(0, 90));
        if (oldText === '' || oldText === newText) {
            problemList.push(`${name}: old is empty, or the same as new`);
            continue;
        }
        const start = target.text.indexOf(oldText);
        if (start === -1) {
            problemList.push(
                `${name}: old text is not in ${targetPath}: ${shown}`,
            );
            continue;
        }
        if (target.text.indexOf(oldText, start + 1) !== -1) {
            problemList.push(
                `${name}: old text occurs more than once, add context: ${shown}`,
            );
            continue;
        }
        const span = [start, start + oldText.length];
        const clash = target.spanList.find((one) => {
            return one.span[0] < span[1] && span[0] < one.span[1];
        });
        if (clash) {
            problemList.push(`${name}: overlaps ${clash.name}`);
            continue;
        }
        target.spanList.push({ name, span });
        if (!Array.isArray(edit.evidence) || edit.evidence.length === 0) {
            problemList.push(`${name}: no evidence`);
        }
        for (const proof of edit.evidence ?? []) {
            const body = readSqueezed(proof.file ?? '');
            if (body === null) {
                problemList.push(`${name}: no such file: ${proof.file}`);
            } else if (!body.includes(squeeze(toLf(proof.quote)))) {
                problemList.push(
                    `${name}: the quote is not in ${proof.file}: ` +
                        JSON.stringify(String(proof.quote).slice(0, 90)),
                );
            }
        }
        if (onlyKind === undefined || edit.kind === onlyKind) {
            target.acceptedList.push({ span, newText });
        }
    }
}

console.log(
    `${(data.recipes ?? []).length} entries, ${editCount} edit(s) in ` +
        `${documentMap.size} document(s), ${problemList.length} problem(s)`,
);
for (const problem of problemList) {
    console.log(`  - ${problem}`);
}
if (problemList.length > 0) {
    if (isApplying) {
        console.log('Nothing written: fix the problems first.');
    }
    process.exit(1);
}
if (isApplying) {
    for (const [relPath, target] of documentMap) {
        if (target.acceptedList.length === 0) {
            continue;
        }
        // Last edit first, so an earlier span still starts where it was
        // measured.
        target.acceptedList.sort((one, other) => other.span[0] - one.span[0]);
        let text = target.text;
        for (const { span, newText } of target.acceptedList) {
            text = text.slice(0, span[0]) + newText + text.slice(span[1]);
        }
        writeFileSync(
            path.join(REPO_ROOT, relPath),
            target.rawText.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text,
        );
        console.log(`Wrote ${target.acceptedList.length} edit(s) to ${relPath}.`);
    }
}
