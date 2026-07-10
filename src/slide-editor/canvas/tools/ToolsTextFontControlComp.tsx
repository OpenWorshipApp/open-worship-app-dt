import { useCallback } from 'react';

import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { TextStylePropsType } from '../canvasHelpers';
import type { CanvasItemPropsType } from '../CanvasItem';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import FontSizeControlComp from '../../../others/FontSizeControlComp';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function ToolsTextFontControlComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext<
        CanvasItemPropsType & TextStylePropsType
    >();
    const setPropsRef = useAppCurrentRef(setProps);
    const handleFontSizeChange = useCallback((fontSize: number) => {
        setPropsRef.current({ fontSize });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFontFamilyChange = useCallback((fontFamily: string) => {
        setPropsRef.current({ fontFamily });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFontWeightChange = useCallback((fontWeight: string) => {
        setPropsRef.current({ fontWeight });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SlideEditorToolTitleComp title="Font">
            <div className="d-flex flex-column gap-2">
                <div className="d-flex">
                    <FontSizeControlComp
                        fontSize={props.fontSize}
                        setFontSize={handleFontSizeChange}
                    />
                </div>
                <div className="d-flex">
                    <FontFamilyControlComp
                        fontFamily={props.fontFamily ?? ''}
                        setFontFamily={handleFontFamilyChange}
                        fontWeight={props.fontWeight ?? ''}
                        setFontWeight={handleFontWeightChange}
                    />
                </div>
            </div>
        </SlideEditorToolTitleComp>
    );
}
