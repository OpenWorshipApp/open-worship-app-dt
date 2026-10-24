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
//        test-results/chatbot-quality/verse-find.jsonl [--text] [--data=<dir>]
//
// The rows name Bibles by their short names on the dev profile it was made on
// (KJV, ពគប); a row whose Bible is not installed fails for that reason, and
// its answer says so. First run: 20 of 20 (2026-10-16).
//
// `../references/bible-find-asks.json` (2026-10-22, the user's ask: _make the
// chatbot super smart that can find everything in the bible_) adds stories,
// a book named inside the words, topics and "where is the story of …": its
// rows carry `expectIn` (where it is told) and `isStory`, and a story is
// scored twice -- FOUND (any verse opened inside it) and PASSAGE (a whole
// chapter or three verses and more opened inside it, the answer a person
// asking for a story wants).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [asksPath, outPath] = process.argv.slice(2);

// `expectIn`: a STORY is found when any verse or passage opened lies inside
// where it is told -- "Genesis 6-9" (a run of chapters), "Luke 15:11-32"
// (verses of one chapter), "Psalm 1-150" (a whole book). An opened label is
// read by where it starts.
function toBookName(name) {
    return name.toLowerCase().replace(/^psalms$/, 'psalm').trim();
}
function readRefStart(ref) {
    const match = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref.trim());
    return match === null
        ? null
        : {
              book: toBookName(match[1]),
              chapter: Number(match[2]),
              verse: match[3] === undefined ? null : Number(match[3]),
          };
}
function checkIsInRange(ref, range) {
    const at = readRefStart(ref);
    const match = /^(.+?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/.exec(
        range.trim(),
    );
    if (at === null || match === null || at.book !== toBookName(match[1])) {
        return false;
    }
    const fromChapter = Number(match[2]);
    if (match[3] === undefined) {
        const toChapter =
            match[4] === undefined ? fromChapter : Number(match[4]);
        return at.chapter >= fromChapter && at.chapter <= toChapter;
    }
    // "Luke 15:11-32": verses of one chapter; "John 6:1-7:2" is not used.
    const fromVerse = Number(match[3]);
    const toVerse = match[4] === undefined ? fromVerse : Number(match[4]);
    return (
        at.chapter === fromChapter &&
        (at.verse === null || (at.verse >= fromVerse && at.verse <= toVerse))
    );
}

// A button is drawn in the window's language (2026-10-22): `បើក លោកុប្បត្តិ
// ៨:១១ ក្នុងការស្វែងរកព្រះគម្ពីរ` for a Khmer reader. The installed Bibles'
// own book names (`<data folder>/bibles-data/<key>.xml.cache/_info`) read it
// back into `Genesis 8:11`. --data=<data folder>; the dev one by default.
const DATA_DIR = (() => {
    const asked = process.argv.find((arg) => arg.startsWith('--data='));
    return asked === undefined
        ? path.join(os.homedir(), 'Desktop', 'open-worship-data-dev')
        : asked.slice('--data='.length);
})();
const bookKeyByName = new Map();
let englishByKey = {};
try {
    const dir = path.join(DATA_DIR, 'bibles-data');
    for (const name of fs.readdirSync(dir)) {
        const infoPath = path.join(dir, name, '_info');
        if (!name.endsWith('.cache') || !fs.existsSync(infoPath)) {
            continue;
        }
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8')).value;
        for (const [key, bookName] of Object.entries(info?.keyBookMap ?? {})) {
            bookKeyByName.set(String(bookName).trim(), key);
        }
        if (info?.key === 'KJV') {
            englishByKey = info.keyBookMap;
        }
    }
} catch {
    // No data folder: English labels still read.
}
function toAsciiDigits(text) {
    return text.replaceAll(/[០-៩]/g, (digit) => {
        return String(digit.charCodeAt(0) - 0x17e0);
    });
}
/** `Open X in Bible Lookup` in any language, X as an English reference. */
function readOpenedRef(label) {
    const english = /^Open (.+) in Bible Lookup$/i.exec(label);
    // `បើក X ក្នុងការស្វែងរកព្រះគម្ពីរ`: the first word, X, the last.
    const local = /^\S+\s+(.+?)\s+\S+$/u.exec(label);
    const shown = english?.[1] ?? local?.[1];
    if (shown === undefined) {
        return null;
    }
    if (/^[\x20-\x7E–]+$/.test(shown)) {
        return /\d/.test(shown) ? shown : null;
    }
    const match = /^(.+?)\s+([\d០-៩:\-–]+)$/u.exec(shown.trim());
    const key = match === null ? undefined : bookKeyByName.get(match[1]);
    return key === undefined
        ? null
        : `${englishByKey[key] ?? key} ${toAsciiDigits(match[2])}`;
}
// A PASSAGE is a whole chapter, a run of chapters or a range of three verses
// or more: what a story asked for is answered with, rather than one verse.
function checkIsPassageRef(ref) {
    if (/\s\d+[-–]\d+$/.test(ref) || /\s\d+$/.test(ref)) {
        return true;
    }
    const match = /:(\d+)[-–](\d+)$/.exec(ref);
    return match !== null && Number(match[2]) - Number(match[1]) >= 2;
}

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
let stories = 0;
let passages = 0;
for (const ask of asks) {
    const record = records.get(`asks/${ask.focus}/${ask.id}`);
    if (record === undefined || record.stale === true) {
        console.log(`--   ${ask.id}  (not asked yet)`);
        continue;
    }
    asked += 1;
    const opened = (record.actions ?? [])
        .map((one) => {
            return typeof one === 'string' ? one : String(one?.label ?? '');
        })
        .map(readOpenedRef)
        .filter((ref) => {
            return ref !== null;
        });
    const isPass =
        (ask.expect ?? []).some((ref) => {
            return opened.some((one) => {
                return one.toLowerCase() === ref.toLowerCase();
            });
        }) ||
        (ask.expectIn ?? []).some((range) => {
            return opened.some((one) => {
                return checkIsInRange(one, range);
            });
        });
    if (isPass) {
        passed += 1;
    }
    const isPassage = (ask.expectIn ?? []).some((range) => {
        return opened.some((one) => {
            return checkIsPassageRef(one) && checkIsInRange(one, range);
        });
    });
    if (ask.isStory === true) {
        stories += 1;
        passages += isPassage ? 1 : 0;
    }
    const passageMark =
        ask.isStory === true ? (isPassage ? ' +passage' : ' -passage') : '';
    console.log(
        `${isPass ? 'PASS' : 'FAIL'}${passageMark} ${ask.id}  ` +
            `${record.model ?? '?'}  ${record.seconds ?? '?'}s  ` +
            `${record.cost ?? ''}  opened=[${opened.join('; ')}]` +
            (isPass
                ? ''
                : `  expected=${(ask.expect ?? ask.expectIn).join('|')}`),
    );
    if (process.argv.includes('--text')) {
        console.log(
            `     ${String(record.text ?? record.answer ?? '')
                .replaceAll(/\s+/g, ' ')
                .slice(0, 400)}`,
        );
    }
}
console.log(`\n${passed}/${asked} found (of ${asks.length} asks)`);
if (stories > 0) {
    console.log(
        `${passages}/${stories} stories answered with their passage ` +
            '(a whole chapter or 3+ verses opened, inside where it is told)',
    );
}
