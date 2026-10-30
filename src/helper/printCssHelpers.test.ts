// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { collectFontFaceCss, resolveCssUrls } from './printCssHelpers';

function addStyle(cssText: string) {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
    return style;
}

// jsdom parses `@font-face` into its own `CSSFontFaceRule` class but does not
// put that class on the window, so the module's `instanceof` needs it there.
function stubFontFaceRuleClass() {
    const probe = addStyle('@font-face { font-family: probe; }');
    const ruleClass = (probe.sheet as CSSStyleSheet).cssRules[0].constructor;
    probe.remove();
    vi.stubGlobal('CSSFontFaceRule', ruleClass);
}

describe('resolveCssUrls', () => {
    test('makes every relative url absolute against the given base', () => {
        expect(
            resolveCssUrls(
                'src: url(fonts/a.woff2) format("woff2"), ' +
                    "url('../b.woff') format('woff'), " +
                    'url( "c.ttf" );',
                'https://cdn.example/css/site.css',
            ),
        ).toBe(
            'src: url(https://cdn.example/css/fonts/a.woff2) format("woff2"), ' +
                "url('https://cdn.example/b.woff') format('woff'), " +
                'url("https://cdn.example/css/c.ttf");',
        );
    });

    test('leaves absolute and data urls pointing where they did', () => {
        const cssText =
            'url(https://fonts.example/x.woff2) url(data:font/woff2;base64,AAAA)';
        expect(resolveCssUrls(cssText, 'https://cdn.example/css/')).toBe(
            cssText,
        );
    });

    test('resolves against the document when no base is given', () => {
        expect(resolveCssUrls('url(fonts/k.woff2)')).toBe(
            `url(${new URL('fonts/k.woff2', document.baseURI).href})`,
        );
    });
});

describe('collectFontFaceCss', () => {
    beforeEach(() => {
        stubFontFaceRuleClass();
    });

    afterEach(() => {
        document.head.innerHTML = '';
        delete (document as { styleSheets?: unknown }).styleSheets;
        vi.unstubAllGlobals();
    });

    test('copies only the font rules the printed page names, urls made absolute', () => {
        addStyle(
            '@font-face { font-family: "app-Battambang"; ' +
                'src: url(fonts/battambang-400.woff2); font-weight: 400; }' +
                '@font-face { font-family: "app-Battambang"; ' +
                'src: url(fonts/battambang-700.woff2); font-weight: 700; }' +
                '@font-face { font-family: "app-Unused"; src: url(u.woff2); }' +
                '.verse { font-family: "app-Battambang"; }',
        );
        const css = collectFontFaceCss(
            '<p style="font-family: app-Battambang">ព្រះ</p>',
        );
        const rules = css.split('\n');
        expect(rules).toHaveLength(2);
        for (const rule of rules) {
            expect(rule).toMatch(/^@font-face/);
            expect(rule).toContain('app-Battambang');
        }
        expect(css).toContain(
            new URL('fonts/battambang-400.woff2', document.baseURI).href,
        );
        expect(css).toContain(
            new URL('fonts/battambang-700.woff2', document.baseURI).href,
        );
        expect(css).not.toContain('app-Unused');
        expect(css).not.toContain('.verse');
    });

    test('a page that names no app font needs no rules', () => {
        addStyle('@font-face { font-family: "app-Khmer"; src: url(k.woff2); }');
        expect(collectFontFaceCss('<p>Hello</p>')).toBe('');
    });

    test('a rule with no family is skipped', () => {
        addStyle('@font-face { src: url(nameless.woff2); }');
        expect(collectFontFaceCss('<p>nameless</p>')).toBe('');
    });

    test('a sheet that cannot be read is skipped, and a linked sheet resolves against its own address', () => {
        const parsed = addStyle(
            '@font-face { font-family: "app-Kantumruy"; src: url(kantumruy.woff2); }',
        ).sheet as CSSStyleSheet;
        const unreadableSheet = {
            href: 'https://other.example/locked.css',
            get cssRules(): CSSRuleList {
                throw new DOMException('cross-origin', 'SecurityError');
            },
        };
        const linkedSheet = {
            href: 'https://cdn.example/css/fonts.css',
            cssRules: parsed.cssRules,
        };
        Object.defineProperty(document, 'styleSheets', {
            configurable: true,
            value: [unreadableSheet, linkedSheet],
        });
        expect(
            collectFontFaceCss(
                '<span style="font-family: app-Kantumruy">x</span>',
            ),
        ).toContain('url(https://cdn.example/css/kantumruy.woff2)');
    });
});
