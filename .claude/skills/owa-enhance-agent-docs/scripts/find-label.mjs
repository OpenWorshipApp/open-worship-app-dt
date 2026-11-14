// Is this what a control is CALLED? For each label: whether it is a
// dictionary key (each language package's), and where the code writes those
// exact words.
//
//   node .../find-label.mjs "Start Slide Show" "Clear Long Text"
//
// What a recipe may name as `[en:tran:Key]` is a key the code draws through
// `tran()`. A word that is in the dictionary and in no code is a label that
// died; one that is in code and not in the dictionary is drawn in English only
// (the help window, on purpose) and stays plain in the manual. A label put
// together at run time -- `tran(prop)`, a template literal -- is not written
// anywhere whole: search for its parts.
//
// Read-only: one `git grep`, nothing written, no app, no network.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-agent-docs -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const SHOWN_HIT_COUNT = 6;

function readKeySet(language) {
    const dictionary = JSON.parse(
        readFileSync(
            path.join(REPO_ROOT, 'src/lang/data/online', language, 'dictionary.json'),
            'utf-8',
        ),
    );
    return new Set(Object.keys(dictionary));
}

function findInCode(label) {
    const patternList = [
        `'${label}'`,
        `"${label}"`,
        `\`${label}\``,
        `>${label}<`,
    ];
    try {
        return execFileSync(
            'git',
            [
                'grep',
                '-nF',
                '--untracked',
                ...patternList.flatMap((pattern) => ['-e', pattern]),
                '--',
                'src',
                'electron',
                'tools',
                ':!src/lang/data',
                ':!*.test.*',
                ':!tools/owa-devtools-mcp/questions',
            ],
            { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
        )
            .split('\n')
            .filter(Boolean);
    } catch {
        // `git grep` exits 1 when nothing matches.
        return [];
    }
}

const labelList = process.argv.slice(2);
if (labelList.length === 0) {
    console.error('Usage: find-label.mjs "<label>" ["<label>" …]');
    process.exit(1);
}
// Every language package but English's, found by its folder.
const keySetMap = new Map(
    readdirSync(path.join(REPO_ROOT, 'src/lang/data/online'))
        .filter((language) => {
            return (
                language !== 'en' &&
                existsSync(path.join(REPO_ROOT, 'src/lang/data/online', language, 'dictionary.json'))
            );
        })
        .map((language) => {
            return [language, readKeySet(language)];
        }),
);
for (const label of labelList) {
    const hitList = findInCode(label);
    const keyText = [...keySetMap]
        .map(([language, keySet]) => {
            return `${language} key ${keySet.has(label) ? 'YES' : 'no'}`;
        })
        .join(', ');
    console.log(
        `"${label}": ${keyText}, ` +
            `written in code ${hitList.length} time(s)`,
    );
    for (const hit of hitList.slice(0, SHOWN_HIT_COUNT)) {
        console.log(`    ${hit.slice(0, 200)}`);
    }
    if (hitList.length > SHOWN_HIT_COUNT) {
        console.log(`    … ${hitList.length - SHOWN_HIT_COUNT} more`);
    }
}
