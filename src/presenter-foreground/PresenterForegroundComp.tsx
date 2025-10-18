import './PresenterForegroundComp.scss';

import appProvider from '../server/appProvider';
import ForegroundCameraComp from './ForegroundCameraComp';
import ForegroundCommonPropertiesSettingComp from './ForegroundCommonPropertiesSettingComp';
import ForegroundCountDownComp from './ForegroundCountDownComp';
import ForegroundImagesSlideShowComp from './ForegroundImagesSlideShowComp';
import ForegroundMarqueeComp from './ForegroundMarqueeComp';
import ForegroundQuickTextComp from './ForegroundQuickTextComp';
import ForegroundStopwatchComp from './ForegroundStopwatchComp';
import ForegroundTimeComp from './ForegroundTimeComp';

export default function PresenterForegroundComp() {
    return (
        <div className="presenter-foreground w-100 h-100 app-border-white-round p-2">
            <ForegroundCommonPropertiesSettingComp />
            <hr />
            <ForegroundMarqueeComp />
            <hr />
            <ForegroundQuickTextComp />
            <hr />
            <ForegroundCountDownComp />
            <hr />
            <ForegroundStopwatchComp />
            <hr />
            <ForegroundTimeComp />
            <hr />
            <ForegroundImagesSlideShowComp />
            <hr />
            <ForegroundCameraComp />
            {appProvider.systemUtils.isDev ? (
                <>
                    <hr />
                    <div>TODO: Javascript Show</div>
                </>
            ) : null}
        </div>
    );
}
