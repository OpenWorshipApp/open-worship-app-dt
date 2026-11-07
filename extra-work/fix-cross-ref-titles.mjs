// Fix the theme titles of a language's cross-reference bundle
// (`src/lang/data/online/<code>/bb-cr.gz.bundle`, the data the Reader's Cross
// References panel and the 🤖's passage chat read) where the translation went
// wrong (2026-10-23, EC-417). Measured on the Khmer bundle: of 231 890 themes,
// 7 241 left English words in the Khmer (a mountain's or a god's English
// name after the Khmer word for it), 7 291 held a letter that is not Khmer,
// 90 read "patient" as a sick person and ~150 gave a word its modern sense
// (the language's `cross-ref-title-rules.json`) -- a reader of no English
// sees them, in the panel and in **Related
// verses**. A second sweep found 225 more (a temple's court as a law court, a
// shepherd's staff as employees). 7 745 titles were written again; the
// rescan finds none left.
//
//   node extra-work/fix-cross-ref-titles.mjs --lang=<code> [--dry] [--show-left]
//        [--translate --server=http://localhost:11434/v1 --model=gemma4:cloud
//         [--batch=40] [--timeout=180] [--temperature=0] [--debug]]
//        [--hand=src/lang/data/online/<code>/cross-ref-title-fixes-hand.json]
//        [--write]
//
// Four steps, each kept so a run can be repeated and read:
// 1. A KJV name in a title is written as the names lookup writes it in that
//    language (`src/lang/data/online/<code>/location-name-map-data/`), the same
//    spelling the Bible and the lookup panel use -- no model.
// 2. `--translate`: what is still wrong is translated by a model, told the
//    names it must use and the modern senses to avoid, a batch at a time; a
//    translation holding a letter of another script, markup or a false
//    friend is not taken (`--debug` prints it). A batch that hangs is
//    dropped at `--timeout` seconds and asked again by the next run; a title
//    the model gets wrong the same way every time may take `--temperature`.
//    Every fix is kept in `src/lang/data/online/<code>/cross-ref-title-fixes.json`
//    (English title + old title -> new title), so a second run asks only for
//    what is missing (`--show-left` lists it).
// 3. `--hand`: what no model got right, written by hand in the words the
//    language's Bible uses (English title -> title), checked the same way.
// 4. `--write`: the bundle is written again in its own format (records
//    gzipped as they were, the same index shape and footer), every theme
//    title a fix names replaced, nothing else touched -- moved aside first,
//    so an app holding it open keeps reading the old one whole.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? true] : [arg, true];
  }),
);
const LANG = args.lang;
if (typeof LANG !== 'string' || !/^[a-z]{2,3}$/.test(LANG)) {
  console.error('Name the language package: --lang=<code> (src/lang/data/online/<code>/).');
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BUNDLE = path.join(ROOT, 'src', 'lang', 'data', 'online', LANG, 'bb-cr.gz.bundle');
const MAP_DIR = path.join(ROOT, 'src', 'lang', 'data', 'online', LANG, 'location-name-map-data');
const FIX_FILE = path.join(ROOT, 'src', 'lang', 'data', 'online', LANG, 'cross-ref-title-fixes.json');
const MAGIC = 'FBBNDL01';
const LATIN_RUN = /[A-Za-z]{2,}/;
// A translation is taken only with no Latin letter at all: a stray one is a
// typo the model left, not a name. In a language with a script of its own
// (its `assistant.json` `scriptPattern`), no letter of another script either
// (Han or Arabic letters inside a Khmer title came back) and no HTML entity
// (an `&#39;s`) -- 62 of the first 4 984 Khmer translations held one.
const ANY_LATIN = /[A-Za-z]/;
const LANG_FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'lang', 'data', 'online', LANG, 'assistant.json'), 'utf8'),
);
const OWN_SCRIPT_SOURCE = LANG_FACTS.scriptPattern ?? '[A-Za-z]';
const IS_OWN_SCRIPT_LATIN = new RegExp(OWN_SCRIPT_SOURCE, 'u').test('a');
// Nor markup: one title came back ending in `**`.
const STRAY_LETTER = IS_OWN_SCRIPT_LATIN
  ? ANY_LATIN
  : new RegExp(`(?!${OWN_SCRIPT_SOURCE})\\p{L}|&#?\\w+;|[*_#\`<>[\\]{}|\\\\]`, 'u');
