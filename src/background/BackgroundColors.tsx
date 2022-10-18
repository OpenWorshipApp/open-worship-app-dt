import { useEffect, useState } from 'react';
import ColorPicker, {
    AppColorType,
} from '../others/ColorPicker';
import PresentBGManager, {
    BackgroundSrcType,
} from '../_present/PresentBGManager';
import { usePBGMEvents } from '../_present/presentEventHelpers';
import { RenderPresentIds } from './Background';

export default function BackgroundColors() {
    const [selectedBGSrcList, setSelectedBGSrcList] = useState<
        [string, BackgroundSrcType][] | null>(null);
    useEffect(() => {
        if (selectedBGSrcList === null) {
            setSelectedBGSrcList(PresentBGManager.getBGSrcListByType('color'));
        }
    }, [selectedBGSrcList]);
    usePBGMEvents(['update'], undefined, () => {
        setSelectedBGSrcList(PresentBGManager.getBGSrcListByType('color'));
    });
    if (selectedBGSrcList === null) {
        return null;
    }
    if (selectedBGSrcList.length) {
        return (
            <>
                <div title={'Show in presents:'
                    + selectedBGSrcList.map(([key]) => key).join(',')}>
                    <RenderPresentIds
                        ids={selectedBGSrcList.map(([key]) => +key)} />
                </div>
                {selectedBGSrcList.map(([_, bgSrc], i) => {
                    const onColorChange = async (newColor: AppColorType | null, event: any) => {
                        setSelectedBGSrcList(null);
                        PresentBGManager.bgSrcSelect(newColor || bgSrc.src, event, 'color');
                    };
                    return (
                        <ColorPicker key={i}
                            color={bgSrc.src as AppColorType}
                            onColorChange={onColorChange} />
                    );
                })}
            </>
        );
    }
    return (
        <ColorPicker color={null}
            onColorChange={(newColor, e) => {
                if (newColor !== null) {
                    setSelectedBGSrcList(null);
                    PresentBGManager.bgSrcSelect(newColor, e as any, 'color');
                }
            }} />
    );
}
