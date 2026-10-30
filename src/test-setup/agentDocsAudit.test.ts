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
});
