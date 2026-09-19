import { resolve } from 'node:path';
import {
    getSlidesCount as pptxGetSlidesCount,
    getVersion as pptxGetVersion,
    exportPptx as pptxExportHtmls,
} from 'pptx-to-html';
import {
    getVersion as docxGetVersion,
    exportDocx as docxExportHtmls,
} from 'docx-to-html';

import { isWindows, toUnpackedPath } from './electronHelpers';

export function getBinaryPath() {
    const basePath = toUnpackedPath(resolve(__dirname, '../bin-helper'));
    const eot2ttfPath = resolve(
        basePath,
        'ms-helpers',
        'tools',
        'eot2ttf',
        `eot2ttf${isWindows ? '.exe' : ''}`,
    );
    return { eot2ttfPath };
}

export type DocxToHtmlsParamsType = {
    filePath: string;
    outDir: string;
};

export function docxToHtmls({ filePath, outDir }: DocxToHtmlsParamsType) {
    try {
        docxExportHtmls(filePath, outDir);
        return true;
    } catch (error) {
        console.error(error);
    }
    return false;
}
export function getDocxToHtmlsVersion() {
    return docxGetVersion();
}

export type PptxToHtmlsParamsType = {
    filePath: string;
    outDir: string;
};
export function pptxToHtmls({ filePath, outDir }: PptxToHtmlsParamsType) {
    try {
        const { eot2ttfPath } = getBinaryPath();
        pptxExportHtmls(filePath, outDir, eot2ttfPath);
        return true;
    } catch (error) {
        console.error(error);
    }
    return false;
}
export function getPptxToHtmlsVersion() {
    return pptxGetVersion();
}
export function getPptxSlidesCount(filePath: string) {
    return pptxGetSlidesCount(filePath);
}
