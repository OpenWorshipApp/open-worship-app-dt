import { useCanvasItemContext } from '../CanvasItem';
import { BoxEditorNormalImageRenderComp } from './BoxEditorNormalViewImageModeComp';
import { BoxEditorNormalHtmlRenderComp } from './BoxEditorNormalViewHtmlModeComp';
import { BoxEditorNormalTextRenderComp } from './BoxEditorNormalViewTextModeComp';
import { BoxEditorNormalBibleRenderComp } from './BoxEditorNormalViewBibleModeComp';
import { BoxEditorNormalVideoRenderComp } from './BoxEditorNormalViewVideoModeComp';
import { BoxEditorNormalAudioRenderComp } from './BoxEditorNormalViewAudioModeComp';
import { BoxEditorNormalYouTubeRenderComp } from './BoxEditorNormalViewYouTubeModeComp';
import { BoxEditorNormalWebsiteRenderComp } from './BoxEditorNormalViewWebsiteModeComp';
import { BoxEditorNormalCameraRenderComp } from './BoxEditorNormalViewCameraModeComp';
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
        default:
            return <BoxEditorNormalViewErrorRenderComp />;
    }
}
