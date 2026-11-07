// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import {
    UI_TEXT_DIRECTION_ATTRIBUTE,
    UI_TEXT_DIRECTION_CSS,
    UI_TEXT_DIRECTION_STYLE_ID,
    applyUiTextDirection,
} from './langTextDirectionHelpers';

function findStyles() {
    return document.head.querySelectorAll(
        `style#${UI_TEXT_DIRECTION_STYLE_ID}`,
    );
}

afterEach(() => {
    findStyles().forEach((style) => {
        style.remove();
    });
    document.documentElement.removeAttribute(UI_TEXT_DIRECTION_ATTRIBUTE);
    document.documentElement.removeAttribute('dir');
});

describe('UI text direction', () => {
    test('a right-to-left UI never mirrors the window', () => {
        // What the first Hebrew pass did, and what flipped every English
        // Bible, title and fallback label with it.
        document.documentElement.dir = 'rtl';

        applyUiTextDirection(true);

        expect(document.documentElement.hasAttribute('dir')).toBe(false);
        expect(
            document.documentElement.getAttribute(UI_TEXT_DIRECTION_ATTRIBUTE),
        ).toBe('rtl');
    });

    test('injects the rule once, however many times a window boots', () => {
        applyUiTextDirection(true);
        applyUiTextDirection(true);

        const styles = findStyles();
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe(UI_TEXT_DIRECTION_CSS);
        expect(styles[0].parentElement).toBe(document.head);
    });

    test('a left-to-right UI takes the rule and the mark away again', () => {
        applyUiTextDirection(true);

        applyUiTextDirection(false);

        expect(findStyles()).toHaveLength(0);
        expect(
            document.documentElement.hasAttribute(UI_TEXT_DIRECTION_ATTRIBUTE),
        ).toBe(false);
        expect(document.documentElement.hasAttribute('dir')).toBe(false);
    });

    test('a left-to-right UI adds nothing', () => {
        applyUiTextDirection(false);

        expect(findStyles()).toHaveLength(0);
        expect(
            document.documentElement.hasAttribute(UI_TEXT_DIRECTION_ATTRIBUTE),
        ).toBe(false);
    });

    test('the rule loses to any app stylesheet and spares what sets its own direction', () => {
        // Specificity zero: any rule of the app that sets `unicode-bidi`
        // itself wins. A `dir` element (a Bible view), bdo/bdi and the
        // left-ellipsis labels, whose `direction: rtl` plaintext would undo,
        // are left out.
        expect(UI_TEXT_DIRECTION_CSS).toMatch(
            /:where\(body \*:not\(\[dir\], bdo, bdi, \.app-ellipsis-left\)\) \{\s*unicode-bidi: plaintext;/,
        );
        // Everything inside a declared direction, Monaco and SVG text go back
        // to the browser's own, the later rule winning the tie.
        expect(UI_TEXT_DIRECTION_CSS).toMatch(
            /:where\(\[dir\] \*, \.monaco-editor \*, svg \*\) \{\s*unicode-bidi: revert;\s*\}/,
        );
        expect(
            UI_TEXT_DIRECTION_CSS.indexOf('unicode-bidi: revert'),
        ).toBeGreaterThan(UI_TEXT_DIRECTION_CSS.indexOf('plaintext'));
        // An icon's one-sided Bootstrap gap is split over both sides, since a
        // Hebrew label puts the icon on its other side.
        expect(UI_TEXT_DIRECTION_CSS).toContain(
            '.bi.me-1, .bi.ms-1 { margin-inline: 0.125rem !important; }',
        );
        expect(UI_TEXT_DIRECTION_CSS).toContain(
            '.bi.me-2, .bi.ms-2 { margin-inline: 0.25rem !important; }',
        );
        // Nothing jsdom (or an older engine) cannot parse.
        expect(UI_TEXT_DIRECTION_CSS).not.toContain('@layer');
    });
});
