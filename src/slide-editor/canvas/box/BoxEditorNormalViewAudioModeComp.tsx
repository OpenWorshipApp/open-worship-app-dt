import type { CSSProperties } from 'react';

import type { CanvasItemAudioPropsType } from '../CanvasItemAudio';
import CanvasItemAudio from '../CanvasItemAudio';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import { pathToFileURL } from '../../../server/calcHelpers';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import { PREVIEW_ONLY_ATTR } from '../../../helper/constants';
import { checkIsUrlMediaSource } from '../../../helper/mediaSourceHelpers';

export default function BoxEditorNormalViewAudioModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalAudioRender />
        </BoxEditorNormalWrapperComp>
    );
}

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
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    cursor: 'pointer',
                }}
            />
        </div>
    );
}
