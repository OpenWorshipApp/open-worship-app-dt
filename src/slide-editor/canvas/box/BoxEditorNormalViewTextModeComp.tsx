import type { CanvasItemTextPropsType } from '../CanvasItemText';
import CanvasItemText from '../CanvasItemText';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';

export function BoxEditorNormalTextRender() {
    const props = useCanvasItemPropsContext<CanvasItemTextPropsType>();
    try {
        CanvasItemText.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    const text = props.text.replaceAll('\n', '<br />');
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                ...CanvasItemText.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: text,
            }}
        />
    );
}
