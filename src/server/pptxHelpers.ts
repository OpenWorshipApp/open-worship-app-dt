import FileSource from '../helper/FileSource';
import { type AnyObjectType } from '../helper/typeHelpers';
import { tran } from '../lang/langHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { electronSendAsync } from './appHelpers';
import appProvider from './appProvider';
import { fsDeleteDir, fsReadFile, pathJoin } from './fileHelpers';
import { unlocking } from './unlockingHelpers';

function toPptxHtmlsPreviewDirPath(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    return appProvider.pathUtils.resolve(
        fileSource.baseDirPath,
        `${fileSource.fullName}-htmls`,
    );
}

export async function removePptxHtmlsPreview(filePath: string) {
    const outDir = toPptxHtmlsPreviewDirPath(filePath);
    return await fsDeleteDir(outDir);
}

export async function getSlidesCount(filePath: string) {
    const count = await electronSendAsync<number | null>(
        'main:app:ms-pp-slides-count',
        { filePath },
    );
    return count;
}

export async function pptxToHtmls(filePath: string, outDir: string) {
    const progressBarKey = `Exporting PPTX Slides "${FileSource.getInstance(filePath).name}"`;
    showSimpleToast(
        tran('Exporting PPTX Slides'),
        tran('Please wait while the slides are being exported...'),
    );
    showProgressBar(progressBarKey);
    const isSuccess = await electronSendAsync<boolean>(
        'main:app:pptx-to-htmls',
        { filePath, outDir },
    );
    hideProgressBar(progressBarKey);
    return isSuccess;
}

export async function getPptxToHtmlsVersion() {
    const version = await electronSendAsync<string>(
        'main:app:get-pptx-to-htmls-version',
    );
    return version;
}

export type PptxSlideDataType100 = {
    htmlFileName: string;
    htmlFilePath: string;
    html: string;
    subHtmlFileNames: string[];
    subHtmlFilePaths: string[];
    subHtmls: string[];
    isDisabled: boolean;
    note: string | null;
    images: string[];
    videos: string[];
    audios: string[];
};
export type PptxDataType100 = {
    info: {
        toolName: string;
        toolVersion: '1.0.0';
        exportedAt: Date;
        pptxFileName: string;
        dimensions: {
            width: number;
            height: number;
        };
        checksum: {
            sha256: string;
            md5: string;
        };
        fontFamily: string[];
        embeddedFontFamily: string[];
        missingFontFamily: string[];
        slides: PptxSlideDataType100[];
    };
    baseDir: string;
};
export function getPptxData(filePath: string): Promise<PptxDataType100 | null> {
    const key = `get-pptx-data-${filePath}`;
    return unlocking<PptxDataType100 | null>(key, async () => {
        const fileMd5 = await appProvider.systemUtils.generateFileMD5(filePath);
        const outDir = toPptxHtmlsPreviewDirPath(filePath);
        const infoFilePath = pathJoin(outDir, 'info.json');
        const infoFileSource = FileSource.getInstance(infoFilePath);
        let infoData: AnyObjectType | null = null;
        let i = 0;
        while (i < 3) {
            infoData = await infoFileSource.readFileJsonData();
            if (infoData !== null) {
                if (infoData.checksum?.md5 === fileMd5) {
                    break;
                }
                await removePptxHtmlsPreview(filePath);
                infoData = null;
            }
            await pptxToHtmls(filePath, outDir);
            i += 1;
        }
        if (infoData === null) {
            return null;
        }
        const slides = infoData.slides as any[];
        slides.forEach((slide) => {
            slide.htmlFilePath = pathJoin(outDir, slide.htmlFileName);
            slide.subHtmlFilePaths = slide.subHtmlFileNames.map(
                (fileName: string) => {
                    return pathJoin(outDir, fileName);
                },
            );
        });
        infoData.slides = await Promise.all(
            slides.map(async (slide) => {
                const html = await fsReadFile(slide.htmlFilePath);
                const subHtmls = await Promise.all(
                    slide.subHtmlFilePaths.map((subHtmlFilePath: string) => {
                        return fsReadFile(subHtmlFilePath);
                    }),
                );
                return {
                    ...slide,
                    html,
                    subHtmls,
                };
            }),
        );
        const data: PptxDataType100 = {
            info: infoData as PptxDataType100['info'],
            baseDir: outDir,
        };
        return data;
    });
}

/**
 * The small `info.json` of an already-generated preview, and nothing else: no
 * full-file MD5, no HTML/media reads, no preview regeneration. `null` while
 * the preview is not generated yet. `readFileJsonData` is short-lived cached.
 *
 * `getPptxData` is the full path -- it hashes the WHOLE pptx to validate the
 * preview and reads every slide's html. Anything that runs per pptx in the
 * folder (the Audios panel, the missing-font banner) must come through here.
 */
async function readPptxInfoDataQuick(
    filePath: string,
): Promise<AnyObjectType | null> {
    const outDir = toPptxHtmlsPreviewDirPath(filePath);
    const infoFilePath = pathJoin(outDir, 'info.json');
    const infoFileSource = FileSource.getInstance(infoFilePath);
    return await infoFileSource.readFileJsonData();
}

export async function getPptxMissingFontFamilyList(
    filePath: string,
): Promise<string[]> {
    const infoData = await readPptxInfoDataQuick(filePath);
    return (infoData?.missingFontFamily as string[] | undefined) ?? [];
}

export type PptxSlideAudioDataQuickType = {
    // Index into `getSlides()`, whose slot 0 is the blank slide -- so for a
    // real slide the index and the id are the same number.
    slideIndex: number;
    slideId: number;
    filePaths: string[];
};

/**
 * Which slides carry audio, read from `info.json` alone.
 *
 * Measured 2026-09-15 (`EN-12`): the Audios panel asked this of EVERY pptx in
 * the Documents folder through `getSlides()` on mount and on every folder
 * refresh, and `getPptxData` hashes the whole file first -- 10 files, 54 MB,
 * ~150 ms of renderer CPU per pass on an SSD, unbounded on a church laptop's
 * HDD with a folder of forty. The list may lag a pptx replaced outside the app
 * until that document is next opened, which regenerates the preview.
 */
export async function getPptxSlideAudioDataListQuick(
    filePath: string,
): Promise<PptxSlideAudioDataQuickType[]> {
    const infoData = await readPptxInfoDataQuick(filePath);
    const slides = infoData?.slides;
    if (!Array.isArray(slides)) {
        return [];
    }
    const outDir = toPptxHtmlsPreviewDirPath(filePath);
    const audioDataList: PptxSlideAudioDataQuickType[] = [];
    slides.forEach((slide, i) => {
        const audios: unknown = slide?.audios;
        if (!Array.isArray(audios) || audios.length === 0) {
            return;
        }
        audioDataList.push({
            slideIndex: i + 1,
            slideId: i + 1,
            filePaths: audios.map((audioPath) => {
                return pathJoin(outDir, String(audioPath));
            }),
        });
    });
    return audioDataList;
}
