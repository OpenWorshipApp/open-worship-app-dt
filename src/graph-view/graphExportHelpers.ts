import { handleError } from '../helper/errorHelpers';
import type { SrcData } from '../helper/FileSource';
import { collectFontFaceCss } from '../helper/printCssHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { downloadImageBase64Data } from '../server/appHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { GraphEdgeType, GraphNodeType, GraphNodeViewType } from './core';
import {
    EDGE_ARROW_PATH_D,
    GRAPH_GEOMETRY,
    getEdgeBowIndexMap,
    getEdgeDrawing,
    getEdgeLabelPoint,
    getNodeAnchor,
    getNodeRect,
} from './core';

/**
 * Turning the graph into a standalone picture.
 *
 * ONE serializer feeds both outputs. The boxes on screen are DOM and the edges
 * are SVG, so something has to redraw the whole thing either way; doing it
 * once means the saved image and the printed page can never disagree.
 */

export type GraphExportNodeType = {
    node: GraphNodeType;
    view: GraphNodeViewType | null;
    typeColor: string;
};

/**
 * The drawn width of `text`, in px, at the given size and weight in the
 * export's own font. See `genCanvasTextMeasure`.
 */
export type GraphTextMeasureType = (
    text: string,
    fontSize: number,
    fontWeight: number,
) => number;

export type GraphExportOptionsType = {
    title: string;
    nodeList: GraphExportNodeType[];
    edgeList: GraphEdgeType[];
    // Label AND direction: a saved or printed picture that dropped the
    // arrowheads would leave `child` sitting between two boxes with no way to
    // tell which of them is the child.
    resolveEdge: (edge: GraphEdgeType) => {
        label: string;
        isDirected: boolean;
    };
    pathEdgeKeySet: Set<string>;
    // Read off the live panel so the export matches what is on screen in both
    // themes rather than guessing at colours.
    palette: {
        background: string;
        surface: string;
        ink: string;
        muted: string;
        line: string;
        accent: string;
    };
    fontFamily: string;
    // Without one, a line is cut by its CHARACTER count, which is all a test
    // with no fonts can do — and not enough for a real picture: Khmer runs
    // wider per character than Latin, and a 30-character description drawn
    // past the box's right border.
    measureText?: GraphTextMeasureType;
};

const EXPORT_PADDING = 48;

// One box's text lines, in the box's own units. Measured and drawn with the
// SAME numbers, so a line clipped to fit is the line that is drawn.
const TEXT_LEFT = 10;
const TEXT_RIGHT_PADDING = 8;
const TEXT_MAX_WIDTH =
    GRAPH_GEOMETRY.NODE_WIDTH - TEXT_LEFT - TEXT_RIGHT_PADDING;
const NAME_FONT = { size: 13, weight: 600 };
const KJV_NAME_FONT = { size: 11, weight: 400 };
const CAPTION_FONT = { size: 10, weight: 400 };
const ELLIPSIS = '…';
const KHMER_COENG = '្';

/**
 * Printing always uses a light layout, whatever theme the app is in.
 *
 * The panel is dark in a dark booth, but a dark PDF floods a page with ink and
 * reads badly on paper, so the printed copy is inverted to paper conventions.
 * The per-type accent hues are NOT swapped: they are mid-tone and stay legible
 * as a thin bar on white, and keeping them means the printout still colour-codes
 * the same way the screen does.
 */
export const PRINT_PALETTE = {
    background: '#ffffff',
    surface: '#ffffff',
    ink: '#1a1d20',
    muted: '#5c636a',
    line: '#adb5bd',
    accent: '#0d6efd',
};

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Clips a label to something that fits the box, since SVG text does not wrap
 * and an overflowing name would run across the picture.
 */
function clipText(value: string, maxChars: number) {
    const trimmed = value.trim();
    return trimmed.length <= maxChars
        ? trimmed
        : `${trimmed.slice(0, Math.max(0, maxChars - 1))}${ELLIPSIS}`;
}

/**
 * Cuts a line to what the box can hold, by its DRAWN width.
 *
 * Cut between grapheme clusters, never inside one — a base letter keeps its
 * vowel signs — and never right after a Khmer COENG: the subscript letter it
 * joins is a cluster of its own, and a coeng left at the end of a line draws
 * as a stray mark.
 */
