import type { CSSProperties } from 'react';

import type { CanvasItemWebsitePropsType } from '../CanvasItemWebsite';
import CanvasItemWebsite from '../CanvasItemWebsite';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewWebsiteModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalWebsiteRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalWebsiteRender() {
    const props = useCanvasItemPropsContext<CanvasItemWebsitePropsType>();
    try {
        CanvasItemWebsite.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
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
                src={props.url}
                title={`website-${props.id}`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="strict-origin-when-cross-origin"
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
