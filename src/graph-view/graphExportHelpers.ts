import { handleError } from '../helper/errorHelpers';
import type { SrcData } from '../helper/FileSource';
import { collectFontFaceCss } from '../helper/printCssHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { downloadImageBase64Data } from '../server/appHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { GraphEdgeType, GraphNodeType, GraphNodeViewType } from './core';
import {
    GRAPH_GEOMETRY,
    getEdgeBowIndexMap,
    getEdgeLabelPoint,
    getEdgePathD,
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

export type GraphExportOptionsType = {
    title: string;
    nodeList: GraphExportNodeType[];
    edgeList: GraphEdgeType[];
    resolveEdgeLabel: (edge: GraphEdgeType) => string;
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
};

const EXPORT_PADDING = 48;

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
        : `${trimmed.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** The whole graph as a self-contained `<svg>` document. */
export function buildGraphSvg({
    title,
    nodeList,
    edgeList,
    resolveEdgeLabel,
    pathEdgeKeySet,
    palette,
    fontFamily,
}: GraphExportOptionsType): string {
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
            const localFrom = {
                x: from.x - bounds.left,
                y: from.y - bounds.top,
            };
            const localTo = { x: to.x - bounds.left, y: to.y - bounds.top };
            const bow = bowByKey.get(edge.key) ?? 0;
            const isOnPath = pathEdgeKeySet.has(edge.key);
            const stroke = isOnPath ? palette.accent : palette.line;
            const label = resolveEdgeLabel(edge);
            const length = Math.hypot(to.x - from.x, to.y - from.y);
            const point = getEdgeLabelPoint(localFrom, localTo, bow);
            const labelMarkup =
                label === '' || length < GRAPH_GEOMETRY.EDGE_LABEL_MIN_LENGTH
                    ? ''
                    : `<text x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}"` +
                      ` text-anchor="middle" dominant-baseline="middle"` +
                      ` font-size="10" fill="${palette.muted}"` +
                      ` stroke="${palette.background}" stroke-width="3"` +
                      ` paint-order="stroke">${escapeXml(label)}</text>`;
            return (
                `<path d="${getEdgePathD(localFrom, localTo, bow)}" fill="none"` +
                ` stroke="${stroke}" stroke-width="${isOnPath ? 2.5 : 1.4}"` +
                ` opacity="${isOnPath ? 1 : 0.7}"/>${labelMarkup}`
            );
        })
        .join('');

    const nodeMarkup = nodeList
        .map(({ node, view, typeColor }) => {
            const x = node.x - GRAPH_GEOMETRY.NODE_WIDTH / 2 - bounds.left;
            const y = node.y - GRAPH_GEOMETRY.NODE_HEIGHT / 2 - bounds.top;
            const name = clipText(view?.name ?? node.name, 22);
            const caption = clipText(view?.title ?? '', 30);
            return (
                `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"` +
                ` width="${GRAPH_GEOMETRY.NODE_WIDTH}"` +
                ` height="${GRAPH_GEOMETRY.NODE_HEIGHT}" rx="6"` +
                ` fill="${palette.surface}" stroke="${palette.line}"/>` +
                `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="3"` +
                ` height="${GRAPH_GEOMETRY.NODE_HEIGHT}" rx="1.5"` +
                ` fill="${typeColor}"/>` +
                `<text x="${(x + 10).toFixed(1)}" y="${(y + 20).toFixed(1)}"` +
                ` font-size="13" font-weight="600" fill="${palette.ink}">` +
                `${escapeXml(name)}</text>` +
                (caption === ''
                    ? ''
                    : `<text x="${(x + 10).toFixed(1)}"` +
                      ` y="${(y + 38).toFixed(1)}" font-size="10"` +
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
export async function saveGraphImage(svgText: string) {
    try {
        const dataUrl = await rasterizeSvg(svgText);
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
