import FileSource from '../helper/FileSource';
import { type AnyObjectType } from '../helper/typeHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { electronSendAsync } from './appHelpers';
import appProvider from './appProvider';
import { fsDeleteDir, pathJoin } from './fileHelpers';
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

type PptxToHtmlsDataType = {
    isSuccessful: boolean;
    message?: string;
};
export async function pptxToHtmls(filePath: string, outDir: string) {
    const progressBarKey = `Exporting PPTX Slides "${FileSource.getInstance(filePath).name}"`;
    showProgressBar(progressBarKey);
    const result = await electronSendAsync<PptxToHtmlsDataType>(
        'main:app:pptx-to-htmls',
        { filePath, outDir },
    );
    hideProgressBar(progressBarKey);
    return result;
}

let version: string | null = null;
type PptxToHtmlsVersionDataType = {
    version: string | null;
    message?: string;
};
export function getPptxToHtmlsVersion() {
    return unlocking('get-pptx-to-htmls-version', async () => {
        if (version !== null) {
            return version;
        }
        const result = await electronSendAsync<PptxToHtmlsVersionDataType>(
            'main:app:get-pptx-to-htmls-version',
        );
        version = result.version;
        return result.version;
    });
}
getPptxToHtmlsVersion();

export type PptxSlideDataType100 = {
    htmlFileName: string;
    htmlFilePath: string;
    subSlideFileNames: string[];
    subSlideFilePaths: string[];
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
    bashDirPath: string;
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
            slide.subSlideFilePaths = slide.subSlideFileNames.map(
                (fileName: string) => pathJoin(outDir, fileName),
            );
        });
        infoData.slides = slides;
        const data: PptxDataType100 = {
            info: infoData as PptxDataType100['info'],
            bashDirPath: outDir,
        };
        return data;
    });
}

export async function removeSlideBackground(filePath: string) {
    // TODO: this function should not work yet, need to be fixed in the future
    const isSuccess = await electronSendAsync<boolean>(
        'main:app:ms-pp-remove-slides-bg',
        { filePath },
    );
    return isSuccess;
}
