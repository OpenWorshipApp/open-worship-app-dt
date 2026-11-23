import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    getSlidesCount as pptxGetSlidesCount,
    getVersion as pptxGetVersion,
    exportPptx as pptxExportHtmls,
} from 'pptx-to-html-conv';
import {
    getVersion as docxGetVersion,
    exportDocx as docxExportHtmls,
} from 'docx-to-html-conv';

import enFonts from '../src/lang/data/en/fonts.json';
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
    // Build the slides without their own background, so what the app puts
    // behind them shows through. Absent (the help window's words-only
    // conversions) is `false`, the converter's own default.
    noBackground?: boolean;
};

/**
 * The converter does not say in `info.json` whether the background was left
 * out, and the renderer has to know whether a preview on disk was built the
 * way the deck is asked for now (`getPptxData`), so it is written in here,
 * beside the md5 and the version it already compares.
 */
function stampPptxInfo(outDir: string, noBackground: boolean) {
    const infoFilePath = resolve(outDir, 'info.json');
    // The converter opens the file with a byte-order mark, which
    // `JSON.parse` refuses.
    const text = readFileSync(infoFilePath, 'utf8').replace(/^\uFEFF/, '');
    const info = JSON.parse(text);
    info.noBackground = noBackground;
    writeFileSync(infoFilePath, JSON.stringify(info, null, 2));
}

// English's face, the app's default on every page, registered in the presenter
// and in the screen window alike. The converter puts it in front of the
// generic family closing each font list, so a face of the deck the computer
// lacks is drawn in it, not in Arial. Read from English's own package, the one
// place it is named: `tsc` copies the file into `electron-build/`.
const PPTX_DEFAULT_FONT_FAMILY = enFonts.uiFamily;

export function pptxToHtmls({
    filePath,
    outDir,
    noBackground,
}: PptxToHtmlsParamsType) {
    // Over IPC: anything but a real `true` is the default.
    const isNoBackground = noBackground === true;
    try {
        const { eot2ttfPath } = getBinaryPath();
        pptxExportHtmls(
            filePath,
            outDir,
            eot2ttfPath,
            isNoBackground,
            PPTX_DEFAULT_FONT_FAMILY,
        );
        stampPptxInfo(outDir, isNoBackground);
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
