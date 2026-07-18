#!/usr/bin/env node
/**
 * build-manual.mjs — turn the robot-test workflow source of truth into a
 * VitePress manual + a machine-readable test manifest.
 *
 * WHY THIS EXISTS
 * ---------------
 * `.claude/skills/owa-robot-test/references/user-workflows.md` is the canonical,
 * live-verified, tutorial-voice source of truth (W-01 … W-nn). This script is a
 * pure-Node (no dependencies) generator that produces TWO derived views of it:
 *
 *   1. docs/manual-sources/**       — one Markdown page per workflow, with the
 *      test metadata (id / verify rows / screenshot count) tucked into YAML
 *      frontmatter so it renders as a clean Blender-style user manual.
 *   2. docs/test-manifest.json      — the machine-readable BRIDGE the owa-robot-test
 *      skill reads to drive each W-xx path and mark the coverage-matrix rows it
 *      proves. This is what makes "the manual = the source of truth for testing".
 *   3. docs/.vitepress/sidebar.generated.json — the manual's nav tree.
 *
 * Because everything is derived from ONE file, the human manual and the robot's
 * test paths can never drift apart — the exact failure mode user-workflows.md's
 * "Contract" warns about.
 *
 * CANONICITY: today user-workflows.md is canonical and manual-sources/ is
 * generated (edit the workflow file, re-run this). To flip later — make the
 * manual pages canonical and hand-author them — keep only the manifest+sidebar
 * pass (it reads each page's frontmatter, not user-workflows.md) and drop the
 * split pass. The manifest schema is identical either way.
 *
 * Run:  node docs/scripts/build-manual.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..'); // docs/scripts -> repo root
const SOURCE = join(
    REPO,
    '.claude',
    'skills',
    'owa-robot-test',
    'references',
    'user-workflows.md',
);
const OUT_DIR = join(REPO, 'docs', 'manual-sources');
const VITEPRESS_DIR = join(REPO, 'docs', '.vitepress');
const MANIFEST_PATH = join(REPO, 'docs', 'test-manifest.json');

/** kebab-case a heading for use in file names / URLs. */
function slug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9ក-៿]+/g, '-') // keep ascii + khmer, collapse the rest
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

/** "PL-01, PM-05..09, KB-05." -> ["PL-01","PM-05",...,"PM-09","KB-05"] */
function expandVerify(str) {
    const out = [];
    for (const raw of str.split(',')) {
        const tok = raw.trim().replace(/\.+$/, '');
        if (!tok) continue;
        const m = tok.match(/^([A-Z]+)-(\d+)\.\.(\d+)$/);
        if (m) {
            const [, prefix, a, b] = m;
            const width = a.length;
            for (let i = parseInt(a, 10); i <= parseInt(b, 10); i++) {
                out.push(`${prefix}-${String(i).padStart(width, '0')}`);
            }
        } else {
            out.push(tok);
        }
    }
    return out;
}

