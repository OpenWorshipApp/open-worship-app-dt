import './MiniScreen.scss';

import MiniScreenFooterComp, { defaultRangeSize } from './MiniScreenFooterComp';
import { useStateSettingNumber } from '../../helper/settingHelpers';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import MiniScreenBodyComp from './MiniScreenBodyComp';

ScreenManager.initReceiveScreenMessage();
export default function MiniScreenComp() {
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
            className="card w-100 h-100 app-zero-border-radius"
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: previewScale,
                    setValue: setPreviewScale1,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <MiniScreenBodyComp previewScale={previewScale} />
            <MiniScreenFooterComp
                previewSizeScale={previewScale}
                setPreviewSizeScale={setPreviewScale1}
            />
        </div>
    );
}
