import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { clipboard } = vi.hoisted(() => ({
    clipboard: { writeText: vi.fn(), readText: vi.fn() },
}));
vi.mock('electron', () => ({ clipboard }));
import { writeClipboardText } from './clipboardHelpers';

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('does not read or acknowledge before the asynchronous write finishes', async () => {
    let complete!: () => void;
    clipboard.writeText.mockReturnValue(
        new Promise<void>((resolve) => {
            complete = resolve;
        }),
    );
    clipboard.readText.mockResolvedValue('copied');
    const pending = writeClipboardText('copied');
    expect(clipboard.readText).not.toHaveBeenCalled();
    complete();
    await expect(pending).resolves.toBe(true);
});

test('acknowledges a readable copy, accepting OS newline normalization', async () => {
    clipboard.readText.mockReturnValue('first\r\nsecond');
    await expect(writeClipboardText('first\nsecond')).resolves.toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
});

test('retries a temporary refusal and stops after success', async () => {
    clipboard.readText.mockReturnValueOnce('').mockReturnValue('copied');
    const pending = writeClipboardText('copied');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledTimes(2);
});

test.each(['empty', 'throw', 'reject'])(
    'does not claim success when the clipboard stays %s',
    async (kind) => {
        clipboard.readText.mockReturnValue('');
        if (kind === 'throw') {
            clipboard.writeText.mockImplementation(() => {
                throw new Error('busy');
            });
        }
        if (kind === 'reject') {
            clipboard.writeText.mockRejectedValue(new Error('busy'));
        }
        const pending = writeClipboardText('copied');
        await vi.runAllTimersAsync();
        await expect(pending).resolves.toBe(false);
        expect(clipboard.writeText).toHaveBeenCalledTimes(3);
    },
);

test('an old retry cannot overwrite a newer copy', async () => {
    clipboard.readText.mockReturnValueOnce('').mockReturnValue('new');
    const oldCopy = writeClipboardText('old');
    await expect(writeClipboardText('new')).resolves.toBe(true);
    await vi.runAllTimersAsync();
    await expect(oldCopy).resolves.toBe(false);
    expect(clipboard.writeText.mock.calls).toEqual([['old'], ['new']]);
});

test.each([null, 1, {}, ''])(
    'rejects invalid or empty text without clearing existing clipboard: %s',
    async (value) => {
        await expect(writeClipboardText(value)).resolves.toBe(false);
        expect(clipboard.writeText).not.toHaveBeenCalled();
    },
);
