import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { subscribeMediaSessionStrips } from './mediaSessionData';
import { getActiveDirSourceSettingName } from './folderSessionHelpers';

/**
 * The folder setting of a list's active session, for a view that shows the
 * list's files WITHOUT being the list -- the Background Audios tab's songs
 * with audio in them, read off the Documents folder. Re-renders when any
 * strip of that list switches, adds or removes a session in this window, so
 * it never keeps reading a folder the operator switched away from.
 */
export function useActiveDirSourceSettingName(baseSettingName: string) {
    const [settingName, setSettingName] = useState(() => {
        return getActiveDirSourceSettingName(baseSettingName);
    });
    useAppEffect(() => {
        // Read once on (re)subscribe too: a switch made while this view was
        // not mounted is already in the setting.
        setSettingName(getActiveDirSourceSettingName(baseSettingName));
        return subscribeMediaSessionStrips(baseSettingName, () => {
            setSettingName(getActiveDirSourceSettingName(baseSettingName));
        });
    }, [baseSettingName]);
    return settingName;
}
