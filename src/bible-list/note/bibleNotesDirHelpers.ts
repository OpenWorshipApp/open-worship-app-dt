import { dirSourceSettingNames } from '../../helper/constants';
import { getDirPathBySettingName } from '../../helper/dirSourcePathHelpers';
import { getActiveDirSourceSettingName } from '../../media-sessions/folderSessionHelpers';

/**
 * The Bible Notes folder of the session in front -- where a note or a study
 * made from outside the list lands (`Note.getDirSourceSettingName`), so it
 * shows in the list being looked at. Setting reads and nothing more: the help
 * window asks it to name a study kept in Bible Notes (EC-509). Null while no
 * data folder is in use or none is set.
 */
export function getActiveBibleNotesDirPath() {
    return getDirPathBySettingName(
        getActiveDirSourceSettingName(dirSourceSettingNames.BIBLE_NOTES),
    );
}
