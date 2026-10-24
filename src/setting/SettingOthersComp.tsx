import SettingOthersExtraBinComp from './SettingOthersExtraBinComp';
import SettingOthersSongSelectComp from '../plugins/song-select/SettingOthersSongSelectComp';

/**
 * Outside services, stacked as full-width rows sharing one grammar: a state
 * rail down the left edge, then icon / name / state / the control that changes
 * that state. (AI Providers was a third row here until it grew into its own
 * tab.) Scanning the rails answers "what is wired up?" without reading a word.
 */
export default function SettingOthersComp() {
    return (
        <div className="w-100 h-100 app-setting-others">
            <div className="app-setting-others-rack">
                <SettingOthersSongSelectComp />
                <SettingOthersExtraBinComp />
            </div>
        </div>
    );
}