const BATCH = Number(args.batch ?? 40);
// Words a machine translation gave a MODERN meaning, each with the English
// that would make it right -- the language's own
// `src/lang/data/online/<code>/cross-ref-title-rules.json`. "Companies of Warriors"
// had become a business, "Calling" a phone call, "God's Host" a machine,
// "The Dove as Messenger" a messaging app -- Genesis 8:10 and 8:12, the
// passage the user asked about. A second sweep found the temple's courts and
// Pharaoh's court as a LAW court (197), a shepherd's staff as employees (27
// -- Psalm 23:4's _rod and staff_, under the passage chat's own answer) and
// a ship's pilots flying planes. A rule's `title` is a pattern; what makes
// it wrong or right is a test of the English.
const RULE_FILE = path.join(ROOT, 'src', 'lang', 'data', 'online', LANG, 'cross-ref-title-rules.json');
const FALSE_FRIEND_LIST = (
  fs.existsSync(RULE_FILE) ? JSON.parse(fs.readFileSync(RULE_FILE, 'utf8')).falseFriends ?? [] : []
).map((rule) => {
  return {
    title: new RegExp(rule.title, 'u'),
    badIf: rule.badIf ? new RegExp(rule.badIf, 'i') : null,
    badUnless: rule.badUnless ? new RegExp(rule.badUnless, 'i') : null,
  };
});
// Some languages separate words with zero-width spaces (Khmer titles do):
// every check reads the title without them.
const toPlainTitle = (text) => String(text ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '');

function checkHasFalseFriend(title, titleEn) {
  const plain = toPlainTitle(title);
  return FALSE_FRIEND_LIST.some((rule) => {
    if (!rule.title.test(plain)) {
      return false;
    }
    if (rule.badIf !== null && !rule.badIf.test(titleEn)) {
      return false;
    }
    return rule.badUnless === null || !rule.badUnless.test(titleEn);
  });
}

// ---- the bundle ------------------------------------------------------------

function readBundle(filePath) {
  const buffer = fs.readFileSync(filePath);
  const footer = buffer.subarray(buffer.length - 20);
  if (footer.toString('latin1', 12, 20) !== MAGIC) {
    throw new Error('Not a bundle (bad magic)');
  }
  const indexOffset = footer.readUInt32LE(0);
  const indexLength = footer.readUInt32LE(4);
  const flags = footer.readUInt32LE(8);
  const isGzip = (flags & 1) === 1;
  const index = JSON.parse(
    buffer.subarray(indexOffset, indexOffset + indexLength).toString('utf8'),
  );
  const records = new Map();
  for (const [key, [offset, length]] of Object.entries(index)) {
    const raw = buffer.subarray(offset, offset + length);
    records.set(
      key,
      JSON.parse((isGzip ? zlib.gunzipSync(raw) : raw).toString('utf8')),
    );
  }
  return { records, flags, isGzip, keyOrder: Object.keys(index) };
}

function writeBundle(filePath, { records, flags, isGzip, keyOrder }) {
  const chunks = [];
  const index = {};
  let offset = 0;
  for (const key of keyOrder) {
    const text = Buffer.from(JSON.stringify(records.get(key)), 'utf8');
    const data = isGzip ? zlib.gzipSync(text, { level: 9 }) : text;
    index[key] = [offset, data.length];
    chunks.push(data);
    offset += data.length;
  }
  const indexBuffer = Buffer.from(JSON.stringify(index), 'utf8');
  const footer = Buffer.alloc(20);
  footer.writeUInt32LE(offset, 0);
  footer.writeUInt32LE(indexBuffer.length, 4);
  footer.writeUInt32LE(flags, 8);
  footer.write(MAGIC, 12, 'latin1');
  // A running app holds the bundle open with the index it read once
  // (`cachedCrossRefReader` in `langHelpers.ts`): bytes written over it would
  // be read at the old offsets. Moved aside first, the old file stays whole
  // for whoever holds it (Windows refuses a rename OVER a held file, not of
  // one), and the next launch reads the new one.
  const aside = `${filePath}.old-${process.pid}`;
  fs.renameSync(filePath, aside);
  try {
    fs.writeFileSync(filePath, Buffer.concat([...chunks, indexBuffer, footer]));
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    fs.renameSync(aside, filePath);
    throw error;
  }
  fs.rmSync(aside, { force: true });
}

// ---- what is wrong -----------------------------------------------------------

