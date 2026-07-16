import { useCallback, useRef, useState, type ReactNode } from 'react';

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
import { useZoomingRegistering } from '../others/AppRangeComp';
import appProvider from '../server/appProvider';
import { handleAutoHide } from '../helper/domHelpers';
import { useAppEffect } from '../helper/appHooks';
import { showSimpleToast } from '../toast/toastHelpers';
import NewLineSettingComp from './NewLineSettingComp';
import BibleModelInfoSettingComp from './BibleModelInfoSettingComp';

function RenderComp() {
    const nestedBibleItems = useBibleItemViewControllerUpdateEvent();
    return <BibleViewRendererComp nestedBibleItems={nestedBibleItems} />;
}

export default function BiblePreviewerRenderComp({
    footerExtra = null,
}: Readonly<{
    footerExtra?: ReactNode;
}> = {}) {
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
    const handleFullScreenToggling = useCallback(
        async (isToFullScreen: boolean) => {
            try {
                if (isToFullScreen) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (error) {
                showSimpleToast('Toggle full screen failed', `Error: ${error}`);
            }
        },
        [],
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: fontSize,
        setValue: setFontSize,
        defaultSize: defaultRangeSize,
    });

    return (
        <div
            className={
                'card w-100 h-100 app-zero-border-radius' +
                ` ${isFulledScreen ? 'app-popup-full' : ''}`
            }
            ref={containerRef}
        >
            <div className={'card-body d-flex app-overflow-hidden w-100 h-100'}>
                <BibleViewFontSizeContext value={fontSize}>
                    <RenderComp />
                </BibleViewFontSizeContext>
            </div>
            <div
                className={'app-auto-hide-bottom p-1 card-footer w-100'}
                ref={(element) => {
                    if (element !== null) {
                        handleAutoHide(element);
                    }
                }}
            >
                <div className="d-flex w-100 align-items-center gap-2">
                    <div className="flex-fill d-flex align-items-center gap-2 flex-wrap">
                        <BibleViewSettingComp
                            fontSize={fontSize}
                            setFontSize={setFontSize}
                        />
                        <NewLineSettingComp />
                        <BibleModelInfoSettingComp />
                    </div>
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                        {footerExtra}
                        <FullScreenButtonComp
                            isFulledScreen={isFulledScreen}
                            toggleFullScreen={handleFullScreenToggling}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