function clipTextToWidth(
    value: string,
    measure: GraphTextMeasureType,
    font: { size: number; weight: number },
    maxWidth: number,
) {
    const trimmed = value.trim();
    const measureLine = (text: string) => {
        return measure(text, font.size, font.weight);
    };
    if (measureLine(trimmed) <= maxWidth) {
        return trimmed;
    }
    const clusterList = Array.from(
        new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
            trimmed,
        ),
        (item) => {
            return item.segment;
        },
    );
    const toPrefix = (count: number) => {
        let prefix = clusterList.slice(0, count).join('').trimEnd();
        while (prefix.endsWith(KHMER_COENG)) {
            prefix = prefix.slice(0, -1);
        }
        return prefix;
    };
    // The longest prefix that still fits with its ellipsis.
    let low = 0;
    let high = clusterList.length - 1;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (measureLine(`${toPrefix(middle)}${ELLIPSIS}`) <= maxWidth) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }
    return `${toPrefix(low)}${ELLIPSIS}`;
}

/**
 * A measurer for `buildGraphSvg`, reading this window's own fonts.
 *
 * `undefined` where there is no canvas to measure with, which leaves the
 * character-count cut.
 */
export function genCanvasTextMeasure(
    fontFamily: string,
): GraphTextMeasureType | undefined {
    const context =
        globalThis.document?.createElement('canvas').getContext('2d') ?? null;
    if (context === null) {
        return undefined;
    }
    return (text, fontSize, fontWeight) => {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
    };
}

/**
 * Makes sure the faces an export measures with are loaded: a canvas measures
 * in a fallback font until the face it asks for has actually arrived.
 */
export async function loadGraphExportFonts(fontFamily: string) {
    const fontFaceSet = globalThis.document?.fonts;
    if (fontFaceSet === undefined) {
        return;
    }
    try {
        await Promise.all(
            [NAME_FONT, KJV_NAME_FONT].map((font) => {
                return fontFaceSet.load(
                    `${font.weight} ${font.size}px ${fontFamily}`,
                );
            }),
        );
    } catch (_error) {
        // Measuring falls back to whatever face is there; still a picture.
    }
}

