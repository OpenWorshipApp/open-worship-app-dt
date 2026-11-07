import { describe, expect, test, vi } from 'vitest';

vi.mock('./FileSource', () => ({
    default: { getInstance: (filePath: string) => ({ filePath }) },
}));
vi.mock('./helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

import { ItemBaseFilePath } from './ItemBase';

// A slide kind that leaves everything it may to the base classes: it has no
// save of its own and no extra card classes.
class PlainSlideItem extends ItemBaseFilePath {
    id = 7;
    filePath = '/slides/welcome.slide';
    private _metadata: Record<string, unknown>;

    constructor(metadata: Record<string, unknown> = {}) {
        super();
        this._metadata = metadata;
    }

    get metadata() {
        return this._metadata;
    }

    set metadata(metadata: Record<string, unknown>) {
        this._metadata = metadata;
    }

    async getItemFilePath() {
        return this.filePath;
    }

    clone() {
        return new PlainSlideItem(structuredClone(this._metadata));
    }
}

describe('ItemBase defaults', () => {
    test('a stored colour note is read back', async () => {
        const item = new PlainSlideItem({ colorNote: '#e53935' });
        await expect(item.getColorNote()).resolves.toBe('#e53935');
    });

    test('an empty colour note reads as none', async () => {
        const item = new PlainSlideItem({ colorNote: '' });
        await expect(item.getColorNote()).resolves.toBeNull();
    });

    test('an item kind without its own save refuses to save', async () => {
        await expect(new PlainSlideItem().save()).rejects.toThrow(
            'Method not implemented.',
        );
    });

    test('a slide kind stamps no extra classes on its card by default', () => {
        expect(new PlainSlideItem().extraClassnames).toBe('');
    });
});
