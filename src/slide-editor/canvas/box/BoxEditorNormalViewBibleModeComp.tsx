import type { CSSProperties } from 'react';

import type { CanvasItemBiblePropsType } from '../CanvasItemBibleItem';
import CanvasItemBibleItem from '../CanvasItemBibleItem';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewBibleModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalBibleRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalBibleRender() {
    const props = useCanvasItemPropsContext<CanvasItemBiblePropsType>();
    try {
        CanvasItemBibleItem.validate(props);
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
                ...CanvasItemBibleItem.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: props.html,
            }}
        />
    );
}
