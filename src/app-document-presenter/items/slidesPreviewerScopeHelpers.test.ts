// @vitest-environment jsdom
// jsdom because the point of a scope is the selector `document.querySelector`
// reads back for it.

import { afterEach, describe, expect, test } from 'vitest';

import {
    genSlidesPreviewerScope,
    SLIDES_PREVIEWER_SCOPE_KEY,
} from './slidesPreviewerScopeHelpers';

afterEach(() => {
    document.body.innerHTML = '';
});

function addPanel(scopeId: string) {
    const panel = document.createElement('div');
    panel.setAttribute(SLIDES_PREVIEWER_SCOPE_KEY, scopeId);
    document.body.appendChild(panel);
    return panel;
}

describe('genSlidesPreviewerScope', () => {
    test('each previewer gets its own scope, whose selector finds only its own panel', () => {
        const firstRef = { current: null };
        const secondRef = { current: null };
        const first = genSlidesPreviewerScope(firstRef);
        const second = genSlidesPreviewerScope(secondRef);

        expect(first.scopeId).not.toBe(second.scopeId);
        expect(first.containerRef).toBe(firstRef);
        expect(second.containerRef).toBe(secondRef);
        const firstPanel = addPanel(first.scopeId);
        const secondPanel = addPanel(second.scopeId);
        expect([...document.querySelectorAll(first.containerSelector)]).toEqual(
            [firstPanel],
        );
        expect([
            ...document.querySelectorAll(second.containerSelector),
        ]).toEqual([secondPanel]);
    });

    test('an id goes into a selector unescaped, so it holds no character that needs escaping', () => {
        const { scopeId, containerSelector } = genSlidesPreviewerScope({
            current: null,
        });

        expect(scopeId).toMatch(/^[a-z0-9-]+$/);
        expect(containerSelector).toBe(
            `[${SLIDES_PREVIEWER_SCOPE_KEY}="${scopeId}"]`,
        );
    });
});
