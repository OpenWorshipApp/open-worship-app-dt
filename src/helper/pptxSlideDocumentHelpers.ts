/**
 * A PowerPoint made into a slide document (2026-11-20, `EC-763`; the user's
 * story: _as a user I want to ask chatbot to help convert the pptx file to
 * app-document file_, and the goal: _95% alike_). The app side of
 * `owa_media_file` `convert`, imported on the ask: nothing here loads in a
 * window that never converts.
 *
 * 1. The deck goes through the app's OWN converter, the one the Documents
 *    list previews it with, background included, into a folder of the
 *    temporary folder's -- nothing is written beside the person's file.
 * 2. Each picture is read once and made no bigger than it is drawn (one
 *    deck carried a 17 MB photograph drawn 1280 pixels wide): a slide
 *    document holds its pictures inside it, and a low-spec computer opens
 *    every slide of it.
 * 3. Each slide's page becomes its boxes (`pptxSlideDocumentRules.ts`), its
 *    note and its hidden state kept.
 * 4. Some slides -- or all -- are drawn both ways by the app's document
 *    capture window and compared (`slideLikenessRules.ts`), so the answer
 *    can say how alike the new document is, and which slide is least so.
 * 5. The temporary folder is deleted whatever happened.
 */
import { electronSendAsync } from '../server/electronSendHelpers';
import {
    fsCheckFileExist,
    fsDeleteDir,
    fsReadFile,
    fsReadFileBytes,
    fsWriteFile,
    getTempPath,
    pathJoin,
} from '../server/fileHelpers';
import type { AnyObjectType } from './typeHelpers';
import {
    listPptxSlideImageUses,
    toPptxSlideCanvasItems,
    type PptxResolvedImageType,
} from './pptxSlideDocumentRules';
import {
    computeSsim,
    pickSampleSlideNumbers,
    summarizeLikeness,
    toLumaPlane,
    type SlideLikenessScoreType,
} from './slideLikenessRules';

export type PptxLikenessModeType = 'sample' | 'all' | 'none';

const TEMP_FOLDER_NAME = 'open-worship-app-pptx-slides';
const MAX_SLIDE_COUNT = 300;
// A slide drawn on a screen up to one and a half times its own size: a
// 1280-pixel slide on a 1920-pixel projector.
const DRAWN_SCALE = 1.5;
const JPEG_QUALITY = 0.88;
// The capture window's own ceiling per call.
const CAPTURE_BATCH_SIZE = 8;
const SAMPLE_SLIDE_COUNT = 8;
// Both pictures are compared at this width, the height in proportion.
const COMPARE_WIDTH = 320;
const IMAGE_MIME_MAP: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
};

type PptxInfoSlideType = {
    htmlFileName?: unknown;
    subHtmlFileNames?: unknown;
    isDisabled?: unknown;
    note?: unknown;
    transition?: unknown;
    videos?: unknown;
    audios?: unknown;
};

type CaptureResultType = {
    isSuccessful: boolean;
    message?: string;
    dataUrls?: string[];
};

export type PptxSlideDocumentType = {
    slides: AnyObjectType[];
    width: number;
    height: number;
    pptxSlideCount: number;
    // Slides added for build steps, each after the slide it builds.
    stepSlideCount: number;
    hiddenSlideCount: number;
    missingFonts: string[];
    leftOut: {
        pictures: string[];
        videoSlides: number[];
        audioSlides: number[];
        transitionSlides: number[];
        unreadSlides: number[];
    };
    likeness: ReturnType<typeof summarizeLikeness>;
};

// A page the converter wrote is named by it (`slide3.html`); no other name
// in `info.json` is read.
const PAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.html$/;

function toStringList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((one): one is string => {
              return typeof one === 'string' && one !== '';
          })
        : [];
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(String(reader.result));
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('The picture could not be read.'));
        };
        reader.readAsDataURL(blob);
    });
}

// A picture with no pixel to see through: a photograph a deck kept as a PNG
// (2.1 MB in the worship deck) is a tenth of that as a JPEG.
function checkIsOpaque(
    context: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
) {
    const data = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < data.length; index += 4) {
        if (data[index] < 255) {
            return false;
        }
    }
    return true;
}

/**
 * One picture as a data URL no bigger than it is drawn, or null when it
 * cannot be read as a picture. A slide document holds its pictures inside
 * it, once for every slide that shows one -- a build step repeats its
 * slide's -- so each copy is kept as small as it can look the same: drawn
 * no bigger than shown, opaque ones as JPEG, the original kept when that is
 * smaller still.
 */
