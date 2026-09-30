// Fonts for "Export to PPTX": which installed font a slide's text is really
// drawn in, per glyph. A browser silently falls back to another font for a
// glyph the requested one does not have (the Latin "(DOXOLOGY #2)" set in the
// Khmer-only Moul), while PowerPoint draws empty boxes instead — or nothing at
// all. So the exporter asks the browser, with the same canvas text engine the
// slide was laid out with, which font each stretch of text actually came from,
// and names THAT font in the PPTX.
//
// Everything is cached per export on the resolver instance and dropped with
// it; nothing outlives the export.

import { getFontFamilyMapByNodeFont } from '../server/fontHelpers';
import appProvider from '../server/appProvider';

const GENERIC_FAMILY_SET = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'ui-rounded',
    '-apple-system',
    'blinkmacsystemfont',
    'emoji',
    'math',
    'fangsong',
]);

type PlatformFontsType = {
    genericMap: Record<string, string>;
    // Chromium's "standard" font: what a glyph falls back to once every family
    // an element names has been tried.
    standard: string;
    fallbackList: string[];
};

function getPlatformFonts(): PlatformFontsType {
    const { isMac, isWindows } = appProvider.systemUtils;
    if (isWindows) {
        return {
            genericMap: {
                serif: 'Times New Roman',
                'sans-serif': 'Arial',
                monospace: 'Courier New',
                cursive: 'Comic Sans MS',
                fantasy: 'Impact',
                'system-ui': 'Segoe UI',
                'ui-sans-serif': 'Segoe UI',
                'ui-serif': 'Times New Roman',
                'ui-monospace': 'Consolas',
                'ui-rounded': 'Segoe UI',
                '-apple-system': 'Segoe UI',
                blinkmacsystemfont: 'Segoe UI',
                emoji: 'Segoe UI Emoji',
            },
            standard: 'Times New Roman',
            fallbackList: [
                'Times New Roman',
                'Segoe UI',
                'Arial',
                'Khmer UI',
                'Leelawadee UI',
                'DaunPenh',
                'Segoe UI Symbol',
                'Segoe UI Emoji',
            ],
        };
    }
    if (isMac) {
        return {
            genericMap: {
                serif: 'Times',
                'sans-serif': 'Helvetica',
                monospace: 'Courier',
                cursive: 'Apple Chancery',
                fantasy: 'Papyrus',
                'system-ui': 'Helvetica Neue',
                'ui-sans-serif': 'Helvetica Neue',
                'ui-serif': 'Times',
                'ui-monospace': 'Menlo',
                'ui-rounded': 'Helvetica Neue',
                '-apple-system': 'Helvetica Neue',
                blinkmacsystemfont: 'Helvetica Neue',
                emoji: 'Apple Color Emoji',
            },
            standard: 'Times',
            fallbackList: [
                'Times',
                'Helvetica Neue',
                'Helvetica',
                'Khmer Sangam MN',
                'Khmer MN',
                'Apple Color Emoji',
            ],
        };
    }
    return {
        genericMap: {
            serif: 'DejaVu Serif',
            'sans-serif': 'DejaVu Sans',
            monospace: 'DejaVu Sans Mono',
            'system-ui': 'DejaVu Sans',
            'ui-sans-serif': 'DejaVu Sans',
            'ui-serif': 'DejaVu Serif',
            'ui-monospace': 'DejaVu Sans Mono',
            '-apple-system': 'DejaVu Sans',
            blinkmacsystemfont: 'DejaVu Sans',
            emoji: 'Noto Color Emoji',
        },
        standard: 'DejaVu Serif',
        fallbackList: [
            'DejaVu Serif',
            'DejaVu Sans',
            'Liberation Serif',
            'Liberation Sans',
            'Noto Sans Khmer',
            'Khmer OS',
            'Noto Color Emoji',
        ],
    };
}

// `font-family` exactly as computed — `Moul`, `"Khmer OS", serif`,
// `system-ui, -apple-system, "Segoe UI"` — as a plain list of names.
export function parseFontFamilyList(fontFamily: string) {
    const familyList: string[] = [];
    let current = '';
    let quote: string | null = null;
    for (const char of fontFamily) {
        if (quote !== null) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
        } else if (char === ',') {
            familyList.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    familyList.push(current.trim());
    return familyList.filter((family) => {
        return family !== '';
    });
}

export function checkIsGenericFontFamily(family: string) {
    return GENERIC_FAMILY_SET.has(family.toLowerCase());
}

function quoteFamily(family: string) {
    if (checkIsGenericFontFamily(family)) {
        return family;
    }
    return `"${family.replaceAll('"', '')}"`;
}

export type PptxFontSpecType = {
    // the computed `font-family`, unparsed
    familyList: string;
    // px
    size: number;
    weight: string;
    style: string;
};

export type PptxFontSegmentType = {
    text: string;
    fontFamily: string;
};

export type PptxFontMetricsType = {
    // px, what the browser lays the inline box out with
    ascent: number;
    descent: number;
};

const graphemeSegmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
});

