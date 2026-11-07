import { useLayoutEffect, useRef } from 'react';

import type { CanvasItemHtmlPropsType } from '../CanvasItemHtml';
import CanvasItemHtml from '../CanvasItemHtml';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import { useCanvasItemSafeHtml } from '../canvasItemSafeHtmlHelpers';
import {
    genLyricGrowRoomAttr,
    LYRIC_GROW_ROOM_ATTR,
    scheduleLyricBoxGrow,
} from '../../../lyric-list/lyricBoxGrowHelpers';

export function BoxEditorNormalHtmlRenderComp() {
    const props = useCanvasItemPropsContext<CanvasItemHtmlPropsType>();
    const html = useCanvasItemSafeHtml(props.html);
    const boxRef = useRef<HTMLDivElement>(null);
    // In the markup too, not only here: a screen draws the slide as static
    // markup, with no effect run, and grows it once it is on the page.
    const growRoomAttr =
        props.lyricGrowRoom === undefined
            ? undefined
            : genLyricGrowRoomAttr(props.lyricGrowRoom);
    // A layout effect, so a song's part is grown before it is first painted
    // rather than shown cut for a frame.
    useLayoutEffect(() => {
        if (growRoomAttr !== undefined && boxRef.current !== null) {
            scheduleLyricBoxGrow(boxRef.current);
        }
    }, [html, growRoomAttr]);
    try {
        CanvasItemHtml.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    return (
        <div
            ref={boxRef}
            title={props.id.toString()}
            {...{ [LYRIC_GROW_ROOM_ATTR]: growRoomAttr }}
            style={{
                width: '100%',
                height: '100%',
                ...CanvasItemHtml.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: html,
            }}
        />
    );
}
