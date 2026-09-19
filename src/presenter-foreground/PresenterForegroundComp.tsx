import './PresenterForegroundComp.scss';

import ForegroundCameraComp from './ForegroundCameraComp';
import ForegroundCountDownComp from './ForegroundCountDownComp';
import ForegroundImagesSlideShowComp from './ForegroundImagesSlideShowComp';
import ForegroundMarqueeBottomComp from './ForegroundMarqueeBottomComp';
import ForegroundMarqueeTopComp from './ForegroundMarqueeTopComp';
import ForegroundQuickTextComp from './ForegroundQuickTextComp';
import ForegroundStopwatchComp from './ForegroundStopwatchComp';
import ForegroundTimeComp from './ForegroundTimeComp';
import ForegroundWebComp from './ForegroundWebComp';

export default function PresenterForegroundComp() {
    return (
        <div
            className={
                'presenter-foreground w-100 h-100 app-border-white-round ' +
                'p-2 app-zero-border-radius'
            }
        >
            <ForegroundMarqueeTopComp />
            <hr />
            <ForegroundMarqueeBottomComp />
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
            <hr />
            <ForegroundWebComp />
        </div>
    );
}
