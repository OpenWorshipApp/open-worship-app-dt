import { useStateSettingString } from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { getForegroundCommonProperties } from './ForegroundCommonPropertiesSettingComp';

export default function ForegroundMarqueeComp() {
    useScreenForegroundManagerEvents(['update']);
    const [text, setText] = useStateSettingString<string>(
        'foreground-marquee-setting',
        'This is a testing marquee text. It has to be long enough to test ' +
            'the marquee scrolling effect properly.',
    );

    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.marqueeData !== null;
        },
    );
    const handleHiding = (screenId: number) => {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setMarqueeData(null);
            },
        );
    };
    const handleShowing = (event: any, isForceChoosing = false) => {
        const extraStyle = getForegroundCommonProperties();
        ScreenForegroundManager.setMarquee(
            event,
            text,
            extraStyle,
            isForceChoosing,
        );
    };
    const handleContextMenuOpening = (event: any) => {
        handleShowing(event, true);
    };
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
            buttonTitle="`Hide Marquee"
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    return (
        <ForegroundLayoutComp
            target="marquee"
            fullChildHeaders={<h4>`Marquee</h4>}
            childHeadersOnHidden={genHidingElement(true)}
        >
            <div>
                <button
                    className="btn btn-sm btn-info"
                    onClick={() => {
                        // Sunday September 24, 2023
                        const date = new Date();
                        const formattedDate = date.toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        });
                        setText(formattedDate);
                    }}
                >
                    Date
                </button>
            </div>
            <div className="form-floating">
                <textarea
                    id="marquee-textarea"
                    className="form-control"
                    cols={30}
                    rows={20}
                    value={text}
                    onChange={(event) => {
                        setText(event.target.value);
                    }}
                    placeholder="Leave a marquee text here"
                />
                <label htmlFor="marquee-textarea">Marquee</label>
                <button
                    className="btn btn-secondary"
                    onClick={handleShowing}
                    onContextMenu={handleContextMenuOpening}
                >
                    `Show Marquee
                </button>
            </div>
            {genHidingElement(false)}
        </ForegroundLayoutComp>
    );
}