/** The whole graph as a self-contained `<svg>` document. */
export function buildGraphSvg({
    title,
    nodeList,
    edgeList,
    resolveEdge,
    pathEdgeKeySet,
    palette,
    fontFamily,
    measureText,
}: GraphExportOptionsType): string {
    const fitLine = (
        value: string,
        maxChars: number,
        font: { size: number; weight: number },
        decorate: (text: string) => string = (text) => {
            return text;
        },
    ) => {
        if (measureText === undefined) {
            return clipText(value, maxChars);
        }
        // The brackets drawn around a name take room in the box too, so they
        // are measured with it.
        const measureDecorated: GraphTextMeasureType = (text, size, weight) => {
            return measureText(decorate(text), size, weight);
        };
        return clipTextToWidth(value, measureDecorated, font, TEXT_MAX_WIDTH);
    };
    // Computed straight from the node CENTRES plus half a box, rather than
    // reusing the canvas bounds: those pad generously for panning, and simply
    // shrinking that padding cropped the outermost boxes in half.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const { node } of nodeList) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }
    if (nodeList.length === 0) {
        minX = 0;
        minY = 0;
        maxX = 0;
        maxY = 0;
    }
    const halfWidth = GRAPH_GEOMETRY.NODE_WIDTH / 2;
    const halfHeight = GRAPH_GEOMETRY.NODE_HEIGHT / 2;
    const bounds = {
        left: minX - halfWidth - EXPORT_PADDING,
        top: minY - halfHeight - EXPORT_PADDING,
        width: maxX - minX + GRAPH_GEOMETRY.NODE_WIDTH + EXPORT_PADDING * 2,
        height: maxY - minY + GRAPH_GEOMETRY.NODE_HEIGHT + EXPORT_PADDING * 2,
    };
    const nodeByKey = new Map(
        nodeList.map((item) => {
            return [item.node.key, item.node];
        }),
    );
    const bowByKey = getEdgeBowIndexMap(edgeList);

    const edgeMarkup = edgeList
        .map((edge) => {
            const from = nodeByKey.get(edge.fromKey);
            const to = nodeByKey.get(edge.toKey);
            if (from === undefined || to === undefined) {
                return '';
            }
            const fromAnchor = getNodeAnchor(from, from.isCollapsed);
            const toAnchor = getNodeAnchor(to, to.isCollapsed);
            const localFrom = {
                x: fromAnchor.x - bounds.left,
                y: fromAnchor.y - bounds.top,
            };
            const localTo = {
                x: toAnchor.x - bounds.left,
                y: toAnchor.y - bounds.top,
            };
            const bow = bowByKey.get(edge.key) ?? 0;
            const fromRect = getNodeRect(
                { x: from.x - bounds.left, y: from.y - bounds.top },
                from.isCollapsed,
            );
            const toRect = getNodeRect(
                { x: to.x - bounds.left, y: to.y - bounds.top },
                to.isCollapsed,
            );
            const isOnPath = pathEdgeKeySet.has(edge.key);
            const stroke = isOnPath ? palette.accent : palette.line;
            const { label, isDirected } = resolveEdge(edge);
            const length = Math.hypot(to.x - from.x, to.y - from.y);
            const point = getEdgeLabelPoint(localFrom, localTo, bow);
            const drawing = getEdgeDrawing(
                localFrom,
                localTo,
                bow,
                fromRect,
                toRect,
            );
            const arrowMarkup = isDirected
                ? `<path d="${EDGE_ARROW_PATH_D}" fill="${stroke}"` +
                  ` transform="${drawing.arrowTransform}"/>`
                : '';
            const labelMarkup =
                label === '' || length < GRAPH_GEOMETRY.EDGE_LABEL_MIN_LENGTH
                    ? ''
                    : `<text x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}"` +
                      ` text-anchor="middle" dominant-baseline="middle"` +
                      ` font-size="10" fill="${palette.muted}"` +
                      ` stroke="${palette.background}" stroke-width="3"` +
                      ` paint-order="stroke">${escapeXml(label)}</text>`;
            return (
                `<path d="${drawing.d}" fill="none"` +
                ` stroke="${stroke}" stroke-width="${isOnPath ? 2.5 : 1.4}"` +
                ` opacity="${isOnPath ? 1 : 0.7}"/>${arrowMarkup}${labelMarkup}`
            );
        })
        .join('');

    const nodeMarkup = nodeList
        .map(({ node, view, typeColor }) => {
            const x = node.x - GRAPH_GEOMETRY.NODE_WIDTH / 2 - bounds.left;
            const y = node.y - GRAPH_GEOMETRY.NODE_HEIGHT / 2 - bounds.top;
            const name = fitLine(view?.name ?? node.name, 22, NAME_FONT);
            // The English name the box shows beside a translated one: a
            // picture of eight Khmer names that begin alike was the one copy
            // of the graph that could not be read by the people it was for.
            const kjvName = fitLine(
                view?.kjvName ?? '',
                26,
                KJV_NAME_FONT,
                (text) => {
                    return `(${text})`;
                },
            );
            const caption = fitLine(view?.title ?? '', 30, CAPTION_FONT);
            const captionY = y + (kjvName === '' ? 38 : 52);
            const textX = (x + TEXT_LEFT).toFixed(1);
            return (
                `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"` +
                ` width="${GRAPH_GEOMETRY.NODE_WIDTH}"` +
                ` height="${GRAPH_GEOMETRY.NODE_HEIGHT}" rx="6"` +
                ` fill="${palette.surface}" stroke="${palette.line}"/>` +
                `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="3"` +
                ` height="${GRAPH_GEOMETRY.NODE_HEIGHT}" rx="1.5"` +
                ` fill="${typeColor}"/>` +
                `<text x="${textX}" y="${(y + 20).toFixed(1)}"` +
                ` font-size="${NAME_FONT.size}"` +
                ` font-weight="${NAME_FONT.weight}" fill="${palette.ink}">` +
                `${escapeXml(name)}</text>` +
                (kjvName === ''
                    ? ''
                    : `<text x="${textX}"` +
                      ` y="${(y + 35).toFixed(1)}"` +
                      ` font-size="${KJV_NAME_FONT.size}"` +
                      ` fill="${palette.muted}">(${escapeXml(kjvName)})</text>`) +
                (caption === ''
                    ? ''
                    : `<text x="${textX}"` +
                      ` y="${captionY.toFixed(1)}"` +
                      ` font-size="${CAPTION_FONT.size}"` +
                      ` fill="${palette.muted}">${escapeXml(caption)}</text>`) +
                `</g>`
            );
        })
        .join('');

    return (
        `<svg xmlns="http://www.w3.org/2000/svg"` +
        ` width="${Math.ceil(bounds.width)}"` +
        ` height="${Math.ceil(bounds.height)}"` +
        ` viewBox="0 0 ${Math.ceil(bounds.width)} ${Math.ceil(bounds.height)}">` +
        `<title>${escapeXml(title)}</title>` +
        `<style>text{font-family:${fontFamily};}</style>` +
        `<rect width="100%" height="100%" fill="${palette.background}"/>` +
        edgeMarkup +
        nodeMarkup +
        `</svg>`
    );
}

