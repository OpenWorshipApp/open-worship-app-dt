import { CSSProperties } from 'react';

import CanvasItemBibleItem, {
    CanvasItemBiblePropsType,
} from '../CanvasItemBibleItem';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import { CanvasItemTextPropsType } from '../CanvasItemText';

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
    const props = useCanvasItemPropsContext<CanvasItemTextPropsType>();
    try {
        CanvasItemBibleItem.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
    const bibleRenderingList = (props as CanvasItemBiblePropsType)
        .bibleRenderingList;
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                ...CanvasItemBibleItem.genStyle(props),
            }}
        >
            {bibleRenderingList.map((bibleRendered) => {
                return (
                    <div key={bibleRendered.title}>
                        <div>{bibleRendered.title}</div>
                        <div>{bibleRendered.text}</div>
                    </div>
                );
            })}
        </div>
    );
}
