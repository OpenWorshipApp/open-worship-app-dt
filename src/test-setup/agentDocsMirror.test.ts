import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'extra-work', 'sync-agent-mirror.mjs');

function runSync(rootPath: string, ...argList: string[]) {
    const result = spawnSync(
        process.execPath,
        [SCRIPT_PATH, `--root=${rootPath}`, ...argList],
        { encoding: 'utf-8' },
    );
    return { status: result.status, output: result.stdout + result.stderr };
}

let fixtureRoot: string | null = null;

function makeFixture(fileMap: Record<string, string>) {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), 'owa-agent-mirror-'));
    for (const [relPath, content] of Object.entries(fileMap)) {
        const fullPath = path.join(fixtureRoot, relPath);
        mkdirSync(path.dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content);
    }
    return fixtureRoot;
}

function readFixture(relPath: string) {
    return readFileSync(path.join(fixtureRoot!, relPath), 'utf-8');
}

const SKILL_SOURCE = [
    '---',
    'name: demo',
    "description: 'Demo skill, it''s quoted'",
    "argument-hint: '[one | two]'",
    '---',
    '',
    '# Demo',
    '',
    'New body.',
    '',
].join('\n');

const SKILL_PREAMBLE = [
    '---',
    'name: demo',
    'description: Short Codex description.',
    '---',
    '',
    '## Codex usage',
    '',
    'Invoke as `$demo`.',
    '',
    'Arguments: [old]',
    '',
    '### Full workflow scope (preserved from Claude)',
];

afterEach(() => {
    if (fixtureRoot !== null) {
        rmSync(fixtureRoot, { recursive: true, force: true });
        fixtureRoot = null;
    }
});

describe('the Codex mirror of the agent docs', () => {
    test('is in step with .claude/ in this checkout', () => {
        // `.claude/` is the source of truth and the mirror is copied in the
        // SAME change; one fell several revisions and seven memory notes behind
        // while that was only a sentence in CLAUDE.md.
        const { status, output } = runSync(REPO_ROOT, '--check');
        expect(output).toContain('0 out of step');
        expect(status).toBe(0);
    });

    test('fails on a stale copy, and the sync repairs it', () => {
        const root = makeFixture({
            '.claude/CLAUDE.md': 'rules\n',
            '.codex/project-instructions.md': 'rules\n',
            '.claude/memory/note.md': 'the new text\n',
            '.codex/memory/note.md': 'the old text\n',
        });
        const before = runSync(root, '--check');
        expect(before.status).toBe(1);
        expect(before.output).toContain('out of step: .codex/memory/note.md');
        expect(readFixture('.codex/memory/note.md')).toBe('the old text\n');

        expect(runSync(root).status).toBe(0);
        expect(readFixture('.codex/memory/note.md')).toBe('the new text\n');
        expect(runSync(root, '--check').status).toBe(0);
    });

    test('does not count line endings as drift', () => {
        const root = makeFixture({
            '.claude/CLAUDE.md': 'one\ntwo\n',
            '.codex/project-instructions.md': 'one\r\ntwo\r\n',
        });
        expect(runSync(root, '--check').status).toBe(0);
    });

    test('fails on a mirror file whose source is gone', () => {
        const root = makeFixture({
            '.claude/CLAUDE.md': 'rules\n',
            '.codex/project-instructions.md': 'rules\n',
            '.codex/memory/deleted-note.md': 'gone from .claude\n',
        });
        const result = runSync(root, '--check');
        expect(result.status).toBe(1);
        expect(result.output).toContain(
            'no source: .codex/memory/deleted-note.md',
        );
    });

    test("keeps a SKILL.md's Codex preamble and rewrites the rest", () => {
        const root = makeFixture({
            '.claude/CLAUDE.md': 'rules\n',
            '.codex/project-instructions.md': 'rules\n',
            '.claude/skills/demo/SKILL.md': SKILL_SOURCE,
            '.agents/skills/demo/SKILL.md': [
                ...SKILL_PREAMBLE,
                '',
                'An old description.',
                '',
                '# Demo',
                '',
                'Old body.',
                '',
            ].join('\n'),
        });
        expect(runSync(root, '--check').status).toBe(1);

        expect(runSync(root).status).toBe(0);
        expect(readFixture('.agents/skills/demo/SKILL.md')).toBe(
            [
                ...SKILL_PREAMBLE.map((line) => {
                    return line === 'Arguments: [old]'
                        ? 'Arguments: [one | two]'
                        : line;
                }),
                '',
                "Demo skill, it's quoted",
                '',
                '# Demo',
                '',
                'New body.',
                '',
            ].join('\n'),
        );
        expect(runSync(root, '--check').status).toBe(0);
    });

    test('never invents the preamble of a new skill', () => {
        const root = makeFixture({
            '.claude/CLAUDE.md': 'rules\n',
            '.codex/project-instructions.md': 'rules\n',
            '.claude/skills/fresh/SKILL.md': SKILL_SOURCE,
        });
        const result = runSync(root);
        expect(result.status).toBe(1);
        expect(result.output).toContain(
            'by hand: .agents/skills/fresh/SKILL.md -- missing',
        );
    });
});
