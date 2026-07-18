import './MiniScreen.scss';

import { useCallback, useRef } from 'react';

import MiniScreenFooterComp, { defaultRangeSize } from './MiniScreenFooterComp';
import { useStateSettingNumber } from '../../helper/settingHelpers';
import { useZoomingRegistering } from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import MiniScreenBodyComp from './MiniScreenBodyComp';
import { useAppCurrentRef } from '../../helper/appHooks';

ScreenManager.initReceiveScreenMessage();
export default function MiniScreenComp() {
    const [previewScale, setPreviewScale] = useStateSettingNumber(
        'mini-screen-previewer',
        defaultRangeSize.size,
    );
    const setPreviewScaleRef = useAppCurrentRef(setPreviewScale);
    const setPreviewScale1 = useCallback((size: number) => {
        setPreviewScaleRef.current(size);
        for (const screenManager of getAllScreenManagers()) {
            screenManager.fireScaleEvent();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: previewScale,
        setValue: setPreviewScale1,
        defaultSize: defaultRangeSize,
    });

    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            ref={containerRef}
        >
            <MiniScreenBodyComp previewScale={previewScale} />
            <MiniScreenFooterComp
                previewSizeScale={previewScale}
                setPreviewSizeScale={setPreviewScale1}
            />
        </div>
    );
}
