import CacheManager from '../others/CacheManager';
import { electronSendAsync } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckDirExist,
    fsCreateDir,
    fsDeleteDir,
    fsListFiles,
} from '../server/fileHelpers';
import FileSource from './FileSource';
import { appError } from './loggerHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import {
    finishPdfConversion,
    startPdfConversion,
    updatePdfConversion,
} from './pdfConversionProgress';

function toPdfImagesPreviewDirPath(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    return appProvider.pathUtils.resolve(
        fileSource.baseDirPath,
        `${fileSource.fullName}-images`,
    );
}

export function removePdfImagesPreview(filePath: string) {
    const outDir = toPdfImagesPreviewDirPath(filePath);
    return fsDeleteDir(outDir);
}

type PdfItemViewInfoType = {
    src: string;
    pageNumber: number;
    width: number;
    height: number;
};

const srcSizeCacheManager = new CacheManager<{ width: number; height: number }>(
    10,
);

// A PNG stores its dimensions in the IHDR chunk: an 8-byte signature, then a
// 4-byte length and the 4-byte type `IHDR`, then width and height as
// big-endian uint32s at offsets 16 and 20. So 24 bytes answer the question
// that decoding the whole file also answers.
const PNG_HEADER_READ_BYTES = 24;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Reads width/height straight out of the PNG header instead of decoding the
 * image. Decoding an 88-page PDF's previews cost ~163MB of bitmap (every page
 * in flight at once, via the `Promise.all` below) and ~180ms; the header read
 * is ~2KB and ~10ms for the same pages, and returns byte-identical values —
 * `pdf-to-images.mjs` writes the pixmap dimensions into IHDR.
 *
 * Returns null for anything that is not a well-formed PNG so the caller can
 * fall back to decoding.
 */
function readPngSize(filePath: string) {
    const fileUtils = appProvider.fileUtils;
    let fileDescriptor: number | null = null;
    try {
        fileDescriptor = fileUtils.openSync(filePath, 'r');
        const buffer = Buffer.alloc(PNG_HEADER_READ_BYTES);
        const bytesRead = fileUtils.readSync(
            fileDescriptor,
            buffer,
            0,
            PNG_HEADER_READ_BYTES,
            0,
        );
        if (bytesRead < PNG_HEADER_READ_BYTES) {
            return null;
        }
        const isPng = PNG_SIGNATURE.every((byte, index) => {
            return buffer[index] === byte;
        });
        if (!isPng || buffer.toString('latin1', 12, 16) !== 'IHDR') {
            return null;
        }
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width === 0 || height === 0) {
            return null;
        }
        return { width, height };
    } catch (_error) {
        // let the caller fall back to decoding the image
        return null;
    } finally {
        if (fileDescriptor !== null) {
            try {
                fileUtils.closeSync(fileDescriptor);
            } catch (_error) {
                /* already closed or never opened cleanly */
            }
        }
    }
}

function decodeImageSize(src: string) {
    return new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = function () {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = function () {
            resolve({ width: 0, height: 0 });
        };
        img.src = src;
    });
}

async function getImageSize(src: string, filePath?: string) {
    let size = await srcSizeCacheManager.get(src);
    if (size !== null) {
        return size;
    }
    size =
        (filePath === undefined ? null : readPngSize(filePath)) ??
        (await decodeImageSize(src));
    await srcSizeCacheManager.set(src, size);
    return size;
}
async function genPdfImagePreviewInfo(
    filePath: string,
): Promise<PdfItemViewInfoType | null> {
    const fileSource = FileSource.getInstance(filePath);
    const pageNumber = Number.parseInt(fileSource.name.split('-')[1]);
    const { width, height } = await getImageSize(fileSource.src, filePath);
    return { src: fileSource.src, pageNumber, width, height };
}

function sortPdfImagePreviewInfo(items: PdfItemViewInfoType[]) {
    items.sort((a, b) => {
        if (a.pageNumber < b.pageNumber) {
            return -1;
        }
        if (a.pageNumber > b.pageNumber) {
            return 1;
        }
        return 0;
    });
    return items;
}

async function genPdfImagesPreviewImpl(
    filePath: string,
    isForce = false,
): Promise<PdfItemViewInfoType[] | null> {
    const outDir = toPdfImagesPreviewDirPath(filePath);
    if (!isForce && (await fsCheckDirExist(outDir))) {
        let fileList = await fsListFiles(outDir);
        fileList = fileList
            .filter((fileFullName) => {
                return fileFullName.toLowerCase().endsWith('.png');
            })
            .map((fileFullName) => {
                return appProvider.pathUtils.resolve(outDir, fileFullName);
            });
        if (fileList.length > 0) {
            const pagesCount = await electronSendAsync<number>(
                'main:app:pdf-pages-count',
                { filePath },
            );
            if (fileList.length !== pagesCount) {
                return null;
            }
            const imageFileInfoList = await Promise.all(
                fileList.map(genPdfImagePreviewInfo),
            );
            if (imageFileInfoList.includes(null)) {
                return null;
            }
            return sortPdfImagePreviewInfo(
                imageFileInfoList as PdfItemViewInfoType[],
            );
        }
    }
    await fsDeleteDir(outDir);
    await fsCreateDir(outDir);
    const progressTitle = tran('Exporting PDF Images');
    const progressBarKey = `${progressTitle}: ${FileSource.getInstance(filePath).fullName}`;
    if (startPdfConversion(filePath)) {
        showSimpleToast(
            progressTitle,
            tran('Please wait while the PDF pages are being exported...'),
        );
        showProgressBar(progressBarKey);
    }
    let previewData: {
        isSuccessful: boolean;
        message?: string;
        filePaths?: string[];
    };
    try {
        previewData = await electronSendAsync(
            'main:app:pdf-to-images',
            { filePath, outDir, isForce: true },
            (progress: { completed: number; total: number }) => {
                updatePdfConversion(
                    filePath,
                    progress.completed,
                    progress.total,
                );
            },
        );
    } finally {
        if (finishPdfConversion(filePath)) {
            hideProgressBar(progressBarKey);
        }
    }
    if (!previewData.isSuccessful || !previewData.filePaths) {
        appError('Failed to generate PDF images preview:', previewData.message);
        return null;
    }
    const imageFileInfoList = await Promise.all(
        previewData.filePaths.map(genPdfImagePreviewInfo),
    );
    if (imageFileInfoList.includes(null)) {
        return null;
    }
    return sortPdfImagePreviewInfo(imageFileInfoList as PdfItemViewInfoType[]);
}

// Several mounted slide views can request the same PDF at once. Share their
// work so a second view does not delete the first view's partial output or
// start another conversion after it.
const pendingPreviewMap = new Map<
    string,
    Promise<PdfItemViewInfoType[] | null>
>();

export function genPdfImagesPreview(filePath: string, isForce = false) {
    const pending = pendingPreviewMap.get(filePath);
    if (pending) {
        return pending;
    }
    const promise = (async () => {
        try {
            return await genPdfImagesPreviewImpl(filePath, isForce);
        } finally {
            pendingPreviewMap.delete(filePath);
        }
    })();
    pendingPreviewMap.set(filePath, promise);
    return promise;
}
