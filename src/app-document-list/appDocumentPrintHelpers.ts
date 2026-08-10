import type AppDocument from './AppDocument';
import type Slide from './Slide';
import { genSlideHtml } from '../app-document-presenter/items/SlideRendererComp';
import appProvider from '../server/appProvider';
import { handleError } from '../helper/errorHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import { collectFontFaceCss } from '../helper/printCssHelpers';
import type { DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { parseWebsiteCaptureSize } from '../helper/websiteCaptureHelpers';
import { captureWebScreenShot } from '../helper/capturingHelpers';
import {
    PREVIEW_ONLY_ATTR,
    WEBSITE_CAPTURE_SIZE_ATTR,
    WEBSITE_ITEM_ATTR,
    WEBSITE_URL_ATTR,
} from '../helper/constants';

function toPageName(slide: Slide) {
    return `page-${slide.width}x${slide.height}`;
}

// One @page rule per distinct slide dimension; printToPDF runs with
// `preferCSSPageSize`, so each PDF page gets exactly its slide's size.
function genPageSizeCss(slides: Slide[]) {
    const rules = new Map<string, string>();
    for (const slide of slides) {
        if (slide.width <= 0 || slide.height <= 0) {
            continue;
        }
        rules.set(
            toPageName(slide),
            `@page ${toPageName(slide)} {` +
                ` size: ${slide.width}px ${slide.height}px; margin: 0;` +
                ' }',
        );
    }
    return Array.from(rules.values()).join('\n');
}

function escapeHtmlText(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// A <video> element never paints a frame into a printed PDF, so grab the
// first frame as an image instead.
function captureVideoFrameDataUrl(src: string) {
    return new Promise<string | null>((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        const finish = (dataUrl: string | null) => {
            clearTimeout(timeoutId);
            video.removeAttribute('src');
            video.load();
            resolve(dataUrl);
        };
        const timeoutId = setTimeout(() => {
            finish(null);
        }, 10_000);
        video.addEventListener(
            'error',
            () => {
                finish(null);
            },
            { once: true },
        );
        video.addEventListener(
            'loadeddata',
            () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                if (context === null || canvas.width === 0) {
                    finish(null);
                    return;
                }
                context.drawImage(video, 0, 0);
                try {
                    finish(canvas.toDataURL('image/jpeg', 0.9));
                } catch (error) {
                    handleError(error);
                    finish(null);
                }
            },
            { once: true },
        );
        video.src = src;
    });
}

async function genBackgroundHtml(
    droppedData: DroppedDataType | null,
    videoFrameCache: Map<string, Promise<string | null>>,
) {
    if (droppedData === null) {
        return '';
    }
    const backgroundDiv = document.createElement('div');
    Object.assign(backgroundDiv.style, {
        position: 'absolute',
        inset: '0',
        overflow: 'hidden',
    });
    if (droppedData.type === DragTypeEnum.BACKGROUND_COLOR) {
        backgroundDiv.style.backgroundColor = droppedData.item;
        return backgroundDiv.outerHTML;
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
        const image = document.createElement('img');
        image.alt = '';
        image.src = droppedData.item.src;
        Object.assign(image.style, { width: '100%', height: '100%' });
        backgroundDiv.appendChild(image);
        return backgroundDiv.outerHTML;
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
        const src = droppedData.item.src as string;
        if (!videoFrameCache.has(src)) {
            videoFrameCache.set(src, captureVideoFrameDataUrl(src));
        }
        const frameDataUrl = await videoFrameCache.get(src);
        if (!frameDataUrl) {
            return '';
        }
        const image = document.createElement('img');
        image.alt = '';
        image.src = frameDataUrl;
        Object.assign(image.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
        });
        backgroundDiv.appendChild(image);
        return backgroundDiv.outerHTML;
    }
    // Camera and web BACKGROUNDS are live content and cannot be printed. (A
    // website canvas ITEM can — it prints the screenshot it already shows
    // everywhere else; see `fillWebsiteScreenShots`.)
    return '';
}

