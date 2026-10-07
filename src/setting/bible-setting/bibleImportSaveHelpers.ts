import { checkAgentFileName } from '../../../tools/owa-devtools-mcp/agentFileName.mjs';
import { getDownloadedBibleInfoList } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { tran } from '../../lang/langHelpers';
import { fsCheckFileExist } from '../../server/fileHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { checkIsBibleKeyTaken } from './bibleKeyHelpers';
import {
    bibleKeyToXMLFilePath,
    getAllXMLFileKeys,
    type BibleXMLJsonType,
} from './bibleXMLJsonDataHelpers';
import { saveJsonDataToXMLfile } from './bibleXMLHelpers';

// Recheck after the user has spent time choosing maps. An import must never
// replace a key installed while its review dialog was open.
export async function saveNewBibleImport(data: BibleXMLJsonType) {
    return unlocking('bible-xml-import', async () => {
        const key = data.info.key;
        if (!key.trim() || checkAgentFileName(key) !== null)
            throw new Error(tran('Invalid Bible key'));
        const keys = Object.keys(await getAllXMLFileKeys());
        const downloaded = await getDownloadedBibleInfoList();
        if (downloaded === null) return false;
        keys.push(...downloaded.map((item) => item.key));
        const path = await bibleKeyToXMLFilePath(key, true);
        if (
            !path ||
            checkIsBibleKeyTaken(key, keys) ||
            (await fsCheckFileExist(path))
        ) {
            throw new Error(tran('Key is already taken'));
        }
        const saved = await saveJsonDataToXMLfile(data);
        return saved;
    });
}
