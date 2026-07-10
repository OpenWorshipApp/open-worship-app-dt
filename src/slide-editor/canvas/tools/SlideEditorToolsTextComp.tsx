import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import type { TextStylePropsType } from '../canvasHelpers';
import ToolsTextFontControlComp from './ToolsTextFontControlComp';
import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';
import SlideEditorToolsTextContentComp from './SlideEditorToolsTextContentComp';
import type { CanvasItemPropsType } from '../CanvasItem';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';

export default function SlideEditorToolsTextComp({
    isAlignmentEnabled = true,
    isTextContentEnabled = true,
}: Readonly<{
    isAlignmentEnabled?: boolean;
    isTextContentEnabled?: boolean;
}>) {
    const [props, setProps] = useCanvasItemPropsSetterContext<
        CanvasItemPropsType & TextStylePropsType
    >();
    const textAlignmentData = {
        horizontalAlignment: props.textHorizontalAlignment,
        verticalAlignment: props.textVerticalAlignment,
    };
    return (
        <div
            className="app-inner-shadow ps-1"
            style={{
                // Wide enough for the alignment button row, but small
                // enough that the panel does not scroll horizontally.
                minWidth: '200px',
            }}
        >
            <SlideEditorToolTitleComp title="Color" isInline>
                <SlideEditorToolsColorComp
                    color={props.color}
                    handleColorChanging={(newColor) => {
                        setProps({
                            color: newColor,
                        });
                    }}
                />
            </SlideEditorToolTitleComp>
            {isAlignmentEnabled ? (
                <SlideEditorToolTitleComp title="Text Alignment" isInline>
                    <SlideEditorToolAlignComp
                        isText
                        data={textAlignmentData}
                        onData={(data) => {
                            const newData = {
                                ...textAlignmentData,
                                ...data,
                            };
                            setProps({
                                textHorizontalAlignment:
                                    newData.horizontalAlignment,
                                textVerticalAlignment:
                                    newData.verticalAlignment,
                            });
                        }}
                    />
                </SlideEditorToolTitleComp>
            ) : null}
            <ToolsTextFontControlComp />
            {isTextContentEnabled ? (
                <div className="w-100 pe-1">
                    <SlideEditorToolsTextContentComp />
                </div>
            ) : null}
        </div>
    );
}
