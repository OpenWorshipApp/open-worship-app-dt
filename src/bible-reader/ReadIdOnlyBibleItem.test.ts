import { describe, expect, test, vi } from 'vitest';

// The id accessors exactly as `BibleItem` has them; the rest of that class
// reaches the bible database and the app provider, which this never touches.
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        _id: number;
        constructor(id: number) {
            this._id = id;
        }
        get id() {
            return this._id;
        }
        set id(id: number) {
            this._id = id;
        }
    },
}));

import BibleItem from '../bible-list/BibleItem';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

describe('ReadIdOnlyBibleItem', () => {
    test('reads the id it was made with', () => {
        const bibleItem = new (ReadIdOnlyBibleItem as any)(7);
        expect(bibleItem.id).toBe(7);
        expect(bibleItem).toBeInstanceOf(BibleItem);
    });

    test('refuses to have its id changed', () => {
        const bibleItem = new (ReadIdOnlyBibleItem as any)(7);
        expect(() => {
            bibleItem.id = 8;
        }).toThrow('ReadOnlyBibleItem: id cannot be set');
        expect(bibleItem.id).toBe(7);
        // Where a plain bible item would take it.
        const plainItem = new (BibleItem as any)(7);
        plainItem.id = 8;
        expect(plainItem.id).toBe(8);
    });
});
