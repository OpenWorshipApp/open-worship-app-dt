import { BACKGROUND_VIDEO_FADING_SETTING_NAME } from '../_screen/managers/ScreenBackgroundManager';
import { useStateSettingBoolean } from '../helper/settingHelpers';

export default function VideoHeaderSettingComp() {
    const [isFadingAtEnd, setIsFadingAtEnd] = useStateSettingBoolean(
        BACKGROUND_VIDEO_FADING_SETTING_NAME,
        true,
    );
    return (
        <div className="input-group-text app-inner-shadow p-0">
            `Fading the End:{' '}
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isFadingAtEnd}
                onChange={(event) => {
                    const checked = event.target.checked;
                    setIsFadingAtEnd(checked);
                }}
            />
        </div>
    );
}
