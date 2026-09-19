import { useCallback, useRef, useState, type ReactNode } from 'react';

import BibleViewSettingComp, { defaultRangeSize } from './BibleViewSettingComp';
import { useBibleItemViewControllerUpdateEvent } from './BibleItemsViewController';
import BibleViewRendererComp from './BibleViewRendererComp';
import {
    BibleViewFontSizeContext,
    setBibleViewFontSize,
    useBibleViewFontSize,
} from '../helper/bibleViewHelpers';
import FullScreenButtonComp from './FullScreenButtonComp';
import { useZoomingRegistering } from '../others/AppRangeComp';
import { handleAutoHide } from '../helper/domHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import NewLineSettingComp from './NewLineSettingComp';
import BibleModelInfoSettingComp from './BibleModelInfoSettingComp';
import BibleSelectionToolbarComp from './BibleSelectionToolbarComp';

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
    // Setting-backed as before, but through the shared store so UI outside this
    // subtree — the names & locations panels — can scale with the same zoom.
    const fontSize = useBibleViewFontSize();
    const fontSizeRef = useAppCurrentRef(fontSize);
    const setFontSize = useCallback(
        (value: number | ((oldFontSize: number) => number)) => {
            setBibleViewFontSize(
                typeof value === 'function'
                    ? value(fontSizeRef.current)
                    : value,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
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
                showSimpleToast(
                    tran('Toggle full screen failed'),
                    `Error: ${error}`,
                );
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
                {/* Portals to `document.body`, so where it sits in this tree
                    costs nothing; being here is what gives it one instance per
                    window that shows bible views, and none in the screen
                    output, which never renders this component at all. */}
                <BibleSelectionToolbarComp />
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
