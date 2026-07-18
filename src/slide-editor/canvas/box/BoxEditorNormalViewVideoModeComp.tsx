import type { CSSProperties } from 'react';

import type { CanvasItemVideoPropsType } from '../CanvasItemVideo';
import CanvasItemVideo from '../CanvasItemVideo';
import img404 from '../404.png';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import { pathToFileURL } from '../../../server/calcHelpers';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import { PREVIEW_ONLY_ATTR } from '../../../helper/constants';

export default function BoxEditorNormalViewVideoModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalVideoRender />
        </BoxEditorNormalWrapperComp>
    );
}

function genPlayIcon(width: number) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            {...{ [PREVIEW_ONLY_ATTR]: '' }}
            width={width}
            filter="drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))"
            viewBox="0 0 16 16"
            // Outline keeps the icon legible on dark/black video frames.
            stroke="white"
            strokeWidth={0.5}
            paintOrder="stroke"
        >
            <path
                d={
                    'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 ' +
                    '8 0 0 0 0 16z'
                }
            />
            <path
                d={
                    'M6.271 5.055a.5.5 0 0 1 .52.038l3.5 2.5a.5.5 0 0 1 0 ' +
                    '.814l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .271-.445z'
                }
            />
        </svg>
    );
}

export function BoxEditorNormalVideoRender() {
    const props = useCanvasItemPropsContext<CanvasItemVideoPropsType>();
    try {
        CanvasItemVideo.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
    const minSize = Math.min(props.width, props.height) / 4;
    const videoSrc = props.filePath ? pathToFileURL(props.filePath) : img404;
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: 'none',
            }}
        >
            <video
                src={videoSrc}
                style={{
                    width: '100%',
                    height: '100%',
                    // Always fill the box exactly rather than
                    // letterboxing to the media's own ratio, so the box's
                    // background color never shows through around the
                    // video (same as the image render).
                    objectFit: 'fill',
                    display: 'block',
                    cursor: 'pointer',
                }}
                loop
                muted
                playsInline
            />
            <div
                style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                }}
            >
                {genPlayIcon(minSize)}
            </div>
        </div>
    );
}
