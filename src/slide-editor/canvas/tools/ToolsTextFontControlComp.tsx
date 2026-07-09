import { useCallback } from 'react';

import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import FontSizeControlComp from '../../../others/FontSizeControlComp';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function ToolsTextFontControlComp() {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<CanvasItemTextPropsType>();
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
