import { clipboard } from 'electron';

let copyGeneration = 0;

// Electron's clipboard API is asynchronous. Wait for the write and verify it
// before acknowledging; a busy clipboard gets only a short, bounded retry.
export async function writeClipboardText(text: unknown): Promise<boolean> {
    if (typeof text !== 'string' || text.length === 0) {
        return false;
    }
    const expected = text.replace(/\r\n/g, '\n');
    const generation = ++copyGeneration;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            if (generation !== copyGeneration) {
                return false;
            }
        }
        try {
            await clipboard.writeText(text);
            const copied = await clipboard.readText();
            if (generation !== copyGeneration) {
                return false;
            }
            if (copied.replace(/\r\n/g, '\n') === expected) {
                return true;
            }
        } catch {
            // Clipboard contention is recoverable and must not crash main.
        }
    }
    return false;
}
