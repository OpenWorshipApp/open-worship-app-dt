import { useState } from 'react';

import ColorPicker from '../others/color/ColorPicker';
import { AppColorType } from '../others/color/colorHelpers';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';

function RenderColorPickerPerScreenComp({
    screenId,
    backgroundSrc,
}: Readonly<{
    screenId: number;
    backgroundSrc: BackgroundSrcType;
}>) {
    const handleColorChanging = async (newColor: AppColorType | null) => {
        const screenBackgroundManager =
            ScreenBackgroundManager.getInstance(screenId);
        screenBackgroundManager.applyBackgroundSrc('color', { src: newColor });
    };
    return (
        <div className="p-1 m-1 app-border-white-round">
            <ShowingScreenIcon screenId={screenId} />
            <ColorPicker
                color={backgroundSrc.src as AppColorType}
                defaultColor={backgroundSrc.src as AppColorType}
                onNoColor={() => {
                    handleColorChanging(null);
                }}
                onColorChange={handleColorChanging}
                isNoImmediate={true}
            />
        </div>
    );
}

export default function BackgroundColorsComp() {
    const [selectedBackgroundSrcList, setSelectedBackgroundSrcList] = useState<
        [string, BackgroundSrcType][] | null
    >(null);
    const initBackgroundSrcList = async () => {
        setSelectedBackgroundSrcList(
            ScreenBackgroundManager.getBackgroundSrcListByType('color'),
        );
    };
    useAppEffect(() => {
        if (selectedBackgroundSrcList === null) {
            initBackgroundSrcList();
        }
    }, [selectedBackgroundSrcList]);
    useScreenBackgroundManagerEvents(
        ['update'],
        undefined,
        initBackgroundSrcList,
    );
    if (selectedBackgroundSrcList === null) {
        return null;
    }
    return (
        <div
            className={'d-flex align-content-start flex-wrap w-100 h-100'}
            style={{
                overflowY: 'auto',
            }}
        >
            {selectedBackgroundSrcList.length === 0 ? (
                <ColorPicker
                    color={null}
                    defaultColor={'#000000'}
                    onColorChange={(newColor, event: any) => {
                        ScreenBackgroundManager.handleBackgroundSelecting(
                            event,
                            'color',
                            { src: newColor },
                        );
                    }}
                    isNoImmediate={true}
                />
            ) : (
                selectedBackgroundSrcList.map(([key, backgroundSrc], i) => {
                    const screenId = parseInt(key);
                    return (
                        <RenderColorPickerPerScreenComp
                            key={backgroundSrc.src + i}
                            screenId={screenId}
                            backgroundSrc={backgroundSrc}
                        />
                    );
                })
            )}
        </div>
    );
}
