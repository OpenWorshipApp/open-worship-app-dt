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
    const pWidth = props.width;
    const pHeight = props.height;
    const rWidth = pWidth / props.mediaWidth;
    const rHeight = pHeight / props.mediaHeight;
    const mR = Math.min(rWidth, rHeight);
    const width = mR * props.mediaWidth;
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <img
                alt=""
                className="align-self-center"
                width={width}
                style={{
                    pointerEvents: 'none',
                }}
                src={props.srcData || img404}
            />
        </div>
    );
}
