// The browser side of "Export to PPTX". A slide is drawn exactly the way a
// screen draws it — the same `genSlideHtml` markup under the screen window's
// own reset stylesheet — in a hidden container, and then READ BACK: where every
// line of text landed, in which font, where every picture sits. That layout,
// not the slide's JSON, is what the PPTX is built from, so line breaks, flex
// centering, fallback fonts and padding all come out the way the congregation
// sees them, while the text stays editable in PowerPoint.
//
// One slide at a time: the container is filled, measured and emptied before
// the next, so a long document never has more than one slide's DOM alive.

import screenCss from '../_screen/screen.scss?inline';
import type Slide from '../app-document-list/Slide';
import { genSlideHtml } from '../app-document-presenter/items/SlideRendererComp';
import { fillWebsiteScreenShots } from '../app-document-list/appDocumentPrintHelpers';
import { captureVideoFrameDataUrl } from '../helper/mediaHelpers';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import type { DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { PREVIEW_ONLY_ATTR, WEBSITE_ITEM_ATTR } from '../helper/constants';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { extractYouTubeVideoId } from '../slide-editor/canvas/youtubeUrlHelpers';
import { handleError } from '../helper/errorHelpers';
import { fsReadFileBytes } from '../server/fileHelpers';
import type {
    PptxBackgroundType,
    PptxBoxType,
    PptxElementType,
    PptxGeometryType,
    PptxLeafElementType,
    PptxLineType,
    PptxMediaExtensionType,
    PptxMediaType,
    PptxPictureElementType,
    PptxRunType,
    PptxSlideModelType,
    PptxTextAlignType,
    PptxTextBodyType,
} from './pptxXmlHelpers';
import type { PptxFontSpecType } from './pptxFontHelpers';
import type { ObjectFitType, RectType } from './pptxStyleHelpers';
import {
    extractScreenBodyFontFamily,
    parseCssColor,
    compositeOverBlack,
    parseDataUrl,
    toFileExtension,
    fileUrlToPath,
    parseObjectPosition,
    calcObjectFit,
    calcCoverRect,
    toBoxGeometry,
    toCollapsedText,
    applyTextTransform,
    parsePx,
    toAlign,
    checkIsSameRect,
    checkIsSameRunStyle,
} from './pptxStyleHelpers';
import {
    PptxFontResolver,
    calcPptxFirstBaseline,
    splitGraphemes,
} from './pptxFontHelpers';

export type PptxMediaLoadedType = {
    bytes: Uint8Array;
    extension: PptxMediaExtensionType;
};

export type PptxMediaAdderType = (
    key: string,
    load: () => Promise<PptxMediaLoadedType | null>,
) => Promise<PptxMediaType | null>;

const KHMER_CHAR_REGEX = /[\u1780-\u17ff\u19e0-\u19ff]/;
const MEDIA_EXTENSION_BY_MIME: Record<string, PptxMediaExtensionType> = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/gif': 'gif',
};
const MEDIA_EXTENSION_BY_FILE_EXTENSION: Record<
    string,
    PptxMediaExtensionType
> = {
    png: 'png',
    jpg: 'jpeg',
    jpeg: 'jpeg',
    jpe: 'jpeg',
    gif: 'gif',
};
// A raster copy of something PowerPoint cannot hold as it is (a WebP, an SVG
// icon) is drawn at this multiple of its size on the slide, so it stays sharp
// when the slide is shown full screen.
const RASTER_SCALE = 2;
// Anything past this on its long side is drawn down to it: a slide picture
// never needs more pixels than a 4K screen has.
const MAX_RASTER_SIDE = 3840;

function canvasToBytes(
    canvas: HTMLCanvasElement,
    type: 'image/png' | 'image/jpeg' = 'image/png',
) {
    return new Promise<Uint8Array | null>((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (blob === null) {
                    resolve(null);
                    return;
                }
                blob.arrayBuffer()
                    .then((buffer) => {
                        resolve(new Uint8Array(buffer));
                    })
                    .catch(() => {
                        resolve(null);
                    });
            },
            type,
            // a baked blur is a photograph: JPEG keeps it a fraction the size
            0.92,
        );
    });
}

function loadImageElement(src: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = src;
    });
}

