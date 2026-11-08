#!/usr/bin/env node
// The byte-for-byte bar on REAL notes (owa-enhance-bible-note-chatbot, rule 2).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/note-roundtrip.mjs <bible-notes folder>
//
// e.g. the dev data folder's `bible-notes` (Settings → Path Settings names
// the data folder). For every note of every `.own` file there:
//   1. each editable block given its OWN words back must leave the note
//      byte for byte as it was (a run kept, a mention kept, its spaces kept);
//   2. a colour on each block (on one of its words when it has words) must
//      change that block's top-level node and no other.
// Reads only. The rules are TypeScript (`src/helper/agentNote*Helpers.ts`):
// they are copied with their imports pointed at each other into the OS temp
// folder and run there with Node's own type stripping -- nothing is built.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_DIR = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
);
const notesDir = process.argv[2];
if (!notesDir) {
    console.error(
        'Give the bible-notes folder to read, e.g. <data folder>/bible-notes.',
    );
    process.exit(2);
}
const MODULE_LIST = [
    'agentNoteBlockHelpers',
    'agentNoteStyleHelpers',
    'agentNoteInsertHelpers',
    'agentNoteDrawingHelpers',
    'agentNoteBlockLinkHelpers',
    'agentNoteNormalizeHelpers',
    'agentNoteMarkupHelpers',
];
const workDir = mkdtempSync(join(tmpdir(), 'note-roundtrip-'));
try {
    for (const name of MODULE_LIST) {
        let source = readFileSync(
            join(REPO_DIR, 'src', 'helper', `${name}.ts`),
            'utf8',
        );
        for (const other of MODULE_LIST) {
            source = source
                .split(`from './${other}'`)
                .join(`from './${other}.mts'`);
        }
        writeFileSync(join(workDir, `${name}.mts`), source);
    }
    writeFileSync(
        join(workDir, 'run.mts'),
        `import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers.mts';
const dir = process.argv[2];
let textChecked = 0, styleChecked = 0, failures = 0;
for (const file of readdirSync(dir).filter((one) => one.endsWith('.own'))) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const item of data.items ?? []) {
        if (item.verseKey || typeof item.content !== 'string') continue;
        let from = 1;
        while (true) {
            const read = readNoteBlocks(item.content, from);
            if (read === null) break;
            const before = JSON.parse(item.content).root.children.map((one: any) => JSON.stringify(one));
            for (const block of read.blocks) {
                if (!block.isFixed && !block.isTextCut) {
                    textChecked++;
                    const result = applyNoteEdit({ content: item.content, changes: [{ block: block.n, text: block.text }] });
                    if ('reason' in result || result.content !== item.content) {
                        failures++;
                        console.log('TEXT', file, item.metadata?.id, block.n, block.kind, 'reason' in result ? result.reason : 'changed');
                    }
                }
                const word = (block.text.match(/[\\p{L}]{4,}/u) ?? [])[0];
                const styled = applyNoteEdit({ content: item.content, changes: [{ block: block.n, color: 'red', ...(word && !block.isFixed ? { words: word } : {}) }] });
                if ('reason' in styled) {
                    if (!/does not have the words|cannot be/.test(styled.reason)) {
                        failures++;
                        console.log('STYLE REFUSED', file, item.metadata?.id, block.n, block.kind, styled.reason);
                    }
                    continue;
                }
                styleChecked++;
                const after = JSON.parse(styled.content).root.children.map((one: any) => JSON.stringify(one));
                const touched = before.filter((one: string, index: number) => one !== after[index]).length;
                if (after.length !== before.length || touched > 1) {
                    failures++;
                    console.log('STYLE TOUCHED', file, item.metadata?.id, block.n, block.kind, touched);
                }
            }
            if (read.nextFrom === undefined) break;
            from = read.nextFrom;
        }
    }
}
console.log(JSON.stringify({ textChecked, styleChecked, failures }));
process.exit(failures === 0 ? 0 : 1);
`,
    );
    execFileSync(
        process.execPath,
        [join(workDir, 'run.mts'), resolve(notesDir)],
        {
            stdio: 'inherit',
        },
    );
} catch (error) {
    process.exitCode = error.status ?? 1;
} finally {
    rmSync(workDir, { recursive: true, force: true });
}
