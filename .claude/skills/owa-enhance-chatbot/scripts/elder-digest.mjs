// Prints a run file as something to grade: per scenario, the three models'
// answers to each step side by side, plus a numbers table per model.
import fs from 'node:fs';

const file = process.argv[2];
const only = process.argv[3] ?? null;
const rows = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
// The last complete attempt of each scenario on each model: a paused or
// reloaded attempt is asked again by a later run.
const goodRun = new Map();
for (const row of rows) {
  if (row.type === 'scenario' && !row.error)
    goodRun.set(row.scenario + '|' + row.model, row.runId);
}
const steps = rows.filter(
  (row) =>
    row.type === 'step' &&
    (row.runId === undefined ||
      goodRun.get(row.scenario + '|' + row.model) === row.runId ||
      !goodRun.has(row.scenario + '|' + row.model)),
);
const scenarios = rows.filter((row) => row.type === 'scenario');

if (only !== 'numbers') {
  const ids = [...new Set(steps.map((s) => s.scenario))];
  for (const id of ids) {
    if (only && !id.startsWith(only)) continue;
    console.log(`\n=== ${id}`);
    const forId = steps.filter((s) => s.scenario === id);
    const maxStep = Math.max(...forId.map((s) => s.step));
    for (let n = 1; n <= maxStep; n++) {
      for (const s of forId.filter((one) => one.step === n)) {
        const what =
          s.sent ??
          (s.press
            ? `PRESS ${s.press.label ?? s.press.reason}`
            : s.thumbsDown
              ? 'THUMB'
              : '');
        console.log(
          `--- [${n}] ${s.model} ${s.seconds}s r${s.usage?.rounds ?? '-'} ` +
            `${s.usage ? s.usage.input + s.usage.cacheRead : '-'}tok ` +
            `tools=${(s.tools ?? []).map((t) => t.name.replace('owa_', '') + (t.isError ? '!' : '')).join('>')} ` +
            `${s.found !== undefined ? `found=${s.found}` : ''} ${s.leak ? `LEAK=${s.leak}` : ''} ` +
            `km=${s.script?.kmShare} ${s.pageErrors?.length ? `PAGEERR=${JSON.stringify(s.pageErrors)}` : ''}` +
            `${s.timedOut ? ' TIMEOUT' : ''}${s.error ? ` ERROR=${s.error}` : ''}`,
        );
        console.log(`    > ${what}`);
        if (s.interrupt)
          console.log(`    interrupt: ${JSON.stringify(s.interrupt)}`);
        if (s.stop) console.log(`    stop: ${JSON.stringify(s.stop)}`);
        if (s.afterThumb)
          console.log(`    afterThumb: ${JSON.stringify(s.afterThumb)}`);
        if (s.nothingSent !== undefined)
          console.log(
            `    nothingSent=${s.nothingSent} input=${JSON.stringify(s.inputAfter)}`,
          );
        if (s.inputAfterAskAgain !== undefined)
          console.log(
            `    askAgain input=${JSON.stringify(s.inputAfterAskAgain)} submitAsIs=${JSON.stringify(s.submitAsIs)}`,
          );
        console.log(`    note: ${s.note ?? ''}`);
        console.log(
          `    ${String(s.answer).replace(/\n+/g, ' ⏎ ').slice(0, 1400)}`,
        );
        console.log(`    buttons: ${JSON.stringify(s.buttons)}`);
        const latin = englishOf(s);
        if (latin.length)
          console.log(`    ENGLISH SHOWN: ${latin.join(' | ')}`);
        const toolArgs = (s.tools ?? []).filter(
          (t) => !/help_search|help_page|app_state/.test(t.name),
        );
        if (toolArgs.length)
          console.log(
            `    acting/other tools: ${JSON.stringify(toolArgs.map((t) => [t.name, t.args, (t.result ?? '').slice(0, 160)]))}`,
          );
      }
    }
    for (const sc of scenarios.filter((one) => one.scenario === id)) {
      const extra = Object.entries(sc).filter(
        ([k]) =>
          !['type', 'scenario', 'kind', 'model', 'at', 'mainPage'].includes(k),
      );
      if (extra.length)
        console.log(
          `  after[${sc.model}]: ${JSON.stringify(Object.fromEntries(extra))}`,
        );
    }
  }
}

function englishOf(s) {
  const shown = [s.answer ?? '', s.note ?? '', ...(s.buttons ?? [])].join('\n');
  const runs =
    shown.match(
      /\/?[A-Za-z][A-Za-z'’.-]*(?:[ ,:;0-9-]+[A-Za-z][A-Za-z'’.-]*)*/g,
    ) ?? [];
  return [
    ...new Set(
      runs
        .map((r) => r.trim())
        .filter((r) => /[A-Za-z]{2,}/.test(r) && !/^\/[a-z-]+$/.test(r)),
    ),
  ];
}
// Letters of a script that is neither Khmer nor Latin, in a Khmer answer:
// "អេកក्रीन" (Devanagari), "សមាជិកមন্ডল" (Bengali).
function foreignScriptOf(s) {
  const shown = [s.answer ?? '', ...(s.buttons ?? [])].join('\n');
  return (
    shown.match(
      /(?![ក-៿᧠-᧿])(?!\p{Script=Latin})(?!\p{Script=Common})(?!\p{Script=Inherited})\p{L}/gu,
    ) ?? []
  ).join('');
}
const models = [...new Set(steps.map((s) => s.model))];
const median = (list) => {
  const sorted = list
    .filter((v) => typeof v === 'number')
    .sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)];
};
console.log('\n=== numbers');
for (const model of models) {
  const mine = steps.filter(
    (s) => s.model === model && s.sent !== undefined && !s.nothingSent,
  );
  const modelled = mine.filter((s) => s.usage);
  console.log(
    model.padEnd(18),
    `asks=${mine.length}`,
    `modelAnswers=${modelled.length}`,
    `medianSec=${median(modelled.map((s) => s.seconds))}`,
    `maxSec=${Math.max(...modelled.map((s) => s.seconds))}`,
    `medianRounds=${median(modelled.map((s) => s.usage.rounds))}`,
    `medianTok=${median(modelled.map((s) => s.usage.input + s.usage.cacheRead))}`,
    `outTok=${median(modelled.map((s) => s.usage.output))}`,
    `timeouts=${mine.filter((s) => s.timedOut).length}`,
    `leaks=${mine.filter((s) => s.leak).length}`,
    `pageErr=${mine.filter((s) => s.pageErrors?.length).length}`,
    `englishShown=${mine.filter((s) => englishOf(s).length).length}`,
    `englishWords=${mine.reduce((sum, s) => sum + englishOf(s).join(' ').split(/\s+/).filter(Boolean).length, 0)}`,
    `foreignScript=${mine.filter((s) => foreignScriptOf(s).length).length}`,
    `lowKhmer=${mine.filter((s) => (s.script?.kmShare ?? 1) < 0.5).length}`,
    `verseFound=${steps.filter((s) => s.model === model && s.found === true).length}/${steps.filter((s) => s.model === model && s.found !== undefined).length}`,
  );
}
