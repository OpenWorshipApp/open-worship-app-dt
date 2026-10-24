import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), write: vi.fn() }));

vi.mock('node:child_process', () => ({ spawnSync: mocks.spawn }));
vi.mock('node:fs', () => ({
    // A stale successful summary remains on disk from an earlier run.
    existsSync: () => true,
    mkdirSync: () => {},
    readFileSync: () => JSON.stringify({ total: {} }),
    readdirSync: () => [],
    statSync: () => ({ isDirectory: () => false }),
    writeFileSync: mocks.write,
}));

const scriptPath = resolve(
    '.claude/skills/owa-upgrade-unit-test/scripts/coverage-gap.mjs',
);
const initialArgv = process.argv;
let exit: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.resetModules();
    process.argv = [process.execPath, scriptPath, '--surface=src'];
    exit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
});

afterEach(() => {
    process.argv = initialArgv;
});

test.each([
    { status: 1, error: undefined },
    { status: null, error: new Error('Could not launch vitest') },
])(
    'rejects failed coverage runs even when a previous summary exists: %j',
    async (result) => {
        mocks.spawn.mockReturnValue(result);
        await import(scriptPath);
        expect(exit).toHaveBeenCalledWith(1);
        expect(mocks.write).not.toHaveBeenCalled();
        expect(stderr).toHaveBeenCalledWith(
            expect.stringContaining('Refusing to reuse any existing report'),
        );
    },
);

test('allows successful measurement to write its worklist', async () => {
    mocks.spawn.mockReturnValue({ status: 0 });
    await import(scriptPath);
    expect(exit).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledWith(
        expect.stringContaining('worklist.json'),
        expect.any(String),
    );
});
