import { useCanvasItemContext } from '../CanvasItem';
import { BoxEditorNormalImageRenderComp } from './BoxEditorNormalViewImageModeComp';
import { BoxEditorNormalHtmlRenderComp } from './BoxEditorNormalViewHtmlModeComp';
import { BoxEditorNormalTextRender } from './BoxEditorNormalViewTextModeComp';
import { BoxEditorNormalBibleRender } from './BoxEditorNormalViewBibleModeComp';
import { BoxEditorNormalVideoRender } from './BoxEditorNormalViewVideoModeComp';
import { BoxEditorNormalAudioRender } from './BoxEditorNormalViewAudioModeComp';
import { BoxEditorNormalYouTubeRender } from './BoxEditorNormalViewYouTubeModeComp';
import { BoxEditorNormalWebsiteRender } from './BoxEditorNormalViewWebsiteModeComp';
import { BoxEditorNormalCameraRender } from './BoxEditorNormalViewCameraModeComp';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';

// The one and only place a canvas item's content is rendered inside the
// editor. `BoxEditorComp` keeps this at a fixed position in its children, so
// selecting/deselecting a box never changes the component type here — that is
// what stops a `<video>`/`<iframe>`/camera preview from being torn down and
// re-created (and visibly flashing) on every selection change.
export default function BoxEditorCanvasItemRenderComp() {
    const canvasItem = useCanvasItemContext();
    switch (canvasItem.type) {
        case 'image':
            return <BoxEditorNormalImageRenderComp />;
        case 'video':
            return <BoxEditorNormalVideoRender />;
        case 'audio':
            return <BoxEditorNormalAudioRender />;
        case 'youtube':
            return <BoxEditorNormalYouTubeRender />;
        case 'website':
            return <BoxEditorNormalWebsiteRender />;
        case 'camera':
            return <BoxEditorNormalCameraRender />;
        case 'text':
            return <BoxEditorNormalTextRender />;
        case 'html':
            return <BoxEditorNormalHtmlRenderComp />;
        case 'bible':
            return <BoxEditorNormalBibleRender />;
        default:
            return <BoxEditorNormalViewErrorRenderComp />;
    }
}
