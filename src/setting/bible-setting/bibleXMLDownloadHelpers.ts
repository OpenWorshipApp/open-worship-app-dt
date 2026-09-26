import FileSource from '../../helper/FileSource';
import { handleError } from '../../helper/errorHelpers';
import { tran } from '../../lang/langHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import {
    fsWriteFile,
    getDownloadPath,
    pathJoin,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getBibleXMLDataFromKey } from './bibleXMLHelpers';

export async function downloadBibleJSON(bibleKey: string) {
    try {
        const bibleXMLData = await getBibleXMLDataFromKey(bibleKey);
        if (bibleXMLData === null) {
            showSimpleToast(
                tran('Download'),
                `${tran('Bible XML data not found')}: "${bibleKey}"`,
            );
            return null;
        }
        const initialFilePath = pathJoin(getDownloadPath(), `${bibleKey}.json`);
        const filePath =
            await FileSource.getInstance(initialFilePath).genNextFilePath();
        await fsWriteFile(filePath, JSON.stringify(bibleXMLData, null, 2));
        showSimpleToast(
            tran('Download Completed'),
            `${tran('File saved at:')} ${filePath}`,
        );
        showFileOrDirExplorer(filePath);
        return filePath;
    } catch (error) {
        handleError(error);
        showSimpleToast(tran('Download'), tran('Failed to save Bible data'));
        return null;
    }
}
