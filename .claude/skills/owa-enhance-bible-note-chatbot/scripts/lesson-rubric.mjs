#!/usr/bin/env node
// The STRUCTURE of a preaching lesson, checked by machine on a note as
// `owa_note_edit read` gives it (its `blocks`) -- the half of "a best
// lesson" a script can hold (owa-enhance-bible-note-chatbot, BN-66). The
// other half, whether it is a GOOD sermon, is a reader's: the standard is
// `references/lesson-rubric.md`, and a blind judge scores against it.
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/lesson-rubric.mjs <results.jsonl> [--text=<dir>]
//
// prints each lesson `run-lesson-asks.mjs` made with its checks. Imported,
// `gradeLesson(blocks, {form, isEnglish})` grades one.
//
// Ten checks, each pass or fail:
//   passage      the main passage printed whole near the top (a passage block
//                among the first three)
//   sections     every part a lesson holds: in English by its name (Big idea,
//                Background, Introduction, Pointing to Jesus, Response,
//                prayer, Questions, Memory verse); in another language, at
//                least nine "## " headings
//   points       at least three numbered points ("1." …) -- a children's
//                lesson two, a devotion one
//   point verses every numbered point cites its verses (a chip or a passage)
//   point depth  every numbered point is more than a line: two blocks after
//                its heading, or sixty words
//   questions    at least two questions for discussion, under their heading
//                (in another language: lines that end in a question mark)
//   memory verse a verse (a passage or a chip) in the last three blocks
//   no empties   no empty line left in the note
//   length       its own words (passages left out) within the form's range
//   no repeats   no block's words written twice (a point kept beside its
//                expanded section); a passage printed twice is the Bible's
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGLISH_SECTION_LIST = [
    ['big idea', /\bbig idea\b|\bmain idea\b|\bcentral (?:idea|truth)\b/i],
    ['background', /\bbackground\b|\bcontext\b|\bsetting\b/i],
    ['introduction', /\bintroduction\b|\bopening\b/i],
    ['pointing to Jesus', /\bjesus\b|\bchrist\b|\bgospel\b/i],
    ['response', /\bresponse\b|\brespond\b|\bapplication\b|\binvitation\b/i],
    ['prayer', /\bprayer\b/i],
    ['questions', /\bquestions?\b|\bdiscussion\b|\blet'?s talk\b/i],
    ['memory verse', /\bmemory\b|\bverse to (?:keep|remember)\b/i],
];
const LENGTH_RANGE_MAP = {
    sermon: [450, 3200],
    devotion: [120, 1400],
    children: [200, 2200],
};
const VERSE_TOKEN_PATTERN = /\[\^[^\]\n]+\]/;

function toWords(text) {
    return String(text ?? '')
        .replace(/\[\^[^\]\n]*\]/g, ' ')
        .match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? [];
}

function checkIsHeading(block) {
    return /^h[1-6]$/.test(block.kind);
}

function checkIsPointHeading(block) {
    return (
        checkIsHeading(block) &&
        /^\s*(?:\*\*)?\s*[\p{Nd}]+[.)]/u.test(String(block.text ?? ''))
    );
}

function checkHasVerse(block) {
    return block.kind === 'passage' || VERSE_TOKEN_PATTERN.test(block.text);
}

/** Each numbered point: its heading and the blocks up to the next heading. */
function listPointSections(blocks) {
    const sections = [];
    blocks.forEach((block, index) => {
        if (!checkIsPointHeading(block)) {
            return;
        }
        const rest = [];
        for (const next of blocks.slice(index + 1)) {
            if (checkIsHeading(next)) {
                break;
            }
            rest.push(next);
        }
        sections.push({ heading: block, rest });
    });
    return sections;
}

/**
 * The questions for discussion: in English the blocks under a heading that
 * names them; in any language, blocks after the last third that ask (end
 * in a question mark) or are list items under a heading of their own.
 */
function countQuestions(blocks, isEnglish) {
    const at = blocks.findIndex((block) => {
        return (
            checkIsHeading(block) &&
            /\bquestions?\b|\bdiscussion\b|\blet'?s talk\b/i.test(block.text)
        );
    });
    if (isEnglish && at >= 0) {
        let count = 0;
        for (const block of blocks.slice(at + 1)) {
            if (checkIsHeading(block)) {
                break;
            }
            count += String(block.text ?? '').trim() === '' ? 0 : 1;
        }
        return count;
    }
    return blocks.slice(Math.floor(blocks.length / 2)).filter((block) => {
        return (
            !checkIsHeading(block) &&
            /\?\s*$/u.test(String(block.text ?? '').trim())
        );
    }).length;
}

