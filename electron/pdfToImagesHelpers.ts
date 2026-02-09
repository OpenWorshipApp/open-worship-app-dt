import { unlocking } from './electronHelpers';
import { execute } from './processHelpers';

type PdfImagePreviewDataType = {
    isSuccessful: boolean;
    message?: string;
    filePaths?: string[];
};

function genImage(filePath: string, outDir: string) {
    return execute<PdfImagePreviewDataType>('pdf-to-images.mjs', {
        filePath,
        outDir,
    });
}

const dataMap = new Map<string, PdfImagePreviewDataType>();
export function pdfToImages(
    filePath: string,
    outDir: string,
    isForce: boolean,
) {
    return unlocking<PdfImagePreviewDataType>(filePath, async () => {
        if (isForce) {
            dataMap.delete(filePath);
        }
        if (dataMap.has(filePath)) {
            return dataMap.get(filePath)!;
        }
        const data = await genImage(filePath, outDir);
        dataMap.set(filePath, data);
        return data;
    });
}

const countMap = new Map<string, { date: number; count: number }>();
export async function getPagesCount(filePath: string) {
    return unlocking<number | null>(`count-pages-${filePath}`, async () => {
        let data = countMap.get(filePath);
        const now = Date.now();
        const threeSeconds = 1000 * 3;
        if (!data || now - data.date > threeSeconds) {
            const count = await execute<number | null>('count-pdf-pages.mjs', {
                filePath,
            });
            if (count !== null) {
                countMap.set(filePath, { count, date: Date.now() });
            }
        }
        data = countMap.get(filePath);
        if (data) {
            return data.count;
        }
        return null;
    });
}
