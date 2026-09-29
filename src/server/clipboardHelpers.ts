import { electronSendAsync } from './electronSendHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

// Use the same OS clipboard in every window without Chromium's focus-dependent
// text API. No private clipboard cache: external copies must take effect too.
export async function writeTextToClipboard(text: string): Promise<boolean> {
    if (text.length === 0) {
        return false;
    }
    try {
        if (
            await electronSendAsync<boolean>('main:app:write-clipboard-text', {
                text,
            })
        ) {
            return true;
        }
    } catch {
        // Clipboard trouble should not become an unhandled renderer error.
    }
    showSimpleToast(
        tran('Copy failed'),
        tran('Could not copy to the clipboard. Try again.'),
    );
    return false;
}

export async function readTextFromClipboard(): Promise<string | null> {
    try {
        return await electronSendAsync<string>('main:app:read-clipboard-text');
    } catch {
        return null;
    }
}