export function gradeLesson(blocks, { form = 'sermon', isEnglish = true } = {}) {
    const list = Array.isArray(blocks) ? blocks : [];
    const headings = list.filter(checkIsHeading);
    const points = listPointSections(list);
    // A devotion keeps the parts with one point (PREACHING_LESSON_SHAPE).
    const minPoints = form === 'sermon' ? 3 : form === 'children' ? 2 : 1;
    const ownWords = list
        .filter((block) => block.kind !== 'passage')
        .flatMap((block) => toWords(block.text));
    const [minWords, maxWords] = LENGTH_RANGE_MAP[form] ?? LENGTH_RANGE_MAP.sermon;
    const missingSections = isEnglish
        ? ENGLISH_SECTION_LIST.filter(([, pattern]) => {
              return !headings.some((block) => pattern.test(block.text));
          }).map(([name]) => name)
        : [];
    const seenWords = new Map();
    const repeats = [];
    for (const block of list) {
        // A passage printed twice (a point's and the memory verse) is the
        // Bible's words, not the lesson's.
        if (block.isFixed === true) {
            continue;
        }
        const key = toWords(block.text).join(' ').toLowerCase();
        if (key.split(' ').length < 3) {
            continue;
        }
        // A point heading said again as a list item, or any line twice.
        const bare = key.replace(/^\d+\s+/, '');
        if (seenWords.has(bare)) {
            repeats.push(block.text);
        }
        seenWords.set(bare, true);
    }
    const checks = [
        {
            name: 'passage',
            pass: list.slice(0, 3).some((block) => block.kind === 'passage'),
        },
        {
            name: 'sections',
            pass: isEnglish
                ? form === 'sermon'
                    ? missingSections.length === 0
                    : missingSections.length <= 3
                : headings.length >= (form === 'sermon' ? 9 : 5),
            detail: isEnglish
                ? missingSections.join(', ')
                : `${headings.length} headings`,
        },
        {
            name: 'points',
            pass: points.length >= minPoints,
            detail: `${points.length}`,
        },
        {
            name: 'point verses',
            pass:
                points.length > 0 &&
                points.every(({ heading, rest }) => {
                    return [heading, ...rest].some(checkHasVerse);
                }),
        },
        {
            name: 'point depth',
            pass:
                points.length > 0 &&
                points.every(({ rest }) => {
                    const words = rest.flatMap((block) => toWords(block.text));
                    return rest.length >= 2 || words.length >= 60;
                }),
        },
        {
            name: 'questions',
            pass: countQuestions(list, isEnglish) >= 2,
            detail: `${countQuestions(list, isEnglish)}`,
        },
        {
            name: 'memory verse',
            pass: list.slice(-3).some(checkHasVerse),
        },
        {
            name: 'no empties',
            pass: !list.some((block) => {
                return (
                    block.isFixed !== true &&
                    String(block.text ?? '').trim() === ''
                );
            }),
        },
        {
            name: 'length',
            pass: ownWords.length >= minWords && ownWords.length <= maxWords,
            detail: `${ownWords.length} words`,
        },
        {
            name: 'no repeats',
            pass: repeats.length === 0,
            detail: repeats.slice(0, 2).join(' | '),
        },
    ];
    return {
        score: checks.filter((check) => check.pass).length,
        max: checks.length,
        checks,
        words: ownWords.length,
    };
}

/** A note's blocks as plain text a reader can judge: headings, items, passages. */
const REPO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
let kjvData = null;

function readKjvData() {
    if (kjvData === null) {
        const read = (path) => {
            return JSON.parse(readFileSync(join(REPO_DIR, path), 'utf8'));
        };
        const config = read('src/helper/bible-helpers/kjvBibleConfig.json');
        kjvData = {
            books: read('src/helper/bible-helpers/bible-data/kjvBibleBooks.json'),
            keyMap: new Map(
                Object.entries(config.keyBookMap).map(([key, name]) => {
                    return [String(name).toLowerCase(), key];
                }),
            ),
        };
    }
    return kjvData;
}

