import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import FontSizeControlComp from '../../../others/FontSizeControlComp';

export default function ToolsTextFontControlComp() {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<CanvasItemTextPropsType>();

    return (
        <SlideEditorToolTitleComp title="Font Size">
            <div className="d-flex">
                <FontSizeControlComp
                    fontSize={props.fontSize}
                    setFontSize={(fontSize) => {
                        setProps({ fontSize });
                    }}
                />
            </div>
            <hr />
            <div className="d-flex">
                <FontFamilyControlComp
                    fontFamily={props.fontFamily ?? ''}
                    setFontFamily={(fontFamily) => {
                        setProps({ fontFamily });
                    }}
                    fontWeight={props.fontWeight ?? ''}
                    setFontWeight={(fontWeight) => {
                        setProps({ fontWeight });
                    }}
                />
            </div>
        </SlideEditorToolTitleComp>
    );
}
