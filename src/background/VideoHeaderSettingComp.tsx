import { type ChangeEvent, useCallback } from 'react';

import { BACKGROUND_VIDEO_FADING_SETTING_NAME } from '../_screen/managers/ScreenBackgroundManager';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function VideoHeaderSettingComp() {
    const [isFadingAtEnd, setIsFadingAtEnd] = useStateSettingBoolean(
        BACKGROUND_VIDEO_FADING_SETTING_NAME,
        true,
    );
    const setIsFadingAtEndRef = useAppCurrentRef(setIsFadingAtEnd);
    const handleFadingChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setIsFadingAtEndRef.current(checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="input-group-text app-inner-shadow p-0">
            {tran('Fading at the End')}:{' '}
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isFadingAtEnd}
                onChange={handleFadingChange}
            />
        </div>
    );
}