// A block over the note read's 8000 letters comes back cut with "…"
// (`isTextCut`) though the note holds it whole: every reader of ab20..ab23
// was given L-01's 1 Samuel 17:1-58 stopping at "(51): Therefore David
// ran,…" -- the harness's cut, not the note's. A KJV passage is rebuilt
// from the repo's KJV, the words the installed one gives (byte for byte
// on every passage block not cut), and only where the cut text is the
// start of what is rebuilt.
export function toWholePassageText(text) {
    const cut = String(text ?? '');
    if (!cut.endsWith('…')) {
        return cut;
    }
    const match =
        /^\(KJV\) ((?:[1-3] )?[A-Za-z][A-Za-z ]*?) (\d+):(\d+)-(\d+) — /.exec(
            cut,
        );
    if (match === null) {
        return cut;
    }
    const { books, keyMap } = readKjvData();
    const chapter = books[keyMap.get(match[1].toLowerCase())]?.[match[2]];
    if (chapter === undefined) {
        return cut;
    }
    const verseList = [];
    for (let verse = Number(match[3]); verse <= Number(match[4]); verse++) {
        const words = chapter[String(verse)];
        if (typeof words !== 'string') {
            return cut;
        }
        verseList.push(`(${verse}): ${words}`);
    }
    const whole = `${match[0]}${verseList.join(' ')}`;
    return whole.startsWith(cut.slice(0, -1)) ? whole : cut;
}

export function toLessonText(blocks, title = '') {
    const lines = title === '' ? [] : [`# ${title}`, ''];
    for (const block of Array.isArray(blocks) ? blocks : []) {
        const text = String(block.text ?? '');
        if (block.kind === 'passage') {
            lines.push(`> ${toWholePassageText(text)}`, '');
        } else if (/^h[1-6]$/.test(block.kind)) {
            lines.push(`${'#'.repeat(Number(block.kind[1]) + 0)} ${text}`, '');
        } else if (['bullet', 'check'].includes(block.kind)) {
            lines.push(`- ${text}`);
        } else if (block.kind === 'number') {
            lines.push(`1. ${text}`);
        } else if (text.trim() !== '') {
            // A block's line breaks are lines in the note window; in
            // Markdown they ran together -- "bold labels run together in
            // the points" (ab23, a children's lesson written as one block).
            lines.push(text.split('\n').join('\n\n'), '');
        }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// The run's own note name (`Lesson L02 c`) is no part of the lesson.
function toShownTitle(name) {
    const text = String(name ?? '');
    return /^Lesson [A-Z]-?\d+ \w+$/.test(text) ? '' : text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const file = process.argv[2];
    if (!file) {
        console.error('Give the results .jsonl run-lesson-asks.mjs wrote.');
        process.exit(2);
    }
    // `--text=<dir>`: each lesson as the reader gets it -- the ask and the
    // form, then the lesson, nothing of how it was made.
    const textArg = process.argv.find((arg) => arg.startsWith('--text='));
    const textDir = textArg === undefined ? null : textArg.slice(7);
    if (textDir !== null) {
        mkdirSync(textDir, { recursive: true });
    }
    // A finish row's reader is shown what the preacher had written first.
    const asksArg = process.argv.find((arg) => arg.startsWith('--asks='));
    const seedMap = new Map(
        JSON.parse(
            readFileSync(
                asksArg === undefined
                    ? join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'lesson-asks.json')
                    : asksArg.slice(7),
                'utf8',
            ),
        ).map((item) => [item.id, item.seed ?? null]),
    );
    let total = 0;
    let passed = 0;
    for (const line of readFileSync(file, 'utf8').trim().split(/\r?\n/)) {
        const row = JSON.parse(line);
        if (textDir !== null) {
            const asked =
                row.ask ??
                (row.pressed ?? []).map((words) => `(pressed) ${words}`).join(' then ');
            const seed = seedMap.get(row.id) ?? null;
            writeFileSync(
                join(textDir, `${row.id}.md`),
                `Asked: ${asked}\nForm asked for: ${row.form}\n` +
                    (seed === null
                        ? ''
                        : `\nWhat the preacher had written in the note before asking:\n\n${seed
                              .split('\n')
                              .map((one) => `    ${one}`)
                              .join('\n')}\n`) +
                    `\n---\n\n${toLessonText(row.blocks, toShownTitle(row.noteName))}\n`,
            );
        }
        const grade = gradeLesson(row.blocks, {
            form: row.form,
            isEnglish: row.isEnglish !== false,
        });
        total += 1;
        passed += grade.score === grade.max ? 1 : 0;
        const failed = grade.checks
            .filter((check) => !check.pass)
            .map((check) => `${check.name}${check.detail ? ` (${check.detail})` : ''}`);
        console.log(
            `${String(row.id).padEnd(6)} ${grade.score}/${grade.max} ${String(row.seconds ?? '').padStart(4)}s ${String(grade.words).padStart(5)}w ${failed.length === 0 ? 'all' : failed.join('; ')}`,
        );
    }
    console.log(`${passed} of ${total} lessons pass every check`);
}