const KHMER_COENG = '\u17d2';

// Grapheme clusters, with one repair: Unicode's cluster rules have no conjunct
// rule for Khmer, so `ស្រី` segments as `ស្` + `រី` — a coeng (the sign that
// turns the next consonant into a subscript) is kept with what follows it, or
// a syllable would be measured, and could be re-fonted, in two halves.
export function splitGraphemes(text: string) {
    const graphemeList: string[] = [];
    for (const { segment } of graphemeSegmenter.segment(text)) {
        const last = graphemeList[graphemeList.length - 1];
        if (last?.endsWith(KHMER_COENG)) {
            graphemeList[graphemeList.length - 1] = last + segment;
        } else {
            graphemeList.push(segment);
        }
    }
    return graphemeList;
}

export class PptxFontResolver {
    private readonly context: CanvasRenderingContext2D;
    private readonly platformFonts = getPlatformFonts();
    // lower-case family name -> installed name, `null` until loaded, empty
    // when the list could not be read (then every family counts as installed)
    private installedFamilyMap: Map<string, string> | null = null;
    private readonly widthCache = new Map<string, number>();
    private readonly coverageCache = new Map<string, boolean>();

    constructor() {
        const context = document.createElement('canvas').getContext('2d');
        if (context === null) {
            throw new Error('Unable to measure text: no canvas context');
        }
        this.context = context;
    }

    async init() {
        const fontMap = await getFontFamilyMapByNodeFont();
        this.installedFamilyMap = new Map(
            Object.keys(fontMap ?? {}).map((family) => {
                return [family.trim().toLowerCase(), family.trim()];
            }),
        );
    }

    private findInstalledFamily(family: string) {
        const installedFamilyMap = this.installedFamilyMap;
        if (installedFamilyMap === null || installedFamilyMap.size === 0) {
            return family;
        }
        return installedFamilyMap.get(family.toLowerCase()) ?? null;
    }

    // The font the browser uses for the text's metrics and for every glyph it
    // has: the first family in the list that exists, a generic name standing
    // for the platform font it maps to.
    resolvePrimaryFamily(familyList: string) {
        for (const family of parseFontFamilyList(familyList)) {
            if (checkIsGenericFontFamily(family)) {
                return (
                    this.platformFonts.genericMap[family.toLowerCase()] ??
                    this.platformFonts.standard
                );
            }
            const installed = this.findInstalledFamily(family);
            if (installed !== null) {
                return installed;
            }
        }
        return this.platformFonts.standard;
    }

    private toFont(spec: PptxFontSpecType, familyList: string) {
        // weight and style only; a font's stretch or small caps would not
        // change which font draws a glyph
        return `${spec.style} ${spec.weight} ${spec.size}px ${familyList}`;
    }

    private measureWidth(font: string, text: string) {
        const key = `${font}\u0000${text}`;
        let width = this.widthCache.get(key);
        if (width === undefined) {
            this.context.font = font;
            width = this.context.measureText(text).width;
            this.widthCache.set(key, width);
        }
        return width;
    }

    // Whether `family` itself draws `grapheme`. Measured twice, once with a
    // monospace and once with a serif behind it: a font that has the glyph
    // measures the same both ways, one that lacks it takes the fallback's
    // width. If both fallbacks lack it too, the system's own fallback draws
    // all four measurements alike — which must NOT read as "covered".
    private checkIsCovered(
        family: string,
        grapheme: string,
        spec: PptxFontSpecType,
    ) {
        const key = `${family}\u0000${spec.weight}\u0000${spec.style}\u0000${grapheme}`;
        let isCovered = this.coverageCache.get(key);
        if (isCovered === undefined) {
            const probeSpec = { ...spec, size: 64 };
            const quoted = quoteFamily(family);
            const withMonospace = this.measureWidth(
                this.toFont(probeSpec, `${quoted}, monospace`),
                grapheme,
            );
            const withSerif = this.measureWidth(
                this.toFont(probeSpec, `${quoted}, serif`),
                grapheme,
            );
            if (Math.abs(withMonospace - withSerif) > 0.01) {
                isCovered = false;
            } else {
                const monospaceOnly = this.measureWidth(
                    this.toFont(probeSpec, 'monospace'),
                    grapheme,
                );
                const serifOnly = this.measureWidth(
                    this.toFont(probeSpec, 'serif'),
                    grapheme,
                );
                isCovered = !(
                    Math.abs(withMonospace - monospaceOnly) <= 0.01 &&
                    Math.abs(withSerif - serifOnly) <= 0.01
                );
            }
            this.coverageCache.set(key, isCovered);
        }
        return isCovered;
    }

    private checkIsWhitespace(grapheme: string) {
        return /^\s+$/u.test(grapheme);
    }

