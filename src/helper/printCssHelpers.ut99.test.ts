// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { collectFontFaceCss, resolveCssUrls } from './printCssHelpers';

describe('resolveCssUrls', () => {
    test('every url() form is made absolute against the base', () => {
        const css =
            '@font-face { src: url("fonts/a.woff2"), url( \'b.ttf\' ),' +
            ' URL(../c.otf); }';
        expect(resolveCssUrls(css, 'https://app.local/css/site.css')).toBe(
            '@font-face { src: url("https://app.local/css/fonts/a.woff2"),' +
                " url('https://app.local/css/b.ttf')," +
                ' url(https://app.local/c.otf); }',
        );
    });

    test('without a base it resolves against the document', () => {
        expect(resolveCssUrls('src: url(fonts/x.woff)')).toBe(
            `src: url(${new URL('fonts/x.woff', document.baseURI).href})`,
        );
    });

    test('absolute and data urls are kept as they are', () => {
        const css =
            'src: url(data:font/woff2;base64,AAAA), url(https://cdn.example/f.ttf)';
        expect(resolveCssUrls(css, 'https://app.local/')).toBe(css);
    });

    test('text with no url() is untouched', () => {
        expect(resolveCssUrls('body { color: red; }')).toBe(
            'body { color: red; }',
        );
    });
});

describe('collectFontFaceCss', () => {
    const originalFontFaceRule = (globalThis as any).CSSFontFaceRule;

    afterEach(() => {
        (globalThis as any).CSSFontFaceRule = originalFontFaceRule;
        delete (document as any).styleSheets;
        document.head.innerHTML = '';
    });

    describe('with the stylesheets jsdom parses', () => {
        beforeEach(() => {
            const style = document.createElement('style');
            style.textContent =
                '@font-face { font-family: "app-Xx-Face";' +
                ' src: url(fonts/xx-face.woff2); }\n' +
                "@font-face { font-family: 'app-Unused';" +
                ' src: url(fonts/unused.woff2); }\n' +
                '.verse { font-family: app-Xx-Face; }';
            document.head.appendChild(style);
            // jsdom parses @font-face into its own rule class but does not
            // expose it as a global; the helper needs it for `instanceof`.
            const firstRule = document.styleSheets[0].cssRules[0];
            (globalThis as any).CSSFontFaceRule =
                Object.getPrototypeOf(firstRule).constructor;
        });

        test('copies only the rules of families the printed HTML uses', () => {
            const css = collectFontFaceCss(
                '<p style="font-family: app-Xx-Face">✝</p>',
            );
            const expectedUrl = new URL('fonts/xx-face.woff2', document.baseURI)
                .href;
            expect(css).toContain('app-Xx-Face');
            expect(css).toContain(`url(${expectedUrl})`);
            expect(css).not.toContain('app-Unused');
            expect(css).not.toContain('.verse');
        });

        test('nothing referenced, nothing copied', () => {
            expect(collectFontFaceCss('<p>plain</p>')).toBe('');
        });
    });

    describe('with stand-in sheets', () => {
        class FakeFontFaceRule {
            readonly style: { getPropertyValue: (name: string) => string };
            constructor(
                readonly cssText: string,
                family: string,
            ) {
                this.style = {
                    getPropertyValue: (name: string) => {
                        return name === 'font-family' ? family : '';
                    },
                };
            }
        }

        function setStyleSheets(sheets: unknown[]) {
            Object.defineProperty(document, 'styleSheets', {
                configurable: true,
                get: () => sheets,
            });
        }

        beforeEach(() => {
            (globalThis as any).CSSFontFaceRule = FakeFontFaceRule;
        });

        test('a linked sheet resolves its font urls against its own href', () => {
            setStyleSheets([
                {
                    href: 'https://app.local/assets/fonts.css',
                    cssRules: [
                        new FakeFontFaceRule(
                            '@font-face { src: url(xx.woff2) }',
                            '"Made Up Sans"',
                        ),
                    ],
                },
            ]);
            expect(collectFontFaceCss('font-family: Made Up Sans')).toBe(
                '@font-face { src: url(https://app.local/assets/xx.woff2) }',
            );
        });

        test('a sheet whose rules cannot be read (cross-origin) is skipped', () => {
            setStyleSheets([
                {
                    href: 'https://cdn.example/x.css',
                    get cssRules(): never {
                        throw new DOMException('blocked', 'SecurityError');
                    },
                },
                {
                    href: null,
                    cssRules: [new FakeFontFaceRule('@font-face {a}', 'Alpha')],
                },
            ]);
            expect(collectFontFaceCss('Alpha')).toBe('@font-face {a}');
        });

        test('rules that are not @font-face, or name no family, are ignored', () => {
            setStyleSheets([
                {
                    href: null,
                    cssRules: [
                        { cssText: '.Alpha { color: red }' },
                        new FakeFontFaceRule('@font-face {empty}', '  ""  '),
                        new FakeFontFaceRule('@font-face {alpha}', 'Alpha'),
                    ],
                },
            ]);
            expect(collectFontFaceCss('Alpha ""')).toBe('@font-face {alpha}');
        });

        test('every weight of a used family comes along, joined by newlines', () => {
            setStyleSheets([
                {
                    href: null,
                    cssRules: [
                        new FakeFontFaceRule('@font-face {w400}', 'Alpha'),
                        new FakeFontFaceRule('@font-face {beta}', 'Beta'),
                    ],
                },
                {
                    href: null,
                    cssRules: [
                        new FakeFontFaceRule('@font-face {w700}', "'Alpha'"),
                    ],
                },
            ]);
            expect(collectFontFaceCss('Alpha')).toBe(
                '@font-face {w400}\n@font-face {w700}',
            );
        });

        test('the printed HTML is searched once per family, however many rules', () => {
            setStyleSheets([
                {
                    href: null,
                    cssRules: [
                        new FakeFontFaceRule('@font-face {1}', 'Alpha'),
                        new FakeFontFaceRule('@font-face {2}', 'Alpha'),
                        new FakeFontFaceRule('@font-face {3}', 'Beta'),
                        new FakeFontFaceRule('@font-face {4}', 'Alpha'),
                    ],
                },
            ]);
            const searched: string[] = [];
            // Tens of MB of inlined images in real life: count the scans.
            const printedHtml = {
                includes: (family: string) => {
                    searched.push(family);
                    return family === 'Alpha';
                },
            };
            expect(collectFontFaceCss(printedHtml as any)).toBe(
                '@font-face {1}\n@font-face {2}\n@font-face {4}',
            );
            expect(searched).toEqual(['Alpha', 'Beta']);
        });
    });
});