// A picture PowerPoint cannot take as it is (WebP, AVIF, SVG, BMP…) redrawn as
// a PNG from an already-decoded element, at no more than it needs.
async function rasterizeImageSource(
    source: CanvasImageSource,
    naturalWidth: number,
    naturalHeight: number,
    targetWidth = naturalWidth,
    targetHeight = naturalHeight,
) {
    if (targetWidth <= 0 || targetHeight <= 0) {
        return null;
    }
    const scale = Math.min(
        1,
        MAX_RASTER_SIDE / Math.max(targetWidth, targetHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(targetWidth * scale));
    canvas.height = Math.max(1, Math.round(targetHeight * scale));
    const context = canvas.getContext('2d');
    if (context === null || naturalWidth <= 0 || naturalHeight <= 0) {
        return null;
    }
    try {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const bytes = await canvasToBytes(canvas);
        return bytes === null ? null : { bytes, extension: 'png' as const };
    } catch (error) {
        // a cross-origin picture taints the canvas
        handleError(error);
        return null;
    }
}

async function readSourceBytes(src: string) {
    if (src.startsWith('data:')) {
        return parseDataUrl(src);
    }
    if (src.startsWith('file:')) {
        const filePath = fileUrlToPath(src);
        const bytes = await fsReadFileBytes(filePath);
        const extension = toFileExtension(filePath);
        const mime =
            MEDIA_EXTENSION_BY_FILE_EXTENSION[extension] !== undefined
                ? `image/${MEDIA_EXTENSION_BY_FILE_EXTENSION[extension]}`
                : `image/${extension}`;
        return { mime, bytes };
    }
    const response = await fetch(src);
    if (!response.ok) {
        return null;
    }
    const mime = (response.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
    return { mime, bytes: new Uint8Array(await response.arrayBuffer()) };
}

// The bytes of a picture the way PowerPoint can hold them: PNG/JPEG/GIF as
// they are, anything else redrawn as PNG from the decoded element (or a fresh
// one when none was on the slide).
async function loadPictureMedia(
    src: string,
    decoded: HTMLImageElement | null,
): Promise<PptxMediaLoadedType | null> {
    try {
        const source = await readSourceBytes(src);
        if (source !== null) {
            const extension = MEDIA_EXTENSION_BY_MIME[source.mime];
            if (extension !== undefined) {
                return { bytes: source.bytes, extension };
            }
        }
    } catch (error) {
        handleError(error);
    }
    const image = decoded ?? (await loadImageElement(src));
    if (image === null || image.naturalWidth === 0) {
        return null;
    }
    return rasterizeImageSource(image, image.naturalWidth, image.naturalHeight);
}

type ItemJsonType = {
    id: number;
    type: string;
    rotate?: number;
    url?: string;
    backdropFilter?: number;
};

type FragmentType = {
    text: string;
    element: Element;
    rect: RectType;
};

type MeasuredLineType = {
    fragmentList: FragmentType[];
    isNewParagraph: boolean;
};

const INLINE_DISPLAY_SET = new Set(['inline', 'contents', 'ruby', 'ruby-text']);
const ITEM_CONTAINER_DISPLAY_SET = new Set([
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
]);

type TextBlockEntryType = {
    block: Element;
    nodeList: (Text | HTMLBRElement)[];
    // loose text of a flex/grid container that is laid out beside other items
    isAnonymousItem: boolean;
};

const SKIPPED_TAG_SET = new Set([
    'SCRIPT',
    'STYLE',
    'TEMPLATE',
    'NOSCRIPT',
    'TEXTAREA',
    'SELECT',
    'OPTION',
]);

function checkIsInsideSvg(element: Element) {
    return element.closest('svg') !== null;
}

export class PptxSlideMeasurer {
    private readonly host: HTMLDivElement;
    private readonly frame: HTMLDivElement;
    private readonly fontResolver = new PptxFontResolver();
    private readonly addMedia: PptxMediaAdderType;
    private readonly videoFrameCache = new Map<
        string,
        Promise<string | null>
    >();
    private readonly webScreenShotCache = new Map<
        string,
        Promise<string | null>
    >();
    // What the screen is still showing from an earlier slide: a slide with no
    // background of its own (and a document with none) leaves it up.
    private carriedDroppedData: DroppedDataType | null = null;
    private readonly backgroundStillCache = new Map<
        string,
        Promise<{ src: string; image: HTMLImageElement } | null>
    >();
    private readonly objectUrlList: string[] = [];
    // the current slide's background still and where the screen puts it
    private backdrop: { image: HTMLImageElement; rect: RectType } | null = null;
    private backdropCount = 0;

    constructor(addMedia: PptxMediaAdderType) {
        this.addMedia = addMedia;
        this.host = document.createElement('div');
        // Laid out for real (text cannot be measured otherwise) but far off
        // screen, so nothing is ever painted and the page does not move.
        Object.assign(this.host.style, {
            position: 'fixed',
            left: '-100000px',
            top: '0',
            width: '0',
            height: '0',
            overflow: 'hidden',
            pointerEvents: 'none',
        });
        this.host.setAttribute('aria-hidden', 'true');
        const shadowRoot = this.host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = screenCss;
        shadowRoot.appendChild(style);
        this.frame = document.createElement('div');
        // `all: initial` so nothing the presenter window inherits (its
        // font, line height, color) leaks in; the screen's own body font is
        // put back on top.
        this.frame.style.cssText =
            'all: initial; display: block; position: relative; ' +
            'overflow: hidden; contain: strict; ' +
            `font-family: ${extractScreenBodyFontFamily(screenCss)};`;
        shadowRoot.appendChild(this.frame);
        document.body.appendChild(this.host);
    }

    async init() {
        await this.fontResolver.init();
    }

    destroy() {
        this.frame.replaceChildren();
        this.host.remove();
        this.videoFrameCache.clear();
        this.webScreenShotCache.clear();
        this.backgroundStillCache.clear();
        for (const objectUrl of this.objectUrlList) {
            URL.revokeObjectURL(objectUrl);
        }
        this.objectUrlList.length = 0;
        this.backdrop = null;
    }

    private toSlideRect(rect: DOMRect, origin: DOMRect): RectType {
        return {
            x: rect.left - origin.left,
            y: rect.top - origin.top,
            width: rect.width,
            height: rect.height,
        };
    }

    async measureSlide(slide: Slide): Promise<PptxSlideModelType> {
        const { width, height } = slide;
        const background = await this.measureBackground(slide);
        const elements: PptxElementType[] = [];
        try {
            await Promise.all(
                Array.from(slide.getBibleKeys()).map((bibleKey) => {
                    return getBibleFontFamily(bibleKey);
                }),
            );
            Object.assign(this.frame.style, {
                width: `${width}px`,
                height: `${height}px`,
            });
            const slideDiv = genSlideHtml(slide.canvasItemsJson);
            await fillWebsiteScreenShots(slideDiv, this.webScreenShotCache);
            // a website item's screenshot stands in for the live page the
            // screen shows, so it is no longer only a preview
            for (const frame of slideDiv.querySelectorAll(
                `[${WEBSITE_ITEM_ATTR}] [${PREVIEW_ONLY_ATTR}]`,
            )) {
                frame.removeAttribute(PREVIEW_ONLY_ATTR);
            }
            this.frame.replaceChildren(slideDiv);
            // what the screen hides: the video play badge, the audio player
            for (const element of slideDiv.querySelectorAll(
                `[${PREVIEW_ONLY_ATTR}]`,
            )) {
                if (
                    element instanceof HTMLElement ||
                    element instanceof SVGElement
                ) {
                    element.style.display = 'none';
                }
            }
            await this.waitForContent(slideDiv);
            const origin = this.frame.getBoundingClientRect();
            const wrapperList = Array.from(slideDiv.children);
            for (const [
                index,
                canvasItemJson,
            ] of slide.canvasItemsJson.entries()) {
                const wrapper = wrapperList[index];
                if (!(wrapper instanceof HTMLElement)) {
                    continue;
                }
                // one item that cannot be read costs that item, not the
                // whole export
                try {
                    const element = await this.measureItem(
                        wrapper,
                        canvasItemJson as ItemJsonType,
                        origin,
                        index,
                    );
                    if (element !== null) {
                        elements.push(element);
                    }
                } catch (error) {
                    handleError(error);
                }
            }
        } finally {
            this.frame.replaceChildren();
        }
        return {
            width,
            height,
            background,
            elements,
            note: slide.note,
            isHidden: slide.isDisabled,
        };
    }

    private async waitForContent(root: HTMLElement) {
        const fontSet = new Set<string>();
        for (const element of root.querySelectorAll('*')) {
            const style = getComputedStyle(element);
            fontSet.add(
                `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ` +
                    style.fontFamily,
            );
        }
        await Promise.all([
            ...Array.from(root.querySelectorAll('img')).map((image) => {
                return image.decode().catch(() => {});
            }),
            // a web font the slide names (a Bible's) must be in before its
            // text is measured, or the fallback's widths are what gets read
            ...Array.from(fontSet).map((font) => {
                return document.fonts.load(font).catch(() => []);
            }),
        ]);
        await document.fonts.ready;
    }

    // The background a screen shows behind this slide when the document is
    // presented in order: its own attachment, else the document's, else
    // whatever the previous slide left up (`applyAttachBackground` changes
    // nothing when neither is set). A disabled slide is skipped when
    // presenting, so it hands nothing on.
    private async resolveDroppedData(slide: Slide) {
        const own = await attachBackgroundManager.getAttachedBackground(
            slide.filePath,
            slide.id,
        );
        const droppedData =
            own ??
            (await attachBackgroundManager.getAttachedBackground(
                slide.filePath,
            )) ??
            this.carriedDroppedData;
        if (!slide.isDisabled) {
            this.carriedDroppedData = droppedData;
        }
        return droppedData;
    }

    private async measureBackground(
        slide: Slide,
    ): Promise<PptxBackgroundType | null> {
        this.backdrop = null;
        const droppedData = await this.resolveDroppedData(slide);
        if (droppedData === null) {
            return null;
        }
        try {
            if (droppedData.type === DragTypeEnum.BACKGROUND_COLOR) {
                const color = parseCssColor(droppedData.item);
                return color === null
                    ? null
                    : { kind: 'color', color: compositeOverBlack(color) };
            }
            let key: string | null = null;
            let loadStill: () => Promise<string | null> = async () => {
                return null;
            };
            if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
                const src: string = droppedData.item.src;
                key = `background:${src}`;
                loadStill = async () => {
                    return src;
                };
            } else if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
                // a screen plays it; its first frame is what a still can show
                const src: string = droppedData.item.src;
                key = `video-frame:${src}`;
                loadStill = () => {
                    return this.captureVideoFrame(src);
                };
            }
            if (key === null) {
                // Camera and web backgrounds are live and have no still to
                // export, the same as printing leaves them out.
                return null;
            }
            const still = await this.loadBackgroundStill(key, loadStill);
            if (still === null) {
                return null;
            }
            const media = await this.addMedia(key, () => {
                return loadPictureMedia(still.src, still.image);
            });
            if (media === null) {
                return null;
            }
            const { naturalWidth, naturalHeight } = still.image;
            this.backdrop = {
                image: still.image,
                rect: calcCoverRect(
                    slide.width,
                    slide.height,
                    naturalWidth,
                    naturalHeight,
                ),
            };
            return {
                kind: 'picture',
                media,
                crop: this.toCoverCrop(slide, naturalWidth, naturalHeight),
            };
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    // The decoded still behind a background, kept for the export: every slide
    // of a document usually shares one, and a blurred box needs its pixels.
    // Decoded from its own bytes so the canvas that blurs it is never tainted
    // by a `file:` picture.
    private loadBackgroundStill(
        key: string,
        loadSrc: () => Promise<string | null>,
    ) {
        let promise = this.backgroundStillCache.get(key);
        if (promise === undefined) {
            promise = (async () => {
                const src = await loadSrc();
                if (!src) {
                    return null;
                }
                let objectUrl: string | null = null;
                if (!src.startsWith('data:')) {
                    const source = await readSourceBytes(src).catch((error) => {
                        handleError(error);
                        return null;
                    });
                    if (source !== null) {
                        objectUrl = URL.createObjectURL(
                            new Blob(
                                [source.bytes as Uint8Array<ArrayBuffer>],
                                {
                                    type: source.mime,
                                },
                            ),
                        );
                        this.objectUrlList.push(objectUrl);
                    }
                }
                const image = await loadImageElement(objectUrl ?? src);
                if (image === null || image.naturalWidth === 0) {
                    return null;
                }
                return { src, image };
            })();
            this.backgroundStillCache.set(key, promise);
        }
        return promise;
    }

    // CSS `backdrop-filter: blur()` has no PowerPoint equivalent, so the blur
    // is baked: the background under the box, blurred the same way, cut to the
    // box's own shape and laid beneath its translucent fill.
    private async genBackdropPicture(
        box: PptxBoxType,
        geometry: PptxGeometryType,
        blurRadius: number,
        name: string,
    ): Promise<PptxPictureElementType | null> {
        const backdrop = this.backdrop;
        if (
            backdrop === null ||
            blurRadius <= 0 ||
            box.width <= 0 ||
            box.height <= 0
        ) {
            return null;
        }
        const scale = Math.min(
            1,
            MAX_RASTER_SIDE / Math.max(box.width, box.height),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(box.width * scale));
        canvas.height = Math.max(1, Math.round(box.height * scale));
        const context = canvas.getContext('2d');
        if (context === null) {
            return null;
        }
        // item-local space: the box unturned, its top-left at the origin
        context.scale(scale, scale);
        context.translate(box.width / 2, box.height / 2);
        context.rotate((-box.rotation * Math.PI) / 180);
        context.translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
        context.filter = `blur(${blurRadius * scale}px)`;
        const { image, rect } = backdrop;
        context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
        const media = await this.addMedia(
            `backdrop:${this.backdropCount++}`,
            async () => {
                const bytes = await canvasToBytes(canvas, 'image/jpeg');
                return bytes === null ? null : { bytes, extension: 'jpeg' };
            },
        );
        if (media === null) {
            return null;
        }
        return {
            kind: 'picture',
            name: `${name} blur`,
            box: { ...box, rotation: 0 },
            geometry,
            fill: null,
            media,
            crop: null,
            opacity: 1,
        };
    }

    // A screen scales a background to COVER it, centered (`calMediaSizes`).
    private toCoverCrop(
        slide: Slide,
        naturalWidth: number,
        naturalHeight: number,
    ) {
        return calcObjectFit(
            { x: 0, y: 0, width: slide.width, height: slide.height },
            naturalWidth,
            naturalHeight,
            'cover',
            { x: 0.5, y: 0.5 },
        ).crop;
    }

    private captureVideoFrame(src: string) {
        let promise = this.videoFrameCache.get(src);
        if (promise === undefined) {
            promise = captureVideoFrameDataUrl(src);
            this.videoFrameCache.set(src, promise);
        }
        return promise;
    }

    private async measureItem(
        wrapper: HTMLElement,
        itemJson: ItemJsonType,
        origin: DOMRect,
        index: number,
    ): Promise<PptxElementType | null> {
        // Measured unturned; the rotation goes back on as the PPTX shape's own.
        wrapper.style.transform = 'none';
        const wrapperStyle = getComputedStyle(wrapper);
        const rect = this.toSlideRect(wrapper.getBoundingClientRect(), origin);
        const box: PptxBoxType = { ...rect, rotation: itemJson.rotate ?? 0 };
        const geometry = toBoxGeometry(wrapperStyle, rect.width, rect.height);
        const fill = parseCssColor(wrapperStyle.backgroundColor);
        const name = `${itemJson.type} ${index + 1}`;
        const childList: PptxLeafElementType[] = [];
        const textBodyList = this.measureTextBlocks(wrapper, origin);
        const decorationList = this.measureDecorations(wrapper, origin, name);
        await this.measurePictures(wrapper, origin, itemJson, childList);
        const clippedGeometry: PptxGeometryType =
            wrapperStyle.overflow === 'hidden' ||
            wrapperStyle.overflow === 'clip'
                ? geometry
                : { kind: 'rect' };
        for (const child of childList) {
            if (child.kind === 'picture' && clippedGeometry.kind !== 'rect') {
                child.geometry = clippedGeometry;
            }
        }
        // The common case — a text box with its own background — becomes ONE
        // shape holding both, which is what someone editing it in PowerPoint
        // expects to click.
        const baseShape: PptxLeafElementType = {
            kind: 'shape',
            name,
            box: { ...box, rotation: 0 },
            geometry,
            fill: fill !== null && fill.alpha > 0 ? fill : null,
            textBody: null,
        };
        const textShapeList: PptxLeafElementType[] = [];
        for (const { textBody, frame } of textBodyList) {
            const insets = {
                left: frame.x - rect.x,
                top: textBody.insets.top + frame.y - rect.y,
                right: rect.x + rect.width - (frame.x + frame.width),
                bottom: 0,
            };
            const canJoin =
                baseShape.textBody === null &&
                textBodyList.length === 1 &&
                childList.length === 0 &&
                insets.left >= 0 &&
                insets.top >= 0 &&
                insets.right >= 0;
            if (canJoin) {
                baseShape.textBody = { ...textBody, insets };
                continue;
            }
            textShapeList.push({
                kind: 'shape',
                name: `${name} text`,
                box: {
                    x: frame.x,
                    y: frame.y + textBody.insets.top,
                    width: frame.width,
                    height: Math.max(
                        frame.height - textBody.insets.top,
                        textBody.lines.length * textBody.lineSpacing,
                    ),
                    rotation: 0,
                },
                geometry: { kind: 'rect' },
                fill: null,
                textBody: {
                    ...textBody,
                    insets: { left: 0, top: 0, right: 0, bottom: 0 },
                },
            });
        }
        const leafList: PptxLeafElementType[] = [];
        const [onlyPicture] = childList;
        const canFillPicture =
            baseShape.fill !== null &&
            baseShape.textBody === null &&
            geometry.kind === 'rect' &&
            childList.length === 1 &&
            textShapeList.length === 0 &&
            onlyPicture.kind === 'picture' &&
            checkIsSameRect(onlyPicture.box, box);
        if (canFillPicture) {
            // a picture carries its own fill, painted behind its transparent
            // pixels exactly as the box's background shows through in CSS
            onlyPicture.fill = baseShape.fill;
        } else if (baseShape.fill !== null || baseShape.textBody !== null) {
            leafList.push(baseShape);
        }
        leafList.push(...decorationList, ...childList, ...textShapeList);
        const backdropPicture = await this.genBackdropPicture(
            box,
            geometry,
            itemJson.backdropFilter ?? 0,
            name,
        );
        if (backdropPicture !== null) {
            leafList.unshift(backdropPicture);
        }
        if (leafList.length === 0) {
            return null;
        }
        if (leafList.length === 1) {
            const [only] = leafList;
            // a lone element turns about its own center; that is the item's
            // center only when it fills the item's box
            if (checkIsSameRect(only.box, box) || box.rotation === 0) {
                return {
                    ...only,
                    box: { ...only.box, rotation: box.rotation },
                };
            }
        }
        return { kind: 'group', name, box, children: leafList };
    }

    private findBlockContainer(element: Element, root: Element) {
        let current: Element | null = element;
        while (current !== null && current !== root) {
            const display = getComputedStyle(current).display;
            if (!INLINE_DISPLAY_SET.has(display)) {
                return current;
            }
            current = current.parentElement;
        }
        return root;
    }

    // Every block of text in an item, as the lines the browser broke it into.
    // How a flex or grid container splits its children into items: every
    // child element is one, and every run of loose text (with its `<br>`s)
    // between them is one more, anonymous — unless it is only whitespace.
    private genItemRunMap(container: Element) {
        const runIndexMap = new Map<Node, number>();
        let itemCount = 0;
        let runIndex = -1;
        let isInRun = false;
        let hasRunText = false;
        const closeRun = () => {
            if (isInRun && hasRunText) {
                itemCount++;
            }
            isInRun = false;
            hasRunText = false;
        };
        for (const child of Array.from(container.childNodes)) {
            if (child instanceof Element && !(child instanceof HTMLBRElement)) {
                closeRun();
                if (getComputedStyle(child).display !== 'none') {
                    itemCount++;
                }
                continue;
            }
            if (!isInRun) {
                runIndex++;
                isInRun = true;
            }
            runIndexMap.set(child, runIndex);
            if (child instanceof Text && child.data.trim() !== '') {
                hasRunText = true;
            }
        }
        closeRun();
        // one key object per run, so a run's text nodes land in one block
        return { runIndexMap, itemCount, runKeyMap: new Map<number, object>() };
    }

    // Every block of text in an item, as the lines the browser broke it into.
    // A text item's box is a flex container, so markup inside its text (a
    // `<b>word</b>`) is laid out as items side by side, not as a flowing line
    // — each of those becomes a text block of its own, placed where the
    // browser put it.
    private measureTextBlocks(root: HTMLElement, origin: DOMRect) {
        const entryMap = new Map<unknown, TextBlockEntryType>();
        const itemRunCache = new Map<
            Element,
            ReturnType<PptxSlideMeasurer['genItemRunMap']>
        >();
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (node instanceof Element) {
                        if (
                            SKIPPED_TAG_SET.has(node.tagName) ||
                            node.tagName.toLowerCase() === 'svg'
                        ) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return node instanceof HTMLBRElement
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            },
        );
        for (
            let node = walker.nextNode();
            node !== null;
            node = walker.nextNode()
        ) {
            const parent = node.parentElement;
            if (parent === null || checkIsInsideSvg(parent)) {
                continue;
            }
            const block = this.findBlockContainer(parent, root);
            let key: unknown = block;
            let isAnonymousItem = false;
            if (
                parent === block &&
                ITEM_CONTAINER_DISPLAY_SET.has(getComputedStyle(block).display)
            ) {
                let itemRun = itemRunCache.get(block);
                if (itemRun === undefined) {
                    itemRun = this.genItemRunMap(block);
                    itemRunCache.set(block, itemRun);
                }
                const runIndex = itemRun.runIndexMap.get(node);
                // one lone run of text is the common case, and keeps the
                // container's whole box to be aligned in
                if (itemRun.itemCount > 1 && runIndex !== undefined) {
                    let runKey = itemRun.runKeyMap.get(runIndex);
                    if (runKey === undefined) {
                        runKey = {};
                        itemRun.runKeyMap.set(runIndex, runKey);
                    }
                    key = runKey;
                    isAnonymousItem = true;
                }
            }
            const entry = entryMap.get(key) ?? {
                block,
                nodeList: [],
                isAnonymousItem,
            };
            entry.nodeList.push(node as Text | HTMLBRElement);
            entryMap.set(key, entry);
        }
        const resultList: { textBody: PptxTextBodyType; frame: RectType }[] =
            [];
        for (const { block, nodeList, isAnonymousItem } of entryMap.values()) {
            const result = this.measureBlock(
                block,
                root,
                nodeList,
                origin,
                isAnonymousItem,
            );
            if (result !== null) {
                resultList.push(result);
            }
        }
        return resultList;
    }

    private measureLineHeight(block: Element, fontSize: number) {
        const lineHeight = getComputedStyle(block).lineHeight;
        if (lineHeight.endsWith('px')) {
            return parsePx(lineHeight);
        }
        const factor = Number.parseFloat(lineHeight);
        if (Number.isFinite(factor)) {
            return factor * fontSize;
        }
        return null;
    }

    private splitTextNode(node: Text, lineHeight: number, origin: DOMRect) {
        const parent = node.parentElement as Element;
        const style = getComputedStyle(parent);
        const range = document.createRange();
        range.selectNodeContents(node);
        const rectList = Array.from(range.getClientRects()).filter((rect) => {
            return rect.width > 0 || rect.height > 0;
        });
        if (rectList.length === 0) {
            return [];
        }
        const text = node.data;
        if (rectList.length === 1) {
            return [
                {
                    text: toCollapsedText(text, style.whiteSpace),
                    element: parent,
                    rect: this.toSlideRect(rectList[0], origin),
                },
            ];
        }
        // Several lines: find which line every grapheme landed on. Graphemes,
        // never code units — a Khmer cluster is one piece or it is broken.
        const fragmentList: FragmentType[] = [];
        let offset = 0;
        let current: {
            text: string;
            left: number;
            top: number;
            right: number;
            bottom: number;
        } | null = null;
        const threshold = Math.max(1, lineHeight / 2);
        for (const grapheme of splitGraphemes(text)) {
            range.setStart(node, offset);
            range.setEnd(node, offset + grapheme.length);
            offset += grapheme.length;
            const graphemeRect = Array.from(range.getClientRects()).find(
                (rect) => {
                    return rect.width > 0 || rect.height > 0;
                },
            );
            if (graphemeRect === undefined) {
                // collapsed whitespace has no box; keep it as a word gap
                if (current !== null) {
                    current.text += grapheme;
                }
                continue;
            }
            const centerY = graphemeRect.top + graphemeRect.height / 2;
            const currentCenterY =
                current === null ? null : (current.top + current.bottom) / 2;
            if (
                current === null ||
                currentCenterY === null ||
                Math.abs(centerY - currentCenterY) > threshold
            ) {
                if (current !== null) {
                    fragmentList.push({
                        text: toCollapsedText(current.text, style.whiteSpace),
                        element: parent,
                        rect: this.toSlideRect(
                            new DOMRect(
                                current.left,
                                current.top,
                                current.right - current.left,
                                current.bottom - current.top,
                            ),
                            origin,
                        ),
                    });
                }
                current = {
                    text: grapheme,
                    left: graphemeRect.left,
                    top: graphemeRect.top,
                    right: graphemeRect.right,
                    bottom: graphemeRect.bottom,
                };
                continue;
            }
            current.text += grapheme;
            current.left = Math.min(current.left, graphemeRect.left);
            current.top = Math.min(current.top, graphemeRect.top);
            current.right = Math.max(current.right, graphemeRect.right);
            current.bottom = Math.max(current.bottom, graphemeRect.bottom);
        }
        if (current !== null) {
            fragmentList.push({
                text: toCollapsedText(current.text, style.whiteSpace),
                element: parent,
                rect: this.toSlideRect(
                    new DOMRect(
                        current.left,
                        current.top,
                        current.right - current.left,
                        current.bottom - current.top,
                    ),
                    origin,
                ),
            });
        }
        return fragmentList;
    }

    private toFontSpec(style: CSSStyleDeclaration): PptxFontSpecType {
        return {
            familyList: style.fontFamily,
            size: parsePx(style.fontSize),
            weight: style.fontWeight,
            style: style.fontStyle,
        };
    }

    private calcOpacity(element: Element, root: Element) {
        let opacity = 1;
        let current: Element | null = element;
        while (current !== null) {
            opacity *=
                Number.parseFloat(getComputedStyle(current).opacity) || 0;
            if (current === root) {
                break;
            }
            current = current.parentElement;
        }
        return opacity;
    }

    // `root` is the item: an opacity anywhere between the text and the item
    // (the Bible item's dimmed title row) fades the text.
    private toRuns(fragment: FragmentType, root: Element): PptxRunType[] {
        const style = getComputedStyle(fragment.element);
        const color = parseCssColor(style.color) ?? { hex: '000000', alpha: 1 };
        const opacity = this.calcOpacity(fragment.element, root);
        const decoration = style.textDecorationLine || style.textDecoration;
        const weight = Number.parseInt(style.fontWeight, 10);
        const verticalAlign = style.verticalAlign;
        const spec = this.toFontSpec(style);
        const text = applyTextTransform(fragment.text, style.textTransform);
        return this.fontResolver.splitByFont(text, spec).map((segment) => {
            return {
                text: segment.text,
                fontFamily: segment.fontFamily,
                fontSize: spec.size,
                color: { ...color, alpha: color.alpha * opacity },
                isBold: Number.isFinite(weight)
                    ? weight >= 600
                    : style.fontWeight === 'bold',
                isItalic:
                    style.fontStyle === 'italic' ||
                    style.fontStyle.startsWith('oblique'),
                isUnderline: decoration.includes('underline'),
                isStrike: decoration.includes('line-through'),
                letterSpacing:
                    style.letterSpacing === 'normal'
                        ? 0
                        : parsePx(style.letterSpacing),
                baselineShift:
                    verticalAlign === 'super'
                        ? 30
                        : verticalAlign === 'sub'
                          ? -25
                          : 0,
                lang: KHMER_CHAR_REGEX.test(segment.text) ? 'km-KH' : 'en-US',
            };
        });
    }

    private measureBlock(
        block: Element,
        root: Element,
        nodeList: (Text | HTMLBRElement)[],
        origin: DOMRect,
        isAnonymousItem = false,
    ): { textBody: PptxTextBodyType; frame: RectType } | null {
        const blockStyle = getComputedStyle(block);
        const blockFontSize = parsePx(blockStyle.fontSize);
        const computedLineHeight = this.measureLineHeight(block, blockFontSize);
        const lineList: MeasuredLineType[] = [];
        let current: MeasuredLineType = {
            fragmentList: [],
            isNewParagraph: true,
        };
        let currentCenterY: number | null = null;
        const threshold = Math.max(
            1,
            (computedLineHeight ?? blockFontSize) / 2,
        );
        for (const node of nodeList) {
            if (node instanceof HTMLBRElement) {
                lineList.push(current);
                current = { fragmentList: [], isNewParagraph: true };
                currentCenterY = null;
                continue;
            }
            const fragmentList = this.splitTextNode(
                node,
                computedLineHeight ?? blockFontSize,
                origin,
            );
            for (const fragment of fragmentList) {
                const centerY = fragment.rect.y + fragment.rect.height / 2;
                if (
                    currentCenterY !== null &&
                    current.fragmentList.length > 0 &&
                    centerY - currentCenterY > threshold
                ) {
                    lineList.push(current);
                    current = { fragmentList: [], isNewParagraph: false };
                    currentCenterY = null;
                }
                current.fragmentList.push(fragment);
                currentCenterY ??= centerY;
            }
        }
        lineList.push(current);
        // a trailing `<br>` does not open a line in the browser
        while (
            lineList.length > 1 &&
            lineList[lineList.length - 1].fragmentList.length === 0
        ) {
            lineList.pop();
        }
        const lineInfoList = lineList.map((line) => {
            return this.toLineInfo(line, root);
        });
        const firstFilled = lineInfoList.findIndex((info) => {
            return info !== null;
        });
        if (firstFilled < 0) {
            return null;
        }
        // The pitch the browser really used; it is the computed line height
        // unless inline content of another size stretched the lines.
        let lineSpacing = computedLineHeight ?? 0;
        const filledList = lineInfoList
            .map((info, index) => {
                return info === null ? null : { info, index };
            })
            .filter((item) => {
                return item !== null;
            });
        if (filledList.length >= 2) {
            const first = filledList[0];
            const last = filledList[filledList.length - 1];
            const measured =
                (last.info.baseline - first.info.baseline) /
                (last.index - first.index);
            if (
                measured > 0 &&
                (lineSpacing <= 0 || Math.abs(measured - lineSpacing) > 0.5)
            ) {
                lineSpacing = measured;
            }
        }
        const firstInfo = lineInfoList[firstFilled]!;
        if (lineSpacing <= 0) {
            lineSpacing = firstInfo.metrics.ascent + firstInfo.metrics.descent;
        }
        // the frame starts at the first line box, wherever an empty leading
        // line (a `<br>` first) pushed it
        const firstBaseline = firstInfo.baseline - firstFilled * lineSpacing;
        const pptxFirstBaseline = calcPptxFirstBaseline(
            lineSpacing,
            firstInfo.fontSize,
            firstInfo.metrics,
        );
        const blockRect = this.toSlideRect(
            block.getBoundingClientRect(),
            origin,
        );
        const content: RectType = {
            x:
                blockRect.x +
                parsePx(blockStyle.paddingLeft) +
                parsePx(blockStyle.borderLeftWidth),
            y:
                blockRect.y +
                parsePx(blockStyle.paddingTop) +
                parsePx(blockStyle.borderTopWidth),
            width:
                blockRect.width -
                parsePx(blockStyle.paddingLeft) -
                parsePx(blockStyle.paddingRight) -
                parsePx(blockStyle.borderLeftWidth) -
                parsePx(blockStyle.borderRightWidth),
            height:
                blockRect.height -
                parsePx(blockStyle.paddingTop) -
                parsePx(blockStyle.paddingBottom) -
                parsePx(blockStyle.borderTopWidth) -
                parsePx(blockStyle.borderBottomWidth),
        };
        if (isAnonymousItem) {
            // an anonymous item has no element to measure: it is exactly as
            // wide as its widest line, where the browser put it
            const measuredList = lineInfoList.filter((info) => {
                return info !== null;
            });
            content.x = Math.min(...measuredList.map((info) => info.left));
            content.width =
                Math.max(...measuredList.map((info) => info.right)) - content.x;
            content.height = lineList.length * lineSpacing;
            content.y = firstBaseline - pptxFirstBaseline;
        }
        const { align, left, right } = this.resolveHorizontal(
            toAlign(blockStyle.textAlign),
            content,
            lineInfoList,
        );
        const lines: PptxLineType[] = lineInfoList.map((info, index) => {
            return {
                runs: info?.runs ?? [],
                isNewParagraph: lineList[index].isNewParagraph,
            };
        });
        const frameTop = firstBaseline - pptxFirstBaseline;
        return {
            textBody: {
                lines,
                align,
                lineSpacing,
                // `top` is measured from the frame below
                insets: {
                    left: 0,
                    top: frameTop - content.y,
                    right: 0,
                    bottom: 0,
                },
            },
            frame: {
                x: left,
                y: content.y,
                width: Math.max(1, right - left),
                height: content.height,
            },
        };
    }

    // The horizontal band the lines are aligned in. Usually the block's
    // content box; when the block shrink-wraps (a flex item centered by its
    // container) the lines themselves say where the band really is.
    private resolveHorizontal(
        align: PptxTextAlignType,
        content: RectType,
        lineInfoList: ReturnType<PptxSlideMeasurer['toLineInfo']>[],
    ) {
        const measuredList = lineInfoList.filter((info) => {
            return info !== null;
        });
        const minLeft = Math.min(...measuredList.map((info) => info.left));
        const maxRight = Math.max(...measuredList.map((info) => info.right));
        const contentLeft = content.x;
        const contentRight = content.x + content.width;
        const tolerance = 2;
        if (align === 'ctr') {
            const center = (contentLeft + contentRight) / 2;
            const isCentered = measuredList.every((info) => {
                return (
                    Math.abs((info.left + info.right) / 2 - center) <= tolerance
                );
            });
            if (isCentered) {
                return { align, left: contentLeft, right: contentRight };
            }
            return { align, left: minLeft, right: maxRight };
        }
        if (align === 'r') {
            const isRight = measuredList.every((info) => {
                return Math.abs(info.right - contentRight) <= tolerance;
            });
            return {
                align,
                left: contentLeft,
                right: isRight ? contentRight : maxRight,
            };
        }
        const isLeft = measuredList.every((info) => {
            return Math.abs(info.left - contentLeft) <= tolerance;
        });
        return {
            align,
            left: isLeft ? contentLeft : minLeft,
            right: Math.max(contentRight, maxRight),
        };
    }

    private toLineInfo(line: MeasuredLineType, root: Element) {
        const fragmentList = line.fragmentList.filter((fragment) => {
            return fragment.text !== '';
        });
        if (fragmentList.length === 0) {
            return null;
        }
        // trim the spaces a wrap leaves hanging at either end of a line
        const first = fragmentList[0];
        const last = fragmentList[fragmentList.length - 1];
        const trimmedList = fragmentList
            .map((fragment) => {
                let text = fragment.text;
                if (fragment === first) {
                    text = text.replace(/^[ \t]+/, '');
                }
                if (fragment === last) {
                    text = text.replace(/[ \t]+$/, '');
                }
                return { ...fragment, text };
            })
            .filter((fragment) => {
                return fragment.text !== '';
            });
        if (trimmedList.length === 0) {
            return null;
        }
        const runs: PptxRunType[] = [];
        for (const fragment of trimmedList) {
            for (const run of this.toRuns(fragment, root)) {
                const previous = runs[runs.length - 1];
                if (
                    previous !== undefined &&
                    checkIsSameRunStyle(previous, run)
                ) {
                    previous.text += run.text;
                } else {
                    runs.push(run);
                }
            }
        }
        // the line's baseline comes from its largest unshifted text; a
        // superscript sits above it and says nothing about it
        const mainFragment = trimmedList.reduce((best, fragment) => {
            const style = getComputedStyle(fragment.element);
            const bestStyle = getComputedStyle(best.element);
            const isShifted = !['baseline', 'middle'].includes(
                style.verticalAlign,
            );
            const isBestShifted = !['baseline', 'middle'].includes(
                bestStyle.verticalAlign,
            );
            if (isBestShifted && !isShifted) {
                return fragment;
            }
            if (isShifted && !isBestShifted) {
                return best;
            }
            return parsePx(style.fontSize) > parsePx(bestStyle.fontSize)
                ? fragment
                : best;
        }, trimmedList[0]);
        const mainStyle = getComputedStyle(mainFragment.element);
        const spec = this.toFontSpec(mainStyle);
        const metrics = this.fontResolver.getMetrics(spec);
        return {
            runs,
            baseline: mainFragment.rect.y + metrics.ascent,
            fontSize: spec.size,
            metrics,
            left: Math.min(...trimmedList.map((fragment) => fragment.rect.x)),
            right: Math.max(
                ...trimmedList.map((fragment) => {
                    return fragment.rect.x + fragment.rect.width;
                }),
            ),
        };
    }

    // The panels markup draws inside an item — an HTML item's coloured box,
    // its border — as shapes behind its words. Only plain colours and one
    // uniform border: what a slide's own markup uses.
    private measureDecorations(
        root: HTMLElement,
        origin: DOMRect,
        name: string,
    ): PptxLeafElementType[] {
        const decorationList: PptxLeafElementType[] = [];
        for (const element of Array.from(root.querySelectorAll('*'))) {
            if (
                element instanceof SVGElement ||
                element.closest('svg') !== null ||
                element instanceof HTMLImageElement ||
                element instanceof HTMLVideoElement ||
                element instanceof HTMLCanvasElement ||
                element instanceof HTMLIFrameElement
            ) {
                continue;
            }
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') {
                continue;
            }
            const fill = parseCssColor(style.backgroundColor);
            const borderWidth = parsePx(style.borderTopWidth);
            const borderColor = parseCssColor(style.borderTopColor);
            const hasBorder =
                borderWidth > 0 &&
                borderColor !== null &&
                borderColor.alpha > 0 &&
                !['none', 'hidden'].includes(style.borderTopStyle);
            if ((fill === null || fill.alpha <= 0) && !hasBorder) {
                continue;
            }
            const rect = this.toSlideRect(
                element.getBoundingClientRect(),
                origin,
            );
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }
            const opacity = this.calcOpacity(element, root);
            // CSS paints a border inside the box, DrawingML centers its line
            // on the edge: draw the outline half a border in from the edge
            const inset = hasBorder ? borderWidth / 2 : 0;
            decorationList.push({
                kind: 'shape',
                name: `${name} panel`,
                box: {
                    x: rect.x + inset,
                    y: rect.y + inset,
                    width: Math.max(0, rect.width - inset * 2),
                    height: Math.max(0, rect.height - inset * 2),
                    rotation: 0,
                },
                geometry: toBoxGeometry(style, rect.width, rect.height),
                fill:
                    fill !== null && fill.alpha > 0
                        ? { ...fill, alpha: fill.alpha * opacity }
                        : null,
                line:
                    hasBorder && borderColor !== null
                        ? {
                              width: borderWidth,
                              color: {
                                  ...borderColor,
                                  alpha: borderColor.alpha * opacity,
                              },
                          }
                        : null,
                textBody: null,
            });
        }
        return decorationList;
    }

    private async measurePictures(
        root: HTMLElement,
        origin: DOMRect,
        itemJson: { type: string; url?: string },
        childList: PptxLeafElementType[],
    ) {
        const elementList = Array.from(
            root.querySelectorAll('img, video, svg, canvas, iframe'),
        );
        for (const element of elementList) {
            if (element.parentElement?.closest('svg') !== null) {
                // an svg's own children are drawn with it
                continue;
            }
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') {
                continue;
            }
            const rect = this.toSlideRect(
                element.getBoundingClientRect(),
                origin,
            );
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }
            const opacity = this.calcOpacity(element, root);
            try {
                const picture = await this.measurePicture(
                    element,
                    rect,
                    style,
                    itemJson,
                );
                if (picture !== null) {
                    childList.push({ ...picture, opacity });
                }
            } catch (error) {
                handleError(error);
            }
        }
    }

    private async measurePicture(
        element: Element,
        rect: RectType,
        style: CSSStyleDeclaration,
        itemJson: { type: string; url?: string },
    ): Promise<PptxPictureElementType | null> {
        const objectFit = (style.objectFit || 'fill') as ObjectFitType;
        const position = parseObjectPosition(style.objectPosition || '50% 50%');
        const toPicture = (
            media: PptxMediaType | null,
            naturalWidth: number,
            naturalHeight: number,
            fit: ObjectFitType = objectFit,
        ): PptxPictureElementType | null => {
            if (media === null) {
                return null;
            }
            const fitted = calcObjectFit(
                rect,
                naturalWidth,
                naturalHeight,
                fit,
                position,
            );
            return {
                kind: 'picture',
                name: `${itemJson.type} picture`,
                box: { ...fitted.box, rotation: 0 },
                geometry: { kind: 'rect' },
                fill: null,
                media,
                crop: fitted.crop,
                opacity: 1,
            };
        };
        if (element instanceof HTMLImageElement) {
            const src = element.currentSrc || element.src;
            if (!src || element.naturalWidth === 0) {
                return null;
            }
            const media = await this.addMedia(src, () => {
                return loadPictureMedia(src, element);
            });
            return toPicture(
                media,
                element.naturalWidth,
                element.naturalHeight,
            );
        }
        if (element instanceof HTMLVideoElement) {
            const src = element.currentSrc || element.src;
            if (!src) {
                return null;
            }
            // a screen holds a slide video on its first frame until it is
            // played from the presenter
            const frameDataUrl = await this.captureVideoFrame(src);
            if (!frameDataUrl) {
                return null;
            }
            const image = await loadImageElement(frameDataUrl);
            if (image === null) {
                return null;
            }
            const media = await this.addMedia(`video-frame:${src}`, () => {
                return loadPictureMedia(frameDataUrl, image);
            });
            return toPicture(media, image.naturalWidth, image.naturalHeight);
        }
        if (element instanceof HTMLCanvasElement) {
            const media = await this.addMedia(
                `canvas:${Math.random()}`,
                async () => {
                    const bytes = await canvasToBytes(element);
                    return bytes === null ? null : { bytes, extension: 'png' };
                },
            );
            return toPicture(media, element.width, element.height, 'fill');
        }
        if (element instanceof HTMLIFrameElement) {
            // a YouTube item: the player rests on the video's thumbnail
            const videoId =
                itemJson.type === 'youtube' && itemJson.url
                    ? extractYouTubeVideoId(itemJson.url)
                    : null;
            if (!videoId) {
                return null;
            }
            const src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
            const image = await loadImageElement(src);
            const media = await this.addMedia(src, () => {
                return loadPictureMedia(src, image);
            });
            if (image === null) {
                return null;
            }
            return toPicture(
                media,
                image.naturalWidth,
                image.naturalHeight,
                'cover',
            );
        }
        if (element instanceof SVGSVGElement) {
            return toPicture(
                await this.rasterizeSvg(element, rect, style),
                rect.width,
                rect.height,
                'fill',
            );
        }
        return null;
    }

    // An inline icon (the Bible item's book) drawn to a PNG with its color
    // resolved, since `currentColor` means nothing outside the page.
    private async rasterizeSvg(
        svg: SVGSVGElement,
        rect: RectType,
        style: CSSStyleDeclaration,
    ) {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', `${rect.width}`);
        clone.setAttribute('height', `${rect.height}`);
        clone.style.color = style.color;
        const markup = new XMLSerializer().serializeToString(clone);
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        return this.addMedia(`svg:${markup}`, async () => {
            const image = await loadImageElement(src);
            if (image === null) {
                return null;
            }
            return rasterizeImageSource(
                image,
                rect.width,
                rect.height,
                rect.width * RASTER_SCALE,
                rect.height * RASTER_SCALE,
            );
        });
    }
}
