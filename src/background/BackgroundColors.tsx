import { useState } from 'react';

import ColorPicker from '../others/color/ColorPicker';
import { AppColorType } from '../others/color/colorHelpers';
import ScreenBGManager from '../_screen/ScreenBGManager';
import { usePBGMEvents } from '../_screen/screenEventHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import { BackgroundSrcType } from '../_screen/screenHelpers';

export default function BackgroundColors() {
    const [selectedBGSrcList, setSelectedBGSrcList] = (
        useState<[string, BackgroundSrcType][] | null>(null)
    );
    const handleNoColoring = async (
        _newColor: AppColorType, event: any,
    ) => {
        setSelectedBGSrcList(null);
        ScreenBGManager.bgSrcSelect(null, event, 'color');
    };
    const handleColorChanging = async (
        newColor: AppColorType, event: any) => {
        setSelectedBGSrcList(null);
        ScreenBGManager.bgSrcSelect(newColor, event, 'color');
    };
    useAppEffect(() => {
        if (selectedBGSrcList === null) {
            setSelectedBGSrcList(ScreenBGManager.getBGSrcListByType('color'));
        }
    }, [selectedBGSrcList]);
    usePBGMEvents(['update'], undefined, () => {
        setSelectedBGSrcList(ScreenBGManager.getBGSrcListByType('color'));
    });
    if (selectedBGSrcList === null) {
        return null;
    }
    if (selectedBGSrcList.length === 0) {
        return (
            <ColorPicker color={null}
                defaultColor={'#000000'}
                onNoColor={handleNoColoring}
                onColorChange={handleColorChanging}
            />
        );
    }
    return (
        <div className={
            'd-flex align-content-start flex-wrap w-100 overflow-hidden'
        }>
            {selectedBGSrcList.map(([key, bgSrc]) => {
                const screenId = parseInt(key, 10);
                return (
                    <div key={bgSrc.src}
                        className='p-1 m-1 border-white-round'>
                        <ShowingScreenIcon screenId={screenId} />
                        <ColorPicker
                            color={bgSrc.src as AppColorType}
                            defaultColor={bgSrc.src as AppColorType}
                            onNoColor={handleNoColoring}
                            onColorChange={handleColorChanging}
                        />
                    </div>
                );
            })}
        </div>
    );
}
