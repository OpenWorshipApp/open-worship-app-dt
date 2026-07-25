import { unlocking } from './electronHelpers';
import { execute } from './processHelpers';

type PdfImagePreviewDataType = {
    isSuccessful: boolean;
    message?: string;
    filePaths?: string[];
};

function genImage(filePath: string, outDir: string, width: number) {
    return execute<PdfImagePreviewDataType>('pdf-to-images.mjs', {
        filePath,
        outDir,
        width,
    });
}

// A small LRU: caching every converted PDF forever grows memory unbounded,
// so keep only the few most recently used results.
const DATA_MAP_MAX_SIZE = 3;
const dataMap = new Map<string, PdfImagePreviewDataType>();
function setCachedData(filePath: string, data: PdfImagePreviewDataType) {
    // Re-inserting moves the key to the end, so the first key is always the
    // least recently used one.
    dataMap.delete(filePath);
    dataMap.set(filePath, data);
    while (dataMap.size > DATA_MAP_MAX_SIZE) {
        const oldestKey = dataMap.keys().next().value;
        if (oldestKey === undefined) {
            break;
        }
        dataMap.delete(oldestKey);
    }
}
export function pdfToImages(
    filePath: string,
    outDir: string,
    width: number,
    isForce: boolean,
) {
    return unlocking<PdfImagePreviewDataType>(filePath, async () => {
        if (isForce) {
            dataMap.delete(filePath);
        }
        const cachedData = dataMap.get(filePath);
        if (cachedData !== undefined) {
            setCachedData(filePath, cachedData);
            return cachedData;
        }
        const data = await genImage(filePath, outDir, width);
        setCachedData(filePath, data);
        return data;
    });
}

const COUNT_FRESH_MILLISECONDS = 1000 * 3;
const countMap = new Map<string, { date: number; count: number }>();
function deleteStaleCounts() {
    const now = Date.now();
    for (const [key, value] of countMap) {
        if (now - value.date > COUNT_FRESH_MILLISECONDS) {
            countMap.delete(key);
        }
    }
}
export async function getPagesCount(filePath: string) {
    return unlocking<number | null>(`count-pages-${filePath}`, async () => {
        deleteStaleCounts();
        if (!countMap.has(filePath)) {
            const count = await execute<number | null>('count-pdf-pages.mjs', {
                filePath,
            });
            if (count !== null) {
                countMap.set(filePath, { count, date: Date.now() });
            }
        }
        const data = countMap.get(filePath);
        if (data) {
            return data.count;
        }
        return null;
    });
}