    // The font a run of glyphs the primary font lacks was drawn in: the next
    // families the element names, then the platform's own fallbacks, picked by
    // the width the browser actually gave that run.
    private resolveFallbackFamily(
        text: string,
        spec: PptxFontSpecType,
        primaryFamily: string,
    ) {
        const candidateList: string[] = [];
        for (const family of parseFontFamilyList(spec.familyList)) {
            if (checkIsGenericFontFamily(family)) {
                const mapped =
                    this.platformFonts.genericMap[family.toLowerCase()];
                if (mapped !== undefined) {
                    candidateList.push(mapped);
                }
                continue;
            }
            const installed = this.findInstalledFamily(family);
            if (installed !== null) {
                candidateList.push(installed);
            }
        }
        candidateList.push(...this.platformFonts.fallbackList);
        const graphemeList = splitGraphemes(text).filter((grapheme) => {
            return !this.checkIsWhitespace(grapheme);
        });
        const renderedWidth = this.measureWidth(
            this.toFont(spec, spec.familyList),
            text,
        );
        let firstCovering: string | null = null;
        for (const candidate of candidateList) {
            if (candidate.toLowerCase() === primaryFamily.toLowerCase()) {
                continue;
            }
            if (this.findInstalledFamily(candidate) === null) {
                continue;
            }
            const isCovering = graphemeList.every((grapheme) => {
                return this.checkIsCovered(candidate, grapheme, spec);
            });
            if (!isCovering) {
                continue;
            }
            firstCovering ??= candidate;
            const candidateWidth = this.measureWidth(
                this.toFont(spec, quoteFamily(candidate)),
                text,
            );
            if (Math.abs(candidateWidth - renderedWidth) <= 0.5) {
                return candidate;
            }
        }
        return firstCovering ?? primaryFamily;
    }

    // `text` split where the browser switched fonts: glyphs the primary font
    // draws stay with it (so do spaces, which every font has, to keep runs
    // whole), the rest go to the font the browser fell back to.
    splitByFont(text: string, spec: PptxFontSpecType): PptxFontSegmentType[] {
        const primaryFamily = this.resolvePrimaryFamily(spec.familyList);
        const graphemeList = splitGraphemes(text);
        const flagList = graphemeList.map((grapheme) => {
            return (
                this.checkIsWhitespace(grapheme) ||
                this.checkIsCovered(primaryFamily, grapheme, spec)
            );
        });
        if (
            flagList.every((isCovered) => {
                return isCovered;
            })
        ) {
            return [{ text, fontFamily: primaryFamily }];
        }
        const segmentList: { text: string; isCovered: boolean }[] = [];
        graphemeList.forEach((grapheme, index) => {
            const isCovered = flagList[index];
            const last = segmentList[segmentList.length - 1];
            if (last !== undefined && last.isCovered === isCovered) {
                last.text += grapheme;
            } else {
                segmentList.push({ text: grapheme, isCovered });
            }
        });
        return segmentList.map(({ text: segmentText, isCovered }) => {
            return {
                text: segmentText,
                fontFamily: isCovered
                    ? primaryFamily
                    : this.resolveFallbackFamily(
                          segmentText,
                          spec,
                          primaryFamily,
                      ),
            };
        });
    }

    // The ascent and descent of the element's primary font at its size — the
    // same numbers the browser gave the inline box, so the baseline sits at
    // `rect.top + ascent`.
    getMetrics(spec: PptxFontSpecType): PptxFontMetricsType {
        this.context.font = this.toFont(spec, spec.familyList);
        const metrics = this.context.measureText('Hg');
        return {
            ascent: metrics.fontBoundingBoxAscent,
            descent: metrics.fontBoundingBoxDescent,
        };
    }
}

// Where PowerPoint puts the first baseline of a paragraph set to an EXACT line
// spacing, measured from the top of its text area. Measured against PowerPoint
// 16 on Windows (2026-09-21) with Arial, Segoe UI, Times New Roman,
// Battambang, Moul, Khmer OS and Khmer OS Battambang, 37-150px, at the 1.35
// line height every text item uses:
// - a font whose ascent + descent fits the line sits at 75% of the line,
//   whatever its own metrics (Arial, Segoe UI and Times all land on 101px of a
//   135px line);
// - a font taller than its line (every Khmer font above) is centered the way a
//   browser centers it, then lifted by 3% of the font size.
// Both agree with PowerPoint to within a pixel at 1.35; other line heights are
// an approximation (PowerPoint changes its rule near its own single spacing).
export function calcPptxFirstBaseline(
    lineSpacing: number,
    fontSize: number,
    metrics: PptxFontMetricsType,
) {
    const { ascent, descent } = metrics;
    if (ascent + descent <= lineSpacing) {
        return 0.75 * lineSpacing;
    }
    return (lineSpacing + ascent - descent) / 2 - 0.03 * fontSize;
}
