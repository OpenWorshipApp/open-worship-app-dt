// What a reader of a language other than English is SHOWN, checked answer by
// answer (2026-10-17, the user's goal: _gemma4:cloud 100% work for Khmer
// language_). Reads a `corpus-run.mjs --lang=<code>` file and, per answer,
// every Latin-script run its words and buttons show that is NOT a real label
// a reader of that language meets in the app:
//
// - a value of the language's own dictionary (`src/lang/data/<code>/index.ts`
//   -- "កំណត់ទំហំ Widgets ឡើងវិញ" carries "Widgets" on the button itself),
// - the language's own manual (`docs/manual-i18n/<code>/`, whose code spans
//   are the English names the View → Widgets list and the native menu bar
//   show in every language),
// - the native menu bar (`electron/electronMenu.ts`, English everywhere),
// - key names and the products and Bibles a person types or picks.
//
// Beside it: no answer, an error, a timeout, a page that reloaded, an
// internal name (a tool, a recipe id, a path) or an error sentence shown.
//
//   node lang-check.mjs <corpus.jsonl> [--lang=km] [--json] [--keys=a,b]
//        [--show=flagged|all|<n>]
//
// Model-free and read-only: whether an answer is RIGHT is graded against the
// guide page apart; this says whether it can be READ by someone who reads
// only their own language.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : ['file', arg];
    }),
);
const LANG = typeof args.lang === 'string' ? args.lang : 'km';
const FILE = path.resolve(String(args.file));

// ---- the labels a reader of the language really meets ----------------------

function collectAllowedText() {
    const parts = [];
    const dictionary = fs.readFileSync(
        path.join(REPO, 'src', 'lang', 'data', LANG, 'index.ts'),
        'utf8',
    );
    // Every string literal right of a colon: the translated values.
    for (const match of dictionary.matchAll(/:\s*\n?\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        parts.push(match[2]);
    }
    const manualDir = path.join(REPO, 'docs', 'manual-i18n', LANG);
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.md')) {
                // A template stands for the label in this language: drop it.
                parts.push(
                    fs
                        .readFileSync(full, 'utf8')
                        .replace(/\[en:tran:[^\]]*\]/g, ' '),
                );
            }
        }
    };
    if (fs.existsSync(manualDir)) {
        walk(manualDir);
    }
    const menu = fs.readFileSync(path.join(REPO, 'electron', 'electronMenu.ts'), 'utf8');
    for (const match of menu.matchAll(/label:\s*['`]([^'`$]+)['`]/g)) {
        parts.push(match[1]);
    }
    return parts.join('\n').toLowerCase();
}

const ALLOWED_TEXT = collectAllowedText();
// Read as names whatever the language: keys, the app, the products and
// Bibles named in settings, units.
const ALWAYS_ALLOWED = new Set(
    (
        'ctrl shift alt cmd command option win windows mac macos linux fn ' +
        'f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12 enter return esc escape space ' +
        'spacebar tab delete del backspace home end pageup pagedown pgup pgdn ' +
        'insert ins up down left right arrow menu ok ' +
        'ai api key url http https www pdf ppt pptx doc docx xml json zip mp3 ' +
        'mp4 webm mkv mov png jpg jpeg gif svg owl ows owpf owadoc owadata ' +
        'kjv nkjv niv esv asv web ssv khov ពគប usb hdmi tv wi-fi wifi lan ip ' +
        'youtube google gmail chatgpt claude gemini kimi ollama lm studio ' +
        'bedrock openai anthropic deepseek qwen gemma openlyrics songselect ' +
        'open worship app owa obs ndi vlc ffmpeg yt-dlp github ' +
        'px pt cm mm ms s min fps hz gb mb kb'
    ).split(/\s+/),
);
// English that is never a label: a run carrying one of these is a sentence.
const SENTENCE_WORDS = new Set(
    (
        'the a an to and or of on in at by for with from into onto then ' +
        'again first next last your you it its is are was be this that these ' +
        'there here when where which what how if not no can will just only ' +
        'click press tap choose select pick open close drag drop type answer ' +
        'go see find use put make let get keep turn show hide bar top bottom ' +
        'side button icon box window page panel list item right-click ' +
        'double-click taskbar rest all every each other more less'
    ).split(/\s+/),
);

const LATIN_RUN =
    /[A-Za-z][A-Za-z0-9'’+\-./]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9'’+\-./]*)*/g;