/**
 * Rasterizes the SVG and hands it to the app's own file writer.
 *
 * NOT an `<a download>`: this app registers no `will-download` handler, so a
 * blob download pops a native Save As dialog and orphans a `.tmp` in
 * `~/Downloads`. `downloadImageBase64Data` writes a real named file and
 * reveals it, exactly as the slide editor's image export does.
 */
export async function saveGraphImage(svgText: string, fontFamily?: string) {
    try {
        // A picture in a fallback face still beats no picture at all.
        const fontFaceCss =
            fontFamily === undefined
                ? ''
                : await genEmbeddedFontFaceCss(fontFamily).catch((error) => {
                      handleError(error);
                      return '';
                  });
        const dataUrl = await rasterizeSvg(
            fontFaceCss === ''
                ? svgText
                : svgText.replace('<style>', `<style>${fontFaceCss}`),
        );
        if (dataUrl === null) {
            showSimpleToast(
                tran('Save as image'),
                tran('Failed to save image'),
            );
            return;
        }
        downloadImageBase64Data(dataUrl);
    } catch (error) {
        handleError(error);
    }
}

// The weights the boxes draw with: names at 600, everything else at 400.
const EMBEDDED_FONT_WEIGHT_LIST = [KJV_NAME_FONT.weight, NAME_FONT.weight];
// The picture is drawn from a data URL, which Chromium caps at 2 MB: a face
// past this would leave no picture at all rather than one in a fallback font.
// Battambang's faces are ~115 KB.
const EMBEDDED_FONT_MAX_BYTES = 512 * 1024;

function toFontWeightNumber(value: string) {
    const firstToken = value.trim().split(/\s+/)[0] ?? '';
    if (firstToken === '' || firstToken === 'normal') {
        return 400;
    }
    if (firstToken === 'bold') {
        return 700;
    }
    const weight = Number.parseInt(firstToken, 10);
    return Number.isNaN(weight) ? 400 : weight;
}

function readBlobAsDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(`${reader.result}`);
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('Failed to read font'));
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * Puts the export's font INSIDE the saved picture.
 *
 * An SVG drawn through an `<img>` is sealed off from the page: it can neither
 * use this window's `@font-face` fonts nor fetch anything, so `app-Battambang`
 * fell back to the system's Times and Khmer faces — the brackets turned serif,
 * and a description cut to fit in Battambang drew past its box's border. A
 * font inlined as a `data:` URL is the one kind it can use. Only the faces the
 * boxes ask for, read when an image is saved and dropped with the string.
 */
