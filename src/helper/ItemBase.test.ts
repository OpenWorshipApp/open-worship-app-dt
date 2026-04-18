import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getInstanceMock } = vi.hoisted(() => ({
    getInstanceMock: vi.fn(),
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: getInstanceMock,
    },
}));

vi.mock('./helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

import { ItemBase } from './ItemBase';

class TestItem extends ItemBase {
    id: number;
    filePath?: string | null;
    private _metadata: Record<string, unknown>;
    readonly saveMock = vi.fn(async (_value?: unknown) => true);

    constructor(
        id: number,
        filePath: string | null = '/files/item.json',
        metadata: Record<string, unknown> = {},
    ) {
        super();
        this.id = id;
        this.filePath = filePath;
        this._metadata = metadata;
    }

    get metadata() {
        return this._metadata;
    }

    set metadata(metadata: Record<string, unknown>) {
        this._metadata = metadata;
    }

    async save(_: unknown = undefined) {
        return this.saveMock(_);
    }

    clone() {
        return new TestItem(
            this.id,
            this.filePath ?? null,
            structuredClone(this._metadata),
        );
    }
}

describe('ItemBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstanceMock.mockReturnValue({ filePath: '/files/item.json' });
    });

    test('compares items by id', () => {
        const item = new TestItem(10);

        expect(item.checkIsSame(new TestItem(10))).toBe(true);
        expect(item.checkIsSame(new TestItem(11))).toBe(false);
    });

    test('reads and writes the color note through metadata', async () => {
        const originalMetadata = { nested: { value: 1 } };
        const item = new TestItem(1, '/files/item.json', originalMetadata);

        expect(await item.getColorNote()).toBeNull();

        await item.setColorNote('blue');

        expect(item.saveMock).toHaveBeenCalledTimes(1);
        expect(item.metadata).toEqual({
            nested: { value: 1 },
            colorNote: 'blue',
        });
        expect(item.metadata).not.toBe(originalMetadata);
    });

    test('uses FileSource when a file path is present', () => {
        const item = new TestItem(1, '/files/item.json');

        expect(item.fileSource).toEqual({ filePath: '/files/item.json' });
        expect(getInstanceMock).toHaveBeenCalledWith('/files/item.json');
    });

    test('returns null fileSource when filePath is missing', () => {
        const item = new TestItem(1, null);

        expect(item.fileSource).toBeNull();
        expect(getInstanceMock).not.toHaveBeenCalled();
    });

    test('throws for unimplemented editing accessors and methods', async () => {
        const item = new TestItem(1);

        expect(() => item.isSelectedEditing).toThrow('Method not implemented.');
        expect(() => {
            item.isSelectedEditing = true;
        }).toThrow('Method not implemented.');
        expect(() => item.toJson()).toThrow('Method not implemented.');
        expect(() => ItemBase.fromJson({})).toThrow('Method not implemented.');
        expect(() => ItemBase.fromJsonError({})).toThrow(
            'Method not implemented.',
        );
        expect(() => ItemBase.validate({})).toThrow('Method not implemented.');
        await expect(item.save(undefined)).resolves.toBe(true);
    });
});
