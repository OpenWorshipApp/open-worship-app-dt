import type { CSSProperties } from 'react';

import type { CanvasItemVideoPropsType } from '../CanvasItemVideo';
import CanvasItemVideo from '../CanvasItemVideo';
import img404 from '../404.png';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

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

export function BoxEditorNormalVideoRender() {
    const props = useCanvasItemPropsContext<CanvasItemVideoPropsType>();
    try {
        CanvasItemVideo.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
    const pWidth = props.width;
    const pHeight = props.height;
    const rWidth = pWidth / props.mediaWidth;
    const rHeight = pHeight / props.mediaHeight;
    const mR = Math.min(rWidth, rHeight);
    const width = mR * props.mediaWidth;
    const minSize = Math.min(width, pWidth) / 4;
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
                src={props.srcData || img404}
                width={width}
                loop
                muted
                playsInline
            />
            <div
                style={{
                    position: 'absolute',
                }}
            >
                <PlayIcon width={minSize} />
            </div>
        </div>
    );
}

function PlayIcon({ width }: Readonly<{ width: number }>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            filter="drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))"
            viewBox="0 0 16 16"
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
