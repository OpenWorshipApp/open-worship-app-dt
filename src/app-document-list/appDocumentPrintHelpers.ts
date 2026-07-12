import type AppDocument from './AppDocument';
import type Slide from './Slide';
import { genSlideHtml } from '../app-document-presenter/items/SlideRendererComp';
import appProvider from '../server/appProvider';
import { handleError } from '../helper/errorHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import type { DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';

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

function resolveCssUrls(cssText: string) {
    return cssText.replaceAll(
        /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
        (_match, quote: string, url: string) => {
            const resolved = new URL(url, document.baseURI).href;
            return `url(${quote}${resolved}${quote})`;
        },
    );
}

// App-provided fonts (e.g. bible language fonts like `app-Battambang`) exist
// only as @font-face rules injected into this window, so the print window
// needs a copy of every rule the slides reference, with the font URLs
// absolutized for it. System fonts resolve there by name and need nothing.
function collectFontFaceCss(pagesHtml: string) {
    const cssTexts: string[] = [];
    for (const styleSheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = styleSheet.cssRules;
        } catch (_error) {
            continue;
        }
        for (const rule of Array.from(rules)) {
            if (!(rule instanceof CSSFontFaceRule)) {
                continue;
            }
            const family = rule.style
                .getPropertyValue('font-family')
                .replaceAll(/["']/g, '')
                .trim();
            if (family === '' || !pagesHtml.includes(family)) {
                continue;
            }
            cssTexts.push(resolveCssUrls(rule.cssText));
        }
    }
    return cssTexts.join('\n');
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
    // Camera and web backgrounds are live content and cannot be printed.
    return '';
}

async function genSlidePageHtml(
    slide: Slide,
    videoFrameCache: Map<string, Promise<string | null>>,
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
        const pagesHtml = (
            await Promise.all(
                slides.map((slide) => {
                    return genSlidePageHtml(slide, videoFrameCache);
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
