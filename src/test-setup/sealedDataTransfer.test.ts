import { describe, expect, it } from 'vitest';

import { createSealedDataTransfer } from './sealedDataTransfer';

describe('createSealedDataTransfer', () => {
    it('reads and writes like a drag until it is sealed', () => {
        const { dataTransfer, readData } = createSealedDataTransfer({
            text: 'a',
        });
        expect(dataTransfer.getData('text/plain')).toBe('a');
        dataTransfer.setData('application/x-owa-drag-bibleitem', '');
        expect(dataTransfer.types).toEqual([
            'text/plain',
            'application/x-owa-drag-bibleitem',
        ]);
        expect(readData()).toEqual({
            'text/plain': 'a',
            'application/x-owa-drag-bibleitem': '',
        });
    });

    // The whole point: after the handler has returned, a write is lost and a
    // read is empty, as in a real browser.
    it('ignores a write and answers nothing once sealed', async () => {
        const { dataTransfer, seal, readData } = createSealedDataTransfer();
        const late = (async () => {
            await Promise.resolve();
            dataTransfer.setData('text', 'too late');
            return dataTransfer.getData('text');
        })();
        seal();
        expect(await late).toBe('');
        expect(readData()).toEqual({});
        expect(dataTransfer.types).toEqual([]);
    });
});
