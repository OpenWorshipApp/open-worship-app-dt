import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import CanvasItemText, { ToolingTextType } from '../CanvasItemText';
import ToolsTextFontControlComp from './ToolsTextFontControlComp';
import { AppColorType } from '../../../others/color/colorHelpers';
import { useCanvasControllerContext } from '../CanvasController';
import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';
import { useCanvasItemContext } from '../CanvasItem';

export default function SlideEditorToolsTextComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext() as CanvasItemText;
    const handleDataEvent = (newData: any) => {
        const textData: ToolingTextType = {};
        if (newData.horizontalAlignment !== undefined) {
            textData.textHorizontalAlignment = newData.horizontalAlignment;
        }
        if (newData.verticalAlignment !== undefined) {
            textData.textVerticalAlignment = newData.verticalAlignment;
        }
        applyTextData(textData);
    };
    const handleColorChanging = (newColor: AppColorType) => {
        applyTextData({
            color: newColor,
        });
    };
    const applyTextData = (newData: ToolingTextType) => {
        canvasItem.applyTextData(newData);
        canvasController.applyEditItem(canvasItem);
    };
    return (
        <div className="d-flex flex-wrap app-inner-shadow">
            <SlideEditorToolsColorComp
                color={canvasItem.props.color}
                handleColorChanging={handleColorChanging}
            />
            <div
                className="ps-1"
                style={{
                    minWidth: '300px',
                }}
            >
                <SlideEditorToolTitleComp title="Text Alignment">
                    <SlideEditorToolAlignComp isText onData={handleDataEvent} />
                </SlideEditorToolTitleComp>
                <hr />
                <ToolsTextFontControlComp />
            </div>
        </div>
    );
}
