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

export async function getPptxMissingFontFamilyList(
    filePath: string,
): Promise<string[]> {
    // Read only the small info.json (already short-lived cached) — no HTML/media
    // reads and no preview regeneration; returns [] when the preview isn't
    // generated yet.
    const outDir = toPptxHtmlsPreviewDirPath(filePath);
    const infoFilePath = pathJoin(outDir, 'info.json');
    const infoFileSource = FileSource.getInstance(infoFilePath);
    const infoData = await infoFileSource.readFileJsonData();
    return (infoData?.missingFontFamily as string[] | undefined) ?? [];
}
