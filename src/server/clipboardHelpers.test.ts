import { beforeEach, expect, test, vi } from 'vitest';

const { send, toast } = vi.hoisted(() => ({ send: vi.fn(), toast: vi.fn() }));
vi.mock('./electronSendHelpers', () => ({ electronSendAsync: send }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: toast }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
import {
    readTextFromClipboard,
    writeTextToClipboard,
} from './clipboardHelpers';

beforeEach(() => vi.resetAllMocks());

test('waits for the main-process acknowledgement', async () => {
    let acknowledge!: (ok: boolean) => void;
    send.mockReturnValue(
        new Promise<boolean>((resolve) => {
            acknowledge = resolve;
        }),
    );
    const pending = writeTextToClipboard('copied');
    expect(send).toHaveBeenCalledWith('main:app:write-clipboard-text', {
        text: 'copied',
    });
    expect(toast).not.toHaveBeenCalled();
    acknowledge(true);
    await expect(pending).resolves.toBe(true);
});

test.each(['refused', 'rejected'])(
    'reports a %s copy without a success toast or rejection',
    async (kind) => {
        if (kind === 'refused') send.mockResolvedValue(false);
        else send.mockRejectedValue(new Error('clipboard unavailable'));
        await expect(writeTextToClipboard('copied')).resolves.toBe(false);
        expect(toast).toHaveBeenCalledExactlyOnceWith(
            'Copy failed',
            'Could not copy to the clipboard. Try again.',
        );
    },
);

test('empty selections leave the clipboard untouched', async () => {
    await expect(writeTextToClipboard('')).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
});

test('reads fresh OS text on each request, including external copies', async () => {
    send.mockResolvedValueOnce('slide').mockResolvedValueOnce('external');
    await expect(readTextFromClipboard()).resolves.toBe('slide');
    await expect(readTextFromClipboard()).resolves.toBe('external');
    expect(send).toHaveBeenLastCalledWith('main:app:read-clipboard-text');
});

test('a denied read is empty to the menu instead of an unhandled rejection', async () => {
    send.mockRejectedValue(new Error('unavailable'));
    await expect(readTextFromClipboard()).resolves.toBeNull();
});
