import { describe, expect, it } from 'vitest';

import {
    toCurrentBackgroundTypeName,
    toCurrentDragTypeName,
    withCurrentBackgroundType,
    withCurrentBackgroundTypeKeys,
    withCurrentDragType,
} from './backgroundFillLegacyHelpers';

describe('a fill saved under its old name', () => {
    it('reads the old names as the fill and leaves every other one alone', () => {
        expect(toCurrentBackgroundTypeName('color')).toBe('fill');
        expect(toCurrentBackgroundTypeName('fill')).toBe('fill');
        expect(toCurrentBackgroundTypeName('image')).toBe('image');
        expect(toCurrentBackgroundTypeName(undefined)).toBeUndefined();
        expect(toCurrentDragTypeName('bg-color')).toBe('bg-fill');
        expect(toCurrentDragTypeName('bg-fill')).toBe('bg-fill');
        expect(toCurrentDragTypeName('bg-image')).toBe('bg-image');
        // Each name only in its own place.
        expect(toCurrentDragTypeName('color')).toBe('color');
        expect(toCurrentBackgroundTypeName('bg-color')).toBe('bg-color');
    });

    it('copies a record only when its type changes', () => {
        const legacy = { type: 'color', src: '#000000' };
        expect(withCurrentBackgroundType(legacy)).toEqual({
            type: 'fill',
            src: '#000000',
        });
        expect(legacy.type).toBe('color');
        const current = { type: 'image', src: 'file://a.png' };
        expect(withCurrentBackgroundType(current)).toBe(current);

        const dropped = { type: 'bg-color', item: '#000000' };
        expect(withCurrentDragType(dropped)).toEqual({
            type: 'bg-fill',
            item: '#000000',
        });
        const other = { type: 'bg-video', item: {} };
        expect(withCurrentDragType(other)).toBe(other);
    });

    it('moves a tab’s transition saved under the old key, the current key winning', () => {
        const map = { image: 'fade', fill: 'zoom' };
        expect(withCurrentBackgroundTypeKeys(map)).toBe(map);
        expect(
            withCurrentBackgroundTypeKeys({ image: 'fade', color: 'slide' }),
        ).toEqual({ image: 'fade', fill: 'slide' });
        expect(
            withCurrentBackgroundTypeKeys({ color: 'slide', fill: 'zoom' }),
        ).toEqual({ fill: 'zoom' });
    });
});
