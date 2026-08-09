import type { CanvasItemAudioPropsType } from '../CanvasItemAudio';
import CanvasItemAudio from '../CanvasItemAudio';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import { pathToFileURL } from '../../../server/calcHelpers';
import { PREVIEW_ONLY_ATTR } from '../../../helper/constants';
import { checkIsUrlMediaSource } from '../../../helper/mediaSourceHelpers';
import { calcAudioControlScale } from '../canvasHelpers';

export function BoxEditorNormalAudioRender() {
    const props = useCanvasItemPropsContext<CanvasItemAudioPropsType>();
    try {
        CanvasItemAudio.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    const audioSrc = checkIsUrlMediaSource(props.filePath)
        ? props.filePath
        : pathToFileURL(props.filePath);
    const controlScale = calcAudioControlScale(props.width, props.height);
    return (
        <div
            title={props.filePath}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                // Keep the box draggable in the editor: clicks must reach the
                // box editor, not the player (same as the video render). The
                // presenter re-enables pointer events on its mini screen, which
                // is where the operator clicks play.
                pointerEvents: 'none',
            }}
        >
            <audio
                // The player control is an operator affordance, not something
                // the congregation should see: the projected screen hides every
                // preview-only element, and `ScreenVaryAppDocumentManager` uses
                // the same mark to leave this file unloaded and unsynced there.
                {...{ [PREVIEW_ONLY_ATTR]: '' }}
                src={audioSrc}
                // Never stream on render — the file is only fetched once the
                // operator actually presses play.
                preload="none"
                controls
                style={{
                    // A bigger box on its own only stretches the empty pill —
                    // the control chrome is drawn at a fixed glyph size — so
                    // the box's size becomes a scale factor to actually grow
                    // the player. The element is LAID OUT at the box divided by
                    // that scale and then painted back up to full size, so the
                    // player covers the box exactly (the wrapper centers it and
                    // the default transform origin is its centre).
                    //
                    // `transform`, NOT `zoom`: Chromium positions the native
                    // controls' "⋮" overflow popup — which is UA shadow DOM —
                    // from `getBoundingClientRect()` pixels that then get
                    // re-resolved inside a `zoom`ed subtree, so it landed far
                    // outside the slide at several times its size. A transform
                    // leaves that math alone and the popup anchors to the
                    // control, which keeps the overflow menu usable.
                    width: `${props.width / controlScale}px`,
                    height: `${props.height / controlScale}px`,
                    display: 'block',
                    cursor: 'pointer',
                    transform: `scale(${controlScale})`,
                }}
            />
        </div>
    );
}