async function encodePicture(
    filePath: string,
    drawn: { width: number; height: number },
): Promise<PptxResolvedImageType | null> {
    const extension = /\.([^.]+)$/.exec(filePath)?.[1]?.toLowerCase() ?? '';
    const mime = IMAGE_MIME_MAP[extension];
    if (mime === undefined) {
        return null;
    }
    const bytes = await fsReadFileBytes(filePath);
    const blob = new Blob([bytes as BlobPart], { type: mime });
    if (mime === 'image/svg+xml') {
        return {
            src: await blobToDataUrl(blob),
            width: Math.round(drawn.width) || 1,
            height: Math.round(drawn.height) || 1,
        };
    }
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob);
    } catch {
        return null;
    }
    try {
        // A GIF may move; drawn again it would not.
        if (mime === 'image/gif') {
            return {
                src: await blobToDataUrl(blob),
                width: bitmap.width,
                height: bitmap.height,
            };
        }
        const scale = Math.min(
            1,
            Math.max(
                (drawn.width * DRAWN_SCALE) / bitmap.width,
                (drawn.height * DRAWN_SCALE) / bitmap.height,
            ),
        );
        const isFullSize = scale > 0.95;
        const width = isFullSize
            ? bitmap.width
            : Math.max(1, Math.round(bitmap.width * scale));
        const height = isFullSize
            ? bitmap.height
            : Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if (context === null) {
            return null;
        }
        context.drawImage(bitmap, 0, 0, width, height);
        const isOpaque =
            mime === 'image/jpeg' || checkIsOpaque(context, width, height);
        const encoded = await canvas.convertToBlob(
            isOpaque
                ? { type: 'image/jpeg', quality: JPEG_QUALITY }
                : { type: 'image/png' },
        );
        const chosen = isFullSize && blob.size <= encoded.size ? blob : encoded;
        return {
            src: await blobToDataUrl(chosen),
            width,
            height,
        };
    } finally {
        bitmap.close();
    }
}

async function readJson(filePath: string): Promise<any> {
    try {
        return JSON.parse(await fsReadFile(filePath));
    } catch {
        return null;
    }
}

async function readPageHtml(dirPath: string, fileName: unknown) {
    if (
        typeof fileName !== 'string' ||
        !PAGE_FILE_NAME_PATTERN.test(fileName)
    ) {
        return null;
    }
    try {
        return await fsReadFile(pathJoin(dirPath, fileName));
    } catch {
        return null;
    }
}

async function drawAsPicture(dataUrl: string, height: number) {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob, {
        resizeWidth: COMPARE_WIDTH,
        resizeHeight: height,
        resizeQuality: 'high',
    });
    try {
        const canvas = new OffscreenCanvas(COMPARE_WIDTH, height);
        const context = canvas.getContext('2d');
        if (context === null) {
            return null;
        }
        context.drawImage(bitmap, 0, 0);
        return toLumaPlane(
            context.getImageData(0, 0, COMPARE_WIDTH, height).data,
            COMPARE_WIDTH,
            height,
        );
    } finally {
        bitmap.close();
    }
}

async function capturePages(params: AnyObjectType) {
    const result = await electronSendAsync<CaptureResultType>(
        'main:app:capture-document-pages',
        params,
    );
    return result?.isSuccessful === true && Array.isArray(result.dataUrls)
        ? result.dataUrls
        : null;
}

// A page drawn as it looks once its transition and build have played:
// every animation already at its end. The capture waits 600 ms; a
// six-second curtain was caught half open (worship deck, slide 5).
const STILL_PAGE_STYLE =
    '<style>*,*::before,*::after{animation-delay:-3600s!important;' +
    'animation-play-state:paused!important;transition:none!important}' +
    '</style>';

/**
 * The page to draw for the PowerPoint side: the converter's own, or -- when
 * it moves -- a still copy beside it, which the capture window takes from
 * the same folder.
 */
async function toStillPagePath(dirPath: string, fileName: string) {
    const html = await readPageHtml(dirPath, fileName);
    if (html === null || !/animation/i.test(html)) {
        return pathJoin(dirPath, fileName);
    }
    const stillPath = pathJoin(dirPath, `owa-still-${fileName}`);
    const stillHtml = /<\/head>/i.test(html)
        ? html.replace(/<\/head>/i, `${STILL_PAGE_STYLE}</head>`)
        : STILL_PAGE_STYLE + html;
    await fsWriteFile(stillPath, stillHtml);
    return stillPath;
}

