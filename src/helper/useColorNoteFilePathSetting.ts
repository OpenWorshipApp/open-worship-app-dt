import { useState } from 'react';

import { useAppEffect } from './appHooks';
import {
    getColorNoteFilePathSetting,
    subscribeColorNoteFilePathSetting,
} from './FileSourceMetaManager';

export function useColorNoteFilePathSetting(
    filePath: string,
    id: string | number | null,
) {
    const [color, setColor] = useState(() => {
        return getColorNoteFilePathSetting(filePath, id);
    });
    useAppEffect(() => {
        const unsubscribe = subscribeColorNoteFilePathSetting(
            filePath,
            id,
            setColor,
        );
        // Re-read on a reused card or a change between render and subscription.
        // Updates carry the color, so neither other cards nor their thumbnail
        // bodies re-render or parse the settings when this marker changes.
        setColor(getColorNoteFilePathSetting(filePath, id));
        return unsubscribe;
    }, [filePath, id]);
    return color;
}
