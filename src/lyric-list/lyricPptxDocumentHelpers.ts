import { dirSourceSettingNames } from '../helper/constants';
import DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
import { getActiveDirSourceSettingName } from '../media-sessions/folderSessionHelpers';
import { genFreeFilePath } from '../resources/resourcesCopyHelpers';
import { fsWriteFile, pathBasename } from '../server/fileHelpers';

/**
 * **Save in PPTX in Documents**, the PowerPoint options dialog's own button
 * here (`addSavePptxInDocumentsAction`): the very deck Download would save,
 * put in the Documents list being looked at instead -- the session the
 * operator is on, as a lyric made from a verse is -- so it can be presented
 * from there like any PowerPoint. A name already taken there gets the next
 * free one (`Song (1).pptx`); nothing is overwritten.
 *
 * Loaded only when the button is pressed. What it returns is the dialog's
 * finished status, on the preview's progress line; a throw reads "Export
 * failed" there.
 */
export async function savePptxInDocuments(blob: Blob, fileFullName: string) {
    const dirSource = await DirSource.getInstance(
        getActiveDirSourceSettingName(dirSourceSettingNames.APP_DOCUMENT),
    );
    if (!dirSource.isDirPathValid) {
        throw new Error('Documents directory is unavailable');
    }
    const filePath = await genFreeFilePath(dirSource.dirPath, fileFullName);
    await fsWriteFile(filePath, Buffer.from(await blob.arrayBuffer()));
    dirSource.fireRefreshEvent();
    return `${tran('Saved')}: ${pathBasename(filePath)}`;
}
