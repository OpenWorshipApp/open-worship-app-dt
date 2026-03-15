import { useCallback } from 'react';

import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import FontSizeControlComp from '../../../others/FontSizeControlComp';

export default function ToolsTextFontControlComp() {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<CanvasItemTextPropsType>();
    const handleFontSizeChange = useCallback(
        (fontSize: number) => {
            setProps({ fontSize });
        },
        [setProps],
    );
    const handleFontFamilyChange = useCallback(
        (fontFamily: string) => {
            setProps({ fontFamily });
        },
        [setProps],
    );
    const handleFontWeightChange = useCallback(
        (fontWeight: string) => {
            setProps({ fontWeight });
        },
        [setProps],
    );

    return (
        <SlideEditorToolTitleComp title="Font Size">
            <div className="d-flex">
                <FontSizeControlComp
                    fontSize={props.fontSize}
                    setFontSize={handleFontSizeChange}
                />
            </div>
            <hr />
            <div className="d-flex">
                <FontFamilyControlComp
                    fontFamily={props.fontFamily ?? ''}
                    setFontFamily={handleFontFamilyChange}
                    fontWeight={props.fontWeight ?? ''}
                    setFontWeight={handleFontWeightChange}
                />
            </div>
        </SlideEditorToolTitleComp>
    );
}
