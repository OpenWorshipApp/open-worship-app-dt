import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(
    REPO_ROOT,
    '.claude',
    'skills',
    'owa-enhance-agent-docs',
    'scripts',
    'audit-agent-docs.mjs',
);

// The audit's checks a document fails the day it is written wrong. The agent
// documents teach every Claude session and ship as the in-app assistant's
// knowledge, and until 2026-10-29 (`AD-21`) only the manual's two signals
// were held here (`manualRecipes.test.ts`): the rest waited for somebody to
// run the audit. A rule named `stepHelpHelpers.ts`, a file that never
// existed, for ten days; CLAUDE.md left out four registered tools; and three
// front matters did not parse as YAML (`AD-20`), one hiding a skill's
// description from every session for four days. A hit is fixed in the
// document. A name that is another program's goes in the audit's
// `EXTERNAL_NAME_SET`, one that is history in the skill's
// `references/killed-leads.json`, each with its reason.
const HARD_CHECK_LIST = [
    'paths',
    'symbols',
    'tools',
    'scripts',
    'env',
    'ids',
    'memory',
    'rules',
    'skills',
];
// Printed beside the drift for a person to weigh, not a fault.
const ADVISORY_LABEL_PATTERN = /^skill description lengths/;

type SignalType = {
    label: string;
    items: { at: string; text: string }[];
};

let reportCache: Record<string, SignalType[]> | null = null;
function readSignalList(check: string) {
    if (reportCache === null) {
        const result = spawnSync(
            process.execPath,
            [SCRIPT_PATH, `--check=${HARD_CHECK_LIST.join(',')}`, '--json'],
            { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
        );
        expect(result.status, result.stderr).toBe(0);
        reportCache = JSON.parse(result.stdout) as Record<string, SignalType[]>;
    }
    const signalList = reportCache[check];
    expect(signalList, `the audit printed no "${check}" check`).toBeDefined();
    return signalList;
}

// The first test spawns the audit over the whole repo: a few seconds alone,
// more while the full suite holds every core.
describe('the agent documents name only what the repo has', () => {
    test.each(HARD_CHECK_LIST)(
        'the %s check finds nothing',
        (check) => {
            const hitList = readSignalList(check)
                .filter((signal) => !ADVISORY_LABEL_PATTERN.test(signal.label))
                .flatMap((signal) => {
                    return signal.items.map((item) => {
                        return `${signal.label}: ${item.at}  ${item.text}`;
                    });
                });
            expect(hitList).toEqual([]);
        },
        120000,
    );

    // `AD-27`: the check read only a quoted name handed to `registerTool`, so
    // the five tools registered by a constant were invisible to it (40 of 45)
    // and CLAUDE.md's list lost four of them in silence. The count it prints
    // is held to what the server REALLY registers, asked of a stand-in server
    // that only records the names, in a process of its own.
    test('the tools check counts every owa_* tool the server registers', () => {
        const result = spawnSync(
            process.execPath,
            [
                '--input-type=module',
                '-e',
                [
                    "const url = new URL('./tools/owa-devtools-mcp/owaTools.mjs', 'file:///' + process.cwd().replace(/\\\\/g, '/') + '/');",
                    'const { registerOwaTools } = await import(url.href);',
                    'const nameSet = new Set();',
                    "registerOwaTools({ registerTool: (name) => { nameSet.add(name); return {}; } }, { door: 'stdio' });",
                    "console.log([...nameSet].filter((name) => name.startsWith('owa_')).length);",
                ].join('\n'),
            ],
            { cwd: REPO_ROOT, encoding: 'utf-8' },
        );
        expect(result.status, result.stderr).toBe(0);
        const registeredCount = Number(result.stdout.trim());
        expect(registeredCount).toBeGreaterThan(0);
        const label = readSignalList('tools').find((signal) => {
            return signal.label.startsWith('registered owa_* tools');
        })?.label;
        expect(label).toContain(`(${registeredCount})`);
    }, 120000);
});
