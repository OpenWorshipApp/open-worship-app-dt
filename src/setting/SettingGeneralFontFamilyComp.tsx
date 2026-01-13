import { tran } from '../lang/langHelpers';
import { useStateSettingString } from '../helper/settingHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import { applyStore } from './SettingApplyComp';
import {
    APP_FONT_FAMILY_SETTING_NAME,
    APP_FONT_WEIGHT_SETTING_NAME,
} from './settingHelpers';

export default function SettingGeneralFontFamilyComp() {
    const [fontFamily, setFontFamily] = useStateSettingString(
        APP_FONT_FAMILY_SETTING_NAME,
    );
    const setFontFamily1 = (newFontFamily: string) => {
        applyStore.pendingApply();
        setFontFamily(newFontFamily);
    };
    const [fontWeight, setFontWeight] = useStateSettingString(
        APP_FONT_WEIGHT_SETTING_NAME,
    );
    const setFontWeight1 = (newFontWeight: string) => {
        applyStore.pendingApply();
        setFontWeight(newFontWeight);
    };
    return (
        <div className="card m-1">
            <div className="card-header">{tran('Font Family')}</div>
            <div className="card-body">
                <FontFamilyControlComp
                    fontFamily={fontFamily}
                    setFontFamily={setFontFamily1}
                    fontWeight={fontWeight}
                    setFontWeight={setFontWeight1}
                    isShowingLabel={false}
                />
            </div>
        </div>
    );
}
