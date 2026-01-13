import { useState } from 'react';

import { useStateSettingNumber } from '../helper/settingHelpers';
import BibleViewSettingComp, { defaultRangeSize } from './BibleViewSettingComp';
import { useBibleItemViewControllerUpdateEvent } from './BibleItemsViewController';
import BibleViewRendererComp from './BibleViewRendererComp';
import {
    BibleViewFontSizeContext,
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
} from '../helper/bibleViewHelpers';
import FullScreenButtonComp from './FullScreenButtonComp';
import { fontSizeSettingNames } from '../helper/constants';
import { handleCtrlWheel } from '../others/AppRangeComp';
import appProvider from '../server/appProvider';
import { handleAutoHide } from '../helper/domHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import NewLineSettingComp from './NewLineSettingComp';
import BibleModelInfoSettingComp from './BibleModelInfoSettingComp';

function RenderComp() {
    const nestedBibleItems = useBibleItemViewControllerUpdateEvent();
    return <BibleViewRendererComp nestedBibleItems={nestedBibleItems} />;
}

export default function BiblePreviewerRenderComp() {
    const [isFulledScreen, setIsFulledScreen] = useState(
        document.fullscreenElement !== null,
    );
    useAppEffect(() => {
        const onFullScreenChange = () => {
            setIsFulledScreen(document.fullscreenElement !== null);
        };
        document.addEventListener('fullscreenchange', onFullScreenChange);
        return () => {
            document.removeEventListener(
                'fullscreenchange',
                onFullScreenChange,
            );
        };
    }, []);
    const fontSizeSettingName = appProvider.isPageReader
        ? fontSizeSettingNames.BIBLE_READING
        : fontSizeSettingNames.BIBLE_PRESENTER;
    const [fontSize, setFontSize] = useStateSettingNumber(
        fontSizeSettingName,
        DEFAULT_BIBLE_TEXT_FONT_SIZE,
    );
    const handleFullScreenToggling = async (isToFullScreen: boolean) => {
        try {
            if (isToFullScreen) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            showSimpleToast('Toggle full screen failed', `Error: ${error}`);
        }
    };
    return (
        <div
            className={
                'card w-100 h-100 app-zero-border-radius' +
                ` ${isFulledScreen ? 'app-popup-full' : ''}`
            }
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: fontSize,
                    setValue: setFontSize,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <div className={'card-body d-flex app-overflow-hidden w-100 h-100'}>
                <BibleViewFontSizeContext value={fontSize}>
                    <RenderComp />
                </BibleViewFontSizeContext>
            </div>
            <div
                className={'app-auto-hide-bottom'}
                ref={(element) => {
                    if (element !== null) {
                        handleAutoHide(element);
                    }
                }}
            >
                <div className="d-flex w-100">
                    <div className="flex-fill d-flex">
                        <BibleViewSettingComp
                            fontSize={fontSize}
                            setFontSize={setFontSize}
                        />
                        <NewLineSettingComp />
                        <BibleModelInfoSettingComp />
                    </div>
                    <FullScreenButtonComp
                        isFulledScreen={isFulledScreen}
                        toggleFullScreen={handleFullScreenToggling}
                    />
                </div>
            </div>
        </div>
    );
}
