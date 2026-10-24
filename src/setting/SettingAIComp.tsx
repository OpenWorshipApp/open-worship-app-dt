import SettingOthersAIComp from './SettingOthersAIComp';

/**
 * The AI Providers section moved out of the Others rack into a tab of its own.
 * Same rack wrapper as Others so the section keeps its rail/state layout; the
 * section component itself keeps its old name.
 */
export default function SettingAIComp() {
    return (
        <div className="w-100 h-100 app-setting-others">
            <div className="app-setting-others-rack">
                <SettingOthersAIComp />
            </div>
        </div>
    );
}
