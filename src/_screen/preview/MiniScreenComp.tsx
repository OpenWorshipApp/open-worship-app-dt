import './MiniScreen.scss';

import { useCallback, useRef } from 'react';

import MiniScreenFooterComp, { defaultRangeSize } from './MiniScreenFooterComp';
import { useStateSettingNumber } from '../../helper/settingHelpers';
import { useZoomingRegistering } from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import MiniScreenBodyComp, {
    openMiniScreenContextMenu,
} from './MiniScreenBodyComp';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

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
            {/* Mirrors the auto-hide `...` that `handleAutoHide` appends to this
                same card at `left: 7px; bottom: 7px` — matching offsets keep the
                two floating buttons on one baseline. */}
            <i
                className={
                    'bi bi-three-dots-vertical' +
                    ' app-caught-hover-pointer app-round-icon'
                }
                title={tran('More Options')}
                onClick={openMiniScreenContextMenu}
                style={{
                    right: '7px',
                    bottom: '7px',
                    position: 'absolute',
                    width: '25px',
                    textAlign: 'center',
                    padding: '0px',
                }}
            />
        </div>
    );
}