function checkIsAllowedRun(run) {
    const plain = run.replace(/[.'’]+$/, '').trim();
    const lower = plain.toLowerCase();
    const words = lower.split(/\s+/);
    if (words.every((word) => ALWAYS_ALLOWED.has(word.replace(/[^a-z0-9-]/g, '')))) {
        return true;
    }
    // A key chord, a version code, a file name, a number with a unit.
    if (/^[a-z0-9]+([+\-][a-z0-9]+)+$/i.test(plain) && plain.length <= 24) {
        return true;
    }
    if (/^[A-Z0-9]{2,6}$/.test(plain)) {
        return true;
    }
    if (words.length === 1 && SENTENCE_WORDS.has(words[0])) {
        return false;
    }
    return ALLOWED_TEXT.includes(lower);
}

function listEnglishRuns(text) {
    // Inline code is what the answer quotes as written (an English widget
    // name the View list shows): judged like any other run, not skipped.
    const runs = [];
    const all = String(text ?? '');
    for (const match of all.matchAll(LATIN_RUN)) {
        const run = match[0].trim();
        if (run.length < 2 || checkIsAllowedRun(run)) {
            continue;
        }
        // A `/command` is typed as it is written, in every language.
        if (all[match.index - 1] === '/') {
            continue;
        }
        runs.push(run);
    }
    return runs;
}

const LEAK =
    /\bowa_[a-z_]+|\bW-\d{2}\w?\b|\b[\w/-]+\.(?:tsx?|mjs|json|html)\b|\bsrc\/|data-react|\bisShowing\b|\bneedsPage\b|\bundefined\b|\[object |\{"|"[a-zA-Z]+":|<\/?[a-z]+>|\bmanualId\b|\bdemoId\b|\[en:tran:/;
const ERROR_WORDS =
    /could not answer|I could not|TypeError|ReferenceError|is not a function|Cannot read|មិនអាចឆ្លើយបានទេ/i;
const SCRIPT = { km: /[ក-៿᧠-᧿]/g, fr: /[A-Za-zÀ-ÿ]/g }[LANG] ?? /[^\x00-\x7F]/g;

// ---- the answers ------------------------------------------------------------

const latest = new Map();
for (const line of fs.readFileSync(FILE, 'utf8').split(/\r?\n/)) {
    if (line.trim().length === 0) {
        continue;
    }
    try {
        const row = JSON.parse(line);
        if (row.stale === true) {
            latest.delete(row.key);
            continue;
        }
        if (row.key) {
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

const results = rows.map((row) => {
    const answer = row.answer ?? '';
    const buttons = [...(row.actions ?? []), ...(row.replies ?? []), ...(row.chips ?? [])];
    const flags = [];
    if (row.error) flags.push(`error: ${row.error}`);
    if (row.timedOut) flags.push('timeout');
    if (row.reloaded) flags.push('reloaded');
    if (row.noModel) flags.push('no model');
    if (!row.error && answer.trim().length === 0) flags.push('empty');
    const answerRuns = listEnglishRuns(`${answer}\n${row.note ?? ''}`);
    const buttonRuns = buttons.flatMap((label) => listEnglishRuns(label));
    if (answerRuns.length > 0) flags.push(`english: ${answerRuns.join(' | ')}`);
    if (buttonRuns.length > 0) flags.push(`english button: ${buttonRuns.join(' | ')}`);
    const leak = LEAK.exec(`${answer}\n${row.note ?? ''}`)?.[0];
    if (leak) flags.push(`leak: ${leak}`);
    const error = ERROR_WORDS.exec(`${answer}\n${row.note ?? ''}`)?.[0];
    if (error) flags.push(`error words: ${error}`);
    const native = (answer.match(SCRIPT) ?? []).length;
    if (answer.trim().length > 0 && native === 0) flags.push('no word of the language');
    return {
        key: row.key,
        q: row.q,
        en: row.en,
        seconds: row.seconds,
        rounds: row.usage?.rounds ?? null,
        tools: (row.tools ?? []).map((tool) => tool.name.replace('owa_', '')),
        flags,
        answer,
        buttons,
    };
});

const flagged = results.filter((one) => one.flags.length > 0);
const byKind = {};
for (const one of flagged) {
    for (const flag of one.flags) {
        const kind = flag.split(':')[0];
        byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
}
const seconds = results.map((one) => one.seconds ?? 0).sort((a, b) => a - b);
const summary = {
    file: path.relative(REPO, FILE),
    lang: LANG,
    answers: results.length,
    clean: results.length - flagged.length,
    flagged: flagged.length,
    byKind,
    medianSeconds: seconds[Math.floor(seconds.length / 2)] ?? null,
    maxSeconds: seconds[seconds.length - 1] ?? null,
};
if (args.json) {
    console.log(JSON.stringify({ summary, results }, null, 1));
} else {
    const show = args.show ?? 'flagged';
    const shown = show === 'all' ? results : flagged;
    const limit = /^\d+$/.test(String(show)) ? Number(show) : shown.length;
    for (const one of (show === 'all' ? results : flagged).slice(0, limit)) {
        console.log(`== ${one.key}  (${one.seconds}s r${one.rounds} ${one.tools.join('>')})`);
        console.log(`   Q: ${one.q}`);
        for (const flag of one.flags) console.log(`   ! ${flag}`);
    }
    console.log(JSON.stringify(summary, null, 1));
}
