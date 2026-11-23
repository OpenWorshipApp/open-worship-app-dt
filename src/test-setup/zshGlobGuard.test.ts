import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    '.claude',
    'skills',
    'owa-enhance-agent-docs',
    'scripts',
    'zsh-glob-guard.mjs',
);

function runGuard(command: string, shell = '/bin/zsh', toolName = 'Bash') {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, 'hook'], {
        input: JSON.stringify({
            tool_name: toolName,
            tool_input: { command, description: 'a step', timeout: 5000 },
        }),
        encoding: 'utf-8',
        env: { ...process.env, SHELL: shell },
    });
    return {
        status: result.status,
        message: result.stderr,
        output: result.stdout === '' ? null : JSON.parse(result.stdout),
    };
}

// zsh aborts a whole command line on an unquoted glob in a `--flag=value`
// word that matches no file ("no matches found"), before the command runs;
// bash passes the word through, so the habit keeps coming back (AD-34).
// Since AD-35 the guard escapes the glob and lets the call go on, leaving
// the permission decision to Claude Code's own rules and prompts.
describe('the zsh flag-glob guard', () => {
    test('escapes an unquoted glob in a flag value and keeps the rest of the input', () => {
        const { status, output } = runGuard(
            'grep -rn --include=*.ts* "useFoo*" src | head',
        );
        expect(status).toBe(0);
        expect(output).toEqual({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                updatedInput: {
                    command:
                        'grep -rn --include=\\*.ts\\* "useFoo*" src | head',
                    description: 'a step',
                    timeout: 5000,
                },
            },
        });
    });

    test('never decides the permission itself', () => {
        const { output } = runGuard('grep --include=*.ts x .');
        expect(output.hookSpecificOutput).not.toHaveProperty(
            'permissionDecision',
        );
        expect(output).not.toHaveProperty('decision');
    });

    test('escapes with backslashes, so a brace list in the word still expands', () => {
        const { output } = runGuard(
            'grep -rn --include=*.{ts,tsx} --exclude=a?b[0-9] x src',
        );
        expect(output.hookSpecificOutput.updatedInput.command).toBe(
            'grep -rn --include=\\*.{ts,tsx} --exclude=a\\?b\\[0-9] x src',
        );
    });

    test('lets a quoted, escaped or bare-word glob through', () => {
        for (const command of [
            "grep -rn --include='*.ts*' useFoo src",
            'grep -rn --include="*.md" useFoo docs',
            'grep -rn --include=\\*.ts useFoo src',
            'ls src/*.ts',
            'node -e \'console.log("--include=*.ts")\'',
            '# --include=*.ts is the trap\necho ok',
        ]) {
            const { status, output } = runGuard(command);
            expect(status, command).toBe(0);
            expect(output, command).toBeNull();
        }
    });

    test('skips a here-document body, and reads the line after it', () => {
        expect(
            runGuard("cat > note.txt <<'EOF'\nuse --include=*.ts\nEOF\necho ok")
                .output,
        ).toBeNull();
        expect(
            runGuard(
                "cat <<'EOF'\nbody --include=*.ts\nEOF\ngrep --include=*.ts x .",
            ).output.hookSpecificOutput.updatedInput.command,
        ).toBe(
            "cat <<'EOF'\nbody --include=*.ts\nEOF\ngrep --include=\\*.ts x .",
        );
    });

    test('stays out of other shells and other tools', () => {
        expect(
            runGuard('grep --include=*.ts x .', '/bin/bash').output,
        ).toBeNull();
        expect(
            runGuard('grep --include=*.ts x .', '/bin/zsh', 'Read').output,
        ).toBeNull();
    });
});
