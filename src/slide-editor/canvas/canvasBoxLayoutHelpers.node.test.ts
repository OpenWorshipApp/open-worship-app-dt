import { describe, expect, test, vi } from 'vitest';

// No DOM in this file on purpose: the helper must not reach for one.
vi.mock('../../server/fileHelpers', () => ({
    isSupportedExt: () => true,
    isSupportedMimetype: () => true,
}));

import { genFittedHtmlBoxLayout } from './canvasBoxLayoutHelpers';

describe('genFittedHtmlBoxLayout without a DOM', () => {
    test('measures nothing and returns no layout, so the new box keeps its own size', () => {
        expect(typeof document).toBe('undefined');
        expect(
            genFittedHtmlBoxLayout(
                { html: '<div>verse</div>', fontSize: 45, fontFamily: null },
                1000,
                800,
                { x: 500, y: 400 },
            ),
        ).toBeNull();
    });
});
