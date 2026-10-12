import { BoxEditorNormalImageRenderComp } from './canvas/box/BoxEditorNormalViewImageModeComp';
import { BoxEditorNormalHtmlRenderComp } from './canvas/box/BoxEditorNormalViewHtmlModeComp';
import { BoxEditorNormalTextRenderComp } from './canvas/box/BoxEditorNormalViewTextModeComp';
import { BoxEditorNormalBibleRenderComp } from './canvas/box/BoxEditorNormalViewBibleModeComp';
import { useCanvasItemContext } from './canvas/CanvasItem';
import { BoxEditorNormalVideoRenderComp } from './canvas/box/BoxEditorNormalViewVideoModeComp';
import { BoxEditorNormalAudioRenderComp } from './canvas/box/BoxEditorNormalViewAudioModeComp';
import { BoxEditorNormalYouTubeRenderComp } from './canvas/box/BoxEditorNormalViewYouTubeModeComp';
import { BoxEditorNormalWebsiteRenderComp } from './canvas/box/BoxEditorNormalViewWebsiteModeComp';
import { BoxEditorNormalCameraRenderComp } from './canvas/box/BoxEditorNormalViewCameraModeComp';

export default function CanvasItemRendererComp() {
    const canvasItem = useCanvasItemContext();
    switch (canvasItem.type) {
        case 'image':
            return <BoxEditorNormalImageRenderComp />;
        case 'video':
            return <BoxEditorNormalVideoRenderComp />;
        case 'audio':
            return <BoxEditorNormalAudioRenderComp />;
        case 'youtube':
            return <BoxEditorNormalYouTubeRenderComp />;
        case 'website':
            return <BoxEditorNormalWebsiteRenderComp />;
        case 'camera':
            return <BoxEditorNormalCameraRenderComp />;
        case 'text':
            return <BoxEditorNormalTextRenderComp />;
        case 'html':
            return <BoxEditorNormalHtmlRenderComp />;
        case 'bible':
            return <BoxEditorNormalBibleRenderComp />;
    }
    return null;
}
