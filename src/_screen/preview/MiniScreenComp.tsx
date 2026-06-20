import './MiniScreen.scss';

import { useCallback, useRef } from 'react';

import MiniScreenFooterComp, { defaultRangeSize } from './MiniScreenFooterComp';
import { useStateSettingNumber } from '../../helper/settingHelpers';
import { useZoomingRegistering } from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import MiniScreenBodyComp from './MiniScreenBodyComp';

ScreenManager.initReceiveScreenMessage();
export default function MiniScreenComp() {
    const [previewScale, setPreviewScale] = useStateSettingNumber(
        'mini-screen-previewer',
        defaultRangeSize.size,
    );
    const setPreviewScale1 = useCallback(
        (size: number) => {
            setPreviewScale(size);
            for (const screenManager of getAllScreenManagers()) {
                screenManager.fireRefreshEvent();
            }
        },
        [setPreviewScale],
    );

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
