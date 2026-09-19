// Top-1 / top-3 accuracy of the manual search over every corpus question that
// names a recipe, with the known-question route OUT of the way (a word is
// appended so the exact-label lookup misses, which is what a typed question
// looks like). The ranking's ratchet: run it before and after any change to
// `help.mjs`, `build-knowledge.mjs` or the manual, against the BUILT index
// (`node extra-work/build-knowledge.mjs` first).
//
//   node .claude/skills/owa-enhance-chatbot/scripts/rank-measure.mjs [--misses]
//
// 2026-09-10, manual indexed whole: rows 267, top-1 54%, top-3 78%.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const help = await import(
  pathToFileURL(path.join(ROOT, 'tools/owa-devtools-mcp/help.mjs')).href
);
const qdir = path.join(ROOT, 'tools/owa-devtools-mcp/questions');
const rows = [];
for (const name of fs.readdirSync(qdir)) {
  if (!name.endsWith('.json') || name === 'schema.json') continue;
  const file = JSON.parse(fs.readFileSync(path.join(qdir, name), 'utf8'));
  const focus = Array.isArray(file.focus) ? file.focus[0] : file.focus;
  for (const section of file.sections ?? []) {
    for (const q of section.questions ?? []) {
      if (q.resources?.recipe)
        rows.push({
          text: q.text,
          recipe: q.resources.recipe,
          focus: focus ?? null,
          file: name,
        });
    }
  }
}
let top1 = 0,
  top3 = 0,
  none = 0;
const misses = [];
for (const row of rows) {
  // Defeat the exact-label route: append a word.
  const hits = help.searchHelp(row.text + ' please', 3, 'auto', row.focus);
  const ids = hits.map((h) => h.id);
  if (ids[0] === row.recipe) top1++;
  if (ids.includes(row.recipe)) top3++;
  if (ids.length === 0) none++;
  if (ids[0] !== row.recipe)
    misses.push(`${row.recipe} <- ${ids[0] ?? '-'} : ${row.text}`);
}
console.log(
  `rows ${rows.length} top1 ${top1} (${Math.round((100 * top1) / rows.length)}%) top3 ${top3} (${Math.round((100 * top3) / rows.length)}%) noHit ${none}`,
);
if (process.argv[2] === '--misses') console.log(misses.join('\n'));
