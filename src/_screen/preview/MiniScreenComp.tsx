import './MiniScreen.scss';

import MiniScreenFooterComp, { defaultRangeSize } from './MiniScreenFooterComp';
import {
    useStateSettingBoolean,
    useStateSettingNumber,
} from '../../helper/settingHelpers';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import MiniScreenBodyComp from './MiniScreenBodyComp';

ScreenManager.initReceiveScreenMessage();
export default function MiniScreenComp() {
    const [isShowingTools, setIsShowingTools] = useStateSettingBoolean(
        'mini-screen-previewer-tool',
        false,
    );
    const [previewScale, setPreviewScale] = useStateSettingNumber(
        'mini-screen-previewer',
        defaultRangeSize.size,
    );
    const setPreviewScale1 = (size: number) => {
        setPreviewScale(size);
        for (const screenManager of getAllScreenManagers()) {
            screenManager.fireRefreshEvent();
        }
    };
    return (
        <div
            className="card w-100 h-100"
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: previewScale,
                    setValue: setPreviewScale1,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <MiniScreenBodyComp
                isShowingTools={isShowingTools}
                setIsShowingTools={setIsShowingTools}
                previewScale={previewScale}
            />
            <MiniScreenFooterComp
                previewSizeScale={previewScale}
                setPreviewSizeScale={setPreviewScale1}
                isShowingTools={isShowingTools}
                setIsShowingTools={setIsShowingTools}
            />
        </div>
    );
}