/**
 * Each slide asked for drawn both ways -- the converter's page, as the
 * Documents list previews the deck, and the new slide -- and compared.
 */
async function measureLikeness(
    dirPath: string,
    pageList: PageType[],
    slides: AnyObjectType[],
    numbers: number[],
    size: { width: number; height: number },
) {
    const { genSlidePageHtml } = await import('./agentDocumentWordsHelpers');
    const height = Math.max(
        1,
        Math.round((COMPARE_WIDTH * size.height) / size.width),
    );
    const scoreList: SlideLikenessScoreType[] = [];
    for (let start = 0; start < numbers.length; start += CAPTURE_BATCH_SIZE) {
        const batch = numbers.slice(start, start + CAPTURE_BATCH_SIZE);
        const filePaths: string[] = [];
        for (const number of batch) {
            filePaths.push(
                await toStillPagePath(dirPath, pageList[number - 1].fileName),
            );
        }
        const reference = await capturePages({
            dirPath,
            filePaths,
            width: size.width,
            height: size.height,
        });
        const htmlTexts = await Promise.all(
            batch.map((number) => {
                return genSlidePageHtml(slides[number - 1]);
            }),
        );
        const made = await capturePages({
            htmlTexts,
            width: size.width,
            height: size.height,
        });
        if (reference === null || made === null) {
            continue;
        }
        for (let index = 0; index < batch.length; index += 1) {
            const [first, second] = await Promise.all([
                drawAsPicture(reference[index], height),
                drawAsPicture(made[index], height),
            ]);
            if (first === null || second === null) {
                continue;
            }
            scoreList.push({
                slide: batch[index],
                score: computeSsim(first, second, COMPARE_WIDTH, height),
            });
        }
    }
    return summarizeLikeness(scoreList);
}

/**
 * One page the converter wrote: a PowerPoint slide's first look, or one of
 * its build steps (`slide47_1.html`) -- each a slide of the new document,
 * the way the app presents the PowerPoint itself, a step after the slide.
 */
type PageType = {
    fileName: string;
    pptxSlideNumber: number;
    isStep: boolean;
};

function listPages(slideInfoList: PptxInfoSlideType[]) {
    return slideInfoList.flatMap((slide, index): PageType[] => {
        const fileName = String(slide.htmlFileName ?? '');
        return [
            { fileName, pptxSlideNumber: index + 1, isStep: false },
            ...toStringList(slide.subHtmlFileNames).map((stepName) => {
                return {
                    fileName: stepName,
                    pptxSlideNumber: index + 1,
                    isStep: true,
                };
            }),
        ];
    });
}

/**
 * The new document's slide numbers of the PowerPoint slides that carry
 * `key` -- a transition, videos or sounds -- each at its first look.
 */
function toSlideNumbersWith(
    slideInfoList: PptxInfoSlideType[],
    pageList: PageType[],
    key: 'transition' | 'videos' | 'audios',
) {
    const numbers: number[] = [];
    pageList.forEach((page, index) => {
        if (page.isStep) {
            return;
        }
        const value = slideInfoList[page.pptxSlideNumber - 1][key];
        const has =
            key === 'transition'
                ? value !== null && value !== undefined
                : toStringList(value).length > 0;
        if (has) {
            numbers.push(index + 1);
        }
    });
    return numbers;
}

/**
 * A PowerPoint's slides as a slide document's, or a sentence saying why
 * not. Writes nothing but the temporary folder, which it deletes.
 */
