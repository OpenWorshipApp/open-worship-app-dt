import type { CSSProperties } from 'react';

import type { CanvasItemImagePropsType } from '../CanvasItemImage';
import CanvasItemImage from '../CanvasItemImage';
import img404 from '../404.png';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewImageModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalImageRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalImageRender() {
    const props = useCanvasItemPropsContext<CanvasItemImagePropsType>();
    try {
        CanvasItemImage.validate(props);
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
            }}
        >
            <img
                alt=""
                style={{
                    width: '100%',
                    height: '100%',
                    // Always fill the box exactly rather than
                    // letterboxing to the media's own ratio, so the box's
                    // background color never shows through around the
                    // image.
                    objectFit: 'fill',
                    display: 'block',
                    pointerEvents: 'none',
                }}
                src={props.srcData || img404}
            />
        </div>
    );
}
