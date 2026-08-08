import type { CSSProperties } from 'react';

import type { CanvasItemCameraPropsType } from '../CanvasItemCamera';
import CanvasItemCamera from '../CanvasItemCamera';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import {
    CAMERA_DEVICE_ID_ATTR,
    CAMERA_DEVICE_LABEL_ATTR,
    CAMERA_ITEM_ATTR,
    PREVIEW_ONLY_ATTR,
} from '../../../helper/constants';

export default function BoxEditorNormalViewCameraModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalCameraRender />
        </BoxEditorNormalWrapperComp>
    );
}

// Inline svg rather than `<i className="bi bi-camera-video">`: the icon font is
// not loaded in the print document, and this markup also has to survive
// `renderToStaticMarkup` into the screen window. Same reason the video item's
// play badge is inline svg.
function genCameraIcon(width: number) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            filter="drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))"
            viewBox="0 0 16 16"
            fill="white"
            stroke="black"
            strokeWidth={0.5}
            paintOrder="stroke"
        >
            <path
                d={
                    'M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 ' +
                    '4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 ' +
                    '1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 ' +
                    '1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z'
                }
            />
        </svg>
    );
}

export function BoxEditorNormalCameraRender() {
    const props = useCanvasItemPropsContext<CanvasItemCameraPropsType>();
    try {
        CanvasItemCamera.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    const deviceName = props.label || props.deviceId;
    const minSize = Math.min(props.width, props.height) / 4;
    return (
        <div
            title={deviceName}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                // Keep the box draggable in the editor: clicks must reach the
                // box editor, not the media (same as the video/youtube render).
                pointerEvents: 'none',
            }}
        >
            <video
                // The screen manager finds this element by these marks and
                // attaches the device stream to it. Everywhere else — the
                // editor canvas, the tool item list, slide thumbnails, print —
                // it stays an empty box behind the badge below, so a document
                // full of camera slides opens no devices at all.
                {...{
                    [CAMERA_ITEM_ATTR]: '',
                    [CAMERA_DEVICE_ID_ATTR]: props.deviceId,
                    [CAMERA_DEVICE_LABEL_ATTR]: props.label,
                }}
                // A live feed is not "media playing": it must not block a slide
                // swap or leaving the page. `ScreenBackgroundManager` marks its
                // background camera the same way.
                data-ignore-media-guarding="true"
                playsInline
                // NOTE: React's `muted` prop does NOT survive
                // `renderToStaticMarkup`, and Chromium's autoplay policy
                // rejects `play()` without it — the screen manager sets it in JS
                // when it attaches the stream.
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: props.objectFit,
                    transform: props.isMirrored ? 'scaleX(-1)' : undefined,
                }}
            />
            <div
                // Must be a sibling of the video inside the video's parent:
                // `setCameraBadgeVisibility` looks for it with
                // `video.parentElement.querySelector(...)`, and the projected
                // screen hides every preview-only element wholesale.
                {...{ [PREVIEW_ONLY_ATTR]: '' }}
                style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: `${minSize / 8}px`,
                }}
            >
                {genCameraIcon(minSize)}
                <span
                    style={{
                        color: 'white',
                        fontSize: `${minSize / 4}px`,
                        textShadow: '0 0 3px black',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                    }}
                >
                    {deviceName}
                </span>
            </div>
        </div>
    );
}
