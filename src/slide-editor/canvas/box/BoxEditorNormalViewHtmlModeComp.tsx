import type { CSSProperties } from 'react';

import type { CanvasItemHtmlPropsType } from '../CanvasItemHtml';
import CanvasItemHtml from '../CanvasItemHtml';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
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
            <BoxEditorNormalHtmlRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalHtmlRender() {
    const props = useCanvasItemPropsContext<CanvasItemHtmlPropsType>();
    try {
        CanvasItemHtml.validate(props);
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
                ...CanvasItemHtml.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: props.html,
            }}
        />
    );
}
