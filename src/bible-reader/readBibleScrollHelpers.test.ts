// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { atBottomMock, partialMock } = vi.hoisted(() => ({
    atBottomMock: vi.fn(() => true),
    partialMock: vi.fn(() => false),
}));

vi.mock('../helper/helpers', () => ({
    checkIsVerticalAtBottom: atBottomMock,
    checkIsVerticalPartialInvisible: partialMock,
}));

import {
    checkIsVerseAtBottom,
    checkIsVersePartialInvisible,
} from './readBibleScrollHelpers';

describe('bible-reader readBibleScrollHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    function buildTree() {
        const container = document.createElement('div');
        container.dataset.scrollVersesContainer = '1';
        const middle = document.createElement('div');
        const target = document.createElement('div');
        middle.appendChild(target);
        container.appendChild(middle);
        document.body.appendChild(container);
        return { container, target };
    }

    test('checkIsVersePartialInvisible walks up to the scroll container', () => {
        const { container, target } = buildTree();
        partialMock.mockReturnValue(true);
        expect(checkIsVersePartialInvisible(target)).toBe(true);
        expect(partialMock).toHaveBeenCalledWith(container, target, 1);
    });

    test('checkIsVerseAtBottom walks up to the scroll container', () => {
        const { container, target } = buildTree();
        expect(checkIsVerseAtBottom(target)).toBe(true);
        expect(atBottomMock).toHaveBeenCalledWith(container, target);
    });

    test('returns null when no scroll container is found', () => {
        const orphan = document.createElement('div');
        document.body.appendChild(orphan);
        expect(checkIsVersePartialInvisible(orphan)).toBeNull();
        expect(checkIsVerseAtBottom(orphan)).toBeNull();
    });
});
