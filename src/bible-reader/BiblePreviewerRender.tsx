import { useState } from 'react';

import { useStateSettingNumber } from '../helper/settingHelpers';
import BibleViewSetting, { defaultRangeSize } from './BibleViewSetting';
import {
    useBIVCUpdateEvent,
} from './BibleItemViewController';
import BibleViewRenderer from './BibleViewRenderer';
import {
    BibleViewFontSizeContext, DEFAULT_BIBLE_TEXT_FONT_SIZE,
} from '../helper/bibleViewHelpers';
import FullScreenBtn from './FullScreenBtn';
import {
    checkIsWindowReaderMode, useWindowMode,
} from '../router/routeHelpers';
import { fontSizeSettingNames } from '../helper/constants';
import { handleCtrlWheel } from '../others/AppRange';

export default function BiblePreviewerRender() {
    const [isFulledScreen, setIsFulledScreen] = useState(false);
    const windowMode = useWindowMode();
    const isReader = checkIsWindowReaderMode(windowMode);
    const fontSizeSettingName = (
        isReader ? fontSizeSettingNames.BIBLE_READING :
            fontSizeSettingNames.BIBLE_PRESENTER
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        fontSizeSettingName, DEFAULT_BIBLE_TEXT_FONT_SIZE,
    );
    return (
        <div className={
            `card w-100 h-100 ${isFulledScreen ? 'app-popup-full' : ''}`
        }
            onWheel={(event) => {
                handleCtrlWheel({
                    event, value: fontSize, setValue: setFontSize,
                    defaultSize: defaultRangeSize,
                });
            }}>
            <div className={
                'card-body d-flex overflow-hidden w-100 h-100'
            }>
                <BibleViewFontSizeContext.Provider value={fontSize}>
                    <Render />
                </BibleViewFontSizeContext.Provider>
            </div>
            <div className='auto-hide auto-hide-bottom'>
                <div className='d-flex w-100'>
                    <div className='flex-fill'>
                        <BibleViewSetting
                            fontSize={fontSize}
                            setFontSize={setFontSize}
                        />
                    </div>
                    <FullScreenBtn
                        isFulledScreen={isFulledScreen}
                        setIsFullScreen={setIsFulledScreen}
                    />
                </div>
            </div>
        </div>
    );
}

function Render() {
    const nestedBibleItems = useBIVCUpdateEvent();
    return (
        <BibleViewRenderer nestedBibleItems={nestedBibleItems} />
    );
}
