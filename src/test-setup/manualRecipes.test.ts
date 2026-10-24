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

type SignalType = {
    key?: string;
    items: { at: string; text: string }[];
};

let signalListCache: SignalType[] | null = null;
function readSignal(key: string) {
    if (signalListCache === null) {
        const result = spawnSync(
            process.execPath,
            [SCRIPT_PATH, '--check=manual', '--json'],
            { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
        );
        expect(result.status, result.stderr).toBe(0);
        signalListCache = JSON.parse(result.stdout).manual as SignalType[];
    }
    const signal = signalListCache.find((one) => one.key === key);
    expect(signal, `the manual check has no "${key}" signal`).toBeDefined();
    return signal!.items.map((item) => `${item.at}  ${item.text}`);
}

// The in-app assistant answers from the manual's recipes, and a QA run finds
// its way by the coverage rows. A recipe went on sending people to an
// "Appearance card" for six weeks after the card was deleted, because nothing
// read the manual against the code. A hit here is fixed in the document
// (`/owa-enhance-agent-docs`), or, when the label is another program's, filed
// in that skill's `references/killed-leads.json` with its reason.
// Whichever test runs first spawns the audit over the whole repo: ~1 s alone,
// past the 10 s default while the full suite holds every core (2026-10-24).
describe('the manual names only what the code still has', () => {
    test('no recipe names a label that no code draws', () => {
        expect(readSignal('dead-label')).toEqual([]);
    }, 60000);

    test('no coverage row cites a source file that is gone', () => {
        expect(readSignal('gone-file')).toEqual([]);
    }, 60000);
});
