/**
 * CSS plumbing shared by every "print through a separate window" flow (slides,
 * lyric preview). Kept out of the printing modules themselves so a caller does
 * not have to pull a whole renderer in just to copy a few font rules.
 */

export function resolveCssUrls(cssText: string, baseUrl?: string) {
    return cssText.replaceAll(
        /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
        (_match, quote: string, url: string) => {
            const resolved = new URL(url, baseUrl ?? document.baseURI).href;
            return `url(${quote}${resolved}${quote})`;
        },
    );
}

// App-provided fonts (e.g. bible language fonts like `app-Battambang`) exist
// only as @font-face rules injected into this window, so the print window
// needs a copy of every rule the printed HTML references, with the font URLs
// absolutized for it. System fonts resolve there by name and need nothing.
export function collectFontFaceCss(printedHtml: string) {
    const cssTexts: string[] = [];
    // The same family is normally registered by several rules (one per weight),
    // and the printed HTML inlines base64 images and runs to tens of MB, so each
    // distinct name is searched for at most once.
    const isReferencedByFamily = new Map<string, boolean>();
    for (const styleSheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = styleSheet.cssRules;
        } catch (_error) {
            continue;
        }
        // Indexed rather than copied through `Array.from`: a sheet can hold
        // thousands of rules and only the @font-face ones are wanted.
        for (let index = 0; index < rules.length; index++) {
            const rule = rules[index];
            if (!(rule instanceof CSSFontFaceRule)) {
                continue;
            }
            const family = rule.style
                .getPropertyValue('font-family')
                .replaceAll(/["']/g, '')
                .trim();
            if (family === '') {
                continue;
            }
            let isReferenced = isReferencedByFamily.get(family);
            if (isReferenced === undefined) {
                isReferenced = printedHtml.includes(family);
                isReferencedByFamily.set(family, isReferenced);
            }
            if (!isReferenced) {
                continue;
            }
            cssTexts.push(
                resolveCssUrls(rule.cssText, styleSheet.href ?? undefined),
            );
        }
    }
    return cssTexts.join('\n');
}
