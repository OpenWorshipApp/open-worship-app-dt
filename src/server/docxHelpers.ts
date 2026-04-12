import FileSource from '../helper/FileSource';
import { type AnyObjectType } from '../helper/typeHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { electronSendAsync } from './appHelpers';
import appProvider from './appProvider';
import { fsDeleteDir, fsReadFile, pathJoin } from './fileHelpers';
import { unlocking } from './unlockingHelpers';

function toDocxHtmlsPreviewDirPath(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    return appProvider.pathUtils.resolve(
        fileSource.baseDirPath,
        `${fileSource.fullName}-docx-htmls`,
    );
}

export async function removeDocxHtmlsPreview(filePath: string) {
    const outDir = toDocxHtmlsPreviewDirPath(filePath);
    return await fsDeleteDir(outDir);
}

type DocxToHtmlsDataType = {
    isSuccessful: boolean;
    message?: string;
};

export async function docxToHtmls(filePath: string, outDir: string) {
    const progressBarKey = `Exporting DOCX Pages "${FileSource.getInstance(filePath).name}"`;
    showProgressBar(progressBarKey);
    const result = await electronSendAsync<DocxToHtmlsDataType>(
        'main:app:docx-to-htmls',
        { filePath, outDir },
    );
    hideProgressBar(progressBarKey);
    return result;
}

let version: string | null = null;
type DocxToHtmlsVersionDataType = {
    version: string | null;
    message?: string;
};

export function getDocxToHtmlsVersion() {
    return unlocking('get-docx-to-htmls-version', async () => {
        if (version !== null) {
            return version;
        }
        const result = await electronSendAsync<DocxToHtmlsVersionDataType>(
            'main:app:get-docx-to-htmls-version',
        );
        version = result.version;
        return result.version;
    });
}

export type DocxPageDataType100 = {
    htmlFileName: string;
    htmlFilePath: string;
    html: string;
    width: number;
    height: number;
};

export type DocxDataType100 = {
    info: {
        toolName: string;
        toolVersion: '1.0.0';
        exportedAt: string;
        docxFileName: string;
        checksum: {
            sha256: string;
            md5: string;
        };
        fontFamily: string[];
        embeddedFontFamily: string[];
        missingFontFamily: string[];
        pages: DocxPageDataType100[];
    };
    baseDirPath: string;
};

export function getDocxData(filePath: string): Promise<DocxDataType100 | null> {
    const key = `get-docx-data-${filePath}`;
    return unlocking<DocxDataType100 | null>(key, async () => {
        const fileMd5 = await appProvider.systemUtils.generateFileMD5(filePath);
        const outDir = toDocxHtmlsPreviewDirPath(filePath);
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
                await removeDocxHtmlsPreview(filePath);
                infoData = null;
            }
            await docxToHtmls(filePath, outDir);
            i += 1;
        }
        if (infoData === null) {
            return null;
        }
        const pages = (infoData.pages as any[]).map(async (page) => {
            const htmlFilePath = pathJoin(outDir, page.htmlFileName);
            const html = await fsReadFile(htmlFilePath);
            return {
                ...page,
                htmlFilePath,
                html,
            };
        });
        infoData.pages = await Promise.all(pages);
        return {
            info: infoData as DocxDataType100['info'],
            baseDirPath: outDir,
        };
    });
}
