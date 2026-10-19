// Cuts a corpus-run answer file into bundles a grader reads (2026-10-17, for
// the Khmer pass): per answer, the question as asked and in English, the
// window, the guide page the corpus files it under with the manual files
// that hold that page in English and in the language, the passage / control
// / menu / key / tools the row names, the answer, its buttons, the tools the
// window called and what `lang-check.mjs` flagged.
//
//   node grade-bundle.mjs <corpus.jsonl> --parts=4 [--lang=km] [--keys=a,b]
//        [--out-dir=<dir>] [--carry=<earlier corpus.jsonl>]
//        [--carry-grades=<grade.json,grade.json>]
//
// Writes `<out-dir>/bundle-<n>.json` and prints the paths. Read-only besides.
// `--carry` keeps an earlier grade for an answer that came back word for word
// (a local server is asked at temperature 0, so most do): such answers are
// written to `<out-dir>/carried.json` with their grade and left out of the
// bundles, and only what changed goes to a grader.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : ['file', arg];
    }),
);
const LANG = typeof args.lang === 'string' ? args.lang : 'km';
const FILE = path.resolve(String(args.file));
const PARTS = Number(args.parts ?? 4);
const OUT_DIR = path.resolve(
    String(args['out-dir'] ?? path.join(path.dirname(FILE), 'grade')),
);
fs.mkdirSync(OUT_DIR, { recursive: true });

function indexManual(dir) {
    const map = {};
    const walk = (folder) => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.md')) {
                const id = /^id:\s*(\S+)/m.exec(fs.readFileSync(full, 'utf8'))?.[1];
                if (id) {
                    map[id] = path.relative(REPO, full).replaceAll('\\', '/');
                }
            }
        }
    };
    walk(dir);
    return map;
}
const EN_PAGES = indexManual(path.join(REPO, 'docs', 'manual-sources'));
const LOCAL_PAGES = indexManual(path.join(REPO, 'docs', 'manual-i18n', LANG));

const checked = JSON.parse(
    execFileSync(
        process.execPath,
        [path.join(HERE, 'lang-check.mjs'), FILE, `--lang=${LANG}`, '--json'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
);
const flagsByKey = new Map(checked.results.map((one) => [one.key, one.flags]));

const latest = new Map();
for (const line of fs.readFileSync(FILE, 'utf8').split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
        const row = JSON.parse(line);
        if (row.stale === true) {
            latest.delete(row.key);
        } else if (row.key) {
            latest.set(row.key, row);
        }
    } catch {
        // cut short
    }
}
let rows = [...latest.values()];
if (typeof args.keys === 'string') {
    const keys = args.keys.split(',');
    rows = rows.filter((row) => keys.includes(row.key));
}
const items = rows.map((row) => {
    const recipe = row.resources?.recipe ?? null;
    return {
        key: row.key,
        kind: row.kind,
        window: row.focus,
        mainPage: row.mainPage,
        asked: row.q,
        english: row.en,
        recipe,
        enPage: recipe ? (EN_PAGES[recipe] ?? null) : null,
        localPage: recipe ? (LOCAL_PAGES[recipe] ?? null) : null,
        resources: row.resources,
        answer: row.answer,
        note: row.note,
        buttons: {
            actions: row.actions,
            replies: row.replies,
            chips: row.chips,
        },
        toolsCalled: (row.tools ?? []).map((tool) => ({
            name: tool.name,
            args: tool.args,
            result: tool.name === 'owa_help_page' ? undefined : tool.result,
        })),
        screensChanged: row.screensAfter ? { before: row.screensBefore, after: row.screensAfter } : undefined,
        pageMovedTo: row.pageMovedTo,
        flags: flagsByKey.get(row.key) ?? [],
    };
});
function readLatestRows(file) {
    const map = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (line.trim().length === 0) continue;
        try {
            const row = JSON.parse(line);
            if (row.stale === true) map.delete(row.key);
            else if (row.key) map.set(row.key, row);
        } catch {
            // cut short
        }
    }
    return map;
}
let toGrade = items;
if (typeof args.carry === 'string' && typeof args['carry-grades'] === 'string') {
    const earlier = readLatestRows(path.resolve(args.carry));
    const grades = new Map();
    for (const file of args['carry-grades'].split(',')) {
        for (const grade of JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))) {
            grades.set(grade.key, grade);
        }
    }
    const toShown = (row) => JSON.stringify([row?.answer ?? '', row?.replies ?? [], row?.actions ?? []]);
    const carried = [];
    toGrade = items.filter((item) => {
        const before = earlier.get(item.key);
        const grade = grades.get(item.key);
        const now = latest.get(item.key);
        if (before === undefined || grade === undefined || toShown(before) !== toShown(now)) {
            return true;
        }
        carried.push({ ...grade, carried: true });
        return false;
    });
    fs.writeFileSync(path.join(OUT_DIR, 'carried.json'), JSON.stringify(carried, null, 1));
    console.log(`carried ${carried.length} unchanged answers; ${toGrade.length} to grade`);
}
const size = Math.ceil(toGrade.length / PARTS);
for (let part = 0; part < PARTS; part++) {
    const slice = toGrade.slice(part * size, (part + 1) * size);
    if (slice.length === 0) continue;
    const out = path.join(OUT_DIR, `bundle-${part + 1}.json`);
    fs.writeFileSync(out, JSON.stringify(slice, null, 1));
    console.log(out, slice.length);
}
