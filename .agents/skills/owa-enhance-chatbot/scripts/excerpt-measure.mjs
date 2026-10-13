// Whether the search's EXCERPT answers the question it is shown for, over
// every corpus row that names a page: does it carry the control, the key and
// the menu item the row says answer it? Model-free, no app: the built index
// and the corpus on disk (`node extra-work/build-knowledge.mjs` first).
//
// The excerpt is the whole body of an answer when no assistant can be
// reached, and what a model writes a two-round answer from. The excerpt's
// ratchet: run it before and after touching `passageMatch.mjs`, `help.mjs` or
// the manual, and say both numbers.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/excerpt-measure.mjs [--misses]
//
// 2026-10-12, 398 rows. First line with any query word, plus four: control
// 37/166, key 11/35, menu 4/14; 67 excerpts started and 252 stopped in the
// middle of a sentence. The passage that answers (`passageMatch.mjs`): 160/166,
// 28/35, 13/14; 2 and 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const help = await import(
  pathToFileURL(path.join(ROOT, 'tools/owa-devtools-mcp/help.mjs')).href
);
const qdir = path.join(ROOT, 'tools/owa-devtools-mcp/questions');
const toWords = (text) => {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};
const toCompact = (text) => {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\s+]/g, '');
};
// "Enter / Shift+Enter", "Ctrl+Shift+P, then F": carried when any key is.
const toKeys = (shortcut) => {
  return shortcut
    .split(/[/,]| then | or /)
    .map((key) => {
      return toCompact(key.replace(/\(.*?\)/g, ''));
    })
    .filter((key) => {
      return key.length > 0;
    });
};

let rows = 0;
let ownPageFirst = 0;
let startsMidSentence = 0;
let stopsUnsaid = 0;
const carried = { control: [0, 0], key: [0, 0], menu: [0, 0] };
const lengths = [];
const misses = [];
for (const name of fs.readdirSync(qdir).sort()) {
  if (!name.endsWith('.json') || name === 'schema.json') continue;
  const file = JSON.parse(fs.readFileSync(path.join(qdir, name), 'utf8'));
  const focus = Array.isArray(file.focus)
    ? file.focus[0]
    : (file.focus ?? 'presenter');
  for (const section of file.sections ?? []) {
    for (const question of section.questions ?? []) {
      const resources = question.resources ?? {};
      if (!resources.recipe) continue;
      rows++;
      const hits = help.searchHelp(question.text, 3, 'manual', focus);
      const hit = hits.find((one) => {
        return one.id === resources.recipe;
      });
      if (hit === undefined) {
        misses.push(`no hit  ${file.page}/${question.id} ${resources.recipe}`);
        continue;
      }
      if (hits[0].id === resources.recipe) ownPageFirst++;
      const excerpt = (hit.excerpt ?? '').trim();
      lengths.push(excerpt.length);
      if (/^[a-z]/.test(excerpt)) startsMidSentence++;
      if (!/[.!?:)"”*_…]$/.test(excerpt)) stopsUnsaid++;
      const note = (kind, wanted, isCarried) => {
        carried[kind][1]++;
        if (isCarried) {
          carried[kind][0]++;
          return;
        }
        misses.push(
          `${kind.padEnd(7)} ${file.page}/${question.id} [${resources.recipe}] ` +
            `"${wanted}" :: ${excerpt.replace(/\s+/g, ' ').slice(0, 100)}`,
        );
      };
      if (typeof resources.find === 'string') {
        note(
          'control',
          resources.find,
          toWords(excerpt).includes(toWords(resources.find.split('>').pop())),
        );
      }
      if (typeof resources.shortcut === 'string') {
        note(
          'key',
          resources.shortcut,
          toKeys(resources.shortcut).some((key) => {
            return toCompact(excerpt).includes(key);
          }),
        );
      }
      if (typeof resources.menu === 'string') {
        note(
          'menu',
          resources.menu,
          toWords(excerpt).includes(toWords(resources.menu.split('→').pop())),
        );
      }
    }
  }
}
lengths.sort((one, other) => {
  return one - other;
});
console.log(`rows ${rows}; own page first ${ownPageFirst}`);
console.log(
  `excerpt carries the row's control ${carried.control.join('/')}, ` +
    `key ${carried.key.join('/')}, menu ${carried.menu.join('/')}`,
);
console.log(
  `chars median ${lengths[Math.floor(lengths.length / 2)]} ` +
    `p90 ${lengths[Math.floor(lengths.length * 0.9)]} ` +
    `max ${lengths[lengths.length - 1]}; ` +
    `starts mid-sentence ${startsMidSentence}; stops without saying ${stopsUnsaid}`,
);
if (process.argv.includes('--misses')) console.log(misses.join('\n'));