export async function convertPptxToSlides(
    pptxFilePath: string,
    likenessMode: PptxLikenessModeType = 'sample',
): Promise<PptxSlideDocumentType | { reason: string }> {
    if (!(await fsCheckFileExist(pptxFilePath))) {
        return { reason: 'That PowerPoint is not there any more.' };
    }
    const runId = crypto.randomUUID();
    // The capture window takes pages only out of a converter's own folder.
    const dirPath = pathJoin(
        getTempPath(),
        TEMP_FOLDER_NAME,
        `${runId}.pptx-htmls`,
    );
    try {
        const { pptxToHtmls } = await import('../server/pptxHelpers');
        if ((await pptxToHtmls(pptxFilePath, dirPath, false)) !== true) {
            return {
                reason:
                    'The PowerPoint could not be converted. It may be ' +
                    'damaged, locked by a password, or open in PowerPoint.',
            };
        }
        const info = await readJson(pathJoin(dirPath, 'info.json'));
        const slideInfoList: PptxInfoSlideType[] = Array.isArray(info?.slides)
            ? info.slides.slice(0, MAX_SLIDE_COUNT)
            : [];
        if (slideInfoList.length === 0) {
            return { reason: 'The PowerPoint has no slides to convert.' };
        }
        const width = Number(info?.dimensions?.width) || 1280;
        const height = Number(info?.dimensions?.height) || 720;
        const pageList = listPages(slideInfoList).slice(0, MAX_SLIDE_COUNT);
        // Every picture's largest use across the deck, then each read once.
        // A page is read, used and let go: a deck's pages are not all held
        // at once.
        const drawnMap = new Map<string, { width: number; height: number }>();
        for (const page of pageList) {
            const html = await readPageHtml(dirPath, page.fileName);
            for (const use of html === null
                ? []
                : listPptxSlideImageUses(html)) {
                const old = drawnMap.get(use.href);
                drawnMap.set(use.href, {
                    width: Math.max(old?.width ?? 0, use.width),
                    height: Math.max(old?.height ?? 0, use.height),
                });
            }
        }
        const pictureMap = new Map<string, PptxResolvedImageType | null>();
        for (const [href, drawn] of drawnMap) {
            pictureMap.set(
                href,
                await encodePicture(pathJoin(dirPath, href), drawn).catch(
                    () => {
                        return null;
                    },
                ),
            );
        }
        const missingPictureSet = new Set<string>();
        const unreadSlides: number[] = [];
        const slides: AnyObjectType[] = [];
        for (const [index, page] of pageList.entries()) {
            const slideInfo = slideInfoList[page.pptxSlideNumber - 1];
            const html = await readPageHtml(dirPath, page.fileName);
            const built =
                html === null
                    ? null
                    : toPptxSlideCanvasItems(html, {
                          width,
                          height,
                          idPrefix: `owa-${runId.slice(0, 8)}-s${index + 1}-`,
                          resolveImage: (href) => {
                              return pictureMap.get(href) ?? null;
                          },
                      });
            if (built === null) {
                unreadSlides.push(index + 1);
            }
            for (const href of built?.missingImages ?? []) {
                missingPictureSet.add(href.replace(/^images\//, ''));
            }
            // The speaker's note is the slide's, said once at its first look.
            const note =
                !page.isStep && typeof slideInfo.note === 'string'
                    ? slideInfo.note.trim()
                    : '';
            slides.push({
                id: index + 1,
                canvasItems: built?.canvasItems ?? [],
                metadata: {
                    width,
                    height,
                    ...(note === '' ? {} : { note }),
                },
                ...(slideInfo.isDisabled === true ? { isDisabled: true } : {}),
                type: 'slide',
            });
        }
        // The pictures are inside the slides now; let them go.
        pictureMap.clear();
        const numbers =
            likenessMode === 'none'
                ? []
                : likenessMode === 'all'
                  ? pickSampleSlideNumbers(slides.length, slides.length)
                  : pickSampleSlideNumbers(slides.length, SAMPLE_SLIDE_COUNT);
        const measurable = numbers.filter((number) => {
            return !unreadSlides.includes(number);
        });
        const likeness =
            measurable.length === 0
                ? null
                : await measureLikeness(dirPath, pageList, slides, measurable, {
                      width,
                      height,
                  }).catch(() => {
                      return null;
                  });
        return {
            slides,
            width,
            height,
            pptxSlideCount: slideInfoList.length,
            stepSlideCount: pageList.filter((page) => {
                return page.isStep;
            }).length,
            hiddenSlideCount: slides.filter((slide) => {
                return slide.isDisabled === true;
            }).length,
            missingFonts: toStringList(info?.missingFontFamily),
            leftOut: {
                pictures: Array.from(missingPictureSet),
                videoSlides: toSlideNumbersWith(
                    slideInfoList,
                    pageList,
                    'videos',
                ),
                audioSlides: toSlideNumbersWith(
                    slideInfoList,
                    pageList,
                    'audios',
                ),
                transitionSlides: toSlideNumbersWith(
                    slideInfoList,
                    pageList,
                    'transition',
                ),
                unreadSlides,
            },
            likeness,
        };
    } finally {
        await fsDeleteDir(dirPath).catch((error) => {
            console.warn('A converted copy could not be deleted:', error);
        });
    }
}
