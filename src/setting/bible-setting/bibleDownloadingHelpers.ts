import { useState } from 'react';

import { handleError } from '../../helper/errorHelpers';
import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import {
    BIBLE_DOWNLOAD_TOAST_TITLE,
    downloadBible,
    extractDownloadedBible,
} from '../../helper/bible-helpers/bibleDownloadHelpers';
import { getBibleInfo } from '../../helper/bible-helpers/bibleInfoHelpers';
import { getLangDataAsync } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';

async function syncBibleLanguage(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey, true);
    if (bibleInfo === null) {
        const message = 'Cannot get bible info';
        showSimpleToast('Getting Bible Info', message);
        throw new Error('Cannot get bible info');
    }
    await getLangDataAsync(bibleInfo.locale);
}

export function useDownloadBible(
    bibleInfo: BibleMinimalInfoType,
    onDownloaded: () => void,
): [number | null, () => void] {
    const [downloadingProgress, setDownloadingProgress] = useState<
        number | null
    >(null);
    const handleDoneDownloaded = async (error: any, filePath?: string) => {
        if (error) {
            handleError(error);
        } else {
            const isSuccess = await extractDownloadedBible(filePath as string);
            if (isSuccess) {
                await syncBibleLanguage(bibleInfo.key);
            } else {
                showSimpleToast('Extracting Bible', 'Fail to extract bible');
            }
            onDownloaded();
        }
        setDownloadingProgress(null);
    };
    const startDownloadBible = () => {
        bibleDataReader.clearBibleDatabaseData(bibleInfo.key);
        setDownloadingProgress(0);
        downloadBible({
            bibleInfo,
            options: {
                onStart: (total) => {
                    const fileSize = Number.parseInt(total.toFixed(2));
                    showSimpleToast(
                        BIBLE_DOWNLOAD_TOAST_TITLE,
                        `Start downloading "${bibleInfo.key}". ` +
                            `File size ${fileSize}mb`,
                    );
                },
                onProgress: (percentage) => {
                    setDownloadingProgress(percentage);
                },
                onDone: async (error, filePath) => {
                    await getBibleInfo(bibleInfo.key, true);
                    handleDoneDownloaded(error, filePath);
                },
            },
        });
    };
    return [downloadingProgress, startDownloadBible];
}
