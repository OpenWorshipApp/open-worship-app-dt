import type { SlidePropsType } from '../app-document-list/Slide';
import type { PdfSlidePropsType } from '../app-document-list/PdfSlide';
import PdfSlide from '../app-document-list/PdfSlide';
import type { PptxSlidePropsType } from '../app-document-list/PptxSlide';
import PptxSlide from '../app-document-list/PptxSlide';
import type { DocxSlidePropsType } from '../app-document-list/DocxSlide';
import DocxSlide from '../app-document-list/DocxSlide';
import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';
import { genPdfSlide } from '../app-document-presenter/items/PdfSlideRenderComp';
import { genPptxSlide } from '../app-document-presenter/items/PptxSlideRenderComp';
import { genDocxSlide } from '../app-document-presenter/items/DocxSlideRenderComp';
import { genSlideHtml } from '../app-document-presenter/items/SlideRendererComp';
import {
    filterSideCanvasItems,
    fitSlideIntoBox,
    genDocumentStageLayout,
    genStageBoxStyle,
    genStageContentStyle,
    genStageFrameStyle,
    genStageIndexStyle,
    getDocumentStageDefinition,
    getStageSideOpacity,
} from '../app-document-presenter/stage/documentStageHelpers';
import type { StageLookAheadDataType } from './screenAppDocumentTypeHelpers';
import type { LookAheadBoundsType } from '../lyric-list/lyricLookAheadHelpers';

/**
 * The projector's half of a document stage: the same layout a Stage Previewer
 * card draws (`StageLookAheadComp`), from the same helpers, built as plain DOM
 * the way the screen builds every slide.
 */

function genStyledDiv(style: Record<string, string>) {
    const div = document.createElement('div');
    Object.assign(div.style, style);
    return div;
}

function queryAllDeep(root: ParentNode, selector: string): Element[] {
    const results = Array.from(root.querySelectorAll(selector));
    for (const element of Array.from(root.querySelectorAll('*'))) {
        if (element instanceof HTMLElement && element.shadowRoot !== null) {
            results.push(...queryAllDeep(element.shadowRoot, selector));
        }
    }
    return results;
}

/**
 * A side slide's content at its own size, or `null` when there is nothing to
 * draw. Never anything that plays: canvas media is filtered out before it gets
 * here, and the media a PowerPoint or Word page embeds is taken out after.
 */
function genSideContent(
    itemJson: VarySlideDataType,
): { content: HTMLElement; width: number; height: number } | null {
    if (PdfSlide.tryValidate(itemJson)) {
        const json = itemJson as PdfSlidePropsType;
        if (!json.imagePreviewSrc) {
            return null;
        }
        return {
            content: genPdfSlide(json.imagePreviewSrc),
            ...json.metadata,
        };
    }
    let content: HTMLElement;
    let size: { width: number; height: number };
    if (PptxSlide.tryValidate(itemJson)) {
        const json = itemJson as PptxSlidePropsType;
        size = json.metadata;
        content = genPptxSlide(
            json.html,
            json.htmlFilePath,
            size.width,
            size.height,
        );
    } else if (DocxSlide.tryValidate(itemJson)) {
        const json = itemJson as DocxSlidePropsType;
        size = json.metadata;
        content = genDocxSlide(
            json.html,
            json.htmlFilePath,
            size.width,
            size.height,
            size.width,
        );
    } else {
        const json = itemJson as SlidePropsType;
        if (!Array.isArray(json.canvasItems) || !json.metadata) {
            return null;
        }
        size = json.metadata;
        content = genSlideHtml(filterSideCanvasItems(json.canvasItems));
    }
    for (const media of queryAllDeep(content, 'video, audio')) {
        media.remove();
    }
    return { content, width: size.width, height: size.height };
}

// A slide's corner count, at the bottom right of its box.
function genIndexLabel(box: LookAheadBoundsType, text: string) {
    const labelBox = genStyledDiv({
        ...genStageBoxStyle(box),
        pointerEvents: 'none',
    });
    const label = genStyledDiv(genStageIndexStyle(box));
    label.className = 'stage-look-ahead-index';
    label.textContent = text;
    labelBox.appendChild(label);
    return labelBox;
}

/**
 * `content` -- the slide the screen just built, at its own `width` x `height`
 * -- set into its stage's layout: in the current box, the slides around it in
 * theirs, and each one's corner count. `null` when the stage draws the slide as it
 * is, and the caller then shows `content` untouched.
 */
export function wrapWithStageLookAhead(
    content: HTMLElement,
    width: number,
    height: number,
    data: StageLookAheadDataType,
    // The area the layout fills -- the whole screen on the projector, so a
    // slide of another shape than the screen leaves no bands around it.
    stageWidth = width,
    stageHeight = height,
): HTMLDivElement | null {
    const definition = getDocumentStageDefinition(data.stage);
    if (
        definition === null ||
        width <= 0 ||
        height <= 0 ||
        stageWidth <= 0 ||
        stageHeight <= 0
    ) {
        return null;
    }
    const layout = genDocumentStageLayout(
        definition,
        width,
        height,
        stageWidth,
        stageHeight,
    );
    const root = genStyledDiv({
        position: 'relative',
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
        overflow: 'hidden',
    });
    const currentBox = genStyledDiv(genStageBoxStyle(layout.current));
    const currentContent = genStyledDiv(
        genStageContentStyle(width, height, layout.currentScale),
    );
    currentContent.appendChild(content);
    currentBox.appendChild(currentContent);
    root.appendChild(currentBox);

    const frames: HTMLDivElement[] = [];
    const labels: HTMLDivElement[] = [];
    if (definition.isShowingIndex && data.label !== null) {
        labels.push(genIndexLabel(layout.current, data.label));
    }
    if (definition.arrangement !== null) {
        frames.push(
            genStyledDiv(genStageFrameStyle(layout.current, stageHeight)),
        );
    }
    layout.sideList.forEach((box, i) => {
        const side = data.sideList[i] ?? null;
        if (side === null) {
            return;
        }
        const opacity = getStageSideOpacity(definition, side.offset);
        // The frame says a slide comes next even when it is blank or cannot
        // be drawn.
        frames.push(
            genStyledDiv(genStageFrameStyle(box, stageHeight, opacity)),
        );
        if (definition.isShowingIndex && typeof side.label === 'string') {
            labels.push(genIndexLabel(box, side.label));
        }
        const sideContent = genSideContent(side.itemJson);
        if (sideContent === null) {
            return;
        }
        const fit = fitSlideIntoBox(box, sideContent.width, sideContent.height);
        const sideBox = genStyledDiv(genStageBoxStyle(box, opacity));
        const sideInner = genStyledDiv(
            genStageContentStyle(
                sideContent.width,
                sideContent.height,
                fit.scale,
                fit.left,
                fit.top,
            ),
        );
        sideInner.appendChild(sideContent.content);
        sideBox.appendChild(sideInner);
        root.appendChild(sideBox);
    });
    // Last, so a slide's own background fill cannot cover them.
    root.append(...frames, ...labels);
    return root;
}
