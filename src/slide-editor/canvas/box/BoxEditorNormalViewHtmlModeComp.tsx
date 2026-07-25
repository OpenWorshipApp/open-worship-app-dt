import type { CSSProperties } from 'react';

import type { CanvasItemHtmlPropsType } from '../CanvasItemHtml';
import CanvasItemHtml from '../CanvasItemHtml';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewHtmlModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalHtmlRenderComp />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalHtmlRenderComp() {
    const props = useCanvasItemPropsContext<CanvasItemHtmlPropsType>();
    try {
        CanvasItemHtml.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                ...CanvasItemHtml.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: props.html,
            }}
        />
    );
}
