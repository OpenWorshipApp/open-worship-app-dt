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
import { pressElementLikeButton } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import ScreenMirrorFloatingComp from '../../screen-mirror/ScreenMirrorFloatingComp';
import {
    useMirrorState,
    setMirrorPanelShowing,
} from '../../screen-mirror/mirrorConnectionHelpers';
import { useToggleScreensShowingKey } from './ShowHideScreen';

ScreenManager.initReceiveScreenMessage();
export default function MiniScreenComp() {
    useToggleScreensShowingKey();
    const mirror = useMirrorState();
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
            {!!mirror?.guests.length && (
                <div
                    className="card-header d-flex flex-wrap align-items-center gap-2 py-1"
                    aria-label={tran('Connected guests')}
                >
                    <span className="small">{tran('Connected guests')}</span>
                    {mirror.guests.map((guest) => (
                        <button
                            key={guest.id}
                            className="btn btn-sm btn-outline-info py-0"
                            onClick={() => setMirrorPanelShowing(true)}
                        >
                            <i className="bi bi-pc-display me-1" />
                            {guest.prefix}: {guest.name}
                        </button>
                    ))}
                </div>
            )}
            <MiniScreenBodyComp previewScale={previewScale} />
            <ScreenMirrorFloatingComp />
            {/* This is the only route to `Add New Screen` that is not a
                right-click, so it has to be operable without a mouse: as a
                bare <i> it was out of the accessibility tree, unreachable by
                keyboard, and had no uid for anything driving the app.
                `pressElementLikeButton` dispatches the click at the icon's own
                centre, which is what gives the context menu coordinates to
                position against -- a plain `.click()` opens it at 0,0. */}
            <i
                className={
                    'bi bi-three-dots-vertical' +
                    ' app-caught-hover-pointer app-round-icon'
                }
                role="button"
                tabIndex={0}
                title={tran('More Options')}
                aria-label={tran('More Options')}
                aria-haspopup="menu"
                onClick={openMiniScreenContextMenu}
                onKeyDown={pressElementLikeButton}
                style={{
                    right: '7px',
                    bottom: '7px',
                    position: 'absolute',
                    width: '25px',
                    textAlign: 'center',
                    padding: '0px',
                }}
            />
            <MiniScreenFooterComp
                previewSizeScale={previewScale}
                setPreviewSizeScale={setPreviewScale1}
            />
        </div>
    );
}