async function genEmbeddedFontFaceCss(fontFamily: string) {
    const familyText = fontFamily.replaceAll(/["']/g, '').trim();
    const familyName = familyText.toLowerCase();
    const faceList: { weightText: string; weight: number; url: string }[] = [];
    for (const styleSheet of Array.from(
        globalThis.document?.styleSheets ?? [],
    )) {
        let ruleList: CSSRuleList;
        try {
            ruleList = styleSheet.cssRules;
        } catch (_error) {
            continue;
        }
        for (let index = 0; index < ruleList.length; index++) {
            const rule = ruleList[index];
            if (!(rule instanceof CSSFontFaceRule)) {
                continue;
            }
            const family = rule.style
                .getPropertyValue('font-family')
                .replaceAll(/["']/g, '')
                .trim()
                .toLowerCase();
            const sourceUrl = /url\(\s*(["']?)([^"')]+)\1\s*\)/i.exec(
                rule.style.getPropertyValue('src'),
            )?.[2];
            if (family !== familyName || sourceUrl === undefined) {
                continue;
            }
            const weightText = rule.style.getPropertyValue('font-weight');
            faceList.push({
                weightText: weightText === '' ? 'normal' : weightText,
                weight: toFontWeightNumber(weightText),
                url: new URL(
                    sourceUrl,
                    styleSheet.href ?? globalThis.document.baseURI,
                ).href,
            });
        }
    }
    if (faceList.length === 0) {
        // A system font, which the sealed picture can reach by name.
        return '';
    }
    // The nearest face to each weight the boxes ask for — what the picture's
    // own font matching would pick, had it the whole family.
    const pickedFaceSet = new Set(
        EMBEDDED_FONT_WEIGHT_LIST.map((wantedWeight) => {
            return faceList.reduce((best, face) => {
                const distance = Math.abs(face.weight - wantedWeight);
                const bestDistance = Math.abs(best.weight - wantedWeight);
                return distance < bestDistance ||
                    (distance === bestDistance && face.weight > best.weight)
                    ? face
                    : best;
            });
        }),
    );
    const cssList = await Promise.all(
        Array.from(pickedFaceSet).map(async (face) => {
            const response = await fetch(face.url);
            const blob = await response.blob();
            if (!response.ok || blob.size > EMBEDDED_FONT_MAX_BYTES) {
                throw new Error(`Font not embedded: ${face.url}`);
            }
            const dataUrl = await readBlobAsDataUrl(blob);
            return (
                `@font-face{font-family:"${familyText}";` +
                `src:url("${dataUrl}");font-weight:${face.weightText};}`
            );
        }),
    );
    return cssList.join('');
}

function rasterizeSvg(svgText: string): Promise<SrcData | null> {
    return new Promise((resolve) => {
        const image = new Image();
        // A data URL rather than a blob URL: nothing to revoke, and no
        // cross-origin taint to make `toDataURL` throw afterwards.
        const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            svgText,
        )}`;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            // Twice the logical size so the text stays crisp when the picture
            // is opened at full size or dropped into a document.
            const scale = 2;
            canvas.width = image.width * scale;
            canvas.height = image.height * scale;
            const context = canvas.getContext('2d');
            if (context === null) {
                resolve(null);
                return;
            }
            context.scale(scale, scale);
            context.drawImage(image, 0, 0);
            resolve(canvas.toDataURL('image/png') as SrcData);
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = source;
    });
}

/**
 * The document copy's label, named ONCE.
 *
 * The menu row and the toast that confirms it say the same thing, and a copy
 * whose confirmation named another format would leave the user checking their
 * clipboard. The DIAGRAM labels live with the formats themselves, in
 * `GRAPH_DIAGRAM_FORMAT_LIST`.
 */
export const COPY_MARKDOWN_LABEL = 'Copy as Markdown';

/**
 * Prints the same SVG through the app's existing print pipeline: a hidden
 * BrowserWindow, `printToPDF`, then the Print Preview window.
 *
 * The @font-face rules have to travel with it or the print window rasterizes
 * fallback glyphs where Khmer should be — the print window loads from a temp
 * file and cannot reach this window's injected styles.
 */
export function printGraph(svgText: string, title: string) {
    try {
        const fontFaceCss = collectFontFaceCss(svgText);
        const htmlText =
            `<!doctype html><html><head><meta charset="utf-8">` +
            `<title>${escapeXml(title)}</title><style>${fontFaceCss}` +
            // `zoom`, never `transform: scale`: a transform only scales
            // painting, so content crossing a page boundary is fragmented on
            // its unscaled layout box and text is silently dropped.
            `@page{margin:12mm}body{margin:0}svg{zoom:1;max-width:100%}` +
            `</style></head><body>${svgText}</body></html>`;
        appProvider.messageUtils.sendData('all:app:print', htmlText);
    } catch (error) {
        handleError(error);
    }
}
