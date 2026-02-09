import { resolve } from 'node:path';
import { toUnpackedPath, unlocking } from './electronHelpers';
import { execute } from './processHelpers';

function getBinaryPath(dotNetRoot?: string) {
    const basePath = toUnpackedPath(resolve(__dirname, '../bin-helper'));
    const dotnetPath = dotNetRoot ?? resolve(basePath, 'bin');
    const modulePath = resolve(basePath, 'node-api-dotnet', 'net8.0');
    const binaryPath = resolve(basePath, 'net8.0', 'Helper');
    return { modulePath, binaryPath, dotnetPath };
}

const countMap = new Map<string, { date: number; count: number }>();
export async function countSlides(filePath: string, dotNetRoot?: string) {
    return unlocking<number | null>(
        `count-ms-pp-slides-${filePath}`,
        async () => {
            let data = countMap.get(filePath);
            const now = Date.now();
            const threeSeconds = 1000 * 3;
            if (!data || now - data.date > threeSeconds) {
                const { modulePath, binaryPath, dotnetPath } =
                    getBinaryPath(dotNetRoot);
                const count = await execute<number | null>(
                    'count-ms-pp-slides.js',
                    {
                        filePath,
                        modulePath,
                        binaryPath,
                        dotnetPath,
                    },
                );
                if (count !== null) {
                    countMap.set(filePath, { count, date: Date.now() });
                }
            }
            data = countMap.get(filePath);
            if (data) {
                return data.count;
            }
            return null;
        },
    );
}

export async function removeSlideBackground(
    filePath: string,
    dotNetRoot?: string,
) {
    return unlocking<number | null>(
        `remove-ms-pp-slides-bg-${filePath}`,
        async () => {
            const { modulePath, binaryPath, dotnetPath } =
                getBinaryPath(dotNetRoot);
            const isSuccess = await execute<number | null>(
                'remove-ms-pp-slides-bg.js',
                {
                    filePath,
                    modulePath,
                    binaryPath,
                    dotnetPath,
                },
            );
            return isSuccess;
        },
    );
}

export async function exportBibleMSWord(
    filePath: string,
    data: object[],
    dotNetRoot?: string,
) {
    return unlocking<number | null>(
        `export-bible-ms-word-${filePath}`,
        async () => {
            const { modulePath, binaryPath, dotnetPath } =
                getBinaryPath(dotNetRoot);
            const isSuccess = await execute<number | null>(
                'export-bible-ms-word.js',
                {
                    filePath,
                    data,
                    modulePath,
                    binaryPath,
                    dotnetPath,
                },
            );
            return isSuccess;
        },
    );
}
