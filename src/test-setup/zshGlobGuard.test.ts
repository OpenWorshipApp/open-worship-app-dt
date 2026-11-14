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
            tool_input: { command },
        }),
        encoding: 'utf-8',
        env: { ...process.env, SHELL: shell },
    });
    return { status: result.status, message: result.stderr };
}

// zsh aborts a whole command line on an unquoted glob in a `--flag=value`
// word that matches no file ("no matches found"), before the command runs;
// bash passes the word through, so the habit keeps coming back (AD-34).
describe('the zsh flag-glob guard', () => {
    test('refuses an unquoted glob in a flag value, and names the quoted form', () => {
        const { status, message } = runGuard(
            'grep -rn --include=*.ts* "useFoo" src | head',
        );
        expect(status).toBe(2);
        expect(message).toContain("--include='*.ts*'");
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
            expect(runGuard(command).status, command).toBe(0);
        }
    });

    test('skips a here-document body, and reads the line after it', () => {
        expect(
            runGuard("cat > note.txt <<'EOF'\nuse --include=*.ts\nEOF\necho ok")
                .status,
        ).toBe(0);
        expect(
            runGuard("cat <<'EOF'\nbody\nEOF\ngrep --include=*.ts x .").status,
        ).toBe(2);
    });

    test('stays out of other shells and other tools', () => {
        expect(runGuard('grep --include=*.ts x .', '/bin/bash').status).toBe(0);
        expect(
            runGuard('grep --include=*.ts x .', '/bin/zsh', 'Read').status,
        ).toBe(0);
    });
});