// A website canvas item renders as a screenshot placeholder, but `genSlideHtml`
// runs the React tree through `renderToStaticMarkup`, which runs no effects —
// so the hook that normally fetches that screenshot never fires here. Fill them
// in afterwards, the same way a video background's poster frame is resolved
// above (and sharing that pass's per-document cache shape, so a url repeated
// across slides is captured once).
//
// Unlike a web BACKGROUND, which is genuinely live content and cannot print, a
// website ITEM is a still image by design and prints fine.
async function fillWebsiteScreenShots(
    slideDiv: HTMLDivElement,
    webScreenShotCache: Map<string, Promise<string | null>>,
) {
    const frames = Array.from(
        slideDiv.querySelectorAll(`[${WEBSITE_ITEM_ATTR}]`),
    );
    await Promise.all(
        frames.map(async (frame) => {
            const url = frame.getAttribute(WEBSITE_URL_ATTR) ?? '';
            const placeholder = frame.querySelector(`[${PREVIEW_ONLY_ATTR}]`);
            // The size is stamped into the markup because `slideDiv` is
            // detached — every `offsetWidth` on it is 0 — and because asking
            // for the same size the editor asked for reuses its cached shot.
            const size = parseWebsiteCaptureSize(
                frame.getAttribute(WEBSITE_CAPTURE_SIZE_ATTR),
            );
            if (url === '' || placeholder === null || size === null) {
                return;
            }
            // Keyed by url AND size, matching `captureWebScreenShot`'s own key:
            // the same page can appear at two different box sizes in one
            // document, and a url-only key served the first one's shot to both
            // — stretched into the second by `objectFit: fill`.
            const cacheKey = `${url}-${size.width}x${size.height}`;
            if (!webScreenShotCache.has(cacheKey)) {
                webScreenShotCache.set(
                    cacheKey,
                    captureWebScreenShot(url, { ...size, delay: 3000 }),
                );
            }
            const imageData = await webScreenShotCache.get(cacheKey);
            if (!imageData) {
                // Leave the globe-and-url fallback in place rather than
                // printing an empty box.
                return;
            }
            const image = document.createElement('img');
            image.alt = '';
            image.src = imageData;
            Object.assign(image.style, {
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                display: 'block',
            });
            placeholder.replaceChildren(image);
        }),
    );
}

async function genSlidePageHtml(
    slide: Slide,
    videoFrameCache: Map<string, Promise<string | null>>,
    webScreenShotCache: Map<string, Promise<string | null>>,
) {
    // Same fallback as showing on a screen: the slide's own attachment
    // wins over the document-level one.
    const droppedData =
        (await attachBackgroundManager.getAttachedBackground(
            slide.filePath,
            slide.id,
        )) ??
        (await attachBackgroundManager.getAttachedBackground(slide.filePath));
    const backgroundHtml = await genBackgroundHtml(
        droppedData,
        videoFrameCache,
    );
    const slideDiv = genSlideHtml(slide.canvasItemsJson);
    await fillWebsiteScreenShots(slideDiv, webScreenShotCache);
    Object.assign(slideDiv.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${slide.width}px`,
        height: `${slide.height}px`,
    });
    // The slide is not scaled: the @page rule it is assigned to (see
    // `genPageSizeCss`) makes the PDF page exactly the slide's size, one
    // slide per page.
    const pageDiv = document.createElement('div');
    Object.assign(pageDiv.style, {
        position: 'relative',
        width: `${slide.width}px`,
        height: `${slide.height}px`,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        breakAfter: 'page',
    });
    pageDiv.style.setProperty('page', toPageName(slide));
    pageDiv.innerHTML = backgroundHtml;
    pageDiv.appendChild(slideDiv);
    return pageDiv.outerHTML;
}

export async function printAppDocument(appDocument: AppDocument) {
    try {
        const slides = await appDocument.getSlides();
        const videoFrameCache = new Map<string, Promise<string | null>>();
        const webScreenShotCache = new Map<string, Promise<string | null>>();
        const pagesHtml = (
            await Promise.all(
                slides.map((slide) => {
                    return genSlidePageHtml(
                        slide,
                        videoFrameCache,
                        webScreenShotCache,
                    );
                }),
            )
        ).join('');
        const title = escapeHtmlText(appDocument.fileSource.name);
        const fontFaceCss = collectFontFaceCss(pagesHtml);
        const htmlText =
            '<!DOCTYPE html><html><head><meta charset="utf-8" />' +
            `<title>${title}</title>` +
            '<style>' +
            fontFaceCss +
            '@page { margin: 0; }' +
            genPageSizeCss(slides) +
            'html, body { margin: 0; padding: 0; }' +
            '* {' +
            ' -webkit-print-color-adjust: exact;' +
            ' print-color-adjust: exact;' +
            '}' +
            '</style></head>' +
            `<body>${pagesHtml}</body></html>`;
        appProvider.messageUtils.sendData('all:app:print', htmlText);
    } catch (error) {
        handleError(error);
        showSimpleToast(
            tran('Print'),
            tran('Unable to prepare the document for printing'),
        );
    }
}
