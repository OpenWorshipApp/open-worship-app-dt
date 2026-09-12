import SettingOthersAIComp from './SettingOthersAIComp';
import SettingOthersExtraBinComp from './SettingOthersExtraBinComp';
import SettingOthersSongSelectComp from '../plugins/song-select/SettingOthersSongSelectComp';

/**
 * Three outside services, stacked as three full-width rows sharing one grammar:
 * a state rail down the left edge, then icon / name / state / the control that
 * changes that state. Scanning the rails answers "what is wired up?" without
 * reading a word.
 */
export default function SettingOthersComp() {
    return (
        <div className="w-100 h-100 app-setting-others">
            <div className="app-setting-others-rack">
                <SettingOthersAIComp />
                <SettingOthersSongSelectComp />
                <SettingOthersExtraBinComp />
            </div>
        </div>
    );
}