function checkIsBadTitle(theme) {
  const title = String(theme?.title ?? '');
  const titleEn = String(theme?.titleEn ?? '');
  if (title.trim().length === 0) {
    return false;
  }
  return (
    LATIN_RUN.test(title) ||
    (!IS_OWN_SCRIPT_LATIN && STRAY_LETTER.test(title)) ||
    title.trim() === titleEn.trim() ||
    checkHasFalseFriend(title, titleEn)
  );
}

const toFixKey = (theme) => `${theme.titleEn}\u0000${theme.title}`;

// ---- names: KJV -> the language's own --------------------------------------

function readNameMap() {
  const counts = new Map();
  const add = (kjvName, name) => {
    if (typeof kjvName !== 'string' || typeof name !== 'string') {
      return;
    }
    const kjv = kjvName.trim();
    const own = name.trim();
    if (kjv.length < 2 || own.length === 0 || LATIN_RUN.test(own)) {
      return;
    }
    const byName = counts.get(kjv) ?? new Map();
    byName.set(own, (byName.get(own) ?? 0) + 1);
    counts.set(kjv, byName);
  };
  for (const [file, field] of [
    ['namesMap.json', 'namesMap'],
    ['locationsMap.json', 'locationsMap'],
  ]) {
    const filePath = path.join(MAP_DIR, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Array.isArray(data[field])
      ? data[field]
      : Object.values(data[field] ?? {});
    for (const record of records) {
      add(record?.kjvName, record?.name);
    }
  }
  // The spelling most of a name's records use.
  const nameMap = new Map();
  for (const [kjv, byName] of counts) {
    nameMap.set(
      kjv,
      [...byName].sort((a, b) => {
        return b[1] - a[1];
      })[0][0],
    );
  }
  return nameMap;
}

/**
 * A title with every KJV name in it written as the language writes it. A
 * name that is also an everyday word of the English titles (`a ram`, `the
 * rock`) is left for the translation, which reads the whole English title:
 * swapped blindly, Daniel's ram and the ram of consecration became Ram, a
 * man of Judah.
 */
function replaceNames(title, nameMap, everydayWords) {
  return title.replace(/[A-Z][A-Za-z]+(?:'s)?/g, (word) => {
    const bare = word.replace(/'s$/, '');
    if (everydayWords.has(bare.toLowerCase())) {
      return word;
    }
    const own = nameMap.get(bare);
    return own === undefined ? word : own;
  });
}

// ---- the model ---------------------------------------------------------------


async function translateBatch(items, nameMap) {
  const glossary = new Map();
  for (const item of items) {
    for (const word of item.titleEn.match(/[A-Z][A-Za-z]+/g) ?? []) {
      const own = nameMap.get(word);
      if (own !== undefined) {
        glossary.set(word, own);
      }
    }
  }
  const language = LANG_FACTS.name ?? LANG;
  const prompt =
    `Translate each English Bible cross-reference theme title into ` +
    `natural ${language}, as a short title in the style of a ${language} ` +
    'Bible. Write every person and place with the spelling given below, ' +
    'write no Latin letter at all, and keep the Bible meaning, never a ' +
    'modern one: "patient" is enduring with patience, never a sick ' +
    'person; a "company" or "band" of people is a group, never a ' +
    'business; a "calling" is God calling someone, never a phone call; ' +
    'a "host" is an army or the stars, never a machine; a "messenger" ' +
    'is a person who carries word, never an app; the "court" of the ' +
    'temple or of a king is its courtyard or palace, never a law court ' +
    'unless the title is about law; a "staff" is a rod, never employees; ' +
    'a "pilot" steers a ship. Answer with a ' +
    'JSON array of strings only, one per title, in order.\n\nNames:\n' +
    [...glossary].map(([en, own]) => `${en} = ${own}`).join('\n') +
    '\n\nTitles:\n' +
    JSON.stringify(
      items.map((item) => {
        return item.titleEn;
      }),
    );
  const response = await fetch(`${args.server}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // A batch is ~20 s; one that hangs is dropped, and the next run asks
    // for it again.
    signal: AbortSignal.timeout(Number(args.timeout ?? 180) * 1000),
    body: JSON.stringify({
      model: args.model,
      temperature: Number(args.temperature ?? 0),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`server answered ${response.status}`);
  }
  const body = await response.json();
  const text = String(body?.choices?.[0]?.message?.content ?? '');
  const match = /\[[\s\S]*\]/.exec(text);
  const list = match === null ? [] : JSON.parse(match[0]);
  return Array.isArray(list) ? list : [];
}

// ---- the run -----------------------------------------------------------------

const bundle = readBundle(BUNDLE);
const fixes = fs.existsSync(FIX_FILE)
  ? JSON.parse(fs.readFileSync(FIX_FILE, 'utf8'))
  : {};
const nameMap = readNameMap();
const badMap = new Map();
// The KJV's own lowercase words -- `ram`, `mark`, `rock` -- are everyday
// words, whatever a name of the same letters is (the English titles are in
// Title Case and tell nothing).
const everydayWords = new Set(
  fs
    .readFileSync(
      path.join(
        ROOT,
        'src',
        'helper',
        'bible-helpers',
        'bible-data',
        'kjvBibleBooks.json',
      ),
      'utf8',
    )
    .match(/(?<![A-Za-z])[a-z]{2,}(?![A-Za-z])/g) ?? [],
);
let themeCount = 0;
let badCount = 0;
for (const themes of bundle.records.values()) {
  for (const theme of themes) {
    themeCount++;
    if (checkIsBadTitle(theme)) {
      badCount++;
      badMap.set(toFixKey(theme), theme);
    }
  }
}
let byNames = 0;
for (const [key, theme] of badMap) {
  if (fixes[key] !== undefined) {
    continue;
  }
  const named = replaceNames(theme.title, nameMap, everydayWords);
  if (named !== theme.title && checkIsBadTitle({ ...theme, title: named }) === false) {
    fixes[key] = named;
    byNames++;
  }
}
const left = [...badMap].filter(([key]) => {
  return fixes[key] === undefined;
});
// `--hand=<file>`: titles no model got right, written by hand -- English
// title -> the language's, in the words its Bible uses (the ark as the
// language's own Bible names it). Checked like a translation.
if (typeof args.hand === 'string') {
  const hand = JSON.parse(fs.readFileSync(path.resolve(ROOT, args.hand), 'utf8'));
  for (const [key, theme] of left) {
    const value = hand[theme.titleEn];
    if (
      typeof value === 'string' &&
      !STRAY_LETTER.test(value) &&
      !checkHasFalseFriend(value, theme.titleEn)
    ) {
      fixes[key] = value;
    }
  }
}
if (args['show-left'] === true) {
  for (const [, theme] of left) {
    console.log(`${theme.titleEn} | ${theme.title}`);
  }
}
console.log(
  JSON.stringify({
    lang: LANG,
    themes: themeCount,
    badThemes: badCount,
    distinctBad: badMap.size,
    fixedByNames: byNames,
    fixesKept: Object.keys(fixes).length,
    leftToTranslate: left.length,
    nameMapSize: nameMap.size,
  }),
);
if (args.translate === true) {
  for (let start = 0; start < left.length; start += BATCH) {
    const items = left.slice(start, start + BATCH).map(([key, theme]) => {
      return { key, titleEn: theme.titleEn };
    });
    let translated = [];
    try {
      translated = await translateBatch(items, nameMap);
    } catch (error) {
      console.log(`batch ${start}: ${error.message}`);
      continue;
    }
    let taken = 0;
    items.forEach((item, index) => {
      const value = typeof translated[index] === 'string' ? translated[index].trim() : '';
      if (
        value.length > 0 &&
        !STRAY_LETTER.test(value) &&
        !checkHasFalseFriend(value, item.titleEn)
      ) {
        fixes[item.key] = value;
        taken++;
      } else if (args.debug === true) {
        console.log(`  not taken: ${item.titleEn} => ${JSON.stringify(value)}`);
      }
    });
    console.log(`batch ${start}-${start + items.length}: ${taken} taken`);
    fs.mkdirSync(path.dirname(FIX_FILE), { recursive: true });
    fs.writeFileSync(FIX_FILE, `${JSON.stringify(fixes, null, 1)}\n`);
  }
}
if (args.dry !== true) {
  fs.mkdirSync(path.dirname(FIX_FILE), { recursive: true });
  fs.writeFileSync(FIX_FILE, `${JSON.stringify(fixes, null, 1)}\n`);
}
if (args.write === true) {
  let replaced = 0;
  for (const themes of bundle.records.values()) {
    for (const theme of themes) {
      const fix = fixes[toFixKey(theme)];
      if (typeof fix === 'string') {
        theme.title = fix;
        replaced++;
      }
    }
  }
  writeBundle(BUNDLE, bundle);
  console.log(JSON.stringify({ written: BUNDLE, titlesReplaced: replaced }));
}
