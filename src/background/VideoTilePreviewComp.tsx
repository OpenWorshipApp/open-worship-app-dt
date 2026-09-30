import type { CSSProperties } from 'react';
import { useCallback } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import {
    playMediaElement,
    releaseMediaElementWhenDetached,
} from '../helper/mediaHelpers';
import { useVideoPoster } from './videoPosterHelpers';

// Long enough that dragging the mouse across a grid of tiles starts no
// players, short enough that the video answers the mouse.
export const HOVER_PLAY_DELAY = 120;

const MEDIA_STYLE: CSSProperties = {
    objectFit: 'cover',
    objectPosition: 'center center',
    pointerEvents: 'none',
};

// At rest a tile draws a PICTURE of the video's first frame, not the video:
// a `<video>` is a whole media player -- decoder, demuxer, frame pool, ~8 MB
// of it -- and a folder holds hundreds. The player is created for the one
// tile under the mouse, which is the only one that plays, and handed straight
// back when the mouse leaves or the tile scrolls away.
//
// Handing it back has to be explicit: taking the element out of the document
// does NOT free it (the renderer still counted 13k DOM nodes for videos
// scrolled past until a forced collection here), and Chromium refuses to
// create any more once a frame holds 1000.
//
// Shared by the Background Videos tab and the Foreground panel's Video Show,
// which lists its own folder of overlay clips the same way.
export default function VideoTilePreviewComp({
    src,
    isHovering,
    onDurationRead,
}: Readonly<{
    src: string;
    isHovering: boolean;
    onDurationRead?: (duration: number) => void;
}>) {
    const posterDataUrl = useVideoPoster(src);
    const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
        if (element === null) {
            return;
        }
        playMediaElement(element);
        // React 19 runs a ref callback's return value as its cleanup, which is
        // the one place that knows the element is on its way out.
        return () => {
            releaseMediaElementWhenDetached(element);
        };
    }, []);
    const onDurationReadRef = useAppCurrentRef(onDurationRead);
    const handleMetadataLoaded = useCallback((event: any) => {
        const { duration } = event.currentTarget as HTMLVideoElement;
        if (!Number.isNaN(duration)) {
            onDurationReadRef.current?.(duration);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (isHovering) {
        return (
            <video
                className="w-100 h-100"
                ref={handleVideoRef}
                loop
                muted
                autoPlay
                preload="auto"
                poster={posterDataUrl ?? undefined}
                src={src}
                style={MEDIA_STYLE}
                onLoadedMetadata={handleMetadataLoaded}
            />
        );
    }
    if (posterDataUrl === null) {
        // Its own frame is still being read; the tile keeps its blank card
        // rather than flashing something that is not this video.
        return null;
    }
    return (
        <img
            className="w-100 h-100"
            src={posterDataUrl}
            alt=""
            draggable={false}
            style={MEDIA_STYLE}
        />
    );
}