/** Pull ordered numbered steps out of a workflow body (best effort). */
function extractSteps(bodyLines) {
    const steps = [];
    let current = null;
    for (const line of bodyLines) {
        const m = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (m) {
            if (current) steps.push(current);
            current = m[2].trim();
        } else if (current && /^\s{3,}\S/.test(line) && !line.trim().startsWith('>')) {
            current += ' ' + line.trim();
        } else if (line.trim() === '') {
            // keep the current step open across blank lines
        } else {
            if (current) {
                steps.push(current);
                current = null;
            }
        }
    }
    if (current) steps.push(current);
    // strip markdown emphasis / backticks so the manifest is plain drive-text
    return steps.map((s) =>
        s.replace(/\*\*|`|📸/g, '').replace(/\s+/g, ' ').trim(),
    );
}

// ---------------------------------------------------------------------------
// 1. Parse the source of truth
// ---------------------------------------------------------------------------

const src = readFileSync(SOURCE, 'utf8');
const lines = src.split(/\r?\n/);

const versionMatch = src.match(/workflowsVersion:\s*([0-9-]+)/);
const workflowsVersion = versionMatch ? versionMatch[1] : 'unknown';

const workflows = [];
let section = 'General';
let cur = null;

const flush = () => {
    if (!cur) return;
    // last "*Verify: ... *" italic line -> matrix rows; drop it from the body
    let verify = [];
    const kept = [];
    for (const l of cur.body) {
        const vm = l.match(/^\*Verify:\s*(.+?)\.?\*\s*$/);
        if (vm) {
            verify = expandVerify(vm[1]);
            continue; // do not render the raw verify line in the manual
        }
        kept.push(l);
    }
    // trim leading/trailing blank lines and a stray trailing rule
    while (kept.length && kept[0].trim() === '') kept.shift();
    while (kept.length && (kept[kept.length - 1].trim() === '' || kept[kept.length - 1].trim() === '---'))
        kept.pop();
    cur.verify = verify;
    cur.screenshots = (cur.body.join('\n').match(/📸/g) || []).length;
    cur.steps = extractSteps(cur.body);
    cur.bodyText = kept.join('\n');
    delete cur.body;
    workflows.push(cur);
    cur = null;
};

for (const line of lines) {
    const sec = line.match(/^##\s+(?!#)(.+?)\s*$/);
    const wf = line.match(/^###\s+(W-\d+)\s+[—-]\s+(.+?)\s*$/);
    if (wf) {
        flush();
        cur = {
            id: wf[1],
            title: wf[2].trim(),
            section,
            body: [],
        };
        continue;
    }
    if (sec && !cur) {
        section = sec[1].trim();
        continue;
    }
    if (sec && cur) {
        // a new ## section starts -> close the current workflow first
        flush();
        section = sec[1].trim();
        continue;
    }
    if (cur) cur.body.push(line);
}
flush();

if (workflows.length === 0) {
    console.error('No workflows parsed from', SOURCE);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Emit the per-workflow manual pages
// ---------------------------------------------------------------------------

// wipe previously generated pages so removed workflows don't linger
if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUT_DIR, { recursive: true });

const sectionsInOrder = [];
const bySection = new Map();

for (const w of workflows) {
    const secSlug = slug(w.section);
    w.pageRel = `${secSlug}/${w.id.toLowerCase()}-${slug(w.title)}.md`;
    w.url = '/' + w.pageRel.replace(/\.md$/, '');
    const abs = join(OUT_DIR, w.pageRel);
    mkdirSync(dirname(abs), { recursive: true });

    const fm = [
        '---',
        `id: ${w.id}`,
        `title: ${JSON.stringify(w.title)}`,
        `section: ${JSON.stringify(w.section)}`,
        `verify: [${w.verify.join(', ')}]`,
        `screenshots: ${w.screenshots}`,
        `generatedFrom: user-workflows.md`,
        `workflowsVersion: "${workflowsVersion}"`,
        '---',
        '',
    ].join('\n');

    const coverage = w.verify.length
        ? [
              '',
              '::: details 🤖 Robot-verified — coverage traceability',
              `This page maps 1:1 to a workflow the QA robot drives live. It proves ` +
                  `these \`coverage-matrix.md\` rows:`,
              '',
              w.verify.map((r) => `\`${r}\``).join(' · '),
              '',
              `Regenerated from \`user-workflows.md\` (workflowsVersion ${workflowsVersion}).`,
              ':::',
              '',
          ].join('\n')
        : '';

    const page = `${fm}# ${w.id} — ${w.title}\n\n${w.bodyText}\n${coverage}`;
    writeFileSync(abs, page, 'utf8');

    if (!bySection.has(w.section)) {
        bySection.set(w.section, []);
        sectionsInOrder.push(w.section);
    }
    bySection.get(w.section).push(w);
}

// ---------------------------------------------------------------------------
// 3. Home page + sidebar tree
// ---------------------------------------------------------------------------

const features = sectionsInOrder.map((s) => {
    const first = bySection.get(s)[0];
    return {
        title: s,
        details: bySection
            .get(s)
            .map((w) => w.title)
            .join(' · '),
        link: first.url,
    };
});

const home = [
    '---',
    'layout: home',
    'hero:',
    '  name: Open Worship App',
    '  text: User Manual',
    '  tagline: Present slides, lyrics and Scripture — the same steps the QA robot verifies live.',
    '  actions:',
    `    - theme: brand`,
    `      text: Get started`,
    `      link: ${workflows[0].url}`,
    '    - theme: alt',
    '      text: Keyboard shortcuts',
    `      link: ${(workflows.find((w) => w.id === 'W-06') || workflows[0]).url}`,
    'features:',
    ...features.flatMap((f) => [
        `  - title: ${JSON.stringify(f.title)}`,
        `    details: ${JSON.stringify(f.details)}`,
        `    link: ${f.link}`,
    ]),
    '---',
    '',
    '> This manual is **generated** from the owa-robot-test source of truth',
    '> (`user-workflows.md`). Every page is traceable to the coverage matrix and',
    '> re-verified against the live app on each robot run.',
    '',
].join('\n');

writeFileSync(join(OUT_DIR, 'index.md'), home, 'utf8');

const sidebar = sectionsInOrder.map((s) => ({
    text: s,
    collapsed: false,
    items: bySection.get(s).map((w) => ({
        text: `${w.id} — ${w.title}`,
        link: w.url,
    })),
}));

mkdirSync(VITEPRESS_DIR, { recursive: true });
writeFileSync(
    join(VITEPRESS_DIR, 'sidebar.generated.json'),
    JSON.stringify(sidebar, null, 2) + '\n',
    'utf8',
);

// ---------------------------------------------------------------------------
// 4. The machine-readable bridge: docs/test-manifest.json
// ---------------------------------------------------------------------------

const manifest = {
    $comment:
        'Generated by docs/scripts/build-manual.mjs from user-workflows.md. ' +
        'The owa-robot-test skill reads this to drive each W-xx path and mark ' +
        'the coverage-matrix rows each one proves. Do not edit by hand.',
    workflowsVersion,
    generatedFrom: relative(REPO, SOURCE).replace(/\\/g, '/'),
    workflowCount: workflows.length,
    workflows: workflows.map((w) => ({
        id: w.id,
        title: w.title,
        section: w.section,
        page: 'manual-sources/' + w.pageRel.replace(/\\/g, '/'),
        url: w.url,
        verify: w.verify,
        screenshots: w.screenshots,
        steps: w.steps,
    })),
};

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const totalVerify = new Set(workflows.flatMap((w) => w.verify)).size;
console.log(`✓ Parsed ${workflows.length} workflows from user-workflows.md`);
console.log(`✓ Wrote manual pages under ${relative(REPO, OUT_DIR).replace(/\\/g, '/')}/`);
console.log(`✓ Wrote sidebar: ${relative(REPO, join(VITEPRESS_DIR, 'sidebar.generated.json')).replace(/\\/g, '/')}`);
console.log(`✓ Wrote manifest: ${relative(REPO, MANIFEST_PATH).replace(/\\/g, '/')} (${totalVerify} distinct matrix rows referenced)`);
