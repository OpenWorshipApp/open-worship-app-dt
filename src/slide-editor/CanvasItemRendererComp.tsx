import { BoxEditorNormalImageRenderComp } from './canvas/box/BoxEditorNormalViewImageModeComp';
import { BoxEditorNormalHtmlRenderComp } from './canvas/box/BoxEditorNormalViewHtmlModeComp';
import { BoxEditorNormalTextRender } from './canvas/box/BoxEditorNormalViewTextModeComp';
import { BoxEditorNormalBibleRender } from './canvas/box/BoxEditorNormalViewBibleModeComp';
import { useCanvasItemContext } from './canvas/CanvasItem';
import { BoxEditorNormalVideoRender } from './canvas/box/BoxEditorNormalViewVideoModeComp';
import { BoxEditorNormalYouTubeRender } from './canvas/box/BoxEditorNormalViewYouTubeModeComp';
import { BoxEditorNormalWebsiteRender } from './canvas/box/BoxEditorNormalViewWebsiteModeComp';

export default function CanvasItemRendererComp() {
    const canvasItem = useCanvasItemContext();
    switch (canvasItem.type) {
        case 'image':
            return <BoxEditorNormalImageRenderComp />;
        case 'video':
            return <BoxEditorNormalVideoRender />;
        case 'youtube':
            return <BoxEditorNormalYouTubeRender />;
        case 'website':
            return <BoxEditorNormalWebsiteRender />;
        case 'text':
            return <BoxEditorNormalTextRender />;
        case 'html':
            return <BoxEditorNormalHtmlRenderComp />;
        case 'bible':
            return <BoxEditorNormalBibleRender />;
    }
    return null;
}
