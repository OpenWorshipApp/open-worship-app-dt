import type { CSSProperties } from 'react';

import type { CanvasItemYouTubePropsType } from '../CanvasItemYouTube';
import CanvasItemYouTube from '../CanvasItemYouTube';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewYouTubeModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalYouTubeRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalYouTubeRender() {
    const props = useCanvasItemPropsContext<CanvasItemYouTubePropsType>();
    try {
        CanvasItemYouTube.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
    const embedUrl = CanvasItemYouTube.toEmbedUrl(props.url);
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                // Keep the box draggable in the editor: clicks must reach the
                // box editor, not the iframe (same as the video render). The
                // presenter re-enables pointer events on its mini screen.
                pointerEvents: 'none',
            }}
        >
            <iframe
                src={embedUrl}
                title={`youtube-${props.id}`}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow={
                    'accelerometer; autoplay; clipboard-write; ' +
                    'encrypted-media; gyroscope; picture-in-picture; web-share'
                }
                allowFullScreen
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                    backgroundColor: 'transparent',
                }}
            />
        </div>
    );
}
